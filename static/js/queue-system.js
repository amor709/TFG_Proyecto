/**
 * queue-system.js
 * Sistema de cola de reproducción e historial
 * (NOTA: Toggle de paneles está en panel-toggle.js)
 */
class QueueSystem {
    constructor() {
        this.queue = [];
        this.history = [];
        this.currentTrackIndex = null;
        this.maxHistorySize = 20;
        this.fromAlbum = false;
        this.currentAlbumId = null;
        this.isAutoPlayPending = false;
        this.init();
    }
    init() {
        this.loadQueueFromStorage();
        this.loadHistoryFromStorage();
    }

    addToQueue(trackId) {
        if (!this.queue.includes(trackId)) {
            this.queue.push(trackId);
            this.saveQueueToStorage();
            this.updateQueueDisplay();
        }
    }
    addMultipleToQueue(trackIds) {
        trackIds.forEach(id => {
            if (!this.queue.includes(id)) {
                this.queue.push(id);
            }
        });
        this.saveQueueToStorage();
        this.updateQueueDisplay();
    }
    removeFromQueue(index) {
        this.queue.splice(index, 1);
        this.saveQueueToStorage();
        this.updateQueueDisplay();
    }
    clearQueue() {
        this.queue = [];
        this.fromAlbum = false;
        this.currentAlbumId = null;
        this.saveQueueToStorage();
        this.updateQueueDisplay();
    }
    getNextTrack() {
        if (this.queue.length > 0) {
            return this.queue[0];
        }
        return null;
    }
    playQueueTrackAt(index) {
        if (index >= 0 && index < this.queue.length) {
            const trackId = this.queue[index];
            // Remover todo lo anterior a este índice (incluido este)
            this.queue.splice(0, index + 1);
            this.saveQueueToStorage();
            playSongA(trackId);
            return trackId;
        }
        return null;
    }

