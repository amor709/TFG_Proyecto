/**
 * script.js - Scripts globales de la aplicación
 * Incluye manejo de búsqueda global en el header
 */

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initHeaderSearch();
});

/**
 * Inicializar la búsqueda del header superior
 */
function initHeaderSearch() {
    const searchInput = document.querySelector('.search-bar__input');

    if (!searchInput) {
        return;
    }

    // Manejar cuando el usuario presiona Enter
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = this.value.trim();

            if (query.length < 1) {
                return;
            }

            // Navegar a la página de resultados
            const searchUrl = `/search/?q=${encodeURIComponent(query)}`;
            window.location.href = searchUrl;
        }
    });

}
