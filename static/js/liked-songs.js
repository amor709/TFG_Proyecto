/**
 * liked-songs.js - Gestión del sistema de "Mis joyas"
 * Maneja:
 * - Toggle de botones de "Me gusta"
 * - Actualización visual de iconos (diamond-black vs diamond-white)
 * - Persistencia en tiempo real
 */

class LikedSongsManager {
    constructor() {
        this.likedSongs = new Set(); // IDs de canciones que están en Mis joyas
        this.init();
    }

    async init() {
        // Cargar estado inicial de canciones
        await this.loadLikedStatus();

        // Configurar event listeners globales
        this.setupEventListeners();

        console.log('✅ LikedSongsManager inicializado');
    }

    /**
     * Cargar todas las canciones que están en "Mis joyas"
     */
    async loadLikedStatus() {
        try {
            const response = await fetch('/playlists/api/liked/songs/');
            const data = await response.json();

            // Guardar los IDs de las canciones que están en Mis joyas
            if (data.songs && Array.isArray(data.songs)) {
                this.likedSongs = new Set(data.songs.map(song => song.id));
            }

            // Actualizar todos los botones de Me gusta en la página
            this.updateAllLikeButtons();

        } catch (error) {
            console.error('Error al cargar estado de Mis joyas:', error);
        }
    }

     /**
      * Configurar event listeners para botones de like (diamond icons)
      */
     setupEventListeners() {
         // Para botones de like en tracklists, álbumes, etc. (usa data-song-id)
         document.addEventListener('click', (e) => {
             const button = e.target.closest('.like-btn');

             if (button) {
                 const songId = button.dataset.songId;

                 if (songId) {
                     e.preventDefault();
                     e.stopPropagation();
                     this.toggleLiked(parseInt(songId), button);
                 }
             }
         });

         // Para botones de like en álbumes y playlists (usa data-track-id)
         document.addEventListener('click', (e) => {
             const button = e.target.closest('.track-like-btn');

             if (button) {
                 const trackId = button.dataset.trackId;

                 if (trackId) {
                     e.preventDefault();
                     e.stopPropagation();
                     this.toggleTrackLiked(parseInt(trackId), button);
                 }
             }
         });

         // Para botones de like en el player (usa data-song-id)
         document.addEventListener('click', (e) => {
             const button = e.target.closest('.player__like-btn');

             if (button) {
                 const songId = button.dataset.songId;

                 if (songId) {
                     e.preventDefault();
                     e.stopPropagation();
                     this.toggleLiked(parseInt(songId), button);
                 }
             }
         });
     }

     /**
      * Toggle de like para una canción
      */
     async toggleLiked(songId, button) {
         try {
             console.log(` Toggling like para canción ${songId}`);

             // Actualizar UI inmediatamente antes de enviar al servidor
             const currentlyLiked = this.likedSongs.has(songId);
             const newLikedState = !currentlyLiked;

             // Actualizar visual inmediatamente
             this.updateLikeButton(button, newLikedState);
             this.updateAllButtonsForSong(songId, newLikedState);
             this.updateDiamondInfoIcons(songId, newLikedState);

             // Luego sincronizar con el servidor
             const response = await fetch(`/playlists/api/liked/${songId}/toggle/`, {
                 method: 'POST',
                 headers: {
                     'X-CSRFToken': this.getCsrfToken(),
                     'Content-Type': 'application/json',
                 }
             });

             console.log(` Response status: ${response.status}`);

             const data = await response.json();

             if (data.success) {
                 // Actualizar el Set local con la respuesta del servidor
                 if (data.liked) {
                     this.likedSongs.add(songId);
                     console.log(`✅ Canción ${songId} añadida a Mis joyas`);
                 } else {
                     this.likedSongs.delete(songId);
                     console.log(`❌ Canción ${songId} removida de Mis joyas`);
                 }

                 // Actualizar visual con confirmación del servidor
                 this.updateLikeButton(button, data.liked);
                 this.updateAllButtonsForSong(songId, data.liked);
                 this.updateDiamondInfoIcons(songId, data.liked);

                 // Notificar al usuario
                 console.log(`✅ ${data.message}`);
             } else {
                 // Revertir cambios si hay error
                 console.error('❌ Error:', data.message);
                 this.updateLikeButton(button, currentlyLiked);
                 this.updateAllButtonsForSong(songId, currentlyLiked);
                 this.updateDiamondInfoIcons(songId, currentlyLiked);
                 alert('Error: ' + data.message);
             }

         } catch (error) {
             console.error('❌ Error al togglear like:', error);
             // Revertir UI en caso de error
             const currentlyLiked = this.likedSongs.has(songId);
             this.updateLikeButton(button, currentlyLiked);
             this.updateAllButtonsForSong(songId, currentlyLiked);
             this.updateDiamondInfoIcons(songId, currentlyLiked);
             alert('Error al actualizar. Intenta de nuevo.');
         }
     }

