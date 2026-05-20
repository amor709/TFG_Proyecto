/**
 * song-options-menu.js - Sistema de menú de opciones para canciones (3 puntos)
 * Menú flotante tipo dropdown, similar al del perfil de usuario
 */

class SongOptionsMenu {
    constructor() {
        this.currentOpenMenu = null;
        this.currentOpenButton = null;
        this.init();
    }

    init() {
        // Delegación de eventos para botones de más opciones
        document.addEventListener('click', (e) => {
            const moreBtn = e.target.closest('.track-more-btn');
            if (moreBtn) {
                e.stopPropagation();
                this.toggleMenu(moreBtn);
            }
        });

        // Cerrar menús al hacer clic fuera
        document.addEventListener('click', (e) => {
            // No cerrar si el clic está dentro de un menú o submenu
            if (!e.target.closest('.song-options-menu-floating') && 
                !e.target.closest('.playlist-submenu-floating') && 
                !e.target.closest('.track-more-btn')) {
                this.closeAllMenus();
            }
        });

    }

    /**
     * Toggle del menú de opciones
     */
    toggleMenu(button) {
        // Cerrar otros menús
        this.closeAllMenus();

        // Crear el menú si no existe
        let menu = document.querySelector('.song-options-menu-floating');
        if (!menu) {
            menu = this.createFloatingMenu();
        }

        // Actualizar contenido del menú
        this.updateMenu(menu, button);

        // Posicionar el menú cerca del botón
        this.positionMenu(menu, button);

        // Mostrar el menú
        menu.classList.add('visible');
        this.currentOpenButton = button;
    }

    /**
     * Crear el menú flotante a nivel de página
     */
    createFloatingMenu() {
        const menu = document.createElement('div');
        menu.className = 'song-options-menu-floating';
        menu.innerHTML = '<div class="song-options-menu-content"></div>';
        document.body.appendChild(menu);
        return menu;
    }

