#!/usr/bin/env python3
"""
Bboy Audio Analysis v2 — 3 modes: BBOY / DJ / CURATOR

Run:
  python3 analyze_track.py <audio_file>              # default: bboy mode
  python3 analyze_track.py <audio_file> --mode dj     # DJ blend analysis
  python3 analyze_track.py <audio_file> --mode curator # HiFi music curator
  python3 analyze_track.py <audio_file> --mode all     # all 3 profiles
  python3 analyze_track.py                             # test tone

Computes 10 dimensions + energy arc + phrase structure.
Each mode uses different weights to highlight what matters for that use case.

Fixed from v1:
  - Groove detection: spectral flux onsets, lower threshold (was missing all swing)
  - Rhythm complexity: log-scale normalization, ceiling 40 (was maxing at 0.99)
  - 3 analysis modes with different weight profiles
"""

import sys
import numpy as np
from scipy import signal as sp_signal
from scipy.io import wavfile
import os
import json

# ─── Config ────────────────────────────────────────────────────────
SR = 44100
WINDOW_SEC = 0.5
HOP_SEC = 0.25
FFT_SIZE = 2048
BASS_RANGE = (20, 250)
VOCAL_RANGE = (300, 3400)

DIMENSION_NAMES = [
    'BPM Stability', 'Bass Energy', 'Vocal Presence', 'Beat Strength',
    'Spectral Flux', 'Rhythm Complexity', 'Harmonic Richness', 'Dynamic Range',
    'Groove/Swing',
]

# 3 weight profiles — each highlights what matters for that use case
WEIGHT_PROFILES = {
    'bboy': {
        'name': 'BBOY (Battle Mode)',
        'description': 'Optimized for breaking — beat + bass + rhythm dominate',
        'weights': np.array([0.05, 0.20, 0.03, 0.25, 0.10, 0.20, 0.02, 0.10, 0.05]),
        'labels': {
            'hot': 'FREEZE HERE',
            'build': 'SET UP',
            'drop': 'BLOW-UP',
            'groove': 'POCKET',
        },
    },
    'dj': {
        'name': 'DJ (Blend Mode)',
        'description': 'Optimized for mixing — BPM stability + spectral complement + energy flow',
        'weights': np.array([0.20, 0.15, 0.05, 0.10, 0.15, 0.10, 0.10, 0.10, 0.05]),
        'labels': {
            'hot': 'PEAK',
            'build': 'BUILD',
            'drop': 'MIX POINT',
            'groove': 'LOCKED IN',
        },
    },
    'curator': {
        'name': 'CURATOR (HiFi Mode)',
        'description': 'Optimized for music quality — harmonic richness + dynamics + vocal + groove',
        'weights': np.array([0.05, 0.10, 0.15, 0.10, 0.10, 0.10, 0.20, 0.10, 0.10]),
        'labels': {
            'hot': 'HIGHLIGHT',
            'build': 'RISING',
            'drop': 'RELEASE',
            'groove': 'FEEL',
        },
    },
}

# ─── Audio Loading ──────────────────────────────────────────────────
def load_audio(path):
    """Load audio file, convert to mono float32 at 44.1kHz."""
    try:
        import librosa
        y, sr = librosa.load(path, sr=SR, mono=True)
        return y
    except ImportError:
        sr_file, data = wavfile.read(path)
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32768.0
        elif data.dtype == np.int32:
            data = data.astype(np.float32) / 2147483648.0
        if data.ndim > 1:
            data = data.mean(axis=1)
        if sr_file != SR:
            num_samples = int(len(data) * SR / sr_file)
            data = sp_signal.resample(data, num_samples)
        return data