     /**
      * Toggle de like para una canción usando data-track-id (álbumes y playlists)
      */
     async toggleTrackLiked(trackId, button) {
         try {
             console.log(` Toggling like para track ${trackId}`);

             // Actualizar UI inmediatamente antes de enviar al servidor
             const currentlyLiked = this.likedSongs.has(trackId);
             const newLikedState = !currentlyLiked;

             // Actualizar visual inmediatamente
             this.updateTrackLikeButton(button, newLikedState);
             this.updateAllTrackButtons(trackId, newLikedState);
             this.updateDiamondInfoIcons(trackId, newLikedState);

             // Luego sincronizar con el servidor
             const response = await fetch(`/playlists/api/liked/${trackId}/toggle/`, {
                 method: 'POST',
                 headers: {
                     'X-CSRFToken': this.getCsrfToken(),
                     'Content-Type': 'application/json',
                 }
             });

             console.log(` Response status: ${response.status}`);

             const data = await response.json();

             if (data.success) {
                 // Actualizar el Set local con la respuesta del servidor
                 if (data.liked) {
                     this.likedSongs.add(trackId);
                     console.log(`✅ Track ${trackId} añadido a Mis joyas`);
                 } else {
                     this.likedSongs.delete(trackId);
                     console.log(`❌ Track ${trackId} removido de Mis joyas`);
                 }

                 // Actualizar visual con confirmación del servidor
                 this.updateTrackLikeButton(button, data.liked);
                 this.updateAllTrackButtons(trackId, data.liked);
                 this.updateDiamondInfoIcons(trackId, data.liked);

                 // Notificar al usuario
                 console.log(`✅ ${data.message}`);
             } else {
                 // Revertir cambios si hay error
                 console.error('❌ Error:', data.message);
                 this.updateTrackLikeButton(button, currentlyLiked);
                 this.updateAllTrackButtons(trackId, currentlyLiked);
                 this.updateDiamondInfoIcons(trackId, currentlyLiked);
                 alert('Error: ' + data.message);
             }

         } catch (error) {
             console.error('❌ Error al togglear like:', error);
             // Revertir UI en caso de error
             const currentlyLiked = this.likedSongs.has(trackId);
             this.updateTrackLikeButton(button, currentlyLiked);
             this.updateAllTrackButtons(trackId, currentlyLiked);
             this.updateDiamondInfoIcons(trackId, currentlyLiked);
             alert('Error al actualizar. Intenta de nuevo.');
         }
     }

     /**
      * Actualizar todos los botones de like para una canción específica
      */
     updateAllButtonsForSong(songId, isLiked) {
         document.querySelectorAll(`.like-btn[data-song-id="${songId}"]`).forEach(button => {
             this.updateLikeButton(button, isLiked);
         });
     }

     /**
      * Actualizar todos los botones track de like para un track específico
      */
     updateAllTrackButtons(trackId, isLiked) {
         document.querySelectorAll(`.track-like-btn[data-track-id="${trackId}"]`).forEach(button => {
             this.updateTrackLikeButton(button, isLiked);
         });

         // También actualizar any like-btn with data-song-id matching trackId
         document.querySelectorAll(`.like-btn[data-song-id="${trackId}"]`).forEach(button => {
             this.updateLikeButton(button, isLiked);
         });

         // Y el player like button si coincide
         const playerButton = document.querySelector(`.player__like-btn[data-song-id="${trackId}"]`);
         if (playerButton) {
             this.updateLikeButton(playerButton, isLiked);
         }
     }