    /**
     * Actualizar el contenido del menú
     */
    updateMenu(menu, button) {
        const trackId = button.dataset.trackId;
        const albumId = button.dataset.albumId;
        const removeFromPlaylistId = button.dataset.removeFromPlaylist;

        // Obtener datos de la canción
        const trackRow = button.closest('.tracklist__row') || button.closest('li');
        const artistLink = trackRow?.querySelector('.track-artist-link') || trackRow?.querySelector('a[href*="artist"]');
        const albumLink = albumId ? `/music/album/${albumId}/` : (trackRow?.querySelector('a[href*="album"]') || trackRow?.querySelector('.pl-album-link'));

        let html = '';

        // Ver artista
        if (artistLink) {
            const artistUrl = artistLink.getAttribute('href') || artistLink.href;
            html += `<a href="${artistUrl}" class="song-options-item">
                        <span>Ver artista</span>
                    </a>`;
        }

        // Ver álbum
        if (albumLink) {
            const albumUrl = typeof albumLink === 'string' ? albumLink : albumLink.getAttribute('href');
            if (albumUrl) {
                html += `<a href="${albumUrl}" class="song-options-item">
                            <span>Ver álbum</span>
                        </a>`;
            }
        }

        // Divisor si hay opciones anteriores
        if (html) {
            html += '<div class="song-options-divider"></div>';
        }

        // Añadir a la cola
        html += `<button class="song-options-item add-to-queue-btn" data-song-id="${trackId}">
                    <span>Añadir a la cola</span>
                </button>`;

        // Añadir a Mis Joyas
        html += `<button class="song-options-item add-to-liked-btn" data-song-id="${trackId}">
                    <span>Añadir a Mis Joyas</span>
                </button>`;

        // Divisor antes de playlist
        html += '<div class="song-options-divider"></div>';

        // Añadir a playlist (con submenu)
        html += `<button class="song-options-item playlist-trigger-btn" data-song-id="${trackId}">
                    <span>Añadir a playlist</span>
                </button>`;

        // Quitar de esta playlist (solo si el botón viene con data-remove-from-playlist)
        if (removeFromPlaylistId) {
            html += '<div class="song-options-divider"></div>';
            html += `<button class="song-options-item remove-from-playlist-btn"
                            data-song-id="${trackId}"
                            data-playlist-id="${removeFromPlaylistId}">
                        <span>Quitar de esta playlist</span>
                    </button>`;
        }

        const content = menu.querySelector('.song-options-menu-content');
        content.innerHTML = html;

        // Agregar listeners
        content.querySelector('.add-to-queue-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (typeof queueSystem !== 'undefined' && queueSystem) {
                queueSystem.addNext(trackId);   // suena a continuación + refresca la cola
            }
            this.closeAllMenus();
        });

        content.querySelector('.add-to-liked-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addToLiked(trackId);
        });

        content.querySelector('.playlist-trigger-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPlaylistSubmenu(trackId, menu);
        });

        content.querySelector('.remove-from-playlist-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const songId = e.currentTarget.dataset.songId;
            const playlistId = e.currentTarget.dataset.playlistId;
            if (confirm('¿Quitar esta canción de la playlist?')) {
                fetch(`/playlists/${playlistId}/remove/${songId}/`, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': this.getCsrfToken() }
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            const list = document.querySelector(`.tracklist__list[data-playlist-id="${playlistId}"]`);
                            const row = list && list.querySelector(`.tracklist__row[data-track-id="${songId}"]`);
                            if (row && typeof window.removeTrackRow === 'function') {
                                window.removeTrackRow(row);
                            }
                        }
                    })
                    .catch(() => {});
            }
            this.closeAllMenus();
        });
    }

    /**
     * Posicionar el menú cerca del botón
     */
    positionMenu(menu, button) {
        const rect = button.getBoundingClientRect();
        const menuHeight = 300; // Altura aproximada del menú

        // Calcular posición
        let top = rect.bottom + 8; // 8px debajo del botón
        let left = rect.right - 200; // Alineado a la derecha del botón (200px es el ancho aproximado)

        // Ajustar si sale de pantalla
        if (top + menuHeight > window.innerHeight) {
            top = rect.top - menuHeight - 8; // Mostrar arriba si no hay espacio
        }

        if (left < 0) {
            left = 8; // Margen de seguridad a la izquierda
        }

        if (left + 200 > window.innerWidth) {
            left = window.innerWidth - 200 - 8; // Margen de seguridad a la derecha
        }

        menu.style.position = 'fixed';
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
    }

    /**
     * Mostrar submenu de playlists
     */
    async showPlaylistSubmenu(trackId, menuElement) {
        let submenu = document.querySelector('.playlist-submenu-floating');

        if (submenu && submenu.classList.contains('visible')) {
            submenu.classList.remove('visible');
            return;
        }

        if (!submenu) {
            submenu = document.createElement('div');
            submenu.className = 'playlist-submenu-floating';
            submenu.innerHTML = '<div class="submenu-loader">Cargando playlists...</div>';
            document.body.appendChild(submenu);

            // Cargar playlists del usuario
            try {
                const response = await fetch('/playlists/user-playlists/');
                const playlists = await response.json();

                let html = '';
                if (Array.isArray(playlists) && playlists.length > 0) {
                    playlists.forEach(playlist => {
                        html += `<button class="playlist-item" data-playlist-id="${playlist.id}" data-song-id="${trackId}">
                                    <span>${playlist.name}</span>
                                </button>`;
                    });
                } else {
                    html = '<div class="no-playlists">No tienes playlists</div>';
                }

                submenu.innerHTML = html;

                // Event listeners para items de playlist
                submenu.querySelectorAll('.playlist-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const playlistId = item.dataset.playlistId;
                        this.addToPlaylist(playlistId, trackId);
                    });
                });

            } catch (error) {
                submenu.innerHTML = '<div class="error-msg">Error al cargar playlists</div>';
            }
        }

        // Posicionar el submenu
        this.positionPlaylistSubmenu(submenu, menuElement);
        submenu.classList.add('visible');
    }

    /**
     * Posicionar submenu de playlists
     */
    positionPlaylistSubmenu(submenu, mainMenu) {
        const rect = mainMenu.getBoundingClientRect();

        // Posicionar a la derecha del menú principal
        const top = rect.top;
        const left = rect.right + 8; // 8px a la derecha

        submenu.style.position = 'fixed';
        submenu.style.top = top + 'px';
        submenu.style.left = left + 'px';
    }

    /**
     * Añadir canción a Mis Joyas
     */
    async addToLiked(songId) {
        try {
            const response = await fetch(`/playlists/api/liked/${songId}/toggle/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCsrfToken(),
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            if (data.success) {
                this.closeAllMenus();
            }
        } catch (error) {
        }
    }

    /**
     * Añadir canción a playlist
     */
    async addToPlaylist(playlistId, songId) {
        try {
            const response = await fetch(`/playlists/${playlistId}/add/${songId}/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCsrfToken(),
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            if (data.success) {
                this.closeAllMenus();
            } else {
                alert(data.message || 'Error al añadir a playlist');
            }
        } catch (error) {
            alert('Error al añadir a playlist');
        }
    }

    /**
     * Cerrar todos los menús
     */
    closeAllMenus() {
        const menu = document.querySelector('.song-options-menu-floating');
        if (menu) {
            menu.classList.remove('visible');
        }

        const submenus = document.querySelectorAll('.playlist-submenu-floating');
        submenus.forEach(submenu => {
            submenu.classList.remove('visible');
        });
    }

    /**
     * Obtener token CSRF
     */
    getCsrfToken() {
        const input = document.querySelector('[name=csrfmiddlewaretoken]');
        if (input) return input.value;

        const cookies = document.cookie.split('; ');
        for (let cookie of cookies) {
            if (cookie.startsWith('csrftoken=')) {
                return cookie.split('=')[1];
            }
        }
        return '';
    }
}

// Instanciar cuando el DOM esté listo
let songOptionsMenu;
document.addEventListener('DOMContentLoaded', function() {
    songOptionsMenu = new SongOptionsMenu();
});

// Exportar para uso global
window.SongOptionsMenu = SongOptionsMenu;