    addToHistory(trackId) {
        // Evitar duplicados consecutivos
        if (this.history.length > 0 && this.history[this.history.length - 1] === trackId) {
            return;
        }
        this.history.push(trackId);
        // Limitar a maxHistorySize
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        }
        this.saveHistoryToStorage();
    }
    getHistory() {
        return this.history;
    }

    saveQueueToStorage() {
        localStorage.setItem('soundmusik_queue', JSON.stringify(this.queue));
        localStorage.setItem('soundmusik_queue_fromAlbum', this.fromAlbum.toString());
        localStorage.setItem('soundmusik_queue_albumId', this.currentAlbumId);
    }
    loadQueueFromStorage() {
        const stored = localStorage.getItem('soundmusik_queue');
        if (stored) {
            this.queue = JSON.parse(stored);
        }
        this.fromAlbum = localStorage.getItem('soundmusik_queue_fromAlbum') === 'true';
        this.currentAlbumId = localStorage.getItem('soundmusik_queue_albumId');
    }
    saveHistoryToStorage() {
        localStorage.setItem('soundmusik_history', JSON.stringify(this.history));
    }
    loadHistoryFromStorage() {
        const stored = localStorage.getItem('soundmusik_history');
        if (stored) {
            this.history = JSON.parse(stored);
        }
    }

    updateQueueDisplay() {
        this.loadQueueHTML();
    }
    async loadQueueHTML() {
        if (this.queue.length === 0) {
            const queueList = document.getElementById('queue-list');
            if (queueList) {
                queueList.innerHTML = '<li class="queue-empty">La cola está vacía.</li>';
            }
            return;
        }
        try {
            const idsParam = this.queue.join(',');
            const response = await fetch(`/music/api/queue-html/?ids=${idsParam}`);
            if (!response.ok) {
                throw new Error('Error cargando queue HTML');
            }
            const data = await response.json();
            const queueList = document.getElementById('queue-list');
            if (queueList) {
                queueList.innerHTML = data.html;
            }
        } catch (error) {
            console.error('Error al cargar queue HTML:', error);
        }
    }

     onTrackFinished() {
         // Cuando termina una canción, reproducir la siguiente
         if (this.queue.length > 0) {
             const nextTrackId = this.queue.shift();
             this.saveQueueToStorage();
             console.log('🎵 Reproduciendo siguiente de la cola:', nextTrackId);

             // Marcar que estamos reproduciendo desde la cola
             if (typeof window !== 'undefined') {
                 window.__isPlayingFromQueue = true;
             }

             playSongA(nextTrackId);
         } else if (this.isAutoPlayPending) {
             // Si no hay cola pendiente y hay que hacer autoplay, hacerlo
             this.performAutoPlay();
         }
     }
    onTrackStarted(trackId) {
        this.currentTrackIndex = trackId;
    }
    /**
     * Reproducir un track con el resto del álbum en cola
     * Se llama desde templates de álbum
     */
    async playTrackWithAlbum(trackId, albumId) {
        try {
            console.log(` Reproduciendo canción ${trackId} del álbum ${albumId}`);
            // Primero, limpiar la cola actual
            this.clearQueue();
            this.setFromAlbum(albumId);
            // Obtener las canciones restantes del álbum
            const response = await fetch(`/music/api/album-tracks/${albumId}/${trackId}/`);
            if (!response.ok) {
                throw new Error('Error obteniendo canciones del álbum');
            }
            const data = await response.json();
            const albumTracks = data.album_tracks || [];
            // Añadir las canciones restantes a la cola
            if (albumTracks.length > 0) {
                this.addMultipleToQueue(albumTracks);
                console.log(`Cola del álbum llena con ${albumTracks.length} canciones`);
            }
            // Reproducir la canción actual
            playSongA(trackId);
        } catch (error) {
            console.error('Error al reproducir canción del álbum:', error);
            // Si hay error, reproducir solo la canción
            playSongA(trackId);
        }
    }

    playTrackStandalone(trackId) {
        console.log(`Reproduciendo track standalone: ${trackId}`);
        this.clearQueue();
        this.clearFromAlbumData();
        // Marcar para autoplay después
        this.isAutoPlayPending = true;
        playSongA(trackId);
    }
    performAutoPlay() {
        if (this.history.length === 0) {
            return;
        }
        const lastTrackId = this.history[this.history.length - 1];

        this.fetchSuggestedTracks(lastTrackId);
    }
    async fetchSuggestedTracks(trackId) {
        try {
            const response = await fetch(`/music/api/suggested-tracks/${trackId}/`);
            if (!response.ok) {
                throw new Error('Error obteniendo canciones sugeridas');
            }
            const data = await response.json();
            if (data.suggested_ids && data.suggested_ids.length > 0) {
                console.log('✅ Añadiendo', data.suggested_ids.length, 'canciones sugeridas a la cola');
                this.addMultipleToQueue(data.suggested_ids);
                this.isAutoPlayPending = false;
                // Si hay canciones en cola, reproducir la siguiente
                if (this.queue.length > 0) {
                    const nextTrackId = this.queue.shift();
                    this.saveQueueToStorage();
                    playSongA(nextTrackId);
                }
            }
        } catch (error) {
            console.error('Error en autoplay:', error);
        }
    }
    setFromAlbum(albumId) {
        this.fromAlbum = true;
        this.currentAlbumId = albumId;
        this.saveQueueToStorage();
    }
    clearFromAlbumData() {
        this.fromAlbum = false;
        this.currentAlbumId = null;
        this.saveQueueToStorage();
    }
}
// Instancia global
const queueSystem = new QueueSystem();
// Escuchar cuando se termina una canción
document.addEventListener('DOMContentLoaded', function() {
    const audio = document.getElementById('main-audio');
    if (audio) {
        audio.addEventListener('ended', function() {
            queueSystem.onTrackFinished();
        });
    }
});


function playFromAlbum(trackId, albumId) {
    if (typeof queueSystem !== 'undefined') {
        queueSystem.playTrackWithAlbum(trackId, albumId);
    } else {
        console.warn('Queue system no cargado');
        playSongA(trackId);
    }
}

function playStandalone(trackId) {
    if (typeof queueSystem !== 'undefined') {
        queueSystem.playTrackStandalone(trackId);
    } else {
        console.warn('Queue system no cargado');
        playSongA(trackId);
    }
}
/**
 * Añadir una canción a la cola sin reproducir
 * Uso: onclick="addToQueueFromUI(trackId)"
 */
function addToQueueFromUI(trackId) {
    if (typeof queueSystem !== 'undefined') {
        queueSystem.addToQueue(trackId);
        console.log(`✅ Canción agregada a la cola: ${trackId}`);
    }
}
/**
 * Mostrar panel de queue y actualizar
 * Uso: onclick="showQueueAndUpdate()"
 */
function showQueueAndUpdate() {
    if (typeof panelToggleManager !== 'undefined') {
        panelToggleManager.switchPanel('queue');
    }
}
