/**
 * audio-player-sync.js
 * Integración del reproductor de audio con sistema de persistencia de estado
 * - Guarda periódicamente el estado del reproductor
 * - Restaura el estado al cargar la página
 * - Sincroniza entre pestañas
 * - Interactúa con backend para control de sesiones concurrentes
 */

class AudioPlayerSync {
    constructor() {
        this.audio = null;
        this.stateManager = playbackStateManager;
        this.saveInterval = 2000; // Guardar estado cada 2 segundos
        this.saveIntervalId = null;
        this.currentTrackId = null;
        this.apiBaseUrl = '/accounts';
        this.lastSavedState = null;
    }

    /**
     * Inicializar sincronización del reproductor
     */
    init(audioElement) {
        this.audio = audioElement;
        if (!this.audio) {
            console.error('❌ Elemento de audio no encontrado');
            return;
        }

        console.log('🎧 Inicializando Audio Player Sync...');

        // Listeners del reproductor
        this.audio.addEventListener('play', () => this.handlePlay());
        this.audio.addEventListener('pause', () => this.handlePause());
        this.audio.addEventListener('ended', () => this.handleEnded());
        this.audio.addEventListener('timeupdate', () => this.handleTimeUpdate());

        // Listeners de eventos personalizados
        document.addEventListener('playbackStateUpdated', (e) => this.handleStateUpdate(e));
        document.addEventListener('pageVisible', () => this.handlePageVisible());

        // Verificar sesiones concurrentes periódicamente
        setInterval(() => this.checkConcurrentSessions(), 5000);

        // Restaurar estado al cargar la página
        this.restorePlaybackState();

        // Iniciar guardado periódico de estado
        this.startPeriodicSave();
    }

    /**
     * Manejar evento de reproducción
     */
    handlePlay() {
        console.log('▶️ Reproducción iniciada');
        this.updatePlaybackState(true);
        // Disparar evento para actualizar paneles
        document.dispatchEvent(new CustomEvent('playbackStateChanged'));
    }

    /**
     * Manejar evento de pausa
     */
    handlePause() {
        console.log('⏸️  Reproducción pausada');
        this.updatePlaybackState(false);
        // Disparar evento para actualizar paneles
        document.dispatchEvent(new CustomEvent('playbackStateChanged'));
    }

    /**
     * Manejar fin de canción
     */
    handleEnded() {
        console.log('✅ Canción terminada');
        this.stateManager.clearPlaybackState();
        this.saveToBackend(false);
    }

    /**
     * Manejar actualización de tiempo de reproducción
     */
    handleTimeUpdate() {
        // No hacer nada aquí, se guarda en el intervalo
    }

    /**
     * Manejar actualización de estado desde otra pestaña
     */
    handleStateUpdate(event) {
        const newState = event.detail;

        if (!newState) {
            console.log('📭 Sin estado de reproducción');
            return;
        }

        // Si es la misma sesión, no hacer nada (ya está sincronizado)
        if (newState.sessionId === this.stateManager.sessionId) {
            return;
        }

        // Si no es sesión activa, ignorar
        if (!this.stateManager.isSessionActive()) {
            console.log('🚫 Esta no es la sesión activa, ignorando actualización');
            return;
        }

        console.log('🔄 Restaurando estado desde otra pestaña:', newState);
        this.restorePlaybackStateFromObject(newState);
    }

    /**
     * Manejar cuando la página se vuelve visible
     */
    handlePageVisible() {
        console.log('👀 Página vuelve a estar visible, restaurando estado...');
        this.restorePlaybackState();
    }

