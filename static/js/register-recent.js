/**
 * register-recent.js
 * Registra automáticamente cuando se visita una página de detalle
 * (álbum, playlist, artista)
 */

function registerRecentItem(contentType, objectId) {
    if (!contentType || !objectId) {
        console.warn('❌ registerRecentItem: contentType o objectId faltante');
        return;
    }
    
    const url = `/accounts/sidebar/add-recent/${contentType}/${objectId}/`;
    
    fetch(url, {
        method: 'POST',
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log(`✅ Registrado en recientes: ${contentType} ${objectId}`);
            // Recargar sidebar si existe
            if (typeof sidebarManager !== 'undefined' && sidebarManager) {
                sidebarManager.reloadCurrentSection();
            }
        } else {
            console.error('❌ Error al registrar:', data.error);
        }
    })
    .catch(error => console.error('Error en registerRecentItem:', error));
}

function getCookie(name) {
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

