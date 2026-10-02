"""beat tracking for the bpm agent: turns mic audio into spectrum bands, a bass onset curve,
and a tempo + beat phase estimate.

pure numpy with no audio i/o, so it can be fed a synthetic click track to test it (see the
README). the agent feeds it one hop of samples at a time (process) and asks for a tempo
estimate a few times a second (estimate).

how the beat is found:
1. each hop, the bass band's log-compressed spectral flux (how much louder the kick/bass
   just got) becomes one onset value. the kick carries the beat far more reliably than
   broadband energy, which picks up hi-hats and vocals at the wrong rate
2. the last few seconds of onsets are autocorrelated, and every tempo on a 1 bpm grid is
   scored by how well the onsets repeat at that beat period (and at two beats, which
   breaks the tie between a tempo and its double). a broad prior around 120 bpm settles
   the classic half/double tempo ambiguity
3. the beat's phase comes from a comb: slide a train of beat-spaced teeth back over the
   recent onsets and keep the alignment that lands on the most onset energy
4. a beat clock (a tiny phase-locked loop) runs at the smoothed tempo and only nudges its
   phase toward each new measurement, so one sloppy onset doesn't make the visuals jump

known limit: half/double tempo is a guess when the music fits both (it's the classic hard
case for every beat tracker). 174 bpm drum and bass reads as 87, for example. the visuals
still land on beats, just every other one.
"""

from collections import deque
from dataclasses import dataclass

import numpy as np

SAMPLE_RATE_HZ = 44100
# one frame (spectrum column + onset value) per hop, ~86 a second
HOP_SAMPLES = 512
# ~21.5 Hz bins: enough to keep the kick/bass apart from everything above it
FFT_SIZE = 2048
FRAME_RATE_HZ = SAMPLE_RATE_HZ / HOP_SAMPLES
INT16_FULL_SCALE = 32768.0
# keeps log10 away from zero on digital silence
EPSILON = 1e-12

# spectrum bands for the visuals and the calibration spectrogram, log-spaced like hearing
DISPLAY_BAND_COUNT = 64
DISPLAY_MIN_HZ = 40.0
DISPLAY_MAX_HZ = 12000.0
DISPLAY_FLOOR_DB = -90.0
DISPLAY_CEIL_DB = -10.0
DISPLAY_LEVELS = 255

# the band the onset curve listens to: kick drum and bass line
ONSET_MIN_HZ = 40.0
ONSET_MAX_HZ = 200.0
# log1p(gain * magnitude) compresses loud and quiet hits toward each other, so a quiet
# song's kick still makes a clear onset
ONSET_LOG_GAIN = 1000.0

# below this average level (dbfs) the room counts as silent: no tempo is reported, rather
# than a guess off the noise floor. watch the level meter in calibration to tune it
SILENCE_DB = -55.0
SILENCE_WINDOW_S = 1.5

# how much onset history a tempo estimate looks at, and how much it needs before the first one
TEMPO_WINDOW_S = 8.0
TEMPO_MIN_WINDOW_S = 4.0
# the onset curve has its local average (this wide) taken off, leaving just the peaks
DETREND_WINDOW_S = 0.25

MIN_BPM = 60
MAX_BPM = 200
BPM_GRID_STEP = 1
# a log-normal prior centred here, this many octaves wide. it decides between a tempo and
# its double/half when the onsets fit both about equally
PRIOR_CENTER_BPM = 120.0
PRIOR_STD_OCTAVES = 1.0
# how much the onsets repeating two beats later counts toward a tempo's score
SECOND_BEAT_WEIGHT = 0.5
# autocorrelation at the chosen beat period (0..1) needed to report a tempo at all
MIN_CONFIDENCE = 0.1

# a new estimate within this fraction of the current tempo eases it along; one further
# off has to repeat TEMPO_SWITCH_UPDATES estimates in a row before the tempo jumps to it
TEMPO_TOLERANCE = 0.03
TEMPO_SMOOTHING = 0.3
TEMPO_SWITCH_UPDATES = 4

# the phase comb looks back over this many beats, each counting this much less than the next
PHASE_BEATS = 8
PHASE_BEAT_DECAY = 0.85
# how far the beat clock moves toward each new phase measurement (1 would snap to it)
PHASE_GAIN = 0.3
# a measurement further off the clock than this fraction of a beat is ignored (the comb
# can land on the off-beat, or on the other beat of a half-tempo pair), unless this many
# in a row agree the clock is off, which means the beat really moved
PHASE_MAX_ERROR_BEATS = 0.25
PHASE_RELOCK_UPDATES = 4

