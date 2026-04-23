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

function loadSong(index) {
    trackIndex = index;
    const song = playlist[trackIndex];
    audio.src = song.url;
    document.getElementById('track-title').innerText = song.title;
    document.getElementById('track-art').src = song.cover;
    document.getElementById('track-artist').innerText = song.artist;
    audio.play();
}

function playPause() {
    if (audio.paused) audio.play();
    else audio.pause();
}

function restartSong() {
    audio.currentTime = 0;
}

function nextSong() {
    trackIndex = (trackIndex + 1) % playlist.length;
    loadSong(trackIndex);
}

function prevSong() {
    trackIndex = (trackIndex - 1 + playlist.length) % playlist.length;
    loadSong(trackIndex);
}

function toggleRepeat() {
    isRepeating = !isRepeating;
    document.getElementById('repeat-status').innerText = isRepeating ? "ON" : "OFF";
}

// ECORDATORIO PARA MI - Cuando termina la canción
audio.onended = () => {
    if (isRepeating) {
        audio.play();
    } else {
        nextSong();
    }
};
// RECORDATORIO PARA MI - Actualizar barra de progreso
audio.ontimeupdate = () => {
    const progress = (audio.currentTime / audio.duration) * 100;
    seekSlider.value = progress || 0;
};

function seekTo() {
    const seekTime = (seekSlider.value * audio.duration) / 100;
    audio.currentTime = seekTime;
}