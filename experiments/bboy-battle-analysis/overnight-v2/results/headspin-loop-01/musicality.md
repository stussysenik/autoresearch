### MUSICALITY SIGNATURE: headspin-loop-01

**Expected BeatAlign Range**: `[0.10, 0.22]` with `sigma=70 ms` tolerance. This is a sustained power loop, so most of the window is physics-driven rather than beat-driven; useful beat matches come from the `entry`, any deliberate `tuck/pump` accent, and the `exit`. Soft BeatAlign matters here because a skilled setup often starts `30-80 ms` before the beat so the visible lock-in lands on it; binary hit/miss would mark that as a false miss.

**Musicality Grade**: `C` expected for clean execution

**Joint-Audio Mapping for This Scenario**:
| Audio Band | Primary Joints | Expected Correlation | Notes |
|------------|---------------|---------------------|-------|
| Bass/Kick | `0,1,2,4,5` with `7,8` secondary | Low-Medium on entry/pumps; Low in steady loop | Kick relationship is in launch and leg-radius changes, not foot strikes. Because of blur, `0,1,2,4,5` are more reliable than `7,8,10,11`. |
| Snare/Mid | `18,19,20,21,22,23` | Low-Medium at entry/exit; Very low during continuous spin | Arm sweep into the plant or catch-out can hit snare accents. |
| Hi-hat/High | `15,16,17` | Low | Head is the pivot, so apparent high-frequency motion is often spin artifact, not intentional hat-riding. Shoulders may show slight rhythmic shaping. |
| Full mix | `0,3,6,9,12` plus mass-weighted all joints | Low | Whole-body energy stays elevated and periodic at spin frequency, so it is a weak beat proxy unless segmented into events. |

**Accent Detection**:
- Expected accent locations: `entry plant`, `first clean speed-lock`, any pronounced `tuck-to-speed-up`, and `exit/dismount`
- Accent source joints: `0,1,2,4,5,18,19,22,23` with `7,8` secondary and `10,11` only if the exit lands to feet
- Expected AHR range: `[0.15, 0.30]` over the full action window; lower if the clip is only the steady spin loop

**Groove Analysis**:
- Is groove lock expected? `No` for the sustained loop. A BRACE-style annotation would likely read as `power continuation with beat-aware entry/exit`, not a true beat-hit phrase.
- Beat-period autocorrelation: `[0.05, 0.18]`
- Subdivisions: `irregular / spin-frequency-driven`; occasional half-bar or bar-level accents are plausible, but stable quarter-note lock is not expected

**Anticipation Pattern**:
- Expected tau*: `-80 ms to -30 ms` on setup/entry; effectively unconstrained during the steady loop
- Typical for this scenario: the dancer starts the arm sweep and plant slightly before the beat so the visible speed-onset or first clean revolution lands on the beat; after that, timing is governed by angular momentum

**Phase-Specific Musicality Weight**:
- This scenario should use `20%` musicality weight because it is a sustained power move; scoring the continuous spin like toprock would over-penalize correct technique

