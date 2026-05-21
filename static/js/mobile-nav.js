/**
 * mobile-nav.js - Navegación móvil (barra de pestañas inferior).
 *
 * Controla la apertura/cierre de los paneles "Buscar" y "Tu música"
 * mediante clases en <body> (m-search-open / m-library-open). Toda la
 * presentación vive en responsive-mobile.css y solo aplica en ≤768px,
 * por lo que en escritorio este script no produce ningún efecto visible.
 */
(function () {
    'use strict';

    const body = document.body;

    function syncTabs() {
        const searchOpen = body.classList.contains('m-search-open');
        const libraryOpen = body.classList.contains('m-library-open');
        document.querySelectorAll('.mobile-tab').forEach(function (tab) {
            const name = tab.getAttribute('data-tab');
            let active = false;
            if (name === 'search') {
                active = searchOpen;
            } else if (name === 'library') {
                active = libraryOpen;
            } else if (name === 'home') {
                active = !searchOpen && !libraryOpen;
            }
            tab.classList.toggle('mobile-tab--active', active);
        });
    }

    function closeAll() {
        body.classList.remove('m-search-open', 'm-library-open');
        syncTabs();
    }

    function toggleMobileSearch() {
        const willOpen = !body.classList.contains('m-search-open');
        closeAll();
        if (willOpen) {
            body.classList.add('m-search-open');
            const input = document.querySelector('.search-bar__input');
            if (input) {
                input.focus();
            }
        }
        syncTabs();
    }

    function toggleMobileLibrary() {
        const willOpen = !body.classList.contains('m-library-open');
        closeAll();
        if (willOpen) {
            body.classList.add('m-library-open');
        }
        syncTabs();
    }

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeAll();
        }
    });

    // Exponer para los onclick del template
    window.toggleMobileSearch = toggleMobileSearch;
    window.toggleMobileLibrary = toggleMobileLibrary;

    document.addEventListener('DOMContentLoaded', syncTabs);
})();
