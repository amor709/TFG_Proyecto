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
        // Para botones de like en tracklists, álbumes, etc.
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
    }

    /**
     * Toggle de like para una canción
     */
    async toggleLiked(songId, button) {
        try {
            console.log(`🔄 Toggling like para canción ${songId}`);

            const response = await fetch(`/playlists/api/liked/${songId}/toggle/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCsrfToken(),
                    'Content-Type': 'application/json',
                }
            });

            console.log(`📡 Response status: ${response.status}`);

            const data = await response.json();

            if (data.success) {
                // Actualizar el Set local
                if (data.liked) {
                    this.likedSongs.add(songId);
                    console.log(`✅ Canción ${songId} añadida a Mis joyas`);
                } else {
                    this.likedSongs.delete(songId);
                    console.log(`❌ Canción ${songId} removida de Mis joyas`);
                }

                // Actualizar visual del botón
                this.updateLikeButton(button, data.liked);

                // Actualizar todos los botones para esta canción en toda la página
                this.updateAllButtonsForSong(songId, data.liked);

                // Notificar al usuario
                console.log(`✅ ${data.message}`);
            } else {
                console.error('❌ Error:', data.message);
                alert('Error: ' + data.message);
            }

        } catch (error) {
            console.error('❌ Error al togglear like:', error);
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
     * Actualizar un solo botón de like
     */
    updateLikeButton(button, isLiked) {
        const img = button.querySelector('img');

        if (!img) return;

        if (isLiked) {
            img.src = this.getStaticPath('img/diamond-black.png');
            img.alt = 'Quitar de Mis joyas';
            button.setAttribute('aria-label', 'Quitar de Mis joyas');
            button.classList.add('liked');
            button.classList.remove('not-liked');
        } else {
            img.src = this.getStaticPath('img/diamond-white.png');
            img.alt = 'Añadir a Mis joyas';
            button.setAttribute('aria-label', 'Añadir a Mis joyas');
            button.classList.remove('liked');
            button.classList.add('not-liked');
        }
    }

    /**
     * Actualizar todos los botones de like en la página
     */
    updateAllLikeButtons() {
        // Botones en tracklists, álbumes, playlists, etc.
        document.querySelectorAll('.like-btn[data-song-id]').forEach(button => {
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
        img.src = this.getStaticPath(isLiked ? 'img/diamond-black.png' : 'img/diamond-white.png');
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



