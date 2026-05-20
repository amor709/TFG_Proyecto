/**
 * liked-songs.js - Sistema de "Mis joyas"
 *
 * Cualquier botón con class `.like-btn` y atributo `data-song-id` es un toggle.
 * Al cambiar, se actualizan TODOS los botones de esa canción en la página,
 * más el icono informativo del panel derecho (#artist-badge-info) si la
 * canción coincide con la que se está reproduciendo.
 */

class LikedSongsManager {
    constructor() {
        this.likedSongs = new Set();
        this.init();
    }

    async init() {
        // Sembrar el set con lo que el servidor ya pintó en el HTML (SSR).
        // Así, si el fetch falla, el estado del DOM se preserva en memoria.
        this.seedFromDom();
        this.setupEventListeners();
        // Sincronizar con el servidor en segundo plano.
        this.loadLikedStatus();
    }

    seedFromDom() {
        document.querySelectorAll('.like-btn.liked[data-song-id]').forEach(btn => {
            const id = parseInt(btn.dataset.songId);
            if (id) this.likedSongs.add(id);
        });
    }

    async loadLikedStatus() {
        try {
            const response = await fetch('/playlists/api/liked/songs/');
            if (!response.ok) return; // No sobreescribir el SSR si la API falla
            const data = await response.json();
            if (!data.songs || !Array.isArray(data.songs)) return;
            this.likedSongs = new Set(data.songs.map(song => song.id));
            this.refreshAllButtons();
        } catch (error) {
            console.error('Error al cargar estado de Mis joyas:', error);
            // Mantenemos el estado del SSR sembrado en init()
        }
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const button = e.target.closest('.like-btn');
            if (!button) return;
            const songId = parseInt(button.dataset.songId);
            if (!songId) return;
            e.preventDefault();
            e.stopPropagation();
            this.toggle(songId);
        });
    }

    async toggle(songId) {
        const wasLiked = this.likedSongs.has(songId);
        const newState = !wasLiked;

        // Optimista: pintar el cambio antes de la respuesta del servidor
        this.applyState(songId, newState);
        if (newState) {
            this.likedSongs.add(songId);
        } else {
            this.likedSongs.delete(songId);
            // Si estamos viendo la playlist "Mis joyas", quitar la fila del DOM
            removeTrackRowFromLikedPlaylist(songId);
        }

        try {
            const response = await fetch(`/playlists/api/liked/${songId}/toggle/`, {
                method: 'POST',
                headers: {
                    'X-CSRFToken': this.getCsrfToken(),
                    'Content-Type': 'application/json',
                }
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Error desconocido');
            }

            // Sincronizar con la verdad del servidor por si difiere
            if (data.liked !== newState) {
                if (data.liked) {
                    this.likedSongs.add(songId);
                } else {
                    this.likedSongs.delete(songId);
                }
                this.applyState(songId, data.liked);
            }
        } catch (error) {
            console.error('Error al togglear like:', error);
            // Revertir
            if (wasLiked) {
                this.likedSongs.add(songId);
            } else {
                this.likedSongs.delete(songId);
            }
            this.applyState(songId, wasLiked);
            alert('Error al actualizar. Intenta de nuevo.');
        }
    }

    /**
     * Actualiza TODOS los botones .like-btn[data-song-id=X] de la página
     * + el badge informativo del panel derecho si corresponde.
     */
    applyState(songId, isLiked) {
        document.querySelectorAll(`.like-btn[data-song-id="${songId}"]`).forEach(btn => {
            this.paintButton(btn, isLiked);
        });
        this.updateInfoBadge(songId, isLiked);
    }

    paintButton(button, isLiked) {
        if (!button) return;
        const img = button.querySelector('img');
        const label = isLiked ? 'Quitar de Mis joyas' : 'Añadir a Mis joyas';
        const src = this.getStaticPath(isLiked ? 'img/diamond-red.png' : 'img/diamond-white.png');

        if (img) {
            img.src = src;
            img.alt = label;
        }
        button.setAttribute('aria-label', label);
        button.classList.toggle('liked', isLiked);
        button.classList.toggle('not-liked', !isLiked);
    }

    /**
     * El badge del panel derecho refleja la canción que se está reproduciendo.
     * Solo se actualiza si la canción togleada coincide con el track actual.
     */
    updateInfoBadge(songId, isLiked) {
        const badge = document.getElementById('artist-badge-info');
        if (!badge) return;
        const playerBtn = document.getElementById('player-like-btn');
        const currentId = playerBtn ? parseInt(playerBtn.dataset.songId) : null;
        if (currentId !== songId) return;
        badge.src = this.getStaticPath(isLiked ? 'img/diamond-red.png' : 'img/diamond-white.png');
    }

    /**
     * Llamado cuando cambia la canción del player o tras cargar el estado inicial.
     * Repinta TODO el DOM para reflejar el set actual de likedSongs.
     */
    refreshAllButtons() {
        document.querySelectorAll('.like-btn[data-song-id]').forEach(btn => {
            const songId = parseInt(btn.dataset.songId);
            this.paintButton(btn, this.likedSongs.has(songId));
        });
        const playerBtn = document.getElementById('player-like-btn');
        if (playerBtn) {
            const currentId = parseInt(playerBtn.dataset.songId);
            if (currentId) this.updateInfoBadge(currentId, this.likedSongs.has(currentId));
        }
    }

    /**
     * API pública: llamar tras cambiar la canción del player para refrescar
     * el botón del player y el badge del panel.
     */
    syncPlayer(songId) {
        const playerBtn = document.getElementById('player-like-btn');
        if (!playerBtn) return;
        playerBtn.dataset.songId = songId;
        this.paintButton(playerBtn, this.likedSongs.has(songId));
        this.updateInfoBadge(songId, this.likedSongs.has(songId));
    }

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

    getStaticPath(path) {
        const staticUrl = document.documentElement.getAttribute('data-static-url') || '/static/';
        return `${staticUrl}${path}`;
    }
}

