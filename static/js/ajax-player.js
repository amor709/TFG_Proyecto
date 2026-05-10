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

        // Disparar evento para actualizar paneles
        document.dispatchEvent(new CustomEvent('trackChanged'));

        // Guardar información de la canción actual en localStorage
        saveCurrentTrackToStorage(trackData);

    } catch (error) {
        console.error('❌ Error en playSongA:', error.message);
        alert('Error: ' + error.message);
    }
}

// Aqui se cambia el player
function updatePlayer(trackData) {
    // Validar que trackData exista y tenga las propiedades necesarias
    if (!trackData || !trackData.title || !trackData.artist) {
        console.warn('⚠trackData incompleto para actualizar player');
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

// Aqui se cambia el panel derecho
function updateRightPanel(trackData) {
    const rightPanel = document.querySelector('.right-panel');

    if (!rightPanel) return;

    // Validar que trackData y sus propiedades principales existan
    if (!trackData || !trackData.title || !trackData.artist) {
        console.warn('trackData incompleto para actualizar panel derecho');
        return;
    }

    // Construir HTML seguro usando template literal
    let html = `
        <div class="right-panel__album-cover">
            <img src="${trackData.cover || '/static/img/logo.png'}" alt="${trackData.title}" class="album-cover__img">
            <p class="album-cover__title">${trackData.title}</p>
        </div>
        
        <div class="right-panel__track-info">
            <h3 class="track-info__title">${trackData.title}</h3>
            <div class="track-info__meta">
                <img src="/static/img/diamond-white.png" alt="" class="icon--xs">
                <span class="track-info__artist">${trackData.artist}</span>
            </div>
        </div>
    `;

    // Agregar sección de artista relacionado solo si existe y tiene datos válidos
    if (trackData.related_artist && trackData.related_artist.id && trackData.related_artist.name) {
        html += `
            <div class="right-panel__related">
                <h4 class="related__heading">Cancioncita de…</h4>
                <div class="related__artist-card">
                    <img src="${trackData.related_artist.photo || '/static/img/artist-placeholder.png'}" 
                         alt="${trackData.related_artist.name}" 
                         class="related__artist-photo">
                    <div class="related__artist-info">
                        <span class="related__artist-name">${trackData.related_artist.name}</span>
                        <button class="btn-follow" 
                                data-artist-id="${trackData.related_artist.id}" 
                                aria-label="Seguir a ${trackData.related_artist.name}">
                            + Seguir
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    rightPanel.innerHTML = html;
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
