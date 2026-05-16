/**
 * update-player-panels.js
 * Actualizar los paneles laterales (sidebar y derecha) con la información del reproductor
 * cuando se carga una nueva página o cambia el estado de reproducción
 */
class PlayerPanelsUpdater {
    constructor() {
        this.playerInfoUrl = '/accounts/api/player-info/';
        this.playlistUrl = '/accounts/api/playlist/';
        this.updateInterval = null;
        this.playlistUpdateInterval = null;
    }

    async init() {
        console.log('🎨 Inicializando actualizador de paneles...');

        // Actualizar inmediatamente al cargar
        await this.updatePanels();
        await this.updatePlaylist();

        // Configurar actualización de playlist cada 30 segundos
        this.playlistUpdateInterval = setInterval(() => this.updatePlaylist(), 30000);

        // Escuchar eventos de cambio de canción
        document.addEventListener('trackChanged', () => {
            console.log('🎵 Canción cambiada, actualizando paneles...');
            this.updatePanels();
        });

        // Escuchar eventos de reproducción/pausa
        document.addEventListener('playbackStateChanged', () => {
            console.log('▶️⏸️ Estado de reproducción cambiado, actualizando paneles...');
            this.updatePanels();
        });
    }

    destroy() {
        if (this.playlistUpdateInterval) {
            clearInterval(this.playlistUpdateInterval);
            this.playlistUpdateInterval = null;
        }
    }