def generate_test_tone(duration=15.0):
    """Generate a synthetic bboy break: kick + swung hats + build + drop."""
    t = np.arange(int(SR * duration)) / SR
    bpm = 110
    beat_period = 60.0 / bpm
    y = np.zeros_like(t)

    for beat_time in np.arange(0, duration, beat_period):
        # Kick on beat
        idx = int(beat_time * SR)
        env_len = int(0.05 * SR)
        if idx + env_len < len(y):
            env = np.exp(-np.arange(env_len) / (0.01 * SR))
            y[idx:idx+env_len] += 0.8 * np.sin(2 * np.pi * 55 * np.arange(env_len) / SR) * env

        # Swung hi-hat (swing = 30ms for noticeable groove)
        swing = 0.030
        off_time = beat_time + beat_period / 2 + swing
        idx2 = int(off_time * SR)
        hat_len = int(0.015 * SR)
        if idx2 + hat_len < len(y):
            env = np.exp(-np.arange(hat_len) / (0.003 * SR))
            y[idx2:idx2+hat_len] += 0.25 * np.random.randn(hat_len) * env

        # Ghost snare on beat 3 (every other beat)
        if int(beat_time / beat_period) % 2 == 1:
            snare_len = int(0.03 * SR)
            if idx + snare_len < len(y):
                env = np.exp(-np.arange(snare_len) / (0.008 * SR))
                y[idx:idx+snare_len] += 0.4 * np.random.randn(snare_len) * env

    # Energy build: ramp from 0.3 to 1.0 over first 10s, then DROP at 10s, sustain
    build = np.ones_like(t) * 0.3
    build[:int(10*SR)] = np.linspace(0.3, 1.0, int(10*SR))
    build[int(10*SR):int(10.5*SR)] = 0.1  # the DROP (silence)
    build[int(10.5*SR):] = 0.9  # post-drop energy
    y = y * build
    y = y / (np.max(np.abs(y)) + 1e-8)
    return y

# ─── Feature Extractors ────────────────────────────────────────────
def segment_audio(y):
    win_len = int(WINDOW_SEC * SR)
    hop_len = int(HOP_SEC * SR)
    segments = []
    for start in range(0, len(y) - win_len, hop_len):
        segments.append(y[start:start+win_len])
    return np.array(segments)