**Pseudo-Code**:
```python
import numpy as np

KICK_JOINTS  = [0, 1, 2, 4, 5, 7, 8]
SNARE_JOINTS = [18, 19, 20, 21, 22, 23]
HAT_JOINTS   = [15, 16, 17]
POWER_PROX   = [0, 1, 2, 3, 4, 5, 6, 9, 12, 18, 19, 22, 23]

def gaussian_hit(dt, sigma=0.070):
    return np.exp(-(dt * dt) / (2 * sigma * sigma))

def beat_align(motion_beats, audio_beats, sigma=0.070):
    if len(motion_beats) == 0:
        return 0.0
    return float(np.mean([
        max(gaussian_hit(mb - ab, sigma) for ab in audio_beats)
        for mb in motion_beats
    ]))

def local_peaks(x, thresh, refractory):
    peaks, last = [], -10**9
    for i in range(1, len(x) - 1):
        if x[i] > thresh and x[i] >= x[i - 1] and x[i] > x[i + 1] and (i - last) >= refractory:
            peaks.append(i)
            last = i
    return np.array(peaks, dtype=int)

def lagged_corr(x, y, dt, max_lag_s=0.2):
    max_lag = int(max_lag_s / dt)
    best_r, best_tau = 0.0, 0.0
    for lag in range(-max_lag, max_lag + 1):
        if lag < 0:
            a, b = x[-lag:], y[:lag or None]
        elif lag > 0:
            a, b = x[:-lag], y[lag:]
        else:
            a, b = x, y
        if len(a) < 5:
            continue
        r = np.corrcoef(a, b)[0, 1]
        if np.isfinite(r) and r > best_r:
            best_r, best_tau = r, lag * dt
    return float(best_r), float(best_tau)

def score_headspin_musicality(joints_3d, beat_times, audio_bands, fps=30):
    dt = 1.0 / fps
    t = np.arange(len(joints_3d)) * dt
    vel = np.gradient(joints_3d, dt, axis=0)
    speed = np.linalg.norm(vel, axis=-1)

    # Distal joints blur during fast rotation; trust slower/proximal joints more.
    blur_conf = 1.0 / (1.0 + speed / 2.5)

    kick_env  = (speed[:, KICK_JOINTS]  * blur_conf[:, KICK_JOINTS]).sum(axis=1)
    snare_env = (speed[:, SNARE_JOINTS] * blur_conf[:, SNARE_JOINTS]).sum(axis=1)
    hat_env   = (speed[:, HAT_JOINTS]   * blur_conf[:, HAT_JOINTS]).sum(axis=1)

    prox_w = np.zeros(24)
    prox_w[POWER_PROX] = np.array([1.4, 1.1, 1.1, 0.8, 0.9, 0.9, 0.7, 0.6, 0.4, 0.8, 0.8, 0.7, 0.7])
    full_env = (speed * blur_conf * prox_w[None, :]).sum(axis=1)

    # Keep entry/pump/exit accents; reject plain revolution periodicity.
    ankle_radius = np.linalg.norm(
        joints_3d[:, [7, 8], :2] - joints_3d[:, 15:16, :2], axis=-1
    ).mean(axis=1)
    event_signal = np.abs(np.gradient(full_env, dt)) + 0.6 * np.abs(np.gradient(ankle_radius, dt))
    event_signal = (event_signal - event_signal.mean()) / (event_signal.std() + 1e-6)

    peak_idx = local_peaks(event_signal, thresh=1.0, refractory=int(0.18 / dt))
    motion_beats = t[peak_idx]

    beatalign = beat_align(motion_beats, beat_times, sigma=0.070)
    kick_corr, kick_tau = lagged_corr(kick_env, audio_bands["kick"], dt)
    snare_corr, _ = lagged_corr(snare_env, audio_bands["snare"], dt)
    hat_corr, _ = lagged_corr(hat_env, audio_bands["hat"], dt)

    beat_period = np.median(np.diff(beat_times))
    beat_lag = int(round(beat_period / dt))
    groove = 0.0
    if 0 < beat_lag < len(full_env):
        groove = np.corrcoef(full_env[:-beat_lag], full_env[beat_lag:])[0, 1]
        groove = float(max(groove, 0.0))

    ahr = 0.0
    if len(beat_times):
        ahr = float(np.mean([
            np.max(np.exp(-((motion_beats - b) ** 2) / (2 * 0.070 ** 2))) > 0.5
            for b in beat_times
        ]))

    # Reward slight anticipation on the entry accent.
    anticipation_bonus = 1.0 + 0.25 * np.tanh((-kick_tau) / 0.050)

    raw = (
        0.40 * beatalign +
        0.20 * kick_corr +
        0.15 * snare_corr +
        0.10 * hat_corr +
        0.15 * ahr
    )

    musicality = 0.20 * raw * anticipation_bonus  # power-phase weight = 20%

    return {
        "musicality": round(float(musicality), 3),
        "beatalign": round(float(beatalign), 3),
        "ahr": round(float(ahr), 3),
        "kick_corr": round(float(kick_corr), 3),
        "snare_corr": round(float(snare_corr), 3),
        "hat_corr": round(float(hat_corr), 3),
        "groove_lock": round(float(groove), 3),
        "tau_star_s": round(float(kick_tau), 3),
    }
```

**Positive**:
- TRIVIUM v0.1 should still capture `entry` and `exit` timing reasonably well from mass-weighted whole-body energy, especially via `0,1,2,3,6,9`.
- Soft Gaussian BeatAlign with `70 ms` tolerance is a real improvement here because anticipatory power-move setups are common and musically correct.
- Proximal joints remain more stable than distal limbs under blur, so broad timing structure is still recoverable.

**Gap**:
- v0.1 likely over-penalizes this scenario if it averages musicality across the whole spin loop instead of isolating `entry/pump/exit` events.
- It needs per-band joint mapping; `kick` should look at `0,1,2,4,5`, not treat all joints equally.
- It needs blur-aware weighting, since `7,8,10,11,22,23` are unreliable during fast axial rotation.
- It needs spin-frequency rejection so periodic revolutions are not mistaken for groove lock.
- It needs explicit anticipation scoring; a `-50 ms` setup should score well, while binary hit/miss would mark it wrong.