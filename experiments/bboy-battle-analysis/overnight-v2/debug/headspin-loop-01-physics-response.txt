### PHYSICS SIGNATURE: headspin-loop-01

**Move Category**: Spinning power
**Pivot**: Fixed — head crown contact point (~5–8cm superior to joint 15 in SMPL coordinates, head cap surface against floor)

---

**Angular Momentum Profile**:
- **Source**: Entry kick via joints 7+8 (ankles) and arm sweep via 22+23 (hands) generate initial L_z. After plant, leg pumping at joints 4+5 (knees) injects small boosts.
- **Conservation**: L_z approximately conserved; primary disruption is head-cap friction torque τ_f = μ · N · r_cap, where N ≈ 0.7·m·g (gravity component along spin axis for ~15° off-vertical head tilt) and r_cap ≈ 0.04m. Net: slow exponential decay, not step-changes.
- **Expected |L_z| range**: 5–15 kg·m²·rad/s competitive range. Full-tuck (I ≈ 0.4–0.6 kg·m²) at 3–4 rev/s ≈ 7–15 range; open legs (I ≈ 6–9 kg·m²) at 0.8–1.2 rev/s ≈ same L_z by conservation.
- **Ice-skater ratio**: I_open/I_tuck ≈ 10–15× → ω_tuck/ω_open ≈ 10–15×. This is the primary quality marker — bboys who tuck perfectly get explosive speed increase.

**RTA Velocity Expectations**:

| Component | Expected Profile | Quality Signal | SMPL Joints to Watch |
|-----------|-----------------|----------------|---------------------|
| Tangential | HIGH, slow monotonic decay (friction). Should NOT fluctuate >±15% per revolution | `CV(v_tan)` < 0.15 = clean spin. Spikes = wobble or near-fall | 0 (pelvis), 7+8 (ankles), 22+23 (hands) |
| Radial | INTENTIONAL pulsing — joints 4+5+7+8 move radially inward then outward for speed control. Not noise. | Cross-correlate radial pulses with dω/dt: positive correlation = intentional I-manipulation | 4 (L_knee), 5 (R_knee), 7+8 (ankles) |
| Axial | Should be NEAR ZERO except during entry/exit. Any sustained axial velocity in joints 0+3+6+9 = wobbly head contact | `mean(|v_ax|) / mean(|v_tan|)` < 0.08 = clean. >0.20 = wobble or pivot migration | 0 (pelvis), 3 (spine1), 15 (head — height drift) |

**Energy Budget**:
- **KE source**: Single entry impulse (head plant + leg kick). No external energy input after.
- **Losses**: Head-cap friction (dominant), spinal muscle damping (minor). Estimated power loss: P_fric = τ_f · ω ≈ μ · 0.7mg · r_cap · ω ≈ 0.2 · 0.7·70·9.8 · 0.04 · 12 ≈ 23W at peak speed.
- **Maintenance signal**: `dω/dt` should be small negative constant (decay ≈ –0.1 to –0.3 rad/s²). Sudden drops indicate loss of contact control. Plateaus or increases during leg tuck are the ice-skater effect — score positively.
- **Decay time constant**: τ ≈ I / (μ · N · r_cap) ≈ 0.5 / (0.2 · 480 · 0.04) ≈ 0.3s per unit ω — so good headspins with pumping last 5–20s; unpumped decay in ~3–6s.

