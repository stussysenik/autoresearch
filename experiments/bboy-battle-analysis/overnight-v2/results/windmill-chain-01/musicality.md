### MUSICALITY SIGNATURE: windmill-chain-01

**Expected BeatAlign Range**: `[0.10, 0.28]` overall, with best-case phase-gated entry/exit windows reaching `~0.35`  
Justification: this is a **power-chain** scenario, so steady-state windmill rotation is momentum-governed, not beat-governed. The musical read comes from the **entry sweep**, **first shoulder hit**, optional **per-revolution re-accent**, and **exit phrase**. Compared with `headspin-loop-01`, windmill has a clearer alternating-contact visual pulse via left/right shoulder-back transfer, but that is mostly **internal periodicity**, not true beat lock.

**Musicality Grade**: `C` expected for clean execution  
This is not a low grade because the dancer is unmusical; it reflects that a clean windmill chain should not be judged like toprock. A BRACE-style annotation would likely read as: **clear phrase hit on entry, weak continuous beat coupling during sustained power**.

**Joint-Audio Mapping for This Scenario**:

| Audio Band | Primary Joints | Expected Correlation | Notes |
|------------|---------------|---------------------|-------|
| Bass / Kick `0-200 Hz` | `j0,j1,j2,j10,j11` | `Medium` on entry/exit, `Low` in steady loop | Kick sync is strongest in the setup step, drop, and hip re-drive. Once both feet clear, foot-to-kick coupling should not be required. |
| Snare / Mid `200-2000 Hz` | `j18,j19,j20,j21,j22,j23` | `Medium` on entry, `Low` after takeoff | Arm throw and hand sweep can snap to a clap/snare before first shoulder contact. Repeated windmill revolutions should not be scored off arm accents. |
| Hi-hat / High `2000-8000 Hz` | `j13,j14,j15,j16,j17` | `Low-Medium` as visual pulse, `Low` as true beat sync | Alternating shoulder/collar contact creates readable left-right pulses. This is useful for internal timing regularity, not strong beat matching. |
| Full Mix / Broadband | mass-weighted all joints, especially `j0,j3,j6,j9` | `Low` overall, `Medium` at entry/exit | Whole-body energy spikes at the drop-in and controlled rise-out. Continuous rotation flattens broadband beat correlation. |

**Accent Detection**:
- Expected accent locations: entry arm sweep into drop; first shoulder-floor hit; shoulder-to-shoulder transfer if phrased; hip-kick re-injection; controlled exit or freeze catch.
- Accent source joints: entry `j22,j23,j0,j1,j2`; floor-contact accents `j16,j17,j13,j14`; reinjection `j1,j2,j10,j11`; exit `j0,j10,j11`.
- Expected AHR range: `0.20-0.45` overall. If scored only on entry/exit windows, `~0.55-0.80` is reasonable.

**Groove Analysis**:
- Is groove lock expected? `No`, not in the normal toprock sense. What is expected is **internal cycle regularity**: clean alternation of left/right floor contact and stable revolution timing.
- Beat-period autocorrelation: expected `0.05-0.20` at the audio beat lag.
- Subdivisions: usually **irregular relative to the beat**. If the dancer phrases it well, the first shoulder hit or every other half-cycle may read like a `2-beat` accent, but quarter-note lock is not required.

**Anticipation Pattern**:
- Expected `tau*`: `-60 ms to -20 ms` on entry/exit accents; steady-state loop has no stable global `tau*`.
- Typical for this scenario: skilled execution starts the sweep slightly **ahead of the beat** so the visible drop and first contact land on or just before the beat. During the chain, the body rides its own angular cycle.

**Phase-Specific Musicality Weight**:
- This scenario should use `20%` musicality weight because the windmill chain is a **power move**. Most evaluation should come from physics, contact, and phase control, with musicality limited to **entry, phrase punctuation, and exit**.

