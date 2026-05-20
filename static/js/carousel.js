/**
 * Navegación de carruseles.
 *
 * Cada botón con clase .carousel-nav-btn debe tener:
 *   data-target = ID del .carousel
 *   data-dir    = -1 (anterior) o 1 (siguiente)
 *
 * El carrusel correspondiente debe tener estructura:
 *   <div class="carousel" id="ID">
 *     <div class="carousel__track">
 *       <article class="carousel__item">...</article>
 *     </div>
 *   </div>
 */
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.carousel-nav-btn');
    if (!btn) return;
    const id = btn.dataset.target;
    const dir = parseInt(btn.dataset.dir, 10);
    const carousel = document.getElementById(id);
    if (!carousel) return;
    const track = carousel.querySelector('.carousel__track');
    if (!track) return;
    const item = track.querySelector('.carousel__item');
    const step = item ? item.offsetWidth + 16 : 200; // 16 = var(--space-4)
    const max = track.scrollWidth - track.parentElement.offsetWidth;
    const current = parseInt(track.style.transform?.replace(/[^-\d]/g, '') || 0, 10);
    const next = Math.min(0, Math.max(-max, current - dir * step));
    track.style.transform = `translateX(${next}px)`;
});
