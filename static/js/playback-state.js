/**
 * playback-state.js
 * Sistema de persistencia de estado de reproducción entre navegación de páginas
 * - Guarda: track ID, tiempo actual, estado (playing/paused)
 * - Sincroniza: entre diferentes pestañas/ventanas del mismo usuario
 * - Controla: sesiones concurrentes (un usuario, un reproductor activo)
 */

class PlaybackStateManager {
    constructor() {
        this.STORAGE_KEY = 'soundmusik_playback_state';
        this.SESSION_ID_KEY = 'soundmusik_session_id';
        this.LAST_ACTIVITY_KEY = 'soundmusik_last_activity';
        this.SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutos

        this.sessionId = this.getOrCreateSessionId();
        this.isActiveSession = false;

        // Inicializar listeners
        this.initListeners();
    }

    /**
     * Obtener o crear ID de sesión único para esta pestaña
     */
    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem(this.SESSION_ID_KEY);
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem(this.SESSION_ID_KEY, sessionId);
        }
        return sessionId;
    }

    /**
     * Inicializar listeners para sincronización entre pestañas
     */
    initListeners() {
        // Escuchar cambios de storage (otras pestañas)
        window.addEventListener('storage', (e) => this.handleStorageChange(e));

        // Detectar cambios de visibilidad de página
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });

        // Detectar inactividad
        document.addEventListener('mousemove', () => this.updateLastActivity());
        document.addEventListener('keydown', () => this.updateLastActivity());
        document.addEventListener('click', () => this.updateLastActivity());
    }

    /**
     * Guardar estado actual de reproducción
     */
    savePlaybackState(trackId, currentTime, isPlaying, trackData) {
        const state = {
            trackId: trackId,
            currentTime: currentTime,
            isPlaying: isPlaying,
            timestamp: Date.now(),
            sessionId: this.sessionId,
            trackData: trackData // {title, artist, cover, url}
        };

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
        sessionStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());

        console.log('🎵 Estado de reproducción guardado:', state);
    }

    /**
     * Obtener estado guardado de reproducción
     */
    getPlaybackState() {
        const state = localStorage.getItem(this.STORAGE_KEY);
        return state ? JSON.parse(state) : null;
    }

    /**
     * Limpiar estado de reproducción
     */
    clearPlaybackState() {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('🗑️  Estado de reproducción borrado');
    }

    /**
     * Verificar si esta sesión es la activa para reproducción
     */
    isSessionActive() {
        const state = this.getPlaybackState();
        if (!state) return true; // Si no hay estado, esta sesión es activa

        // Verificar si la sesión es la misma
        if (state.sessionId === this.sessionId) {
            return true;
        }

        // Verificar si la otra sesión está inactiva
        const lastActivity = parseInt(sessionStorage.getItem(this.LAST_ACTIVITY_KEY) || '0');
        const timeSinceActivity = Date.now() - lastActivity;

        if (timeSinceActivity > this.SESSION_TIMEOUT) {
            console.log('⏱️  Sesión anterior expirada, esta sesión es ahora activa');
            return true;
        }

        return false;
    }

    /**
     * Manejar cambios en storage (otras pestañas)
     */
    handleStorageChange(event) {
        if (event.key === this.STORAGE_KEY) {
            console.log('📡 Estado de reproducción actualizado desde otra pestaña');

            // Disparar evento personalizado
            const customEvent = new CustomEvent('playbackStateUpdated', {
                detail: event.newValue ? JSON.parse(event.newValue) : null
            });
            document.dispatchEvent(customEvent);
        }
    }

    /**
     * Manejar cambios de visibilidad de página
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            console.log('👁️  Página visible');

            // Restaurar estado al volver a la pestaña
            const customEvent = new CustomEvent('pageVisible', {
                detail: { timestamp: Date.now() }
            });
            document.dispatchEvent(customEvent);
        } else {
            console.log('🚫 Página oculta');
        }
    }

    /**
     * Actualizar marca de tiempo de última actividad
     */
    updateLastActivity() {
        sessionStorage.setItem(this.LAST_ACTIVITY_KEY, Date.now().toString());
    }

    /**
     * Sincronizar con localStorage (para manejo de sesiones concurrentes)
     */
    syncWithLocalStorage() {
        const state = this.getPlaybackState();
        if (state) {
            console.log('🔄 Sincronizando con localStorage:', state);
        }
    }
}

// Crear instancia global
const playbackStateManager = new PlaybackStateManager();