     /**
      * Actualizar un solo botón de like
      */
     updateLikeButton(button, isLiked) {
         if (!button) return;

         const img = button.querySelector('img');
         if (!img) return;

         const staticUrl = this.getStaticPath('');

         if (isLiked) {
             img.src = staticUrl + 'img/diamond-red.png';
             img.alt = 'Quitar de Mis joyas';
             button.setAttribute('aria-label', 'Quitar de Mis joyas');
             button.classList.add('liked');
             button.classList.remove('not-liked');
         } else {
             img.src = staticUrl + 'img/diamond-white.png';
             img.alt = 'Añadir a Mis joyas';
             button.setAttribute('aria-label', 'Añadir a Mis joyas');
             button.classList.remove('liked');
             button.classList.add('not-liked');
         }

         // Forzar repaint para asegurar que se vea el cambio
         void button.offsetHeight;
     }

     /**
      * Actualizar un botón track-like-btn (en álbumes y playlists)
      */
     updateTrackLikeButton(button, isLiked) {
         const img = button.querySelector('img');

         if (!img) return;

         if (isLiked) {
             img.src = this.getStaticPath('img/diamond-red.png');
             img.alt = 'Quitar de Me gusta';
             button.setAttribute('aria-label', 'Quitar de Me gusta');
             button.classList.add('icon--liked');
         } else {
             img.src = this.getStaticPath('img/diamond-white.png');
             img.alt = 'Añadir a Me gusta';
             button.setAttribute('aria-label', 'Añadir a Me gusta');
             button.classList.remove('icon--liked');
         }
     }

     /**
      * Actualizar los iconos diamond informativos (panel derecho)
      */
     updateDiamondInfoIcons(songId, isLiked) {
         const artistBadge = document.getElementById('artist-badge-info');
         if (artistBadge) {
             if (isLiked) {
                 artistBadge.src = this.getStaticPath('img/diamond-red.png');
             } else {
                 artistBadge.src = this.getStaticPath('img/diamond-white.png');
             }
         }
     }

     /**
      * Actualizar todos los botones de like en la página
      */
     updateAllLikeButtons() {
         // Botones en tracklists, álbumes, playlists, etc. con data-song-id
         document.querySelectorAll('.like-btn[data-song-id]').forEach(button => {
             const songId = parseInt(button.dataset.songId);
             const isLiked = this.likedSongs.has(songId);
             this.updateLikeButton(button, isLiked);
         });

         // Botones track-like-btn en álbumes y playlists con data-track-id
         document.querySelectorAll('.track-like-btn[data-track-id]').forEach(button => {
             const trackId = parseInt(button.dataset.trackId);
             const isLiked = this.likedSongs.has(trackId);
             this.updateTrackLikeButton(button, isLiked);
         });

         // Botones de like en el player
         document.querySelectorAll('.player__like-btn[data-song-id]').forEach(button => {
             const songId = parseInt(button.dataset.songId);
             const isLiked = this.likedSongs.has(songId);
             this.updateLikeButton(button, isLiked);
         });
     }

    /**
     * Obtener token CSRF para peticiones POST
     */
    getCsrfToken() {
        const input = document.querySelector('[name=csrfmiddlewaretoken]');
        if (input) {
            return input.value;
        }

        // Buscar en cookies
        const cookies = document.cookie.split('; ');
        for (let cookie of cookies) {
            if (cookie.startsWith('csrftoken=')) {
                return cookie.split('=')[1];
            }
        }
        return '';
    }

    /**
     * Obtener ruta estática correcta
     */
    getStaticPath(path) {
        const staticUrl = document.documentElement.getAttribute('data-static-url') || '/static/';
        return `${staticUrl}${path}`;
    }

     /**
      * Crear un botón de like para un elemento (útil para elementos generados dinámicamente)
      */
     createLikeButton(songId, isLiked = false) {
         const button = document.createElement('button');
         button.className = 'like-btn ' + (isLiked ? 'liked' : 'not-liked');
         button.dataset.songId = songId;
         button.setAttribute('aria-label', isLiked ? 'Quitar de Mis joyas' : 'Añadir a Mis joyas');

         const img = document.createElement('img');
         img.src = this.getStaticPath(isLiked ? 'img/diamond-red.png' : 'img/diamond-white.png');
         img.alt = isLiked ? 'Quitar de Mis joyas' : 'Añadir a Mis joyas';
         img.className = 'icon--sm';

         button.appendChild(img);
         return button;
     }
}

// Instanciar el manager cuando el DOM esté listo
let likedSongsManager;
document.addEventListener('DOMContentLoaded', function() {
    likedSongsManager = new LikedSongsManager();
});

// Exportar para uso global
window.LikedSongsManager = LikedSongsManager;
window.likedSongsManager = null;