    /**
     * Verificar sesiones concurrentes
     */
    checkConcurrentSessions() {
        fetch(`${this.apiBaseUrl}/api/playback/check-concurrent/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            },
            body: JSON.stringify({
                session_id: this.stateManager.sessionId
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.has_concurrent) {
                console.warn(
                    '⚠️  Reproducción concurrente detectada en: ' +
                    data.other_session.device_info
                );
                // Pausar reproducción en esta sesión
                if (this.audio && !this.audio.paused) {
                    this.audio.pause();
                    console.log('🛑 Reproducción pausada (sesión concurrente)');
                }
            }
        })
        .catch(err => console.error('Error verificando sesiones concurrentes:', err));
    }

    /**
     * Actualizar estado de reproducción actual
     */
    updatePlaybackState(isPlaying = false) {
        if (!this.currentTrackId || !this.audio) {
            return;
        }

        const trackData = this.getCurrentTrackData();
        if (trackData) {
            this.stateManager.savePlaybackState(
                this.currentTrackId,
                this.audio.currentTime,
                isPlaying,
                trackData
            );

            // También guardar en backend
            this.saveToBackend(isPlaying, trackData);
        }
    }

    /**
     * Obtener datos de la canción actual (desde el DOM)
     */
    getCurrentTrackData() {
        const titleEl = document.getElementById('track-title');
        const artistEl = document.getElementById('track-artist');
        const artEl = document.getElementById('track-art');

        if (titleEl && artistEl && artEl) {
            return {
                title: titleEl.innerText,
                artist: artistEl.innerText,
                cover: artEl.src,
                url: this.audio?.src || ''
            };
        }
        return null;
    }

    /**
     * Guardar estado en backend
     */
    saveToBackend(isPlaying, trackData = null) {
        if (!this.audio) return;

        const data = trackData || this.getCurrentTrackData();
        if (!data) return;

        fetch(`${this.apiBaseUrl}/api/playback/state/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            },
            body: JSON.stringify({
                session_id: this.stateManager.sessionId,
                track_id: this.currentTrackId,
                track_title: data.title,
                track_artist: data.artist,
                current_time: this.audio.currentTime,
                is_playing: isPlaying,
                device_info: this.getDeviceInfo()
            })
        })
        .catch(err => console.error('Error guardando estado en backend:', err));
    }

    /**
     * Obtener información del dispositivo
     */
    getDeviceInfo() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        return 'Navegador desconocido';
    }

    /**
     * Obtener token CSRF
     */
    getCsrfToken() {
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

    /**
     * Restaurar estado de reproducción guardado
     */
    restorePlaybackState() {
        const state = this.stateManager.getPlaybackState();

        if (!state) {
            console.log('ℹ️  No hay estado de reproducción guardado');
            // Intentar recuperar del backend
            this.restoreFromBackend();
            return;
        }

        if (!this.stateManager.isSessionActive()) {
            console.log('⚠️  No es la sesión activa, no restaurando');
            return;
        }

        console.log('📂 Restaurando estado de reproducción:', state);
        this.restorePlaybackStateFromObject(state);
    }

    /**
     * Restaurar estado desde backend
     */
    restoreFromBackend() {
        fetch(`${this.apiBaseUrl}/api/playback/get/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.session && data.session.track_id) {
                console.log('📂 Restaurando estado desde backend:', data.session);
                this.restoreFromBackendSession(data.session);
            }
        })
        .catch(err => console.error('Error restaurando desde backend:', err));
    }

    /**
     * Restaurar desde sesión del backend
     */
    restoreFromBackendSession(session) {
        if (!session || !this.audio || !session.track_id) return;

        // Obtener datos completos de la canción desde el backend
        fetch(`/music/api/track/${session.track_id}/`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Canción no encontrada');
            }
            return response.json();
        })
        .then(trackData => {
            this.currentTrackId = session.track_id;

            // Actualizar UI
            document.getElementById('track-title').innerText = trackData.title;
            document.getElementById('track-artist').innerText = trackData.artist;
            document.getElementById('track-art').src = trackData.cover;

            // Cargar audio
            this.audio.src = trackData.audio_url;
            this.audio.currentTime = session.current_time || 0;

            // Reproducir automáticamente si estaba reproduciéndose
            if (session.is_playing) {
                console.log('▶️ Continuando reproducción desde:', this.audio.currentTime + 's');
                this.audio.play().catch(err => {
                    console.error('❌ Error al reproducir:', err);
                });
            } else {
                console.log('⏸️  Canción cargada en pausa, posición:', this.audio.currentTime + 's');
            }
        })
        .catch(err => {
            console.error('Error obteniendo datos de la canción:', err);
            // Fallback: intentar usar datos de localStorage
            const savedState = this.stateManager.getPlaybackState();
            if (savedState && savedState.trackData) {
                this.currentTrackId = session.track_id;
                document.getElementById('track-title').innerText = savedState.trackData.title;
                document.getElementById('track-artist').innerText = savedState.trackData.artist;
                document.getElementById('track-art').src = savedState.trackData.cover;
                this.audio.src = savedState.trackData.url;
                this.audio.currentTime = session.current_time || 0;

                if (session.is_playing) {
                    this.audio.play().catch(err => console.error('❌ Error al reproducir:', err));
                }
            }
        });
    }

    /**
     * Restaurar estado desde un objeto
     */
    restorePlaybackStateFromObject(state) {
        if (!state || !this.audio) {
            return;
        }

        // Establecer track ID actual
        this.currentTrackId = state.trackId;

        // Cargar la canción
        if (state.trackData) {
            document.getElementById('track-title').innerText = state.trackData.title;
            document.getElementById('track-artist').innerText = state.trackData.artist;
            document.getElementById('track-art').src = state.trackData.cover;
        }

        this.audio.src = state.trackData?.url || '';
        this.audio.currentTime = state.currentTime || 0;

        // Si estaba reproduciéndose, continuar desde donde estaba
        if (state.isPlaying) {
            console.log('▶️ Continuando reproducción desde:', this.audio.currentTime + 's');
            this.audio.play().catch(err => {
                console.error('❌ Error al reproducir:', err);
            });
        } else {
            console.log('⏸️  Pausa restaurada, posición:', this.audio.currentTime + 's');
        }
    }

    /**
     * Iniciar guardado periódico de estado
     */
    startPeriodicSave() {
        this.saveIntervalId = setInterval(() => {
            if (!this.audio) return;

            // Solo guardar si está reproduciéndose o si hay un track cargado
            if (!this.audio.paused || this.audio.src) {
                this.updatePlaybackState(!this.audio.paused);
            }
        }, this.saveInterval);

        console.log('💾 Guardado periódico de estado iniciado (cada ' + this.saveInterval + 'ms)');
    }

    /**
     * Detener guardado periódico
     */
    stopPeriodicSave() {
        if (this.saveIntervalId) {
            clearInterval(this.saveIntervalId);
            this.saveIntervalId = null;
            console.log('⏹️  Guardado periódico detenido');
        }
    }

    /**
     * Establecer track actual (llamar desde loadSong)
     */
    setCurrentTrack(trackId, trackData) {
        this.currentTrackId = trackId;
        this.stateManager.savePlaybackState(
            trackId,
            0,
            false,
            trackData
        );
        this.saveToBackend(false, trackData);
    }
}

// Crear instancia global
const audioPlayerSync = new AudioPlayerSync();

// Inicializar cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    const audioElement = document.getElementById('main-audio');
    if (audioElement) {
        audioPlayerSync.init(audioElement);
    }
});