**Quality Pseudo-Code**:
```python
import numpy as np

# De Leva 70kg masses
MASSES = {
    0:11.17, 1:2.78, 2:2.78, 3:5.0, 4:3.28, 5:3.28,
    6:3.0,   7:0.61, 8:0.61, 9:2.5, 10:0.97, 11:0.97,
    12:1.5, 13:0.5, 14:0.5, 15:5.0, 16:2.0, 17:2.0,
    18:1.14,19:1.14,20:0.45,21:0.45,22:0.41,23:0.41
}
SPIN_AXIS = np.array([0.0, 0.0, 1.0])
RTA_JOINTS = [0, 1, 2, 4, 5, 7, 8, 22, 23]  # pelvis, hips, knees, ankles, hands


def score_headspin(joints_3d: np.ndarray, fps: int = 30) -> dict:
    """
    joints_3d: [T, 24, 3] — SMPL world-grounded positions (meters)
    Pivot: joint 15 (head crown contact point)
    """
    T = joints_3d.shape[0]
    dt = 1.0 / fps
    vels = np.gradient(joints_3d, dt, axis=0)  # [T, 24, 3]

    # --- 1. Inversion validation ---
    # Head (j15) should be below pelvis (j0) for valid headspin
    head_z  = joints_3d[:, 15, 2]
    pelvis_z = joints_3d[:, 0, 2]
    inversion_frac = np.mean(head_z < pelvis_z)
    inversion_valid = inversion_frac > 0.70  # >70% frames truly inverted

    # --- 2. Pivot stability (head XY drift) ---
    pivot_xy = joints_3d[:, 15, :2]          # [T, 2]
    pivot_xy_mean = pivot_xy.mean(axis=0)
    drift = np.linalg.norm(pivot_xy - pivot_xy_mean, axis=1)  # [T]
    pivot_stability = 1.0 - np.clip(np.std(drift) / 0.08, 0.0, 1.0)
    # threshold: 8cm std = score 0; <2cm = near 1.0

    # --- 3. Angular momentum L_z about head pivot ---
    Lz = np.zeros(T)
    pivot_3d = np.column_stack([pivot_xy, head_z])  # [T, 3]
    for j, m in MASSES.items():
        r = joints_3d[:, j, :] - pivot_3d          # [T, 3]
        v = vels[:, j, :]                           # [T, 3]
        cross = np.cross(r, v)                      # [T, 3]
        Lz += m * cross[:, 2]

    Lz_abs = np.abs(Lz)

    # L_z conservation: fit linear decay, score residuals
    t_arr = np.arange(T)
    poly = np.polyfit(t_arr, Lz_abs, 1)
    trend = np.polyval(poly, t_arr)
    residuals = Lz_abs - trend
    conservation_cv = np.std(residuals) / (np.mean(Lz_abs) + 1e-6)
    conservation_score = 1.0 - np.clip(conservation_cv * 4.0, 0.0, 1.0)
    # Penalize non-monotonic decay (wobble in L = pivot instability)
    decay_sign_ok = poly[0] <= 0  # slope should be negative (decaying)

    # --- 4. Omega estimate from L_z and estimated I ---
    # Rough I from pelvis-to-ankle radius (proxy for tuck level)
    radii_hips = np.linalg.norm(
        joints_3d[:, [1,2], :2] - joints_3d[:, 15:16, :2], axis=-1
    ).mean(axis=1)  # [T]
    I_approx = 2 * 2.78 * radii_hips**2 + 0.5  # hips + core floor ~0.5 kg·m²
    omega_z = Lz / (I_approx + 1e-6)            # [T] rad/s
    omega_cv = np.std(omega_z) / (np.abs(omega_z).mean() + 1e-6)
    omega_smoothness = 1.0 - np.clip(omega_cv * 3.0, 0.0, 1.0)

    # --- 5. RTA decomposition ---
    v_tan_list, v_rad_list, v_ax_list = [], [], []
    for t in range(T):
        for j in RTA_JOINTS:
            R = joints_3d[t, j] - pivot_3d[t]
            R_mag = np.linalg.norm(R) + 1e-9
            R_hat = R / R_mag
            t_hat = np.cross(SPIN_AXIS, R_hat)
            t_hat /= np.linalg.norm(t_hat) + 1e-9
            v = vels[t, j]
            v_tan_list.append(abs(np.dot(v, t_hat)))
            v_rad_list.append(abs(np.dot(v, R_hat)))
            v_ax_list.append(abs(np.dot(v, SPIN_AXIS)))

    v_tan = np.array(v_tan_list)
    v_rad = np.array(v_rad_list)
    v_ax  = np.array(v_ax_list)
    v_tan_mean = v_tan.mean() + 1e-6

    tangential_cv    = np.std(v_tan) / v_tan_mean
    tangential_score = 1.0 - np.clip(tangential_cv, 0.0, 1.0)

    axial_ratio  = v_ax.mean() / v_tan_mean
    axial_score  = 1.0 - np.clip(axial_ratio * 8.0, 0.0, 1.0)
    # threshold: axial/tangential > 12.5% = score 0

    # Radial intentionality: variance is OK if L_z is conserved (ice-skater pumping)
    radial_intent = conservation_score * 0.7 + omega_smoothness * 0.3

    # --- 6. Head height stability (no bobbing) ---
    head_z_cv    = np.std(head_z) / (np.abs(head_z).mean() + 1e-6)
    height_score = 1.0 - np.clip(head_z_cv * 15.0, 0.0, 1.0)

    # --- 7. Ice-skater bonus: detect tuck→extend speed changes ---
    pelvis_to_ankle_r = np.linalg.norm(
        joints_3d[:, [7,8], :2] - joints_3d[:, 15:16, :2], axis=-1
    ).mean(axis=1)  # [T] — proxy for I_legs
    # Correlation: when r shrinks → omega_z should rise
    r_smooth = np.convolve(pelvis_to_ankle_r, np.ones(5)/5, mode='same')
    w_smooth = np.convolve(np.abs(omega_z), np.ones(5)/5, mode='same')
    if np.std(r_smooth) > 0.02:  # only if there's real I-manipulation
        iceskater_corr = np.corrcoef(r_smooth, w_smooth)[0, 1]
        iceskater_bonus = np.clip(-iceskater_corr, 0.0, 1.0)  # negative corr = good
    else:
        iceskater_bonus = 0.0  # no I-manipulation detected

    # --- Composite ---
    power_quality = (
        0.25 * tangential_score +
        0.20 * conservation_score +
        0.20 * pivot_stability +
        0.15 * axial_score +
        0.10 * height_score +
        0.10 * radial_intent
    )

    return {
        "power_quality":       round(float(power_quality), 3),
        "pivot_stability":     round(float(pivot_stability), 3),
        "L_z_conservation":    round(float(conservation_score), 3),
        "L_z_mean_kgm2s":      round(float(Lz_abs.mean()), 2),
        "omega_z_mean_rads":   round(float(np.abs(omega_z).mean()), 2),
        "tangential_score":    round(float(tangential_score), 3),
        "axial_score":         round(float(axial_score), 3),
        "radial_intent":       round(float(radial_intent), 3),
        "height_stability":    round(float(height_score), 3),
        "iceskater_bonus":     round(float(iceskater_bonus), 3),
        "inversion_valid":     bool(inversion_valid),
        "L_z_decay_correct":   bool(decay_sign_ok),
        # Diagnostic
        "omega_cv":            round(float(omega_cv), 3),
        "axial_ratio":         round(float(axial_ratio), 3),
        "pivot_drift_std_m":   round(float(np.std(drift)), 4),
    }
```

