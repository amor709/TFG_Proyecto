async function playSongA(trackId) {
    try {
        const url = `/music/api/track/${trackId}/`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: No se pudo cargar la canción`);
        }

        const trackData = await response.json();

        // Validar que los datos sean completos
        if (!trackData.audio_url) {
            throw new Error('La canción no tiene archivo de audio');
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
                alert('No se pudo reproducir el audio. Intenta de nuevo.');
            });
        };

        // (El conteo de "reproducida" se gestiona de forma central en
        //  audio-player-sync.js, para que sobreviva a la navegación entre páginas.)
        audio.ontimeupdate = function() {
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

         // Agregar a historial del sistema de cola (para autoplay)
         if (typeof queueSystem !== 'undefined' && queueSystem) {
             queueSystem.addToHistory(trackId);
         }

         // (Ya no guardamos la canción en localStorage('currentTrack'): era por navegador
         //  y filtraba la info entre usuarios en el panel derecho.)

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

         // Sincronizar botón del player y badge del panel derecho con el nuevo track
         setTimeout(() => {
             if (window.likedSongsManager && trackData.id) {
                 window.likedSongsManager.syncPlayer(trackData.id);
             }
         }, 50);

    } catch (error) {
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
        const response = await fetch(`/music/api/suggested-tracks/${trackId}/`);
        

        if (!response.ok) {
            return;
        }

        const data = await response.json();
        
        const suggestedIds = data.suggested_ids || [];

        if (suggestedIds.length > 0) {
            // Agregar las sugerencias a la cola
            if (typeof queueSystem !== 'undefined' && queueSystem) {
                queueSystem.addMultipleToQueue(suggestedIds);
                
                // Forzar actualización inmediata de la cola en el DOM
                // Pequeño delay para asegurar que addMultipleToQueue completó
                await new Promise(resolve => setTimeout(resolve, 50));
                if (typeof queueSystem !== 'undefined' && queueSystem.loadQueueHTML) {
                    await queueSystem.loadQueueHTML();
                }
            } else {
            }
        } else {
            // Si no hay sugerencias Y es reproducción manual, mostrar "vacía"
            if (isManualPlay) {
                const queueList = document.getElementById('queue-list');
                if (queueList) {
                    queueList.innerHTML = '<li class="queue-empty">La cola está vacía.</li>';
                }
            }
        }

        // Garantizar que la cola arranque con al menos 10 canciones (por tags)
        if (typeof queueSystem !== 'undefined' && queueSystem) {
            await queueSystem.ensureQueueMinimum(trackId);
        }
    } catch (error) {
        // Si hay error, continuaré sin sugerencias (no es crítico)
    }
}

// Aqui se cambia el player
function updatePlayer(trackData) {
    // Validar que trackData exista y tenga las propiedades necesarias
    if (!trackData || !trackData.title || !trackData.artist) {
        return;
    }

    const trackArtImg = document.getElementById('track-art');
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');

    if (trackArtImg) trackArtImg.src = trackData.cover || '/static/img/logo.png';
    if (trackTitle) trackTitle.textContent = trackData.title;

    // Nombres de artistas como enlaces a sus perfiles (principal + colaboradores)
    if (trackArtist) {
        if (Array.isArray(trackData.artists) && trackData.artists.length) {
            trackArtist.innerHTML = trackData.artists.map(a =>
                `<a href="/music/artist/${a.id}/" class="player__artist-link">${escapeHtml(a.name)}</a>`
            ).join(',&nbsp;');
        } else {
            trackArtist.textContent = trackData.artist;
        }
    }

    // Álbum actual (para que la carátula/título del footer lleven a su álbum; null si es single)
    window.currentTrackAlbumId = trackData.album_id || null;

}

// Aqui se cambia el panel derecho (SOLO la sección superior)
function updateRightPanel(trackData) {
    // Actualizar SOLO la sección superior (.right-panel__top)
    // La sección inferior (.right-panel__bottom) con la cola se mantiene intacta
    // Esto es FUNDAMENTAL para que la cola no desaparezca
    const topPanel = document.querySelector('.right-panel__top');

    if (!topPanel) {
        return;
    }

    // Validar que trackData y sus propiedades principales existan
    if (!trackData || !trackData.title || !trackData.artist) {
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
                    <a href="/music/artist/${trackData.related_artist.id}/" class="related__artist-photo-link" aria-label="Ver perfil de ${escapeHtml(trackData.related_artist.name)}">
                        <img src="${escapeHtml(trackData.related_artist.photo || '/static/img/userdefault.png')}"
                             alt="${escapeHtml(trackData.related_artist.name)}"
                             class="related__artist-photo"
                             loading="lazy">
                    </a>
                    <div class="related__artist-info">
                         <span class="related__artist-name">${escapeHtml(trackData.related_artist.name)}</span>
                         ${window.CURRENT_USER_IS_ARTIST ? '' : `<button id="artist-follow-btn"
                                 class="btn-follow btn--not-following"
                                 data-artist-id="${trackData.related_artist.id}"
                                 aria-label="Seguir a ${escapeHtml(trackData.related_artist.name)}">
                             + Seguir
                         </button>`}
                     </div>
                </div>
            </div>
        `;
    }

    // Actualizar SOLO el contenido de .right-panel__top (NO afecta .right-panel__bottom que contiene la cola)
    topPanel.innerHTML = html;
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
