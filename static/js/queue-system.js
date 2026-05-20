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
         this.shuffle = false;
         this.repeat = false;
         this.unshuffledQueue = [];   // orden normal guardado mientras shuffle está activo
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
    /** Añade una canción para que suene A CONTINUACIÓN (primera de la cola). */
    addNext(trackId) {
        const id = typeof trackId === 'number' ? trackId : parseInt(trackId, 10);
        if (isNaN(id)) return;
        this.queue = this.queue.filter(x => x !== id);  // evitar duplicado
        this.queue.unshift(id);                          // ponerla la primera
        this.saveQueueToStorage();
        this.updateQueueDisplay();                       // refrescar la cola
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
            // Marca: la siguiente reproducción viene de la cola, no debe
            // vaciarla ni recargar sugerencias en playSongA.
            if (typeof window !== 'undefined') {
                window.__isPlayingFromQueue = true;
            }
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
        localStorage.setItem('soundmusik_shuffle', this.shuffle.toString());
        localStorage.setItem('soundmusik_repeat', this.repeat.toString());
        localStorage.setItem('soundmusik_unshuffled_queue', JSON.stringify(this.unshuffledQueue));
    }
    loadQueueFromStorage() {
        const stored = localStorage.getItem('soundmusik_queue');
        if (stored) {
            this.queue = JSON.parse(stored);
        }
        this.fromAlbum = localStorage.getItem('soundmusik_queue_fromAlbum') === 'true';
        this.currentAlbumId = localStorage.getItem('soundmusik_queue_albumId');
        this.shuffle = localStorage.getItem('soundmusik_shuffle') === 'true';
        this.repeat = localStorage.getItem('soundmusik_repeat') === 'true';
        const u = localStorage.getItem('soundmusik_unshuffled_queue');
        if (u) {
            this.unshuffledQueue = JSON.parse(u);
        }
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
        }
    }

     onTrackFinished() {
         // Cuando termina una canción, reproducir la siguiente
         if (this.queue.length > 0) {
             const nextTrackId = this.queue.shift();
             this.saveQueueToStorage();

             // Marcar que estamos reproduciendo desde la cola
             if (typeof window !== 'undefined') {
                 window.__isPlayingFromQueue = true;
             }

             playSongA(nextTrackId);
             this.ensureQueueMinimum(nextTrackId);  // mantener la cola en ≥10
         } else if (this.history.length > 0) {
             // Cola vacía pero hay historial → autoplay: pide sugerencias por
             // la última canción reproducida (backend tiene fallback aleatorio).
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
             }

             // Sugerencias por tags del ÁLBUM, no de la canción.
             // Se añaden detrás del resto del álbum para sonar al terminar.
             try {
                 const sugResponse = await fetch(`/music/api/album-suggested-tracks/${albumId}/`);
                 if (sugResponse.ok) {
                     const sugData = await sugResponse.json();
                     const suggestedTracks = sugData.suggested_ids || [];
                     if (suggestedTracks.length > 0) {
                         this.addMultipleToQueue(suggestedTracks);
                     }
                 }
             } catch (sugError) {
             }

             // MARCAR COMO REPRODUCCIÓN DESDE ÁLBUM (antes de reproducir)
             if (typeof window !== 'undefined') {
                 window.__isPlayingFromQueue = true;
             }

             // Reproducir la canción actual
             playSongA(trackId);
             this.ensureQueueMinimum(trackId);  // garantizar ≥10 en la cola
         } catch (error) {
             // Si hay error, reproducir solo la canción
             if (typeof window !== 'undefined') {
                 window.__isPlayingFromQueue = false;
             }
             playSongA(trackId);
         }
     }

    playTrackStandalone(trackId) {
         this.clearQueue();
         this.clearFromAlbumData();

         // MARCAR COMO REPRODUCCIÓN MANUAL (NO desde cola)
         if (typeof window !== 'undefined') {
             window.__isPlayingFromQueue = false;
         }

         // Reproducir la canción actual
         playSongA(trackId);
     }

     async playTrackFromArtist(trackId, artistId) {
         try {
             this.clearQueue();
             this.clearFromAlbumData();

             const response = await fetch(`/music/api/artist-tracks/${artistId}/`);
             if (!response.ok) {
                 throw new Error('Error obteniendo canciones del artista');
             }
             const data = await response.json();
             const artistTracks = data.artist_tracks || [];

             if (artistTracks.length > 0) {
                 const shuffled = artistTracks.sort(() => 0.5 - Math.random());
                 this.addMultipleToQueue(shuffled);
             }

             if (typeof window !== 'undefined') {
                 window.__isPlayingFromArtist = true;
                 window.__isPlayingFromQueue = true;
             }

             playSongA(trackId);
             this.ensureQueueMinimum(trackId);  // garantizar ≥10 en la cola
         } catch (error) {
             if (typeof window !== 'undefined') {
                 window.__isPlayingFromQueue = false;
                 window.__isPlayingFromArtist = false;
             }
             playSongA(trackId);
         }
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
                 this.addMultipleToQueue(data.suggested_ids);

                 // Reproducir la primera canción sugerida
                 if (this.queue.length > 0) {
                     const nextTrackId = this.queue.shift();
                     this.saveQueueToStorage();

                     // Marcar como reproducción desde queue
                     if (typeof window !== 'undefined') {
                         window.__isPlayingFromQueue = true;
                     }

                     playSongA(nextTrackId);
                 }
             } else {
             }
         } catch (error) {
         }
     }

    /**
     * Pedir IDs de canciones sugeridas por tags de una canción de referencia.
     */
    async fetchSuggestionIds(trackId, excludeIds) {
        try {
            const exclude = (excludeIds || []).join(',');
            const url = exclude
                ? `/music/api/suggested-tracks/${trackId}/?exclude=${exclude}`
                : `/music/api/suggested-tracks/${trackId}/`;
            const response = await fetch(url);
            if (!response.ok) return [];
            const data = await response.json();
            return data.suggested_ids || [];
        } catch (e) {
            return [];
        }
    }

    /**
     * Asegurar que la cola tenga SIEMPRE al menos 10 canciones.
     * Si faltan, añade sugerencias por tags (nunca encola el álbum).
     * Referencia: la última de la cola (si hay), si no la canción dada.
     * Guard anti-bucle: si no se añade nada nuevo (biblioteca pequeña), para.
     */
    async ensureQueueMinimum(referenceTrackId) {
        const MIN = 10;
        let guard = 0;
        while (this.queue.length < MIN && guard < 8) {
            guard++;
            const refId = this.queue.length > 0 ? this.queue[this.queue.length - 1] : referenceTrackId;
            if (!refId) break;
            const before = this.queue.length;
            // Excluir lo que ya está en la cola (+ la de referencia) para que, al
            // agotar los tags, el endpoint pase automáticamente a canciones aleatorias.
            const exclude = this.queue.slice();
            if (referenceTrackId && !exclude.includes(referenceTrackId)) exclude.push(referenceTrackId);
            const ids = await this.fetchSuggestionIds(refId, exclude);
            if (!ids.length) break;
            this.addMultipleToQueue(ids);   // deduplica internamente
            if (this.queue.length === before) break;  // toda la BD ya está en la cola
        }
        this.loadQueueHTML();
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

    _shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Activar/desactivar shuffle. Al activar baraja la cola actual (guardando el
     * orden normal); al desactivar restaura ese orden (pendientes en su orden +
     * las añadidas durante el shuffle, al final). Reactivar vuelve a barajar.
     * Devuelve el nuevo estado.
     */
    toggleShuffle() {
        this.shuffle = !this.shuffle;
        if (this.shuffle) {
            this.unshuffledQueue = [...this.queue];
            this.queue = this._shuffleArray([...this.queue]);
        } else {
            const pendingOriginal = this.unshuffledQueue.filter(id => this.queue.includes(id));
            const newOnes = this.queue.filter(id => !this.unshuffledQueue.includes(id));
            this.queue = pendingOriginal.concat(newOnes);
            this.unshuffledQueue = [];
        }
        this.saveQueueToStorage();
        this.updateQueueDisplay();
        return this.shuffle;
    }

    /** Activar/desactivar repetición de la canción actual. Devuelve el nuevo estado. */
    toggleRepeat() {
        this.repeat = !this.repeat;
        this.saveQueueToStorage();
        return this.repeat;
    }
}
// Instancia global
const queueSystem = new QueueSystem();
// Escuchar cuando se termina una canción
document.addEventListener('DOMContentLoaded', function() {
    const audio = document.getElementById('main-audio');
    if (audio) {
        audio.addEventListener('ended', function() {
            // Repeat ON → reproducir de nuevo la misma canción (la cola se mantiene)
            if (queueSystem.repeat) {
                audio.currentTime = 0;
                audio.play().catch(() => {});
            } else {
                queueSystem.onTrackFinished();
            }
        });
    }
});


function playFromAlbum(trackId, albumId) {
     if (typeof queueSystem !== 'undefined') {
         queueSystem.playTrackWithAlbum(trackId, albumId);
     } else {
         playSongA(trackId);
     }
 }

 function playFromArtist(trackId, artistId) {
     if (typeof queueSystem !== 'undefined') {
         queueSystem.playTrackFromArtist(trackId, artistId);
     } else {
         playSongA(trackId);
     }
 }

 function playStandalone(trackId) {
     if (typeof queueSystem !== 'undefined') {
         queueSystem.playTrackStandalone(trackId);
     } else {
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
