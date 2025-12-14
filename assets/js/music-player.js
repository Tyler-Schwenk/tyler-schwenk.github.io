// Music Player for Album Playlist
(function() {
    const playlist = [
        { title: "Tezeta", file: "audio/01 Tezeta.mp3" },
        { title: "Endegena", file: "audio/02 Endegena.mp3" },
        { title: "Zengadyw Dereku", file: "audio/03 Zengadyw Dereku.mp3" },
        { title: "Gumegum", file: "audio/04 Gumegum.mp3" },
        { title: "Nefas New Zemedie", file: "audio/05 Nefas New Zemedie.mp3" },
        { title: "Atmetalegnem Woi", file: "audio/06 Atmetalegnem Woi.mp3" },
        { title: "Mestirawi Debdabe", file: "audio/07 Mestirawi Debdabe.mp3" },
        { title: "Ou-Ou-Ta", file: "audio/08 Ou-Ou-Ta.mp3" },
        { title: "Aya Belew Belew", file: "audio/09 Aya Belew Belew.mp3" }
    ];

    let currentTrack = 0;
    let isPlaying = false;

    const audio = document.getElementById('music-player');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const trackInfo = document.getElementById('track-info');
    const volumeSlider = document.getElementById('volume-slider');

    // Initialize
    function init() {
        loadTrack(currentTrack);
        audio.volume = volumeSlider.value / 100;
        updateTrackInfo();
    }

    // Load track
    function loadTrack(index) {
        audio.src = playlist[index].file;
    }

    // Update track info display
    function updateTrackInfo() {
        trackInfo.textContent = `${currentTrack + 1}/${playlist.length}: ${playlist[currentTrack].title}`;
    }

    // Play/Pause
    playPauseBtn.addEventListener('click', function() {
        if (isPlaying) {
            audio.pause();
            playPauseBtn.textContent = '▶';
            isPlaying = false;
        } else {
            audio.play();
            playPauseBtn.textContent = '⏸';
            isPlaying = true;
        }
    });

    // Previous track
    prevBtn.addEventListener('click', function() {
        currentTrack--;
        if (currentTrack < 0) {
            currentTrack = playlist.length - 1;
        }
        loadTrack(currentTrack);
        updateTrackInfo();
        if (isPlaying) {
            audio.play();
        }
    });

    // Next track
    nextBtn.addEventListener('click', function() {
        currentTrack++;
        if (currentTrack >= playlist.length) {
            currentTrack = 0;
        }
        loadTrack(currentTrack);
        updateTrackInfo();
        if (isPlaying) {
            audio.play();
        }
    });

    // Auto-play next track when current ends
    audio.addEventListener('ended', function() {
        currentTrack++;
        if (currentTrack >= playlist.length) {
            currentTrack = 0; // Loop back to first track
        }
        loadTrack(currentTrack);
        updateTrackInfo();
        audio.play();
    });

    // Volume control
    volumeSlider.addEventListener('input', function() {
        audio.volume = this.value / 100;
    });

    // Initialize on page load
    window.addEventListener('DOMContentLoaded', init);
})();
