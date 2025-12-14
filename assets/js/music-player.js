/**
 * Music Player Module
 * Handles playback of album tracks with controls for play/pause, navigation, and volume
 * 
 * @module MusicPlayer
 * @author Tyler Schwenk
 * @version 1.0.0
 */

(function() {
    'use strict';

    // ============================================================
    // CONSTANTS & CONFIGURATION
    // ============================================================
    
    /**
     * Album playlist configuration
     * @type {Array<{title: string, file: string}>}
     * @const
     */
    const PLAYLIST = [
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

    /**
     * Player button symbols
     * @const
     */
    const SYMBOLS = {
        PLAY: '▶',
        PAUSE: '⏸'
    };

    /**
     * Default volume level (0-100)
     * @const
     */
    const DEFAULT_VOLUME = 50;

    // ============================================================
    // STATE MANAGEMENT
    // ============================================================
    
    /**
     * Current track state
     * @type {Object}
     */
    const state = {
        currentTrackIndex: 0,
        isPlaying: false
    };

    // ============================================================
    // DOM ELEMENTS
    // ============================================================
    
    /**
     * Cached DOM elements
     * @type {Object}
     */
    const elements = {
        audio: null,
        playPauseBtn: null,
        prevBtn: null,
        nextBtn: null,
        trackInfo: null,
        volumeSlider: null
    };

    // ============================================================
    // CORE FUNCTIONS
    // ============================================================
    
    /**
     * Initialize the music player
     * Sets up event listeners and loads initial track
     * @returns {void}
     */
    function init() {
        if (!cacheDOMElements()) {
            console.error('Music Player: Failed to initialize - missing required DOM elements');
            return;
        }

        setupEventListeners();
        loadTrack(state.currentTrackIndex);
        setVolume(DEFAULT_VOLUME);
        updateTrackDisplay();
    }

    /**
     * Cache DOM element references for performance
     * @returns {boolean} True if all elements found, false otherwise
     */
    function cacheDOMElements() {
        elements.audio = document.getElementById('music-player');
        elements.playPauseBtn = document.getElementById('play-pause-btn');
        elements.prevBtn = document.getElementById('prev-btn');
        elements.nextBtn = document.getElementById('next-btn');
        elements.trackInfo = document.getElementById('track-info');
        elements.volumeSlider = document.getElementById('volume-slider');

        return Object.values(elements).every(el => el !== null);
    }

    /**
     * Set up all event listeners
     * @returns {void}
     */
    function setupEventListeners() {
        elements.playPauseBtn.addEventListener('click', handlePlayPause);
        elements.prevBtn.addEventListener('click', handlePreviousTrack);
        elements.nextBtn.addEventListener('click', handleNextTrack);
        elements.volumeSlider.addEventListener('input', handleVolumeChange);
        elements.audio.addEventListener('ended', handleTrackEnded);
        elements.audio.addEventListener('error', handleAudioError);
    }

    // ============================================================
    // PLAYBACK CONTROLS
    // ============================================================
    
    /**
     * Load a track by index
     * @param {number} index - Track index in playlist
     * @returns {void}
     */
    function loadTrack(index) {
        if (!isValidTrackIndex(index)) {
            console.warn(`Music Player: Invalid track index ${index}`);
            return;
        }

        elements.audio.src = PLAYLIST[index].file;
    }

    /**
     * Toggle play/pause state
     * @returns {void}
     */
    function togglePlayback() {
        if (state.isPlaying) {
            pauseTrack();
        } else {
            playTrack();
        }
    }

    /**
     * Play current track
     * @returns {void}
     */
    function playTrack() {
        elements.audio.play()
            .then(() => {
                state.isPlaying = true;
                updatePlayPauseButton();
            })
            .catch(error => {
                console.error('Music Player: Playback failed', error);
            });
    }

    /**
     * Pause current track
     * @returns {void}
     */
    function pauseTrack() {
        elements.audio.pause();
        state.isPlaying = false;
        updatePlayPauseButton();
    }

    /**
     * Navigate to previous track
     * @returns {void}
     */
    function previousTrack() {
        state.currentTrackIndex = (state.currentTrackIndex - 1 + PLAYLIST.length) % PLAYLIST.length;
        changeTrack();
    }

    /**
     * Navigate to next track
     * @returns {void}
     */
    function nextTrack() {
        state.currentTrackIndex = (state.currentTrackIndex + 1) % PLAYLIST.length;
        changeTrack();
    }

    /**
     * Change to a new track and maintain playback state
     * @returns {void}
     */
    function changeTrack() {
        loadTrack(state.currentTrackIndex);
        updateTrackDisplay();
        
        if (state.isPlaying) {
            playTrack();
        }
    }

    /**
     * Set volume level
     * @param {number} level - Volume level (0-100)
     * @returns {void}
     */
    function setVolume(level) {
        const normalizedVolume = Math.max(0, Math.min(100, level)) / 100;
        elements.audio.volume = normalizedVolume;
    }

    // ============================================================
    // UI UPDATES
    // ============================================================
    
    /**
     * Update track information display
     * @returns {void}
     */
    function updateTrackDisplay() {
        const trackNumber = state.currentTrackIndex + 1;
        const totalTracks = PLAYLIST.length;
        const trackTitle = PLAYLIST[state.currentTrackIndex].title;
        
        elements.trackInfo.textContent = `${trackNumber}/${totalTracks}: ${trackTitle}`;
    }

    /**
     * Update play/pause button icon
     * @returns {void}
     */
    function updatePlayPauseButton() {
        elements.playPauseBtn.textContent = state.isPlaying ? SYMBOLS.PAUSE : SYMBOLS.PLAY;
    }

    // ============================================================
    // EVENT HANDLERS
    // ============================================================
    
    /**
     * Handle play/pause button click
     * @param {Event} event - Click event
     * @returns {void}
     */
    function handlePlayPause(event) {
        event.preventDefault();
        togglePlayback();
    }

    /**
     * Handle previous track button click
     * @param {Event} event - Click event
     * @returns {void}
     */
    function handlePreviousTrack(event) {
        event.preventDefault();
        previousTrack();
    }

    /**
     * Handle next track button click
     * @param {Event} event - Click event
     * @returns {void}
     */
    function handleNextTrack(event) {
        event.preventDefault();
        nextTrack();
    }

    /**
     * Handle track end - auto-advance to next track
     * @returns {void}
     */
    function handleTrackEnded() {
        nextTrack();
        playTrack();
    }

    /**
     * Handle volume slider input
     * @param {Event} event - Input event
     * @returns {void}
     */
    function handleVolumeChange(event) {
        setVolume(parseInt(event.target.value, 10));
    }

    /**
     * Handle audio loading/playback errors
     * @param {Event} event - Error event
     * @returns {void}
     */
    function handleAudioError(event) {
        console.error('Music Player: Audio error occurred', {
            track: PLAYLIST[state.currentTrackIndex].title,
            error: event.target.error
        });
    }

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================
    
    /**
     * Validate track index
     * @param {number} index - Track index to validate
     * @returns {boolean} True if valid, false otherwise
     */
    function isValidTrackIndex(index) {
        return Number.isInteger(index) && index >= 0 && index < PLAYLIST.length;
    }

    // ============================================================
    // INITIALIZATION
    // ============================================================
    
    // Initialize player when DOM is ready
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded
        init();
    }

})();
