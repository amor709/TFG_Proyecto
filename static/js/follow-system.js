/**
 * follow-system.js - Sistema de seguimiento de artistas
 *
 * Comportamiento:
 *  - Lee data-artist-id del botón #artist-follow-btn al cargar.
 *  - Consulta el estado real al servidor y refleja "+ Seguir" / "Siguiendo".
 *  - Al click, hace optimistic update (cambia botón al instante) y envía POST.
 *  - Si la petición falla, revierte.
 *  - Cuando cambia la canción (evento "trackChanged"), re-evalúa con el nuevo artista.
 */

class FollowSystem {
    constructor() {
        this.currentArtistId = null;
        this.pendingRequest = false;
        this.handleClick = this.onFollowClick.bind(this);
        this.init();
    }

    init() {
        this.refreshFromDom();

        document.addEventListener('trackChanged', (e) => {
            if (e.detail && e.detail.artist_id) {
                this.currentArtistId = e.detail.artist_id;
            }
            setTimeout(() => this.refreshFromDom(), 50);
        });
    }

    /** Toma el artist-id del botón actual, engancha listener y consulta estado. */
    refreshFromDom() {
        const btn = document.getElementById('artist-follow-btn');
        if (!btn) return;

        const domId = parseInt(btn.dataset.artistId, 10);
        if (!isNaN(domId)) {
            this.currentArtistId = domId;
        }

        btn.removeEventListener('click', this.handleClick);
        btn.addEventListener('click', this.handleClick);

        if (this.currentArtistId) {
            this.fetchFollowState();
        }
    }

    fetchFollowState() {
        if (!this.currentArtistId) return;
        fetch(`/accounts/api/check-following/${this.currentArtistId}/`)
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => this.setFollowButtonState(data.is_following))
            .catch(() => { /* silencioso: si no hay listener_profile, no hay estado */ });
    }

    setFollowButtonState(isFollowing) {
        const btn = document.getElementById('artist-follow-btn');
        if (!btn) return;

        if (isFollowing) {
            btn.textContent = 'Siguiendo';
            btn.classList.add('btn--following');
            btn.classList.remove('btn--not-following');
            btn.dataset.following = 'true';
        } else {
            btn.textContent = '+ Seguir';
            btn.classList.add('btn--not-following');
            btn.classList.remove('btn--following');
            btn.dataset.following = 'false';
        }
    }

    onFollowClick(e) {
        e.preventDefault();
        if (!this.currentArtistId || this.pendingRequest) return;

        const btn = document.getElementById('artist-follow-btn');
        if (!btn) return;

        const wasFollowing = btn.dataset.following === 'true';
        this.setFollowButtonState(!wasFollowing);
        this.pendingRequest = true;

        fetch(`/accounts/api/follow-artist/${this.currentArtistId}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': this.getCsrfToken() },
        })
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => {
                if (data.status === 'success') {
                    this.setFollowButtonState(data.is_following);
                    document.dispatchEvent(new CustomEvent('followingChanged', {
                        detail: { artist_id: this.currentArtistId, is_following: data.is_following }
                    }));
                    if (typeof sidebarManager !== 'undefined') {
                        sidebarManager.loadSidebarSection(sidebarManager.currentSection);
                    }
                } else {
                    this.setFollowButtonState(wasFollowing);
                }
            })
            .catch(() => {
                this.setFollowButtonState(wasFollowing);
            })
            .finally(() => {
                this.pendingRequest = false;
            });
    }

    getCsrfToken() {
        const input = document.querySelector('[name=csrfmiddlewaretoken]');
        if (input) return input.value;
        for (const cookie of document.cookie.split('; ')) {
            if (cookie.startsWith('csrftoken=')) return cookie.split('=')[1];
        }
        return '';
    }
}

let followSystem;
document.addEventListener('DOMContentLoaded', function() {
    followSystem = new FollowSystem();
});