**Pseudo-Code**:
```python
# Musicality scoring for windmill-chain-01
# Inputs:
#   joints_3d [T, 24, 3]
#   beat_times [B] in seconds
#   audio_bands = {"kick":..., "snare":..., "hat":..., "mix":...}
#   contact = {"left_shoulder": bool[T], "right_shoulder": bool[T], "back": bool[T]}
#   phases = optional phase labels from phase/contact agents

import numpy as np

MASS_WEIGHTS = np.array([
    11.17, 2.78, 2.78, 5.00, 3.28, 3.28, 3.00, 0.61, 0.61, 2.50, 0.97, 0.97,
    1.50, 0.50, 0.50, 5.00, 2.00, 2.00, 1.14, 1.14, 0.45, 0.45, 0.41, 0.41
])

def smooth_velocity(joints_3d, fps=30):
    vel = np.gradient(joints_3d, axis=0) * fps
    k = np.array([0.25, 0.50, 0.25])
    for j in range(joints_3d.shape[1]):
        for a in range(3):
            vel[:, j, a] = np.convolve(vel[:, j, a], k, mode="same")
    return vel

def peak_pick(x, threshold, min_gap):
    peaks = []
    last = -10**9
    for i in range(1, len(x) - 1):
        if x[i] > threshold and x[i] >= x[i-1] and x[i] >= x[i+1] and (i - last) >= min_gap:
            peaks.append(i)
            last = i
    return np.array(peaks, dtype=int)

def beat_align(motion_beats, audio_beats, sigma=0.070):
    if len(motion_beats) == 0 or len(audio_beats) == 0:
        return 0.0
    out = 0.0
    for mb in motion_beats:
        out += max(np.exp(-((mb - ab) ** 2) / (2 * sigma ** 2)) for ab in audio_beats)
    return out / len(motion_beats)

def lagged_corr(x, y, fps=30, max_lag_ms=200):
    max_lag = int(round(max_lag_ms * fps / 1000))
    x = (x - x.mean()) / (x.std() + 1e-6)
    y = (y - y.mean()) / (y.std() + 1e-6)
    best_mu, best_lag = -1.0, 0
    for lag in range(-max_lag, max_lag + 1):
        if lag < 0:
            mu = np.corrcoef(x[-lag:], y[:lag])[0, 1]
        elif lag > 0:
            mu = np.corrcoef(x[:-lag], y[lag:])[0, 1]
        else:
            mu = np.corrcoef(x, y)[0, 1]
        if np.isfinite(mu) and mu > best_mu:
            best_mu, best_lag = mu, lag
    return best_mu, best_lag / fps

def windmill_chain_musicality_score(joints_3d, beat_times, audio_bands, contact, phases=None, fps=30):
    T = joints_3d.shape[0]
    t = np.arange(T) / fps
    vel = smooth_velocity(joints_3d, fps)
    speed = np.linalg.norm(vel, axis=-1)  # [T,24]

    # Phase-aware motion channels
    kick_motion  = speed[:, [0,1,2,10,11]] @ MASS_WEIGHTS[[0,1,2,10,11]]
    snare_motion = speed[:, [18,19,20,21,22,23]].mean(axis=1)
    hat_motion   = speed[:, [13,14,15,16,17]].mean(axis=1)
    full_motion  = speed @ MASS_WEIGHTS

    # Accent candidates: entry drop + arm throw + shoulder-contact onsets + hip kick
    pelvis_drop = np.maximum(0.0, -np.gradient(joints_3d[:, 0, 2]) * fps)
    arm_throw = np.linalg.norm(vel[:, 22, :], axis=1) + np.linalg.norm(vel[:, 23, :], axis=1)
    shoulder_onsets = (
        np.diff(contact["left_shoulder"].astype(int), prepend=0) > 0
    ) | (
        np.diff(contact["right_shoulder"].astype(int), prepend=0) > 0
    )
    hip_kick = np.linalg.norm(vel[:, 1, :], axis=1) + np.linalg.norm(vel[:, 2, :], axis=1)

    accent_signal = (
        0.30 * pelvis_drop +
        0.25 * arm_throw +
        0.20 * shoulder_onsets.astype(float) +
        0.25 * hip_kick
    )
    z = (accent_signal - accent_signal.mean()) / (accent_signal.std() + 1e-6)
    accent_frames = peak_pick(z, threshold=0.8, min_gap=4)

    # Phase gating: full weight on entry/exit, low weight in sustained power loop
    phase_weight = np.full(T, 0.20)  # default for power
    if phases is not None:
        phase_weight[np.isin(phases, ["ENTRY_SETUP", "FIRST_SHOULDER_CONTACT", "EXIT_CONTROLLED"])] = 1.00
        phase_weight[np.isin(phases, ["BARREL_PHASE_RIGHT", "BARREL_PHASE_LEFT",
                                      "BACK_ROLL_TRANSITION", "INVERSION_PEAK",
                                      "HIP_KICK_RECOVERY"])] = 0.20

    motion_beats = [t[f] for f in accent_frames if phase_weight[f] > 0.0]
    ba = beat_align(motion_beats, beat_times, sigma=0.070)

    # Band-specific lagged correlation
    mu_mix, tau_mix = lagged_corr(full_motion * phase_weight, audio_bands["mix"], fps=fps)
    mu_kick, tau_kick = lagged_corr(kick_motion, audio_bands["kick"], fps=fps)
    mu_snare, _ = lagged_corr(snare_motion, audio_bands["snare"], fps=fps)
    mu_hat, _ = lagged_corr(hat_motion, audio_bands["hat"], fps=fps)

    # Accent hit rate with 70 ms tolerance
    ahr_hits = 0
    for mb in motion_beats:
        if any(abs(mb - ab) <= 0.070 for ab in beat_times):
            ahr_hits += 1
    ahr = ahr_hits / max(len(motion_beats), 1)

    # Internal left-right pulse regularity: important here, but distinct from beat sync
    shoulder_times = np.sort(np.where(shoulder_onsets)[0]) / fps
    if len(shoulder_times) >= 3:
        ioi = np.diff(shoulder_times)
        alternation_cv = np.std(ioi) / (np.mean(ioi) + 1e-6)
        internal_pulse_score = float(np.clip(1.0 - alternation_cv / 0.35, 0, 1))
    else:
        internal_pulse_score = 0.5

    # Anticipation bonus: reward slight early timing on intentional accents
    tau_star = tau_kick if abs(tau_kick) < 0.200 else tau_mix
    anticipation_bonus = 1.0 + 0.25 * np.tanh((-tau_star) / 0.050)

    # Composite: low global weight because this is a power scenario
    joint_band_score = np.mean([
        np.clip(mu_kick, 0, 1),
        np.clip(mu_snare, 0, 1),
        np.clip(mu_hat, 0, 1),
    ])

    composite = (
        0.35 * ba +
        0.20 * np.clip(mu_mix, 0, 1) * anticipation_bonus +
        0.20 * ahr +
        0.15 * joint_band_score +
        0.10 * internal_pulse_score
    )

    return {
        "BeatAlign": round(float(ba), 3),
        "AHR": round(float(ahr), 3),
        "mu_mix": round(float(mu_mix), 3),
        "tau_star_s": round(float(tau_star), 3),
        "internal_pulse": round(float(internal_pulse_score), 3),
        "musicality_composite": round(float(np.clip(composite, 0, 1)), 3),
    }
```

**Positive**: TRIVIUM v0.1’s mass-weighted whole-body energy and lagged correlation are still useful for the **entry drop**, **first shoulder impact**, and **exit**. The soft Gaussian BeatAlign with `sigma=70 ms` is especially appropriate here because binary hit/miss would over-penalize power accents that are only `1-2` frames off at `30 fps`.

**Gap**: TRIVIUM v0.1 needs **phase-aware weighting** for power moves, **band-specific joint grouping**, and **accent extraction from contact-transition events** rather than raw continuous velocity peaks. For this scenario it should also separate:
- **external beat sync** from
- **internal left-right pulse regularity** driven by `j16/j17/j13/j14` floor-contact alternation.

Without that split, a clean windmill chain can be scored unfairly low or for the wrong reasons.