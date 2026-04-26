async function playSongA(trackId) {
    try {
        const response = await fetch(`/music/api/track/${trackId}/`);
        if (!response.ok) {
            throw new Error('No se pudo cargar la canción');
        }
        const trackData = await response.json();
        updatePlayer(trackData);
        updateRightPanel(trackData);

        // Aqui se reproduce la canción
        if (trackData.audio_url) {
            const audio = document.getElementById('main-audio');
            audio.src = trackData.audio_url;
            audio.play();
        }

    } catch (error) {
        console.error('Error al cargar la canción:', error);
        alert('⚠️ Error al cargar la canción. Intenta de nuevo.');
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

