async function playSongA(trackId) {
    try {
        console.log('Intentando reproducir canción ID:', trackId);
        const url = `/music/api/track/${trackId}/`;
        console.log('URL de fetch:', url);

        const response = await fetch(url);
        console.log('Respuesta status:', response.status);

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: No se pudo cargar la canción`);
        }

        const trackData = await response.json();
        console.log('Datos de la canción recibidos:', trackData);
        console.log('URL del audio:', trackData.audio_url);

        updatePlayer(trackData);
        updateRightPanel(trackData);

         // Aqui se reproduce la canción
         const audio = document.getElementById('main-audio');
         if (!audio) {
             throw new Error('No se encontró el elemento de audio (main-audio)');
         }

         if (trackData.audio_url) {
             audio.src = trackData.audio_url;

             // Esperam,os a que el audio esté listo antes de reproducir
             audio.oncanplay = function() {
                 audio.play().catch(err => {
                     console.error('Error al reproducir audio:', err);
                 });
             };

             // Manejo de errores del audio
             audio.onerror = function() {
                 alert('⚠ No se pudo cargar el archivo de audio. Verifica que exista.');
             };

             // Actualizar barra de progreso visual
             audio.ontimeupdate = function() {
                 if (audio.duration) {
                     const progress = (audio.currentTime / audio.duration) * 100;
                     document.documentElement.style.setProperty('--progress', progress + '%');

                     // Actualizar slider
                     const seekSlider = document.getElementById('seek-slider');
                     if (seekSlider) {
                         seekSlider.value = progress;
                     }

                     // Actualizar tiempos
                     updateTimeDisplay(audio.currentTime, audio.duration);
                 }
             };

             // Actualizar duración cuando se carga el metadata
             audio.onloadedmetadata = function() {
                 updateTimeDisplay(0, audio.duration);
             };

             // Cargar el audio
             audio.load();
         } else {
             throw new Error('La canción no tiene archivo de audio (audio_url vacío)');
         }

    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Aqui se cambia el player
function updatePlayer(trackData) {
    const trackArtImg = document.getElementById('track-art');
    const trackTitle = document.getElementById('track-title');
    const trackArtist = document.getElementById('track-artist');

    if (trackArtImg) trackArtImg.src = trackData.cover;
    if (trackTitle) trackTitle.textContent = trackData.title;
    if (trackArtist) trackArtist.textContent = trackData.artist;
}

// Aqui se cambia el panel derecho
function updateRightPanel(trackData) {
    const rightPanel = document.querySelector('.right-panel');

    if (!rightPanel) return;

    rightPanel.innerHTML = `
        <div class="right-panel__album-cover">
            <img src="${trackData.cover}" alt="${trackData.title}" class="album-cover__img">
            <p class="album-cover__title">${trackData.title}</p>
        </div>
        
        <div class="right-panel__track-info">
            <h3 class="track-info__title">${trackData.title}</h3>
            <div class="track-info__meta">
                <img src="/static/img/diamond-white.png" alt="" class="icon--xs">
                <span class="track-info__artist">${trackData.artist}</span>
            </div>
        </div>
        
        <div class="right-panel__related">
            <h4 class="related__heading">Cancioncita de…</h4>
            <div class="related__artist-card">
                <img src="${trackData.related_artist.photo}" 
                     alt="${trackData.related_artist.name}" 
                     class="related__artist-photo">
                <div class="related__artist-info">
                    <span class="related__artist-name">${trackData.related_artist.name}</span>
                    <button class="btn-follow" 
                            data-artist-id="${trackData.related_artist.id}" 
                            aria-label="Seguir a ${trackData.related_artist.name}">
                        + Seguir
                    </button>
                </div>
            </div>
        </div>
    `;
}