/**
 * Helpers reutilizables para eliminar filas de tracklists al instante,
 * usados por liked-songs.js (diamond en Mis joyas) y song-options-menu.js
 * ("Quitar de esta playlist").
 */
function removeTrackRowFromLikedPlaylist(songId) {
    const list = document.querySelector('.tracklist__list[data-liked-playlist="true"]');
    if (!list) return;
    const row = list.querySelector(`.tracklist__row[data-track-id="${songId}"]`);
    if (row) removeTrackRow(row);
}

function removeTrackRow(row) {
    const list = row.parentElement;
    row.remove();
    decrementPlaylistCount();
    // Renumerar filas restantes
    if (list) {
        list.querySelectorAll('.tracklist__row .track-num').forEach((el, i) => {
            el.textContent = i + 1;
        });
        if (!list.querySelector('.tracklist__row')) {
            const empty = document.createElement('li');
            empty.className = 'tracklist__empty';
            empty.textContent = 'Esta playlist aún no tiene canciones.';
            list.appendChild(empty);
        }
    }
}

function decrementPlaylistCount() {
    const counter = document.getElementById('playlist-track-count');
    if (!counter) return;
    const current = parseInt(counter.dataset.count || counter.textContent, 10);
    const next = Math.max(0, current - 1);
    counter.dataset.count = next;
    counter.textContent = next;
    const plural = document.getElementById('playlist-track-count-plural');
    if (plural) plural.textContent = next === 1 ? '' : 'es';
}

window.removeTrackRow = removeTrackRow;
window.removeTrackRowFromLikedPlaylist = removeTrackRowFromLikedPlaylist;

let likedSongsManager;
document.addEventListener('DOMContentLoaded', function() {
    likedSongsManager = new LikedSongsManager();
    window.likedSongsManager = likedSongsManager;
});

window.LikedSongsManager = LikedSongsManager;