SECONDS_PER_MINUTE = 60.0

WINDOW = np.hanning(FFT_SIZE)
# scales the fft so a full-scale sine reads magnitude 1
WINDOW_GAIN = WINDOW.sum() / 2
FFT_FREQS_HZ = np.fft.rfftfreq(FFT_SIZE, 1 / SAMPLE_RATE_HZ)
ONSET_BINS = np.flatnonzero((FFT_FREQS_HZ >= ONSET_MIN_HZ) & (FFT_FREQS_HZ <= ONSET_MAX_HZ))
BAND_EDGES_HZ = np.geomspace(DISPLAY_MIN_HZ, DISPLAY_MAX_HZ, DISPLAY_BAND_COUNT + 1)
BPM_GRID = np.arange(MIN_BPM, MAX_BPM + BPM_GRID_STEP, BPM_GRID_STEP, dtype=float)
TEMPO_PRIOR = np.exp(-0.5 * (np.log2(BPM_GRID / PRIOR_CENTER_BPM) / PRIOR_STD_OCTAVES) ** 2)


def build_band_weights() -> np.ndarray:
    """builds the matrix that averages fft power into the display bands.

    the lowest bands are narrower than one fft bin, so a band with no bin inside it takes
    the bin nearest its centre (neighbouring low bands then share a bin).

    returns:
        (DISPLAY_BAND_COUNT, fft bins) weights; each row sums to 1.
    """
    weights = np.zeros((DISPLAY_BAND_COUNT, FFT_FREQS_HZ.size))
    for band, (low_hz, high_hz) in enumerate(zip(BAND_EDGES_HZ[:-1], BAND_EDGES_HZ[1:], strict=True)):
        bins = np.flatnonzero((FFT_FREQS_HZ >= low_hz) & (FFT_FREQS_HZ < high_hz))
        if bins.size == 0:
            bins = np.array([np.argmin(np.abs(FFT_FREQS_HZ - np.sqrt(low_hz * high_hz)))])
        weights[band, bins] = 1.0 / bins.size
    return weights


BAND_WEIGHTS = build_band_weights()


@dataclass(frozen=True)
class Frame:
    """one hop of analysed audio.

    attributes:
        time_s: when the hop's last sample was captured, epoch seconds.
        bands: DISPLAY_BAND_COUNT levels 0..DISPLAY_LEVELS, low to high frequency.
        onset: bass onset strength (spectral flux; 0 when nothing new hit).
        level_db: the hop's rms level in dbfs.
    """

    time_s: float
    bands: np.ndarray
    onset: float
    level_db: float


@dataclass(frozen=True)
class TempoEstimate:
    """the tracker's current idea of the beat.

    attributes:
        bpm: smoothed tempo, or None when silent or no clear beat.
        confidence: autocorrelation at the beat period, 0..1 (0 when silent).
        beat_s: time of a beat on the beat clock, epoch seconds (None with bpm). beats
            fall every period_s before and after it.
        period_s: seconds per beat (None with bpm).
        level_db: average level over the last SILENCE_WINDOW_S, dbfs.
        curve: prior-weighted score per BPM_GRID tempo, scaled to max 1 (zeros when silent).
    """

    bpm: float | None
    confidence: float
    beat_s: float | None
    period_s: float | None
    level_db: float
    curve: np.ndarray


def to_db(power: np.ndarray | float) -> np.ndarray | float:
    """converts power (amplitude squared, full scale 1) to dbfs."""
    return 10 * np.log10(np.asarray(power) + EPSILON)


def autocorrelate(x: np.ndarray) -> np.ndarray:
    """normalised, unbiased autocorrelation of a signal, taken about its mean.

    args:
        x: the signal.

    returns:
        one value per lag (0..len-1), 1 at lag 0, all zeros for a flat signal. noise
        reads near 0 at every other lag, a steady pulse near 1 at its period.
    """
    n = x.size
    # without the mean off, a never-negative signal (like detrended onsets) correlates
    # with itself at every lag and plain noise looks like a beat
    spectrum = np.fft.rfft(x - x.mean(), 2 * n)
    ac = np.fft.irfft(np.abs(spectrum) ** 2)[:n]
    if ac[0] <= 0:
        return np.zeros(n)
    # unbiased: a long lag overlaps fewer samples, so scale each lag back up by its overlap
    return ac / ac[0] * n / (n - np.arange(n))