**Positive** — what TRIVIUM v0.1 already captures well for headspin-loop-01:
- Basic rotation speed (ω_z) is detectable from pelvis angular velocity even with head blur
- Tangential velocity magnitude and CV are robust metrics — pelvis/hips (joints 0–2) are rarely blurred
- Inversion detection is straightforward from joint 15 vs joint 0 z-ordering

**Gap** — what v0.1 misses for this specific scenario:

1. **Blur-aware joint weighting**: At 2+ rev/s, joints 7+8+10+11 (ankles/feet) move at 2–4 m/s at full extension → severe motion blur. JOSH 4D temporal coherence partially recovers these, but GVHMR will ghost them. The scoring must down-weight high-velocity joints by confidence, not treat all 24 joints equally.

2. **Head contact validity flag**: Joint 15 in SMPL is the center-of-head mesh, not the crown contact point. The actual pivot is ~6cm superior. This systematic offset corrupts L_z calculation. Need contact-point correction: `pivot_corrected = joints_3d[:, 15] + [0, 0, offset_toward_floor]` where offset is detected from floor-contact depth in JOSH contact maps.

3. **L_z decay model**: v0.1 likely uses instantaneous ω — it won't distinguish *clean decay* (good technique, friction is unavoidable) from *technique failure* (same decay, different cause). The linear-fit-residual approach separates these.

4. **Ice-skater detection**: v0.1 has no concept that decreasing `r_pelvis_to_ankle` correlating with increasing ω is a *positive* quality signal (intentional speed manipulation), not measurement noise. This is the signature of a skilled headspin.

5. **Inversion prior mismatch**: GVHMR trained on upright humans will systematically underestimate torso extension when inverted — pelvis joint 0 may drift toward floor in reconstructed coordinates even when the dancer is fully inverted. JOSH v4 bboy-tuned has seen this pose class. Any pipeline using GVHMR for headspin should apply an inversion confidence gate: if `joints_3d[:, 15, 2] > joints_3d[:, 0, 2]` for >30% of frames, flag reconstruction as suspect.
