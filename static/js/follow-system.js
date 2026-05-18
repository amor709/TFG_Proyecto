/**
 * follow-system.js - Sistema de seguimiento de artistas
 */

class FollowSystem {
    constructor() {
        this.currentArtistId = null;
        this.init();
    }

    init() {
        console.log('🔗 Inicializando FollowSystem');
        // Agregar event listener al botón (si existe) y escuchar cambios en el reproductor
        this.attachFollowButtonListener();

        // Escuchar cambios en el reproductor para actualizar el botón
        document.addEventListener('trackChanged', (e) => {
            console.log('🎵 TrackChanged en FollowSystem:', e.detail);
            this.onTrackChanged(e.detail);
        });
    }

    /**
     * Buscar y agregar event listener al botón de follow
     */
    attachFollowButtonListener() {
        const followBtn = document.getElementById('artist-follow-btn');
        console.log('🔍 Buscando botón follow:', followBtn ? '✅ Encontrado' : '❌ No encontrado');

        if (followBtn) {
            // Remover event listeners anteriores si existen
            followBtn.removeEventListener('click', (e) => this.onFollowClick(e));
            // Agregar nuevo event listener
            followBtn.addEventListener('click', (e) => this.onFollowClick(e));
        }
    }

    onTrackChanged(trackData) {
        console.log('🎵 onTrackChanged llamado con:', trackData);

        if (trackData && trackData.artist_id) {
            this.currentArtistId = trackData.artist_id;
            console.log(`✅ Artist ID actualizado a: ${this.currentArtistId}`);

            // Re-agregar event listener al botón nuevo
            setTimeout(() => {
                this.attachFollowButtonListener();
                this.updateFollowButtonState();
            }, 50);
        }
    }

    updateFollowButtonState() {
        const followBtn = document.getElementById('artist-follow-btn');

        if (!followBtn || !this.currentArtistId) {
            console.log('⚠️  No se puede actualizar estado del botón:', {
                hasBtn: !!followBtn,
                hasArtistId: !!this.currentArtistId
            });
            return;
        }

        const url = `/accounts/api/check-following/${this.currentArtistId}/`;
        console.log(`🔍 Verificando estado de seguimiento para artista ${this.currentArtistId}`);

        fetch(url)
            .then(response => response.json())
            .then(data => {
                console.log('📲 Respuesta check-following:', data);
                this.setFollowButtonState(data.is_following);
            })
            .catch(error => console.error('❌ Error al verificar seguimiento:', error));
    }

    setFollowButtonState(isFollowing) {
        const followBtn = document.getElementById('artist-follow-btn');

        if (!followBtn) {
            console.warn('❌ Botón de follow no encontrado en el DOM');
            return;
        }

        console.log(`🔘 Actualizando estado del botón: ${isFollowing ? 'Seguido' : 'No seguido'}`);

        if (isFollowing) {
            followBtn.textContent = '✓ Seguido';
            followBtn.classList.add('btn--following');
            followBtn.classList.remove('btn--not-following');
        } else {
            followBtn.textContent = '+ Seguir';
            followBtn.classList.remove('btn--following');
            followBtn.classList.add('btn--not-following');
        }
    }

    onFollowClick(e) {
        e.preventDefault();

        if (!this.currentArtistId) {
            console.error('No hay artista seleccionado');
            return;
        }

        const url = `/accounts/api/follow-artist/${this.currentArtistId}/`;

        fetch(url, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    this.setFollowButtonState(data.is_following);

                    // Recargar sidebar si existe manager
                    if (typeof sidebarManager !== 'undefined') {
                        sidebarManager.loadSidebarSection(sidebarManager.currentSection);
                    }

                    // Disparar evento de seguimiento cambiado
                    document.dispatchEvent(new CustomEvent('followingChanged', {
                        detail: {
                            artist_id: this.currentArtistId,
                            is_following: data.is_following
                        }
                    }));

                    console.log(`✅ ${data.action === 'followed' ? 'Siguiendo' : 'No siguiendo'} artista`);
                }
            })
            .catch(error => console.error('Error al cambiar seguimiento:', error));
    }
}

// Instanciar cuando el DOM esté listo
let followSystem;
document.addEventListener('DOMContentLoaded', function() {
    followSystem = new FollowSystem();
});






