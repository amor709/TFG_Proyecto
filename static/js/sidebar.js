/**
 * sidebar.js - Gestión del sidebar izquierdo
 * Funcionalidades:
 * - Cargar secciones (Recientes, Guardados)
 * - Búsqueda en tiempo real
 * - Añadir items a recientes al visitarlos
 */

class SidebarManager {
    constructor() {
        this.sidebarList = document.getElementById('sidebar-list');
        this.filterChips = document.querySelectorAll('.filter-chip');
        this.searchInput = document.querySelector('.sidebar__search-input');
        this.currentSection = 'recent';
        this.searchTimeout = null;
        this.isLoading = false;

        this.init();
    }

    init() {
        // Cargar sección inicial (Recientes)
        this.loadSidebarSection('recent');

        // Event listeners para los chips de filtro
        this.filterChips.forEach(chip => {
            chip.addEventListener('click', (e) => this.onFilterChipClick(e));
        });

        // Event listener para la búsqueda
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => this.onSearchInput(e));
        }

        console.log('✅ SidebarManager inicializado');
    }

    /**
     * Maneja el clic en los chips de filtro (Recientes/Guardados)
     */
    onFilterChipClick(e) {
        const section = e.target.dataset.section;
        if (section === this.currentSection) return;

        // Actualizar estado visual de los chips
        this.filterChips.forEach(c => c.classList.remove('filter-chip--active'));
        e.target.classList.add('filter-chip--active');

        // Limpiar búsqueda y cargar nueva sección
        this.currentSection = section;
        this.searchInput.value = '';
        this.loadSidebarSection(section);
    }

    /**
     * Recargar la sección actual (útil cuando se añade algo nuevo a recientes)
     */
    reloadCurrentSection() {
        if (this.currentSection === 'recent') {
            this.loadSidebarSection(this.currentSection);
        }
    }

    /**
     * Maneja la entrada de búsqueda con debounce
     */
    onSearchInput(e) {
        clearTimeout(this.searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) {
            // Si hay menos de 2 caracteres, mostrar la sección actual
            this.loadSidebarSection(this.currentSection);
            return;
        }

        // Debounce de 300ms
        this.searchTimeout = setTimeout(() => {
            this.loadSearchResults(query);
        }, 300);
    }

    /**
     * Cargar una sección (recientes o guardados)
     */
    loadSidebarSection(section) {
        this.setLoading(true);

        const url = section === 'recent'
            ? '/accounts/sidebar/recent/'
            : '/accounts/sidebar/saved/';

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Error al cargar sidebar');
                return response.json();
            })
            .then(data => {
                this.renderSidebarItems(data.items);
                this.setLoading(false);
            })
            .catch(error => {
                console.error('❌ Error al cargar sidebar:', error);
                this.setLoading(false);
                this.showError('Error al cargar items');
            });
    }

     /**
      * Cargar resultados de búsqueda
      */
     loadSearchResults(query) {
         this.setLoading(true);
         const url = `/accounts/sidebar/search/?q=${encodeURIComponent(query)}&section=${this.currentSection}`;

         fetch(url)
             .then(response => {
                 if (!response.ok) throw new Error('Error en búsqueda');
                 return response.json();
             })
             .then(data => {
                 this.renderSidebarItems(data.items);
                 this.setLoading(false);
                 if (data.items.length === 0) {
                     this.showMessage('No se encontraron resultados');
                 }
             })
             .catch(error => {
                 console.error('❌ Error en búsqueda:', error);
                 this.setLoading(false);
                 this.showError('Error en la búsqueda');
             });
     }

    /**
     * Renderizar items en el sidebar
     */
    renderSidebarItems(items) {
        // Preservar elementos fijos (como "Mis Joyas")
        const fixedItems = this.sidebarList.querySelectorAll('.sidebar-item--fixed');
        this.sidebarList.innerHTML = '';

        // Re-insertar elementos fijos
        fixedItems.forEach(item => this.sidebarList.appendChild(item));

        if (items.length === 0) {
            return;
        }

        // Crear y añadir elementos dinámicos
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'sidebar-item';

            // Construir URL basada en el tipo
            const url = this.buildItemUrl(item);

            li.innerHTML = `
                <a href="${url}" class="sidebar-item__link" onclick="sidebarManager.addToRecent('${item.type}', ${item.id}, event)">
                    <div class="sidebar-item__thumb">
                        ${item.cover 
                            ? `<img src="${item.cover}" alt="${item.title}" class="sidebar-item__img">`
                            : '<div class="sidebar-item__placeholder"></div>'
                        }
                    </div>
                    <div class="sidebar-item__info">
                        <span class="sidebar-item__name">${this.escapeHtml(item.title)}</span>
                        <span class="sidebar-item__sub">
                            ${this.getTypeLabel(item.type)}
                            ${item.artist ? ' – ' + this.escapeHtml(item.artist) : ''}
                        </span>
                    </div>
                </a>
            `;

            this.sidebarList.appendChild(li);
        });
    }

    /**
     * Construir URL basada en el tipo de item
     */
    buildItemUrl(item) {
        const baseUrl = window.location.origin;

        switch(item.type) {
            case 'album':
                return `${baseUrl}/music/album/${item.id}/`;
            case 'playlist':
                return `${baseUrl}/playlists/${item.id}/`;
            case 'artistprofile':
                return `${baseUrl}/music/artist/${item.id}/`;
            default:
                return '#';
        }
    }

    /**
     * Obtener etiqueta legible del tipo de item
     */
    getTypeLabel(type) {
        const labels = {
            'album': 'Álbum',
            'playlist': 'Playlist',
            'artistprofile': 'Artista'
        };
        return labels[type] || type;
    }

    /**
     * Añadir item a recientes (llamado desde el HTML onclick)
     */
    addToRecent(contentType, objectId) {
        // No prevenir el comportamiento por defecto, dejar que navegue normalmente
        const url = `/accounts/sidebar/add-recent/${contentType}/${objectId}/`;

        fetch(url, { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log(`✅ Añadido a recientes: ${contentType} ${objectId}`);
                } else {
                    console.error('❌ Error al añadir a recientes:', data.error);
                }
            })
            .catch(error => console.error('Error:', error));
    }

    /**
     * Establecer estado de carga
     */
    setLoading(isLoading) {
        this.isLoading = isLoading;
        if (isLoading) {
            this.sidebarList.classList.add('sidebar__list--loading');
        } else {
            this.sidebarList.classList.remove('sidebar__list--loading');
        }
    }

    /**
     * Mostrar mensaje en el sidebar
     */
    showMessage(message) {
        const div = document.createElement('div');
        div.className = 'sidebar-message';
        div.textContent = message;
        this.sidebarList.appendChild(div);
    }

    /**
     * Mostrar error en el sidebar
     */
    showError(message) {
        const div = document.createElement('div');
        div.className = 'sidebar-message sidebar-message--error';
        div.textContent = message;
        this.sidebarList.appendChild(div);
    }

    /**
     * Escape HTML para evitar XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Instanciar el manager cuando el DOM esté listo
let sidebarManager;
document.addEventListener('DOMContentLoaded', function() {
    sidebarManager = new SidebarManager();
});