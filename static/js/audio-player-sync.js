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
        this._lastCountTime = null; // referencia para el contador de "reproducida"
    }

    /**
     * Inicializar sincronización del reproductor
     */
    init(audioElement) {
        this.audio = audioElement;
        if (!this.audio) {
            return;
        }


        // Listeners del reproductor
        this.audio.addEventListener('play', () => this.handlePlay());
        this.audio.addEventListener('pause', () => this.handlePause());
        this.audio.addEventListener('ended', () => this.handleEnded());
        this.audio.addEventListener('timeupdate', () => this.handleTimeUpdate());

        // Listeners de eventos personalizados
        document.addEventListener('playbackStateUpdated', (e) => this.handleStateUpdate(e));
        document.addEventListener('pageVisible', () => this.handlePageVisible());

        // (Detección de reproducción concurrente desactivada: sin bloqueo multi-dispositivo.)

        // Restaurar estado al cargar la página
        this.restorePlaybackState();

        // Iniciar guardado periódico de estado
        this.startPeriodicSave();

        // Volcar el estado exacto justo antes de salir/navegar (posición + play/pausa)
        window.addEventListener('pagehide', () => this.flushState());
    }

    /**
     * Manejar evento de reproducción
     */
    handlePlay() {
        this.updatePlaybackState(true);
        // Disparar evento para actualizar paneles
        document.dispatchEvent(new CustomEvent('playbackStateChanged'));
    }

    /**
     * Manejar evento de pausa
     */
    handlePause() {
        this.updatePlaybackState(false);
        // Disparar evento para actualizar paneles
        document.dispatchEvent(new CustomEvent('playbackStateChanged'));
    }

    /**
     * Manejar fin de canción
     */
    handleEnded() {
        this.stateManager.clearPlaybackState();
        this.saveToBackend(false);
    }

    /**
     * Manejar actualización de tiempo de reproducción
     */
    handleTimeUpdate() {
        // Cuenta la canción como "reproducida" tras 5 s de audio REAL escuchado.
        // El acumulador se persiste en sessionStorage para sobrevivir a la navegación
        // entre páginas (si cambias de página antes de los 5 s, sigue contando).
        if (!this.audio || !this.currentTrackId || this.audio.paused) return;

        const tid = String(this.currentTrackId);

        // Si la pista cambió respecto a la acumulada, empezar de cero.
        if (sessionStorage.getItem('soundmusik_count_track') !== tid) {
            this.resetPlayCount(tid);
        }

        // Ya contada en esta reproducción: nada que hacer.
        if (sessionStorage.getItem('soundmusik_count_done') === '1') return;

        // Primer tick (o primera vez tras navegar): fijar referencia y salir.
        if (this._lastCountTime == null) {
            this._lastCountTime = this.audio.currentTime;
            return;
        }

        let seconds = parseFloat(sessionStorage.getItem('soundmusik_count_seconds') || '0');
        const delta = this.audio.currentTime - this._lastCountTime;
        this._lastCountTime = this.audio.currentTime;

        // Solo suma el avance natural de la reproducción (ignora pausa y saltos/seeks).
        if (delta > 0 && delta < 1) {
            seconds += delta;
            sessionStorage.setItem('soundmusik_count_seconds', String(seconds));
        }

        if (seconds >= 5) {
            sessionStorage.setItem('soundmusik_count_done', '1');
            this.recordPlayCount(this.currentTrackId);
        }
    }

    /**
     * Reiniciar el acumulador de "reproducida" para una nueva reproducción.
     */
    resetPlayCount(trackId) {
        this._lastCountTime = null;
        sessionStorage.setItem('soundmusik_count_track', String(trackId));
        sessionStorage.setItem('soundmusik_count_seconds', '0');
        sessionStorage.removeItem('soundmusik_count_done');
    }

    /**
     * Registrar la reproducción en el backend (historial + estadísticas).
     */
    recordPlayCount(trackId) {
        fetch(`${this.apiBaseUrl}/api/add-to-history/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.getCsrfToken()
            },
            body: JSON.stringify({ song_id: trackId })
        })
        .then(() => {})
        .catch(() => {});
    }

    /**
     * Manejar actualización de estado desde otra pestaña
     */
    handleStateUpdate(event) {
        const newState = event.detail;

        if (!newState) {
            return;
        }

        // Si es la misma sesión, no hacer nada (ya está sincronizado)
        if (newState.sessionId === this.stateManager.sessionId) {
            return;
        }

        // Si no es sesión activa, ignorar
        if (!this.stateManager.isSessionActive()) {
            return;
        }

        this.restorePlaybackStateFromObject(newState);
    }

    /**
     * Manejar cuando la página se vuelve visible
     */
    handlePageVisible() {
        // No re-restauramos desde backend al volver a la pestaña: la canción ya está
        // cargada en esta pestaña y recargarla revertía los paneles a la sesión guardada
        // (mostraba "info de la sesión anterior").
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
        .catch(() => {});
    }

    /**
     * Fijar la posición de reproducción (y reproducir si procede) SOLO cuando el
     * audio tenga metadata. Si se asigna currentTime antes, el navegador la
     * reinicia a 0 (causa de que la canción empiece desde el principio).
     */
    seekAndMaybePlay(resumeAt, isPlaying) {
        const apply = () => {
            this.audio.currentTime = resumeAt;
            if (isPlaying) {
                this.audio.play().catch(() => {});
            } else {
            }
        };
        if (this.audio.readyState >= 1) {
            apply();
        } else {
            this.audio.addEventListener('loadedmetadata', apply, { once: true });
        }
    }

    /**
     * Volcar el estado actual al backend de forma fiable antes de salir/navegar.
     * fetch con keepalive completa la petición aunque la página se descargue,
     * así no se pierde la posición ni el estado play/pausa (evita reinicios y
     * que una canción pausada arranque sola en la página siguiente).
     */
    flushState() {
        if (!this.audio || !this.currentTrackId) return;
        const data = this.getCurrentTrackData();
        if (!data) return;

        fetch(`${this.apiBaseUrl}/api/playback/state/`, {
            method: 'POST',
            keepalive: true,
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
                is_playing: !this.audio.paused,
                device_info: this.getDeviceInfo()
            })
        }).catch(() => {});
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
        // Reanudar desde el backend (estado único por usuario): al volver a entrar
        // continúas con el mismo track y posición donde lo dejaste.
        this.restoreFromBackend();
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
                this.restoreFromBackendSession(data.session);
            }
        })
        .catch(() => {});
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

            // Actualizar footer y panel derecho con el MISMO render que al reproducir
            // (mantiene enlaces de artista del footer y deja ambos paneles consistentes).
            if (typeof updatePlayer === 'function') updatePlayer(trackData);
            if (typeof updateRightPanel === 'function') updateRightPanel(trackData);

            // Cargar audio y fijar la posición cuando haya metadata
            this.audio.src = trackData.audio_url;
            this.seekAndMaybePlay(session.current_time || 0, session.is_playing);
        })
        .catch(err => {
            // Fallback: intentar usar datos de localStorage
            const savedState = this.stateManager.getPlaybackState();
            if (savedState && savedState.trackData) {
                this.currentTrackId = session.track_id;
                document.getElementById('track-title').innerText = savedState.trackData.title;
                document.getElementById('track-artist').innerText = savedState.trackData.artist;
                document.getElementById('track-art').src = savedState.trackData.cover;
                this.audio.src = savedState.trackData.url;
                this.seekAndMaybePlay(session.current_time || 0, session.is_playing);
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
        this.seekAndMaybePlay(state.currentTime || 0, state.isPlaying);
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

    }

    /**
     * Detener guardado periódico
     */
    stopPeriodicSave() {
        if (this.saveIntervalId) {
            clearInterval(this.saveIntervalId);
            this.saveIntervalId = null;
        }
    }

    /**
     * Establecer track actual (llamar desde loadSong)
     */
    setCurrentTrack(trackId, trackData) {
        this.currentTrackId = trackId;
        // Reproducción nueva: reiniciar el contador de "reproducida".
        this.resetPlayCount(trackId);
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