def _spectral_flux_onsets(seg):
    """Better onset detection using spectral flux (fixes v1 groove bug)."""
    frame_len = min(512, len(seg))
    hop = frame_len // 2
    prev_spec = np.zeros(frame_len // 2 + 1)
    flux = []
    for start in range(0, len(seg) - frame_len, hop):
        frame = seg[start:start+frame_len] * np.hanning(frame_len)
        spec = np.abs(np.fft.fft(frame))[:frame_len//2+1]
        flux.append(np.sum(np.maximum(0, spec - prev_spec)))
        prev_spec = spec
    flux = np.array(flux)
    if len(flux) < 3:
        return np.array([])
    # Lower threshold for better sensitivity (was mean+0.5*std, now mean+0.25*std)
    threshold = np.mean(flux) + 0.25 * np.std(flux)
    peaks, _ = sp_signal.find_peaks(flux, height=threshold, distance=2)
    # Convert frame indices to sample indices
    return peaks * hop

def compute_bpm_stability(seg):
    env = np.abs(seg)
    kernel = np.ones(int(0.01 * SR)) / int(0.01 * SR)
    env = np.convolve(env, kernel, mode='same')
    acf = np.correlate(env - np.mean(env), env - np.mean(env), mode='full')
    acf = acf[len(acf)//2:]
    acf = acf / (acf[0] + 1e-8)
    min_lag = int(SR * 60 / 200)
    max_lag = min(int(SR * 60 / 60), len(acf) - 1)
    if max_lag <= min_lag:
        return 0.0
    search = acf[min_lag:max_lag]
    return float(np.max(search)) if len(search) > 0 else 0.0

def compute_bass_energy(seg):
    spec = np.fft.fft(seg * np.hanning(len(seg)))
    freqs = np.fft.fftfreq(len(seg), 1/SR)
    mask = (np.abs(freqs) >= BASS_RANGE[0]) & (np.abs(freqs) <= BASS_RANGE[1])
    bass_signal = np.real(np.fft.ifft(spec * mask))
    return float(np.sqrt(np.mean(bass_signal**2)))

def compute_vocal_presence(seg):
    spec = np.abs(np.fft.fft(seg * np.hanning(len(seg))))[:len(seg)//2]
    freqs = np.fft.fftfreq(len(seg), 1/SR)[:len(seg)//2]
    total_energy = np.sum(spec**2) + 1e-8
    vocal_mask = (freqs >= VOCAL_RANGE[0]) & (freqs <= VOCAL_RANGE[1])
    band_ratio = np.sum(spec[vocal_mask]**2) / total_energy
    acf = np.correlate(seg, seg, mode='full')
    acf = acf[len(acf)//2:]
    acf = acf / (acf[0] + 1e-8)
    min_lag, max_lag = int(SR / 3400), min(int(SR / 80), len(acf) - 1)
    hnr = float(np.max(acf[min_lag:max_lag])) if max_lag > min_lag else 0.0
    return 0.4 * band_ratio + 0.3 * min(1, band_ratio * 3) + 0.3 * max(0, hnr)

def compute_beat_strength(seg):
    frame_len = min(512, len(seg))
    hop = frame_len // 2
    prev_spec = np.zeros(frame_len // 2 + 1)
    onset_func = []
    for start in range(0, len(seg) - frame_len, hop):
        frame = seg[start:start+frame_len] * np.hanning(frame_len)
        spec = np.abs(np.fft.fft(frame))[:frame_len//2+1]
        onset_func.append(np.sum(np.maximum(0, spec - prev_spec)))
        prev_spec = spec
    return float(max(onset_func)) if onset_func else 0.0

def compute_spectral_flux(seg):
    frame_len = min(512, len(seg))
    hop = frame_len // 2
    prev_spec = None
    flux_values = []
    for start in range(0, len(seg) - frame_len, hop):
        frame = seg[start:start+frame_len] * np.hanning(frame_len)
        spec = np.abs(np.fft.fft(frame))[:frame_len//2+1]
        spec = spec / (np.linalg.norm(spec) + 1e-8)
        if prev_spec is not None:
            flux_values.append(np.linalg.norm(spec - prev_spec))
        prev_spec = spec
    return float(np.mean(flux_values)) if flux_values else 0.0

def compute_rhythm_complexity(seg):
    """v2: Uses spectral flux onsets + log normalization (fixes maxing out)."""
    onsets = _spectral_flux_onsets(seg)
    seg_duration = len(seg) / SR
    density = len(onsets) / seg_duration
    # v2: log-scale normalization with ceiling 40 (was linear with ceiling 20)
    density_norm = min(1.0, np.log1p(density) / np.log1p(40))
    if len(onsets) > 2:
        ioi = np.diff(onsets) / SR
        cv = np.std(ioi) / (np.mean(ioi) + 1e-8)
        syncopation = min(1.0, cv)
    else:
        syncopation = 0.0
    return 0.5 * density_norm + 0.5 * syncopation

def compute_harmonic_richness(seg):
    spec = np.abs(np.fft.fft(seg * np.hanning(len(seg))))[:len(seg)//2]
    freqs = np.fft.fftfreq(len(seg), 1/SR)[:len(seg)//2]
    music_mask = (freqs >= 50) & (freqs <= 8000)
    music_spec = spec[music_mask]
    if len(music_spec) == 0:
        return 0.0
    threshold = 0.1 * np.max(music_spec)
    peaks, _ = sp_signal.find_peaks(music_spec, height=threshold, distance=max(1, len(music_spec)//50))
    peak_score = min(1.0, len(peaks) / 20.0)
    music_spec_pos = music_spec[music_spec > 0]
    if len(music_spec_pos) > 0:
        geo_mean = np.exp(np.mean(np.log(music_spec_pos)))
        ari_mean = np.mean(music_spec_pos)
        flatness = geo_mean / (ari_mean + 1e-8)
        tonality = 1 - min(1.0, flatness)
    else:
        tonality = 0.0
    return 0.5 * peak_score + 0.5 * tonality

def compute_dynamic_range(seg):
    peak = np.max(np.abs(seg))
    rms = np.sqrt(np.mean(seg**2))
    if rms < 1e-8:
        return 0.0
    crest = peak / rms
    return float(np.tanh((crest - 1) / 3))

def compute_groove(seg):
    """v2: Uses spectral flux onsets with lower threshold (fixes zero-groove bug)."""
    onsets = _spectral_flux_onsets(seg)
    if len(onsets) < 6:
        return 0.0
    ioi = np.diff(onsets) / SR
    # Filter out IOIs that are too short (<30ms) or too long (>500ms)
    ioi = ioi[(ioi > 0.03) & (ioi < 0.5)]
    if len(ioi) < 4:
        return 0.0
    # Swing ratio from alternating IOIs
    even_ioi = ioi[0::2]
    odd_ioi = ioi[1::2]
    min_len = min(len(even_ioi), len(odd_ioi))
    if min_len < 2:
        return 0.0
    even_ioi = even_ioi[:min_len]
    odd_ioi = odd_ioi[:min_len]
    ratios = np.maximum(even_ioi, odd_ioi) / (np.minimum(even_ioi, odd_ioi) + 1e-8)
    mean_swing = np.mean(ratios)
    swing_score = min(1.0, max(0.0, (mean_swing - 1.0) / 0.8))
    cv = np.std(ratios) / (np.mean(ratios) + 1e-8)
    regularity = max(0.0, 1.0 - cv)
    return 0.4 * swing_score + 0.6 * regularity

# ─── Analysis ───────────────────────────────────────────────────────
def extract_features(y):
    """Extract 9D feature matrix from audio."""
    segments = segment_audio(y)
    n_seg = len(segments)

    extractors = [
        compute_bpm_stability, compute_bass_energy, compute_vocal_presence,
        compute_beat_strength, compute_spectral_flux, compute_rhythm_complexity,
        compute_harmonic_richness, compute_dynamic_range, compute_groove,
    ]

    features = np.zeros((9, n_seg))
    for d, extractor in enumerate(extractors):
        for i, seg in enumerate(segments):
            features[d, i] = extractor(seg)
        # Per-track min-max normalization
        fmin, fmax = features[d].min(), features[d].max()
        if fmax - fmin > 1e-8:
            features[d] = (features[d] - fmin) / (fmax - fmin)

    return features, segments, n_seg

def analyze_mode(features, n_seg, mode_name, labels):
    """Analyze with a specific weight profile."""
    profile = WEIGHT_PROFILES[mode_name]
    weights = profile['weights']
    weights = weights / weights.sum()  # ensure normalized

    # Hotness
    hotness = weights @ features

    # Energy arc
    energy_velocity = np.diff(hotness) if len(hotness) > 1 else np.array([0])
    energy_accel = np.diff(energy_velocity) if len(energy_velocity) > 1 else np.array([0])

    # Hot segments
    threshold = hotness.mean() + hotness.std()
    hot_idx = np.where(hotness > threshold)[0]
    hot_times = hot_idx * HOP_SEC

    # Build/drop detection
    build_idx = np.where(energy_velocity > np.mean(energy_velocity) + np.std(energy_velocity))[0]
    drop_idx = np.where(energy_velocity < np.mean(energy_velocity) - np.std(energy_velocity))[0]

    # Phrase detection
    phrase_window = int(4.0 / HOP_SEC)
    phrase_times = []
    if n_seg > phrase_window * 2:
        phrase_diff = np.zeros(n_seg - phrase_window)
        for i in range(len(phrase_diff)):
            a = hotness[i:i+phrase_window//2]
            b = hotness[i+phrase_window//2:i+phrase_window]
            phrase_diff[i] = abs(np.mean(a) - np.mean(b))
        if len(phrase_diff) > 0:
            p_thresh = np.mean(phrase_diff) + np.std(phrase_diff)
            phrase_boundaries = np.where(phrase_diff > p_thresh)[0]
            phrase_times = (phrase_boundaries * HOP_SEC).tolist()

    return {
        'hotness': hotness,
        'velocity': energy_velocity,
        'accel': energy_accel,
        'hot_idx': hot_idx,
        'hot_times': hot_times,
        'build_idx': build_idx,
        'drop_idx': drop_idx,
        'phrase_times': phrase_times[:10],
        'labels': profile['labels'],
    }

def print_analysis(features, n_seg, mode_name):
    """Print full analysis for one mode."""
    profile = WEIGHT_PROFILES[mode_name]
    result = analyze_mode(features, n_seg, mode_name, profile['labels'])
    labels = result['labels']
    hotness = result['hotness']

    print(f"\n  ╔══ {profile['name']} ══╗")
    print(f"  {profile['description']}")
    w = profile['weights']
    wstr = ' '.join(DIMENSION_NAMES[i][:4] + '=' + f'{w[i]:.2f}' for i in range(9))
    print(f"  Weights: {wstr}")

    print(f"\n  Hotness: mean={hotness.mean():.3f}  max={hotness.max():.3f}")
    print(f"  Energy velocity: max_rise={result['velocity'].max():.3f}  max_drop={result['velocity'].min():.3f}")

    print(f"\n  {labels['hot']} segments: {len(result['hot_idx'])}/{n_seg} ({100*len(result['hot_idx'])/n_seg:.1f}%)")
    if len(result['hot_times']) > 0:
        print(f"  {labels['hot']} at: {', '.join(f'{t:.1f}s' for t in result['hot_times'][:8])}")

    if len(result['build_idx']) > 0:
        print(f"  {labels['build']} sections: {len(result['build_idx'])}")
    if len(result['drop_idx']) > 0:
        print(f"  {labels['drop']} sections: {len(result['drop_idx'])}")
    if result['phrase_times']:
        print(f"  Phrase changes: {', '.join(f'{t:.1f}s' for t in result['phrase_times'])}")

    # ASCII hotness
    bar_width = min(80, n_seg)
    indices = np.linspace(0, n_seg-1, bar_width).astype(int)
    h = hotness[indices]
    blocks = ' ░▒▓█'
    print(f"\n  Hotness:")
    sys.stdout.write('  ')
    for v in h:
        level = int(v / (hotness.max() + 1e-8) * (len(blocks) - 1))
        sys.stdout.write(blocks[min(level, len(blocks)-1)])
    print()

    # Energy velocity
    ev = result['velocity']
    ev_idx = np.linspace(0, len(ev)-1, bar_width).astype(int)
    ev_r = ev[ev_idx]
    sys.stdout.write('  ')
    for v in ev_r:
        if v > 0.02:
            sys.stdout.write('▲')
        elif v < -0.02:
            sys.stdout.write('▼')
        else:
            sys.stdout.write('─')
    print()

    total_sec = n_seg * HOP_SEC
    print(f"  0s{'─' * (bar_width - 8)}{total_sec:.0f}s")

    return result

# ─── Segment Classifier ────────────────────────────────────────────
def classify_segments(features, n_seg):
    """Classify each segment by its dominant character."""
    classifications = []
    for i in range(n_seg):
        f = features[:, i]
        # Find top 2 dimensions
        top2 = np.argsort(f)[-2:][::-1]
        d1, d2 = DIMENSION_NAMES[top2[0]], DIMENSION_NAMES[top2[1]]

        # Simple classification rules
        if f[3] > 0.7 and f[1] > 0.5:  # beat strength + bass
            label = 'IMPACT'
        elif f[8] > 0.6:  # groove
            label = 'POCKET'
        elif f[5] > 0.7:  # rhythm complexity
            label = 'COMPLEX'
        elif f[4] > 0.7:  # spectral flux
            label = 'TRANSITION'
        elif f[7] > 0.7:  # dynamic range
            label = 'DYNAMIC'
        elif f[2] > 0.6:  # vocal
            label = 'VOCAL'
        elif f[1] > 0.7:  # bass
            label = 'BASS'
        else:
            label = 'NEUTRAL'

        classifications.append({
            'time': i * HOP_SEC,
            'label': label,
            'top_dims': f'{d1} + {d2}',
            'values': {DIMENSION_NAMES[d]: round(float(f[d]), 3) for d in range(9)},
        })
    return classifications

# ─── Main ───────────────────────────────────────────────────────────
if __name__ == '__main__':
    # Parse args
    mode = 'all'
    path = None
    for arg in sys.argv[1:]:
        if arg.startswith('--mode='):
            mode = arg.split('=')[1]
        elif arg == '--mode':
            continue
        elif sys.argv[sys.argv.index(arg)-1] == '--mode':
            mode = arg
        elif not arg.startswith('-'):
            path = arg

    if path and not os.path.exists(path):
        print(f"File not found: {path}")
        sys.exit(1)

    if path:
        print(f"\n  Analyzing: {os.path.basename(path)}")
        y = load_audio(path)
    else:
        print(f"\n  No audio file — generating test break (110 BPM, swung, 15s)")
        y = generate_test_tone(15.0)

    print(f"  Duration: {len(y)/SR:.1f}s  Sample rate: {SR} Hz")

    # Extract features (shared across all modes)
    print(f"\n  Extracting 9D features...")
    features, segments, n_seg = extract_features(y)
    print(f"  {n_seg} segments ({WINDOW_SEC}s window, {HOP_SEC}s hop)")

    # Print per-dimension stats
    print(f"\n  ═══ RAW DIMENSIONS ═══")
    for d in range(9):
        bar = '█' * int(features[d].mean() * 20)
        print(f"  D{d+1} {DIMENSION_NAMES[d]:20s}: mean={features[d].mean():.3f}  {bar}")

    # Run requested modes
    modes_to_run = ['bboy', 'dj', 'curator'] if mode == 'all' else [mode]
    for m in modes_to_run:
        if m in WEIGHT_PROFILES:
            print_analysis(features, n_seg, m)

    # Segment classification
    print(f"\n  ═══ SEGMENT CLASSIFICATION (first 20) ═══")
    classifications = classify_segments(features, n_seg)
    for c in classifications[:20]:
        print(f"  {c['time']:6.1f}s  [{c['label']:10s}]  {c['top_dims']}")

    # Summary
    label_counts = {}
    for c in classifications:
        label_counts[c['label']] = label_counts.get(c['label'], 0) + 1
    print(f"\n  ═══ TRACK PROFILE ═══")
    for label, count in sorted(label_counts.items(), key=lambda x: -x[1]):
        pct = 100 * count / len(classifications)
        bar = '█' * int(pct / 2)
        print(f"  {label:12s}: {pct:5.1f}%  {bar}")

    # Save JSON for further analysis
    output_path = os.path.splitext(path or 'test_tone')[0] + '_analysis.json'
    if not path:
        output_path = 'test_tone_analysis.json'
    analysis_data = {
        'file': path or 'test_tone',
        'duration_sec': len(y) / SR,
        'n_segments': n_seg,
        'dimensions': {DIMENSION_NAMES[d]: {
            'mean': float(features[d].mean()),
            'std': float(features[d].std()),
            'min': float(features[d].min()),
            'max': float(features[d].max()),
        } for d in range(9)},
        'segment_classifications': classifications[:100],  # first 100
        'track_profile': label_counts,
    }
    # Only save if we have a writable location
    try:
        with open(output_path, 'w') as f:
            json.dump(analysis_data, f, indent=2)
        print(f"\n  JSON saved: {output_path}")
    except Exception:
        pass

    print(f"\n  Done.\n")