def detrend(onsets: np.ndarray) -> np.ndarray:
    """takes the local average off an onset curve and keeps what pokes above it.

    args:
        onsets: onset values, oldest first.

    returns:
        the peaks, same length, never negative.
    """
    width = max(1, round(DETREND_WINDOW_S * FRAME_RATE_HZ))
    local_mean = np.convolve(onsets, np.ones(width) / width, mode="same")
    return np.maximum(onsets - local_mean, 0)


def sample_at(x: np.ndarray, index: np.ndarray | float) -> np.ndarray | float:
    """reads a signal at fractional indexes with linear interpolation (0 outside it)."""
    return np.interp(index, np.arange(x.size), x, left=0.0, right=0.0)


def score_tempos(ac: np.ndarray) -> np.ndarray:
    """scores every BPM_GRID tempo by how well the onsets repeat at its beat period.

    args:
        ac: autocorrelation of the detrended onsets.

    returns:
        one score per tempo, prior not applied, never negative.
    """
    lags = SECONDS_PER_MINUTE * FRAME_RATE_HZ / BPM_GRID
    scores = sample_at(ac, lags) + SECOND_BEAT_WEIGHT * sample_at(ac, 2 * lags)
    return np.maximum(scores, 0)


def refine_peak(values: np.ndarray, index: int) -> float:
    """finds a peak between grid points by fitting a parabola through it and its neighbours.

    args:
        values: the curve.
        index: the grid peak.

    returns:
        the fractional index of the true peak (just index at either end of the curve).
    """
    if index == 0 or index == values.size - 1:
        return float(index)
    before, peak, after = values[index - 1], values[index], values[index + 1]
    curvature = before - 2 * peak + after
    if curvature >= 0:
        return float(index)
    return index + 0.5 * (before - after) / curvature


def find_last_beat(x: np.ndarray, period_frames: float) -> float:
    """finds how many frames before the newest one the last beat fell.

    slides a comb of PHASE_BEATS beat-spaced teeth back over the onsets and keeps the
    offset that lands on the most onset energy (recent beats count most).

    args:
        x: detrended onsets, oldest first.
        period_frames: beat period in frames.

    returns:
        frames back from the newest frame, 0 <= result < period_frames.
    """
    offsets = np.arange(int(np.ceil(period_frames)))
    beats = np.arange(PHASE_BEATS)
    indexes = (x.size - 1) - offsets[:, None] - beats[None, :] * period_frames
    energy = sample_at(x, indexes) * PHASE_BEAT_DECAY ** beats[None, :]
    return float(offsets[np.argmax(energy.sum(axis=1))])


