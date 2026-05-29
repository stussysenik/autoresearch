### MUSICALITY SIGNATURE: flare-cycle-01

**Expected BeatAlign Range**: `[0.12, 0.30]` overall with `sigma=70 ms` tolerance; phase-gated entry/exit or deliberately phrased hand-switch accents can reach `~0.38`  
Justification: this is still a **power-cycle** scenario, so sustained flare rotation is mechanics-driven, not beat-driven. Compared with `headspin-loop-01`, flare has more readable **arm-hand punctuation** at `j22/j23`. Compared with `windmill-chain-01`, the internal pulse is cleaner at the support switch, but **self-occlusion from large leg arcs** makes distal beat evidence less trustworthy. Soft BeatAlign is important because a skilled flare often loads the hand and opens the hips `20-70 ms` before the beat so the visible leg apex lands on it; binary hit/miss would score that incorrectly.

**Musicality Grade**: `C` expected for clean execution  
A BRACE-style read would be: `phrase-aware power continuation with readable hand-switch accents, weak sustained beat coupling`.

**Joint-Audio Mapping for This Scenario**:  
| Audio Band | Primary Joints | Expected Correlation | Notes |
|------------|---------------|---------------------|-------|
| Bass / Kick | `j0,j1,j2,j4,j5` with `j10,j11` secondary | `Low-Medium` on entry/lift/exit; `Low` in steady cycle | No true footstep-on-kick relationship once airborne. Kick correlation comes from pelvis/hip drive and leg-sweep onset. Down-weight `j10,j11` during occlusion. |
| Snare / Mid | `j18,j19,j20,j21,j22,j23` | `Medium` on hand plant, push-off, and hand-switch punctuation; `Low-Medium` otherwise | This is the best band for flare. Alternating support at `j22/j23` creates the clearest intentional accent candidate. |
| Hi-hat / High | `j15,j16,j17` with `j13,j14` secondary | `Low` | Head/shoulders may shape pocket subtly, but much apparent high-frequency motion is stabilization or tracking artifact, not true hat-riding. |
| Full Mix | mass-weighted all joints, especially `j0,j3,j6,j9` | `Low` overall; `Medium` at entry/exit | Whole-body energy is strongly periodic at flare-cycle frequency, so it must be separated from real beat sync. |

**Accent Detection**:
- Expected accent locations: `entry kick-through into first support`, `first elevated clean flare position`, `loaded hand-switch / push-off` if intentionally phrased, `exit / freeze catch`
- Accent source joints: `j22,j23,j18,j19,j20,j21` for hand-load accents; `j0,j1,j2,j4,j5` for hip opening and sweep drive; `j10,j11` only as secondary cues when not occluded
- Expected AHR range: `[0.18, 0.40]` overall; higher only if scoring entry/exit and selected switch accents instead of the full cycle

**Groove Analysis**:
- Is groove lock expected? `No` as a primary criterion. What is expected is **internal cycle regularity**: stable left-right support alternation and repeatable revolution timing.
- Beat-period autocorrelation: `[0.06, 0.22]`
- Subdivisions: usually `irregular relative to the beat`; alternating hand switches can sometimes read like `eighth-note` punctuation, or every full flare can read like a `2-beat` accent, but quarter-note lock is not required

**Anticipation Pattern**:
- Expected tau*: `-70 ms to -20 ms` on entry and deliberate support-switch accents
- Typical for this scenario: the dancer loads the support hand and opens the hips slightly **before** the beat so the visible leg split / apex / push-off lands on it; once the flare is established, timing is governed by the cycle, not BPM

**Phase-Specific Musicality Weight**:
- This scenario should use `20%` musicality weight because flare is a sustained **power move** with alternating hand pivots and ballistic flight. Musicality should matter most on `entry`, selected `phrase accents`, and `exit`, not on every revolution.

