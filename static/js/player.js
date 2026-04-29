const playlist = [
    {% for song in songs %}
    {
        title: "{{ song.title }}",
        url: "{{ song.audio_file.url }}",
        cover: "{{ song.cover.url }}",
        artist: "{{ song.artist.user.username }}"
    },
    {% endfor %}
];

let trackIndex = 0;
let isRepeating = false;
const audio = document.getElementById('main-audio');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');

// Esperar a que el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    initializePlayer();
});

function initializePlayer() {
    if (!audio) {
        console.error('Elemento de audio no encontrado');
        return;
    }

    // Configurar volumen inicial
    if (volumeSlider) {
        audio.volume = volumeSlider.value / 100;
        volumeSlider.addEventListener('input', function() {
            audio.volume = this.value / 100;
            console.log('Volumen:', audio.volume);
        });
    }

    // Configurar barra de progreso
    if (seekSlider) {
        seekSlider.addEventListener('input', function() {
            if (audio.duration) {
                audio.currentTime = (this.value * audio.duration) / 100;
            }
        });
    }

    // Actualizar barra al reproducir
    audio.addEventListener('timeupdate', function() {
        if (seekSlider && audio.duration) {
            const progress = (audio.currentTime / audio.duration) * 100;
            seekSlider.value = progress || 0;
            updateProgressBar(progress);
        }
    });

    // Cuando termina la canción
    audio.addEventListener('ended', function() {
        if (isRepeating) {
            audio.currentTime = 0;
            audio.play();
        } else {
            nextSong();
        }
    });

    console.log('Reproductor inicializado');
}

function loadSong(index) {
    if (playlist.length === 0) {
        console.error('La playlist está vacía');
        return;
    }
    trackIndex = index % playlist.length;
    const song = playlist[trackIndex];
    audio.src = song.url;
    document.getElementById('track-title').innerText = song.title;
    document.getElementById('track-art').src = song.cover;
    document.getElementById('track-artist').innerText = song.artist;
    audio.play().catch(err => {
        console.error(' Error al reproducir:', err);
    });
    console.log('Reproduciendo:', song.title);
}

function playPause() {
    if (!audio) return;

    if (audio.paused) {
        audio.play().catch(err => {
            console.error('Error al reproducir:', err);
        });
        console.log('Reproduciendo...');
    } else {
        audio.pause();
        console.log('Pausado');
    }
}

function restartSong() {
    if (audio) {
        audio.currentTime = 0;
        updateProgressBar(0);
    }
}

function nextSong() {
    if (playlist.length > 0) {
        trackIndex = (trackIndex + 1) % playlist.length;
        loadSong(trackIndex);
    }
}

function prevSong() {
    if (playlist.length > 0) {
        trackIndex = (trackIndex - 1 + playlist.length) % playlist.length;
        loadSong(trackIndex);
    }
}

function toggleRepeat() {
    isRepeating = !isRepeating;
}

function updateProgressBar(progress) {
    // Esta función se llama desde timeupdate para actualizar visualmente la barra
    // Los estilos se actualizan en CSS con la variable --progress
    document.documentElement.style.setProperty('--progress', progress + '%');
}