class BeatTracker:
    """keeps the recent audio and onsets, and turns them into tempo estimates.

    not thread-safe: the agent's capture thread is the only caller.
    """

    def __init__(self) -> None:
        """starts empty, as if nothing had been heard yet."""
        tempo_frames = round(TEMPO_WINDOW_S * FRAME_RATE_HZ)
        self._samples = np.zeros(FFT_SIZE)
        self._previous_log_magnitude = np.zeros(ONSET_BINS.size)
        self._onsets: deque[float] = deque(maxlen=tempo_frames)
        self._times: deque[float] = deque(maxlen=tempo_frames)
        self._powers: deque[float] = deque(maxlen=round(SILENCE_WINDOW_S * FRAME_RATE_HZ))
        self._bpm: float | None = None
        self._pending_bpm: float | None = None
        self._pending_count = 0
        self._beat_s: float | None = None
        self._phase_misses = 0

    def process(self, hop: np.ndarray, time_s: float) -> Frame:
        """analyses one hop of audio.

        args:
            hop: HOP_SAMPLES int16 samples.
            time_s: when its last sample was captured, epoch seconds.

        returns:
            the hop's frame (spectrum bands, onset, level).
        """
        samples = hop.astype(np.float64) / INT16_FULL_SCALE
        self._samples = np.concatenate([self._samples[samples.size:], samples])
        magnitude = np.abs(np.fft.rfft(self._samples * WINDOW)) / WINDOW_GAIN

        band_db = to_db(BAND_WEIGHTS @ magnitude**2)
        band_scale = (band_db - DISPLAY_FLOOR_DB) / (DISPLAY_CEIL_DB - DISPLAY_FLOOR_DB)
        bands = np.round(np.clip(band_scale, 0, 1) * DISPLAY_LEVELS).astype(np.uint8)

        log_magnitude = np.log1p(ONSET_LOG_GAIN * magnitude[ONSET_BINS])
        onset = float(np.maximum(log_magnitude - self._previous_log_magnitude, 0).sum())
        self._previous_log_magnitude = log_magnitude

        power = float(np.mean(samples**2))
        self._onsets.append(onset)
        self._times.append(time_s)
        self._powers.append(power)
        return Frame(time_s, bands, onset, float(to_db(power)))

    def estimate(self) -> TempoEstimate:
        """estimates the tempo and beat phase from the recent onsets.

        returns:
            the estimate. bpm is None while there's under TEMPO_MIN_WINDOW_S of audio, the
            room is silent, or no tempo stands out.

        side effects:
            moves the smoothed tempo and the beat clock along (or resets them on silence).
        """
        level_db = float(to_db(np.mean(self._powers))) if self._powers else float(to_db(0.0))
        enough_audio = len(self._onsets) >= TEMPO_MIN_WINDOW_S * FRAME_RATE_HZ
        if not enough_audio or level_db < SILENCE_DB:
            self._reset_beat()
            return TempoEstimate(None, 0.0, None, None, level_db, np.zeros(BPM_GRID.size))

        x = detrend(np.array(self._onsets))
        ac = autocorrelate(x)
        weighted = score_tempos(ac) * TEMPO_PRIOR
        peak = int(np.argmax(weighted))
        curve = weighted / weighted[peak] if weighted[peak] > 0 else weighted
        raw_bpm = MIN_BPM + refine_peak(weighted, peak) * BPM_GRID_STEP
        confidence = float(np.clip(sample_at(ac, SECONDS_PER_MINUTE * FRAME_RATE_HZ / raw_bpm), 0, 1))
        if confidence < MIN_CONFIDENCE:
            self._reset_beat()
            return TempoEstimate(None, confidence, None, None, level_db, curve)

        bpm = self._smooth_tempo(raw_bpm)
        period_s = SECONDS_PER_MINUTE / bpm
        frames_back = find_last_beat(x, period_s * FRAME_RATE_HZ)
        self._update_beat_clock(self._times[-1] - frames_back / FRAME_RATE_HZ, period_s)
        return TempoEstimate(bpm, confidence, self._beat_s, period_s, level_db, curve)

    def _reset_beat(self) -> None:
        """forgets the tempo and beat clock, so the next beat heard starts fresh."""
        self._bpm = None
        self._pending_bpm = None
        self._pending_count = 0
        self._beat_s = None

    def _smooth_tempo(self, raw_bpm: float) -> float:
        """eases the reported tempo toward a new estimate, or switches once a new one sticks.

        args:
            raw_bpm: this estimate's tempo.

        returns:
            the tempo to report.

        side effects:
            a switch to a new tempo also resets the beat clock, since its old phase is
            meaningless at the new period.
        """
        if self._bpm is None or abs(raw_bpm / self._bpm - 1) <= TEMPO_TOLERANCE:
            self._bpm = raw_bpm if self._bpm is None else self._bpm + TEMPO_SMOOTHING * (raw_bpm - self._bpm)
            self._pending_bpm = None
            return self._bpm

        same_as_pending = self._pending_bpm is not None and abs(raw_bpm / self._pending_bpm - 1) <= TEMPO_TOLERANCE
        self._pending_count = self._pending_count + 1 if same_as_pending else 1
        self._pending_bpm = raw_bpm
        if self._pending_count >= TEMPO_SWITCH_UPDATES:
            self._reset_beat()
            self._bpm = raw_bpm
        return self._bpm

    def _update_beat_clock(self, measured_beat_s: float, period_s: float) -> None:
        """nudges the beat clock's phase toward a measured beat.

        a measurement far off the clock is ignored unless PHASE_RELOCK_UPDATES in a row
        are, in which case the clock jumps to the latest one.

        args:
            measured_beat_s: when the comb says the last beat fell, epoch seconds.
            period_s: current seconds per beat.
        """
        if self._beat_s is None:
            self._beat_s = measured_beat_s
            self._phase_misses = 0
            return
        beats_since = round((measured_beat_s - self._beat_s) / period_s)
        predicted_s = self._beat_s + beats_since * period_s
        error_s = measured_beat_s - predicted_s
        if abs(error_s) <= PHASE_MAX_ERROR_BEATS * period_s:
            self._beat_s = predicted_s + PHASE_GAIN * error_s
            self._phase_misses = 0
            return
        self._phase_misses += 1
        if self._phase_misses >= PHASE_RELOCK_UPDATES:
            self._beat_s = measured_beat_s
            self._phase_misses = 0
