/**
 * register-recent.js
 * Registra automáticamente cuando se visita una página de detalle
 * (álbum, playlist, artista)
 */

function registerRecentItem(contentType, objectId) {
    if (!contentType || !objectId) {
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
            // Recargar sidebar si existe
            if (typeof sidebarManager !== 'undefined' && sidebarManager) {
                sidebarManager.reloadCurrentSection();
            }
        } else {
        }
    })
    .catch(() => {});
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

