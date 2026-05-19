async function playSongA(trackId) {
    try {
        console.log('🎵 Intentando reproducir canción ID:', trackId);
        const url = `/music/api/track/${trackId}/`;
        console.log('URL de fetch:', url);

        const response = await fetch(url);
        console.log('ℹRespuesta status:', response.status);

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: No se pudo cargar la canción`);
        }

        const trackData = await response.json();
        console.log(' Datos de la canción recibidos:', trackData);

        // Validar que los datos sean completos
        if (!trackData.audio_url) {
            throw new Error('La canción no tiene archivo de audio');
        }

        console.log('🔊 URL del audio:', trackData.audio_url);

        // Cancelar cualquier temporizador de historial anterior
        if (window.historyTimer) {
            clearTimeout(window.historyTimer);
            window.historyTimer = null;
        }

        // Actualizar interfaz del reproductor y panel derecho
        updatePlayer(trackData);
        updateRightPanel(trackData);

        // Cargar y reproducir el audio
        const audio = document.getElementById('main-audio');
        if (!audio) {
            throw new Error('No se encontró el elemento de audio (main-audio)');
        }

        audio.src = trackData.audio_url;

        // Esperar a que el audio esté listo antes de reproducir
        audio.oncanplay = function() {
            audio.play().catch(err => {
                console.error(' Error al reproducir audio:', err);
                alert('No se pudo reproducir el audio. Intenta de nuevo.');
            });
        };

        // Configurar temporizador para agregar al historial después de 20 segundos de reproducción
        let timerStarted = false;
        audio.ontimeupdate = function() {
            if (audio.duration && !timerStarted && audio.currentTime >= 1) { // Empezar timer después de 1 segundo de reproducción
                timerStarted = true;
                console.log('Iniciando temporizador de historial (20 segundos)');
                window.historyTimer = setTimeout(async () => {
                    try {
                        console.log('📝 Agregando canción al historial después de 20 segundos de reproducción');
                        const historyResponse = await fetch('/accounts/api/add-to-history/', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': getCsrfToken()
                            },
                            body: JSON.stringify({ song_id: trackId })
                        });

                        if (historyResponse.ok) {
                            const responseData = await historyResponse.json();
                            console.log('Canción agregada al historial de escucha:', responseData);
                        } else {
                            console.error('Error al agregar canción al historial:', historyResponse.status, historyResponse.statusText);
                        }
                    } catch (error) {
                        console.error('Error en temporizador de historial:', error);
                    }
                }, 20000); // 20 segundos
            }

            // Actualizar barra de progreso visual
            if (audio.duration) {
                const progress = (audio.currentTime / audio.duration) * 100;
                document.documentElement.style.setProperty('--progress', progress + '%');

                // Actualizar slider
                const seekSlider = document.getElementById('seek-slider');
                if (seekSlider) {
                    seekSlider.value = progress;
                }

                // Actualizar tiempos
                updateTimeDisplay(audio.currentTime, audio.duration);
            }
        };

        // Actualizar duración cuando se carga el metadata
        audio.onloadedmetadata = function() {
            updateTimeDisplay(0, audio.duration);
        };

        // Cargar el audio
        audio.load();

         // Guardar en persistencia si está disponible
         if (typeof audioPlayerSync !== 'undefined' && audioPlayerSync) {
             audioPlayerSync.setCurrentTrack(trackId, {
                 title: trackData.title,
                 artist: trackData.artist,
                 cover: trackData.cover,
                 url: trackData.audio_url
             });
         }

         // ⭐ Agregar a historial del sistema de cola (para autoplay)
         if (typeof queueSystem !== 'undefined' && queueSystem) {
             queueSystem.addToHistory(trackId);
             console.log('📝 Canción agregada al historial del queue system:', trackId);
         }

         // Guardar información de la canción actual en localStorage
         saveCurrentTrackToStorage(trackData);

        // Gestión de la cola tras reproducir una canción.
        // - Si viene de la cola/álbum/artista: la cola ya está preparada por
        //   quien disparó la reproducción (playTrackWithAlbum, playTrackFromArtist,
        //   onTrackFinished, playQueueTrackAt). No tocar.
        // - Si es reproducción manual (single suelto): vaciar y precargar sugerencias
        //   por los tags de esta canción.
        if (typeof queueSystem !== 'undefined' && queueSystem) {
            const isPlayingFromQueue = window.__isPlayingFromQueue === true;
            window.__isPlayingFromQueue = false;

            if (!isPlayingFromQueue) {
                queueSystem.queue = [];
                queueSystem.fromAlbum = false;
                queueSystem.currentAlbumId = null;
                queueSystem.saveQueueToStorage();
                await loadSuggestedTracksToQueue(trackId, true);
            }
        }

         // Disparar evento para actualizar paneles (DESPUÉS de cargar sugerencias)
         document.dispatchEvent(new CustomEvent('trackChanged', {
             detail: {
                 id: trackData.id,
                 title: trackData.title,
                 artist: trackData.artist,
                 artist_id: trackData.artist_id,
                 cover: trackData.cover
             }
         }));

         // Actualizar inmediatamente el icono del diamond y botón del player
         setTimeout(() => {
             if (typeof likedSongsManager !== 'undefined' && likedSongsManager && trackData.id) {
                 const isLiked = likedSongsManager.likedSongs.has(trackData.id);
                 console.log(`🎵 Actualizando iconos para la canción ${trackData.id}: ${isLiked ? 'Liked' : 'Not liked'}`);

                 // Actualizar el icono del diamond del panel derecho
                 likedSongsManager.updateDiamondInfoIcons(trackData.id, isLiked);

                 // Actualizar el botón del player
                 const playerLikeBtn = document.querySelector('#player-like-btn');
                 if (playerLikeBtn) {
                     playerLikeBtn.dataset.songId = trackData.id;
                     likedSongsManager.updateLikeButton(playerLikeBtn, isLiked);
                 }
             }
         }, 50);

    } catch (error) {
        console.error('❌ Error en playSongA:', error.message);
        alert('Error: ' + error.message);
    }
}

/**
 * Cargar canciones sugeridas en la cola después de reproducir una canción
 * @param trackId - ID de la canción actual
 * @param isManualPlay - Si es true, significa que fue clickeada manualmente (no automático desde cola)
 */
async function loadSuggestedTracksToQueue(trackId, isManualPlay = true) {
    try {
        console.log('🔍 Buscando canciones sugeridas para:', trackId);
        const response = await fetch(`/music/api/suggested-tracks/${trackId}/`);
        
        console.log('📡 Respuesta del endpoint suggested-tracks:', response.status, response.statusText);

        if (!response.ok) {
            console.warn(`Error en endpoint: HTTP ${response.status}`);
            return;
        }

        const data = await response.json();
        console.log('Respuesta JSON:', data);
        
        const suggestedIds = data.suggested_ids || [];

        if (suggestedIds.length > 0) {
            console.log('Canciones sugeridas cargadas:', suggestedIds);
            // Agregar las sugerencias a la cola
            if (typeof queueSystem !== 'undefined' && queueSystem) {
                console.log('➕ Agregando', suggestedIds.length, 'canciones a la cola');
                queueSystem.addMultipleToQueue(suggestedIds);
                console.log('✅ Canciones agregadas. Cola actual:', queueSystem.queue);
                
                // Forzar actualización inmediata de la cola en el DOM
                console.log('🎨 Forzando renderizado de la cola...');
                // Pequeño delay para asegurar que addMultipleToQueue completó
                await new Promise(resolve => setTimeout(resolve, 50));
                if (typeof queueSystem !== 'undefined' && queueSystem.loadQueueHTML) {
                    await queueSystem.loadQueueHTML();
                    console.log('✅ Cola renderizada en el DOM');
                }
            } else {
                console.warn('⚠️ queueSystem no disponible para agregar sugerencias');
            }
        } else {
            console.log(' No hay canciones sugeridas disponibles');
            // Si no hay sugerencias Y es reproducción manual, mostrar "vacía"
            if (isManualPlay) {
                const queueList = document.getElementById('queue-list');
                if (queueList) {
                    queueList.innerHTML = '<li class="queue-empty">La cola está vacía.</li>';
                    console.log('Cola vacía: sin sugerencias disponibles');
                }
            }
        }
    } catch (error) {
        console.error('❌ Error al cargar canciones sugeridas:', error);
        // Si hay error, continuaré sin sugerencias (no es crítico)
    }
}

// Aqui se cambia el player
function updatePlayer(trackData) {
    // Validar que trackData exista y tenga las propiedades necesarias
    if (!trackData || !trackData.title || !trackData.artist) {
        console.warn('trackData incompleto para actualizar player');
        return;
    }

    const trackArtImg = document.getElementById('track-art');
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');

    if (trackArtImg) trackArtImg.src = trackData.cover || '/static/img/logo.png';
    if (trackTitle) trackTitle.textContent = trackData.title;
    if (trackArtist) trackArtist.textContent = trackData.artist;

    console.log(`Player actualizado: ${trackData.title} - ${trackData.artist}`);
}

// Aqui se cambia el panel derecho (SOLO la sección superior)
function updateRightPanel(trackData) {
    // Actualizar SOLO la sección superior (.right-panel__top)
    // La sección inferior (.right-panel__bottom) con la cola se mantiene intacta
    // Esto es FUNDAMENTAL para que la cola no desaparezca
    const topPanel = document.querySelector('.right-panel__top');

    if (!topPanel) {
        console.warn('❌ .right-panel__top no encontrado en el DOM');
        return;
    }

    // Validar que trackData y sus propiedades principales existan
    if (!trackData || !trackData.title || !trackData.artist) {
        console.warn('⚠️ trackData incompleto para actualizar panel derecho', trackData);
        return;
    }

    // Construir HTML seguro para la sección superior
    let html = `
        <div class="right-panel__album-cover">
            <img src="${escapeHtml(trackData.cover || '/static/img/logo.png')}"
                 alt="${escapeHtml(trackData.title)}"
                 class="album-cover__img"
                 loading="lazy">
        </div>
        
        <div class="right-panel__track-info">
            <h3 class="track-info__title">${escapeHtml(trackData.title)}</h3>
            <div class="track-info__meta">
                ${window.CURRENT_USER_IS_ARTIST ? '' : '<img src="/static/img/diamond-white.png" alt="" class="icon--xs" id="artist-badge-info">'}
                <span class="track-info__artist">${escapeHtml(trackData.artist)}</span>
            </div>
        </div>
    `;

    // Agregar sección de artista relacionado solo si existe y tiene datos válidos
    if (trackData.related_artist && trackData.related_artist.id && trackData.related_artist.name) {
        html += `
            <div class="right-panel__related">
                <h4 class="related__heading">Cancioncita de…</h4>
                <div class="related__artist-card">
                    <img src="${escapeHtml(trackData.related_artist.photo || '/static/img/artist-placeholder.png')}" 
                         alt="${escapeHtml(trackData.related_artist.name)}" 
                         class="related__artist-photo"
                         loading="lazy">
                    <div class="related__artist-info">
                         <span class="related__artist-name">${escapeHtml(trackData.related_artist.name)}</span>
                         <button id="artist-follow-btn" 
                                 class="btn-follow btn--not-following" 
                                 data-artist-id="${trackData.related_artist.id}" 
                                 aria-label="Seguir a ${escapeHtml(trackData.related_artist.name)}">
                             + Seguir
                         </button>
                     </div>
                </div>
            </div>
        `;
    }

    // Actualizar SOLO el contenido de .right-panel__top (NO afecta .right-panel__bottom que contiene la cola)
    topPanel.innerHTML = html;
    console.log('✅ Sección superior del panel derecho actualizada:', {
        title: trackData.title,
        artist: trackData.artist,
        hasRelatedArtist: !!trackData.related_artist
    });
}

// Función auxiliar para escapar HTML y prevenir inyecciones
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Función para obtener el token CSRF
function getCsrfToken() {
    const name = 'csrftoken';
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Función para guardar la información de la canción actual en localStorage
function saveCurrentTrackToStorage(trackData) {
    if (!trackData) return;

    const trackInfo = {
        id: trackData.id,
        title: trackData.title,
        artist: trackData.artist,
        cover: trackData.cover,
        related_artist: trackData.related_artist,
        timestamp: Date.now()
    };

    localStorage.setItem('currentTrack', JSON.stringify(trackInfo));
    console.log('Información de canción guardada en localStorage:', trackInfo);
}

// Función para recuperar la información de la canción actual del localStorage
function getCurrentTrackFromStorage() {
    try {
        const stored = localStorage.getItem('currentTrack');
        if (!stored) return null;

        const trackInfo = JSON.parse(stored);

        // Verificar que no sea demasiado antigua (más de 24 horas)
        const age = Date.now() - trackInfo.timestamp;
        if (age > 24 * 60 * 60 * 1000) { // 24 horas en milisegundos
            localStorage.removeItem('currentTrack');
            return null;
        }

        return trackInfo;
    } catch (error) {
        console.error('Error al recuperar canción del localStorage:', error);
        return null;
    }
}

// Función para restaurar el panel derecho con la información guardada
function restoreRightPanelFromStorage() {
    const trackData = getCurrentTrackFromStorage();
    if (trackData) {

        updateRightPanel(trackData);
    } else {
        console.log(' No hay canción guardada para restaurar');
    }
}