    async getPlayerInfo() {
        try {
            const response = await fetch(this.playerInfoUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('❌ Error obteniendo información del reproductor:', error);
            return null;
        }
    }

    async getPlaylist() {
        try {
            const response = await fetch(this.playlistUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': this.getCsrfToken()
                }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error obteniendo playlist:', error);
            return null;
        }
    }

    async updatePanels() {
        // Primero intentar obtener información del backend
        const backendData = await this.getPlayerInfo();

        // Obtener información actual del reproductor desde el DOM
        const currentTrackFromDOM = this.getCurrentTrackFromDOM();

        let trackData = null;
        let relatedArtistData = null;

        // Priorizar la información del DOM si existe
        if (currentTrackFromDOM && currentTrackFromDOM.title !== 'Sin canción') {
            trackData = currentTrackFromDOM;

            // Si tenemos datos del backend, usar el artista relacionado
            if (backendData && backendData.status === 'success' && backendData.related_artist) {
                relatedArtistData = backendData.related_artist;
            }
        } else if (backendData && backendData.status === 'success' && backendData.current_track) {
            // Usar datos del backend si no hay nada en el DOM
            trackData = backendData.current_track;
            relatedArtistData = backendData.related_artist;
        }

        // Actualizar panel derecho
        this.updateRightPanel(trackData, relatedArtistData);

        // Actualizar barra inferior del reproductor
        this.updatePlayerFooter(trackData);

        console.log('✅ Paneles actualizados:', trackData ? trackData.title : 'Sin canción');
    }

    /**
     * Obtener información de la canción actual desde el DOM
     */
    getCurrentTrackFromDOM() {
        const titleEl = document.getElementById('track-title');
        const artistEl = document.getElementById('track-artist');
        const coverEl = document.getElementById('track-art');

        if (titleEl && artistEl && coverEl && titleEl.innerText && titleEl.innerText !== 'Sin canción') {
            return {
                title: titleEl.innerText,
                artist: artistEl.innerText,
                cover: coverEl.src || '/static/img/logo.png'
            };
        }

        return null;
    }

    async updatePlaylist() {
        const data = await this.getPlaylist();
        if (!data || data.status !== 'success' || !data.songs) {
            console.log('ℹ️  Sin playlist disponible');
            return;
        }

        this.updateSidebarPlaylist(data.songs);

        // Actualizar la variable global playlist
        window.playlist = data.songs.map(song => ({
            title: song.title,
            url: song.audio_url,
            cover: song.cover,
            artist: song.artist
        }));

        console.log('✅ Playlist actualizada:', data.songs.length, 'canciones');
    }

    updateRightPanel(track, relatedArtist) {
        if (!track) {
            // Limpiar panel derecho si no hay canción
            const coverImg = document.querySelector('.right-panel__album-cover img');
            if (coverImg) {
                coverImg.src = '/static/img/logo.png';
                coverImg.alt = 'Sin canción';
            }

            const titleEl = document.querySelector('.track-info__title');
            if (titleEl) titleEl.innerText = 'Sin canción';

            const artistEl = document.querySelector('.track-info__artist');
            if (artistEl) artistEl.innerText = 'Selecciona una para reproducir';

            // Ocultar sección de artista relacionado
            const relatedSection = document.querySelector('.right-panel__related');
            if (relatedSection) relatedSection.style.display = 'none';

            return;
        }

        // Actualizar portada
        const coverImg = document.querySelector('.right-panel__album-cover img');
        if (coverImg) {
            coverImg.src = track.cover || '/static/img/logo.png';
            coverImg.alt = track.title;
        }

        // Actualizar información de la pista
        const titleEl = document.querySelector('.track-info__title');
        if (titleEl) titleEl.innerText = track.title;

        const artistEl = document.querySelector('.track-info__artist');
        if (artistEl) artistEl.innerText = track.artist;

        // Actualizar artista relacionado
        if (relatedArtist) {
            const relatedSection = document.querySelector('.right-panel__related');
            if (relatedSection) relatedSection.style.display = 'block';

            const relatedPhoto = document.querySelector('.related__artist-photo');
            if (relatedPhoto) {
                relatedPhoto.src = relatedArtist.photo || '/static/img/userdefault.png';
                relatedPhoto.alt = relatedArtist.name;
            }

            const relatedName = document.querySelector('.related__artist-name');
            if (relatedName) relatedName.innerText = relatedArtist.name;

            const followBtn = document.querySelector('.btn-follow');
            if (followBtn) followBtn.dataset.artistId = relatedArtist.id;
        } else {
            const relatedSection = document.querySelector('.right-panel__related');
            if (relatedSection) relatedSection.style.display = 'none';
        }
    }

    updatePlayerFooter(track) {
        if (!track) {
            // Limpiar barra inferior si no hay canción
            const titleEl = document.getElementById('track-title');
            if (titleEl) titleEl.innerText = 'Sin canción';

            const artistEl = document.getElementById('track-artist');
            if (artistEl) artistEl.innerText = 'Selecciona una para reproducir';

            const artImg = document.getElementById('track-art');
            if (artImg) {
                artImg.src = '/static/img/logo.png';
                artImg.alt = 'Sin canción';
            }
            return;
        }

        // Actualizar título
        const titleEl = document.getElementById('track-title');
        if (titleEl) titleEl.innerText = track.title;

        // Actualizar artista
        const artistEl = document.getElementById('track-artist');
        if (artistEl) artistEl.innerText = track.artist;

        // Actualizar portada
        const artImg = document.getElementById('track-art');
        if (artImg) {
            artImg.src = track.cover || '/static/img/logo.png';
            artImg.alt = track.title;
        }
    }

    updateSidebarPlaylist(songs) {
        const playlistEl = document.getElementById('playlist');
        if (!playlistEl) {
            console.warn('⚠️  Elemento playlist no encontrado en el DOM');
            return;
        }

        // Limpiar lista actual
        playlistEl.innerHTML = '';

        // Agregar nuevas canciones
        songs.forEach((song, index) => {
            const li = document.createElement('li');
            li.setAttribute('onclick', `loadSong(${index})`);
            li.innerText = song.title;
            li.title = `${song.title} - ${song.artist}`; // Tooltip con artista
            playlistEl.appendChild(li);
        });

        console.log('✅ Lista del sidebar actualizada con', songs.length, 'canciones');
    }

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
}

// Crear instancia global
let playerPanelsUpdater = null;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Pequeño delay para asegurar que otros scripts estén cargados
    setTimeout(() => {
        playerPanelsUpdater = new PlayerPanelsUpdater();
        playerPanelsUpdater.init();
    }, 100);
});

// Limpiar intervalos cuando se cambia de página
window.addEventListener('beforeunload', function() {
    if (playerPanelsUpdater) {
        playerPanelsUpdater.destroy();
    }
});