**Pseudo-Code**:
```python
import numpy as np

MASS = np.array([11.17,2.78,2.78,5.0,3.28,3.28,3.0,0.61,0.61,2.5,0.97,0.97,
                 1.5,0.5,0.5,5.0,2.0,2.0,1.14,1.14,0.45,0.45,0.41,0.41])

def beat_align(motion_beats, audio_beats, sigma=0.070):
    if len(motion_beats) == 0 or len(audio_beats) == 0: return 0.0
    return float(np.mean([max(np.exp(-((mb-ab)**2)/(2*sigma**2)) for ab in audio_beats)
                          for mb in motion_beats]))

def lagged_corr(x, y, fps=30, max_lag_ms=200):
    x = (x - x.mean()) / (x.std() + 1e-6); y = (y - y.mean()) / (y.std() + 1e-6)
    best_mu, best_tau = -1.0, 0.0; L = int(round(max_lag_ms * fps / 1000))
    for lag in range(-L, L + 1):
        a, b = (x[-lag:], y[:lag]) if lag < 0 else (x[:-lag], y[lag:]) if lag > 0 else (x, y)
        if len(a) < 5: continue
        mu = np.corrcoef(a, b)[0, 1]
        if np.isfinite(mu) and mu > best_mu: best_mu, best_tau = mu, lag / fps
    return float(best_mu), float(best_tau)

def flare_cycle_musicality(joints_3d, beat_times, audio_bands, phases=None, fps=30):
    T, dt = len(joints_3d), 1.0 / fps
    t = np.arange(T) * dt
    vel = np.gradient(joints_3d, axis=0) * fps
    speed = np.linalg.norm(vel, axis=-1)

    com_z = (joints_3d[:, :, 2] @ MASS) / MASS.sum()
    occl = (joints_3d[:,10,2] > com_z + 0.10) & (joints_3d[:,11,2] > com_z + 0.10)
    pivot = np.where(joints_3d[:,22,2] <= joints_3d[:,23,2] + 0.05, 22, 23)
    contacts = {j: (joints_3d[:,j,2] < 0.08) & (np.abs(vel[:,j,2]) < 1.0) for j in [22,23]}

    pivot_xy = joints_3d[np.arange(T), pivot, :2]
    foot_r = np.linalg.norm(joints_3d[:,[10,11],:2] - pivot_xy[:,None,:], axis=-1).mean(axis=1)
    leg_open = np.maximum(0.0, np.gradient(foot_r, dt))
    hip_drive = speed[:,[0,1,2,4,5]] @ MASS[[0,1,2,4,5]]
    kick_motion = hip_drive + 0.35 * (~occl) * (speed[:,10] * MASS[10] + speed[:,11] * MASS[11])
    snare_motion = 1.1*(speed[:,22]+speed[:,23]) + 0.9*(speed[:,18]+speed[:,19]) + 0.6*(speed[:,20]+speed[:,21])
    hat_motion = speed[:,[15,16,17]].mean(axis=1)
    full_motion = speed @ MASS

    left_on  = (np.diff(contacts[22].astype(int), prepend=0) > 0).astype(float)
    right_on = (np.diff(contacts[23].astype(int), prepend=0) > 0).astype(float)
    switch_on = (np.diff(pivot, prepend=pivot[0]) != 0).astype(float)

    accent = (0.30 * snare_motion * (left_on + right_on + 0.5*switch_on) +
              0.25 * leg_open +
              0.20 * np.abs(np.gradient(hip_drive, dt)) +
              0.15 * np.maximum(0.0, np.gradient(com_z, dt)) +
              0.10 * switch_on)
    z = (accent - accent.mean()) / (accent.std() + 1e-6)

    phase_weight = np.full(T, 0.20)
    phase_weight[(left_on + right_on + switch_on) > 0] = 0.35
    if phases is not None:
        phase_weight[np.isin(phases, ["ENTRY_SETUP", "TAKEOFF", "EXIT_CATCH"])] = 1.00
    phase_weight[occl] *= 0.65

    peak_idx = [i for i in range(1, T-1) if z[i] > 0.9 and z[i] >= z[i-1] and z[i] > z[i+1]]
    motion_beats = [t[i] for i in peak_idx if phase_weight[i] > 0.0]

    ba = beat_align(motion_beats, beat_times, sigma=0.070)
    mu_kick, tau_kick = lagged_corr(kick_motion * phase_weight, audio_bands["kick"], fps)
    mu_snare, tau_snare = lagged_corr(snare_motion * phase_weight, audio_bands["snare"], fps)
    mu_hat, _ = lagged_corr(hat_motion * phase_weight, audio_bands["hat"], fps)
    mu_mix, _ = lagged_corr(full_motion * phase_weight, audio_bands["mix"], fps)

    tau_star = tau_snare if mu_snare >= mu_kick else tau_kick
    ahr = float(np.mean([any(abs(mb - ab) <= 0.070 for ab in beat_times) for mb in motion_beats])) if motion_beats else 0.0

    switch_times = np.where(switch_on > 0)[0] / fps
    internal_pulse = 0.5 if len(switch_times) < 3 else float(np.clip(1.0 - np.std(np.diff(switch_times)) /
                                                                     (np.mean(np.diff(switch_times)) + 1e-6) / 0.35, 0, 1))
    anticipation_bonus = 1.0 + 0.25 * np.tanh((-tau_star) / 0.050)
    raw = 0.35*ba + 0.20*max(0.0, max(mu_kick, mu_snare)) + 0.15*max(0.0, mu_mix) + 0.15*ahr + 0.15*internal_pulse
    musicality = 0.20 * raw * anticipation_bonus

    return {"BeatAlign": ba, "AHR": ahr, "mu_kick": mu_kick, "mu_snare": mu_snare,
            "mu_hat": mu_hat, "mu_mix": mu_mix, "tau_star_s": tau_star,
            "internal_pulse": internal_pulse, "musicality": musicality}
```

**Positive**: TRIVIUM v0.1 should already capture `entry` and `exit` timing reasonably well from mass-weighted whole-body energy, and unlike `headspin-loop-01`, flare offers clearer mid-band accent candidates through `j18-j23`. Soft Gaussian BeatAlign with `sigma=70 ms` is also a real improvement here because flare phrasing often anticipates the beat by `1-2` frames at `30 fps`.

**Gap**: TRIVIUM v0.1 needs `active-hand` and `contact-aware` accent extraction for flare. Without that, it will confuse pure cycle periodicity with beat lock, over-trust occluded feet `j10/j11`, and miss that the real musical read is in `entry`, `loaded hand-switch punctuation`, and `exit`, not in every revolution.