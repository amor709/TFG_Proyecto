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

    // Cuando termina la canción.
    // Si NO es repeat, queue-system.js (queueSystem.onTrackFinished) se encarga
    // de avanzar; no llamamos a nextSong aquí para evitar doble shift de la cola.
    audio.addEventListener('ended', function() {
        if (isRepeating) {
            audio.currentTime = 0;
            audio.play();
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
    if (typeof queueSystem === 'undefined' || !queueSystem) return;
    if (queueSystem.queue.length > 0) {
        queueSystem.onTrackFinished();
    } else if (queueSystem.history.length > 0) {
        // Cola vacía: pedir sugerencias por la última del historial.
        queueSystem.performAutoPlay();
    }
}

function prevSong() {
    console.log('⏮️ Botón anterior clickeado');

    if (typeof queueSystem !== 'undefined' && queueSystem) {
        const history = queueSystem.history;
        // history.last === canción actual. Necesitamos al menos 2 entradas
        // para tener una "anterior" distinta.
        if (history.length < 2) {
            if (typeof audio !== 'undefined' && audio) {
                audio.currentTime = 0;
            }
            return;
        }
        const currentTrackId = history.pop();   // saca la actual
        const prevTrackId = history.pop();      // saca la anterior (la reproduciremos)
        queueSystem.saveHistoryToStorage();

        // Re-añadir la actual al inicio de la cola para que "siguiente" la recupere
        if (currentTrackId !== undefined && currentTrackId !== null) {
            queueSystem.queue.unshift(currentTrackId);
            queueSystem.saveQueueToStorage();
            queueSystem.updateQueueDisplay();
        }

        // Evitar que playSongA vacíe la cola y recargue sugerencias
        if (typeof window !== 'undefined') {
            window.__isPlayingFromQueue = true;
        }
        playSongA(prevTrackId);
        return;
    }

    // Fallback al antigua playlist
    if (typeof playlist !== 'undefined' && playlist.length > 0) {
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