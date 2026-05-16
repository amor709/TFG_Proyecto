
class PageLoader {
  constructor() {
    this.readyChecks = {
      critical: false  // Solo verificar que DOM esté listo
    };

    this.readyTimeout = null;
    this.startTime = performance.now();

    this.init();
  }

  init() {
    // Marcar que está en estado de carga
    document.documentElement.classList.add('is-loading');
    document.documentElement.classList.remove('is-ready');

    // Crear el loading screen si no existe
    this.createLoadingScreen();

    // Solo verificar DOM
    this.checkCritical();

    // Timeout máximo muy corto (1.7 segundos)
    this.readyTimeout = setTimeout(() => {
      this.markAsReady();
    }, 1700);
  }

  /**
   * Crear el elemento del loading screen
   */
  createLoadingScreen() {
    if (document.querySelector('.loading-screen')) return;

    const loadingScreen = document.createElement('div');
    loadingScreen.className = 'loading-screen';
    loadingScreen.innerHTML = `
      <div class="loading-logo">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" fill="none" stroke="#e8212e" stroke-width="2" opacity="0.2"/>
          <path d="M 50 20 A 30 30 0 0 1 80 50" fill="none" stroke="#e8212e" stroke-width="2.5" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="loading-spinner"></div>
      <p class="loading-text">Cargando tu música...</p>
    `;
    document.body.insertBefore(loadingScreen, document.body.firstChild);
  }

  /**
   * Solo esperar a que el DOM esté parseado (muy rápido)
   */
  checkCritical() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this.readyChecks.critical = true;
        this.markAsReady();
      });
    } else {
      // DOM ya está listo, mostrar inmediatamente
      this.readyChecks.critical = true;
      setTimeout(() => this.markAsReady(), 100);
    }
  }

  /**
   * Marcar la página como lista
   */
  markAsReady() {
    clearTimeout(this.readyTimeout);

    document.documentElement.classList.remove('is-loading');
    document.documentElement.classList.add('is-ready');

    document.dispatchEvent(new Event('pageLoaderReady'));
  }
}

// Inicializar apenas el documento comience a parsear
if (document.currentScript) {
  // Script está siendo ejecutado
  window.pageLoader = new PageLoader();
} else {
  // Script cargado de forma asincrónica
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.pageLoader = new PageLoader();
    });
  } else {
    window.pageLoader = new PageLoader();
  }
}









