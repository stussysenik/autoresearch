# SCENARIO BLUEPRINT: windmill-chain-01
## Tags: inversion, floor-contact, power
## Notes: Left-right consistency and floor contact are the primary stress axes.

---

## Conflict Resolution Before Integration

**Physics vs Phase — "FIRST_SHOULDER_CONTACT" vs "POWER_DROP"**: These overlap. Resolution: `POWER_DROP` is the phase label for the descent interval; `FIRST_SHOULDER_CONTACT` is the contact detection event that fires *within* that phase and triggers the exit condition. They are compatible. The unified blueprint uses Phase naming (`POWER_DROP`) and Contact event naming (`first_shoulder_contact_event`) as separate layers.

**Physics `L_z` vs Phase `L_z`**: Physics correctly identifies that `L_z` (vertical) is near-meaningless for windmill; the dominant component is `L_barrel` projected along the spine's horizontal axis. Phase agent concurs. TRIVIUM v0.1's `L_z` threshold for power move detection will systematically fail here. Unified blueprint uses `L_barrel` everywhere.

**Contact `j13/j14` threshold 0.12m vs Physics 0.08–0.12m SMPL offset**: Physics notes SMPL shoulder joint centers sit 0.08–0.12m anterior of the actual shoulder contact patch. Contact agent uses `j16/j17 < 0.12m` and `j13/j14 < 0.12m`. These are consistent — the 0.12m threshold is already absorbing the joint-center offset. No change needed, but confidence should be flagged as lower during near-horizontal body orientation.

**Phase `HEAD_FLOOR = 0.10m` vs Contact `j15 alarm = 0.10m`**: Identical. Confirmed.

---

## STATES

### State Machine: Unified Physics + Phase + Contact + Musicality

```
STATE: ENTRY_SETUP
  Phase: toprock (j0.z > 0.70m) OR footwork (j22/j23.z < 0.15m)
  Contact: j10, j11 weight-bearing; j22, j23 free or light only
  Physics: L_barrel ≈ 0 kg·m²·rad/s; arm coil building pre-rotation
  Musicality: Entry phrase window — full musicality weight (1.0x). Arm sweep at
              j22/j23 should arrive -80ms to -30ms BEFORE the beat.

  Entry: clip start with j0.z > 0.70m (toprock) OR j0.z < 0.50m AND j22.z < 0.15m (footwork)
  Active measurements:
    - pelvis_height:   j0.z → expected [0.70, 1.10] m (toprock) or [0.20, 0.50] m (footwork)
    - foot_stance:     |j10.x - j11.x| → expected > 0.20m
    - arm_coil_speed:  ||vel(j22)|| + ||vel(j23)|| → expected < 3.0 m/s (building)
    - L_barrel_pre:    angular momentum about spine horizontal axis → expected < 2.0 kg·m²·rad/s
    - foot_wb_both:    j10.z < 0.05m AND j11.z < 0.05m → True
  Exit: j0.z drops Δz/Δt > 0.6 m/s downward AND arm_sweep speed at j22/j23 > 2.0 m/s
  Duration: 6–24 frames; MAY BE ABSENT

  NOTE: If from frame 0, j0.z < 0.50m AND L_barrel > 5 kg·m²·rad/s, skip directly to
        BARREL_PHASE_RIGHT or BARREL_PHASE_LEFT. Not penalized. Confidence weight on
        first revolution's entry quality metrics is halved.

→ TRANSITION to POWER_DROP
  Quality signal: arm sweep velocity at j22/j23 (entry gesture — judges read this);
                  beat timing of j0.z drop relative to downbeat (tau* = -60ms to -20ms ideal)
  Jerk: low-moderate at j0 (intentional, not error)

---

STATE: POWER_DROP
  Phase: transition (entry impulse)
  Contact: feet unloading from weight-bearing → free; first shoulder (j17 or j16) approaching floor
  Physics: Hip kick at j1/j2 generates initial angular impulse 20–60 N·m; L_barrel 0 → 8+ kg·m²·rad/s
  Musicality: Accent window — entry drop should sync to beat (full weight). Arm sweep peak
              at j22/j23 is the primary visible accent.

  Entry: j0.z descending at > 0.6 m/s downward AND (j16.z < 0.30m OR j17.z < 0.30m) imminently
  Active measurements:
    - pelvis_descent_rate: Δj0.z/Δt → expected [0.6, 1.5] m/s downward
    - arm_sweep_peak:      ||vel(j22)|| + ||vel(j23)|| → expected [2.0, 4.5] m/s
    - first_contact_joint: j16.z or j17.z → approaching < 0.12m
    - hip_angular_impulse: d/dt(L_barrel) → expected spike 20–60 N·m
    - foot_clearance:      max(j10.z, j11.z) → rising > 0.15m within 5 frames of shoulder contact
  Exit: (j16.z < 0.12m OR j17.z < 0.12m) AND L_barrel > 8 kg·m²·rad/s
  Duration: 3–8 frames (~0.10–0.27s)

→ TRANSITION to BARREL_PHASE_RIGHT (j17 contacts first) or BARREL_PHASE_LEFT (j16 contacts first)
  Quality signal: jerk at j17 or j16 at impact (HIGH expected — this is the contact impulse);
                  smoothness of arm-to-shoulder handoff (vel j22/j23 → vel j10/j11)
  Jerk: HIGH — contact impact marker, not a quality penalty; USE this event as accent timestamp

---

STATE: BARREL_PHASE_RIGHT
  Phase: power
  Contact: j17 (right_shoulder) weight-bearing; j14 (right_collar) touching/secondary;
           j10, j11 free (elevated > 0.15m); j15 (head) free (> 0.10m)
  Physics: Barrel roll, approximately horizontal axis through CoM; L_barrel 15–40 kg·m²·rad/s;
           leg sweep driving tangential velocity 2.5–5.0 m/s at j10/j11
  Musicality: Power phase — 0.20x musicality weight. Shoulder contact event is a readable
              internal pulse accent (not beat sync). Track for internal_pulse_score only.

  Entry: j17.z < 0.12m AND j10.z, j11.z > 0.15m AND L_barrel > 8 kg·m²·rad/s
  Active measurements:
    - right_shoulder_z:    j17.z → expected [0.05, 0.12] m (contact maintained)
    - right_collar_z:      j14.z → expected < 0.15m (secondary contact patch)
    - left_shoulder_z:     j16.z → expected > 0.30m (off floor)
    - leg_sweep_velocity:  ||vel(j10)|| and ||vel(j11)|| → expected [2.5, 5.0] m/s each
    - L_barrel:            angular momentum about spine horizontal axis → [15, 40] kg·m²·rad/s
    - L_barrel_cv:         std(L_barrel_this_phase) / mean(L_barrel_this_phase) → < 0.15
    - pelvis_z:            j0.z → rising from ~0.25m toward 0.55m
    - axial_drift_v:       v_axial at j0 → expected < 0.30 m/s (in-place windmill)
    - head_clearance:      j15.z → must be > 0.10m
    - foot_path_symmetry:  ||j10 - j17|| vs ||j11 - j17|| → roughly equal (< 15% difference)
  Exit: j17.z > 0.12m (shoulder lifting) AND j14.z < 0.10m (collar/back rolling in)
  Duration: 8–18 frames (~0.27–0.60s)

→ TRANSITION to BACK_ROLL_TRANSITION
  Quality signal: axial velocity at j0 during lift < 0.30 m/s (no floor drift);
                  L_barrel dip at shoulder handoff < 10% = clean pivot mechanics;
                  jerk at j17 lift-off: moderate, store as jerk_R_liftoff

---

STATE: BACK_ROLL_TRANSITION
  Phase: power (pivot migration sub-phase)
  Contact: j13 (left_collar) AND j14 (right_collar) weight-bearing;
           j3/j6 (spine1/spine2) may contact as back surface patch;
           both shoulders may briefly touch but neither is primary WB
  Physics: Brief bilateral friction; L_barrel may dip 5–15% transiently (normal);
           CoM at intermediate height approaching inversion; spine axis approximately horizontal
  Musicality: 0.20x weight. Bilateral contact moment is NOT a beat-sync opportunity.

  Entry: j14.z < 0.10m AND j13.z < 0.12m (bilateral collar contact)
  Active measurements:
    - collar_bilateral_mean:  (j14.z + j13.z) / 2 → expected < 0.12m
    - collar_symmetry:        |j14.z - j13.z| → expected < 0.05m;
                              > 0.08m = lateral tilt → quality flag (asymmetry_flag = True)
    - pelvis_z:               j0.z → expected [0.45, 0.70] m (approaching inversion)
    - head_clearance:         j15.z → MUST be > 0.10m; if < 0.10m for > 2 frames → headmill_suspected
    - L_barrel_dip_pct:       (L_barrel_pre - L_barrel_min) / L_barrel_pre → expected < 0.15
                              > 0.25 = excessive friction / poor back contact
    - back_surface_z:         min(j3.z, j6.z) → if < 0.14m, back patch also contributing WB
    - spine_tilt:             angle of j0→j9 axis from horizontal → expected > 70° from vertical
  Exit: j16.z < 0.12m (left shoulder initiating contact) AND j17.z > 0.12m
  Duration: 3–8 frames (~0.10–0.27s)

→ TRANSITION to BARREL_PHASE_LEFT
  Quality signal: jerk at j16 contact onset (compare magnitude to j17 entry from POWER_DROP);
                  LR_jerk_ratio = jerk_j16_contact / jerk_j17_contact → target [0.85, 1.15];
                  L_barrel at entry of BARREL_PHASE_LEFT vs BARREL_PHASE_RIGHT → < 15% difference

---

STATE: BARREL_PHASE_LEFT
  Phase: power
  Contact: j16 (left_shoulder) weight-bearing; j13 (left_collar) touching/secondary;
           j10, j11 free; j15 free
  Physics: Mirror of BARREL_PHASE_RIGHT about the barrel axis; L_barrel should match
           BARREL_PHASE_RIGHT within 15%; phase duration should match within ±3 frames
  Musicality: 0.20x weight. Left shoulder contact event tracked for internal_pulse_score.

  Entry: j16.z < 0.12m AND j10.z, j11.z > 0.15m AND L_barrel > 8 kg·m²·rad/s
  Active measurements: (mirror of BARREL_PHASE_RIGHT — swap j16↔j17, j13↔j14)
    - left_shoulder_z:     j16.z → expected [0.05, 0.12] m
    - left_collar_z:       j13.z → expected < 0.15m
    - right_shoulder_z:    j17.z → expected > 0.30m
    - leg_sweep_velocity:  ||vel(j10)|| and ||vel(j11)|| → expected same as BARREL_PHASE_RIGHT
    - L_barrel:            → expected same range as BARREL_PHASE_RIGHT; > 30% difference = asymmetry
    - phase_duration:      frames in this state → should match BARREL_PHASE_RIGHT ± 3 frames

    LEFT-RIGHT CONSISTENCY (primary scenario stress):
      dur_R = duration(prev BARREL_PHASE_RIGHT)
      dur_L = duration(this BARREL_PHASE_LEFT)
      dur_asymmetry = |dur_R - dur_L| / max(dur_R, dur_L) → target < 0.15; > 0.25 = dwelling flag
      
      L_R = mean(L_barrel during BARREL_PHASE_RIGHT)
      L_L = mean(L_barrel during BARREL_PHASE_LEFT)
      L_lr_ratio = |L_R - L_L| / max(L_R, L_L) → target < 0.15; > 0.30 = significant asymmetry
      
  Exit: j16.z > 0.12m AND (j3.z < 0.15m OR j6.z < 0.15m) (lower-back contact beginning)
  Duration: 8–18 frames (must match BARREL_PHASE_RIGHT ± 3 frames for high symmetry score)

→ TRANSITION to INVERSION_PEAK
  Quality signal: radial velocity at j0 moderate (0.5–1.5 m/s) — CoM swinging upward;
                  L_barrel near maximum here; jerk at j16 lift-off → store as jerk_L_liftoff

---

STATE: INVERSION_PEAK
  Phase: power (inversion sub-phase)
  Contact: upper back (j13/j14/j6) light touching OR momentarily free;
           j15 MUST remain > 0.10m — this is the headmill alarm gate
  Physics: KE_barrel ↔ PE exchange; L_barrel drops 10–20% below sweep phase value (normal);
           peak CoM height; pelvis confirmed above head
  Musicality: 0.20x weight. High visual impact for judges but NOT a beat accent.

  Entry: j0.z > j15.z (pelvis overtakes head — confirmed inversion)
  Active measurements:
    - inversion_depth:     j0.z - j15.z → expected [0.30, 0.80] m (full windmill)
    - pelvis_peak_z:       j0.z → expected [0.60, 0.90] m
    - head_clearance:      j15.z → must stay > 0.10m (headmill alarm at < 0.10m for > 2 frames)
    - leg_extension:       ||j10 - j0|| + ||j11 - j0|| → expected > 1.20m
    - L_barrel_at_peak:    10–20% below BARREL_PHASE mean (normal PE conversion)
    - per_rev_peak_z:      track j0.z peak per revolution; cv of peaks → target < 0.10
                           > 0.20 = inconsistent inversion depth (asymmetric driving)
    - back_contact_light:  (j13.z + j14.z)/2 < 0.12m possible → light support, not WB
  Exit: j0.z - j15.z < 0.10m (inversion resolving) AND j0.z decreasing
  Duration: 4–10 frames (~0.13–0.33s)

→ TRANSITION to HIP_KICK_RECOVERY
  Quality signal: radial velocity at j0 (CoM falling) moderate (0.3–0.8 m/s) — controlled descent;
                  L_barrel should begin recovering immediately after peak

---

STATE: HIP_KICK_RECOVERY
  Phase: power (energy re-injection)
  Contact: j3 (spine1) and/or j6 (spine2) weight-bearing (back surface during re-drive);
           shoulders transitioning free → next shoulder approaching
  Physics: Hip kick (j1/j2) and leg whip re-inject angular impulse 5–20 N·m per revolution;
           restores L_barrel; if KE_loss_per_rev > KE_injected_per_rev → chain dying
  Musicality: 0.20x weight. Hip kick is internally rhythmic but not beat-locked.

  Entry: j0.z decreasing post-inversion AND (j3.z < 0.15m OR j6.z < 0.15m)
  Active measurements:
    - hip_kick_impulse:    d/dt(L_barrel) → expected positive 5–20 N·m (re-injection spike)
    - spine_contact_z:     min(j3.z, j6.z) → expected [0.05, 0.15] m
    - L_barrel_recovery:   L_barrel after kick / L_barrel before kick → target > 0.90 (< 10% decay)
    - leg_whip_onset:      ||vel(j10)|| + ||vel(j11)|| → should peak here as new sweep initiates
    - kick_impulse_cv:     std([kick_impulse_per_rev]) / mean([...]) → < 0.20 = consistent drive;
                           > 0.35 = fading chain or inconsistent energy input
    - net_L_decay:         (L_rev_N - L_rev_N+1) / L_rev_N → < 0.10 per revolution = good;
                           > 0.20 per revolution = poor technique / fatigue
  Exit: j17.z < 0.12m (right shoulder re-contacting → next revolution)
        OR L_barrel < 5 kg·m²·rad/s (chain dying → EXIT_UNCONTROLLED)
  Duration: 5–10 frames (~0.17–0.33s)

  CHAIN LOOP: → BARREL_PHASE_RIGHT
  EXIT (controlled): intentional whip stop, j0.z rising → EXIT_CONTROLLED
  EXIT (crash): L_barrel drops > 40% in < 5 frames → EXIT_CRASH

---

STATE: EXIT_CONTROLLED
  Phase: transition (controlled dissipation)
  Contact: j10, j11 returning to floor (weight-bearing within 3 frames)
  Physics: Smooth exponential L_barrel decay; CoM rising; axial drift resolving
  Musicality: Exit phrase window — full musicality weight (1.0x). Exit freeze or landing
              should phrase to a musical endpoint.

  Active measurements:
    - L_decay_shape:       exponential (good) vs step-function (crash landing)
    - pelvis_rise_rate:    j0.z Δ/Δt > 0.3 m/s upward
    - foot_return_z:       j10.z, j11.z → floor_z within 3 frames
    - exit_jerk:           jerk at j0 → low-moderate (smooth) vs HIGH (crash)
  Duration: 0.3–0.8s (~9–24 frames)

STATE: EXIT_CRASH
  Phase: transition (uncontrolled)
  Contact: undefined — abrupt loss of controlled contact
  Physics: L_barrel drops > 40% in < 5 frames; jerk HIGH at j0

  Active measurements:
    - L_barrel_drop_pct:   → > 40% in < 5 frames
    - jerk_at_j0:          → HIGH (quality penalty — binary failure flag)
  Duration: variable; typically ends in stumble or unplanned freeze
```

---

## PROPERTIES

Complete data dictionary for TRIVIUM v0.2 implementation:

| Property | Source Agent | SMPL Joints | Formula / Computation | Expected Range | Unit |
|---|---|---|---|---|---|
| `L_barrel` | Physics | 0–23 (all, CoM pivot) | `Σ mᵢ(rᵢ × vᵢ)` projected onto spine horizontal axis `j0→j9`; see `compute_barrel_L()` | `[15, 40]` sweep; `[10, 30]` inversion | kg·m²·rad/s |
| `L_z` | Physics | 0–23 | `Σ mᵢ(rᵢ × vᵢ)_z` about corrected CoM | `< 3.0` (informational — should be low) | kg·m²·rad/s |
| `L_barrel_cv` | Physics | 0–23 | `std(L_barrel) / mean(L_barrel)` during sweep phases only | `< 0.15` good; `> 0.25` poor | dimensionless |
| `energy_decay_per_rev` | Physics | 0–23 | `(L_rev_N - L_rev_N+1) / L_rev_N` per revolution pair | `< 0.10` good; `> 0.20` poor | fraction |
| `hip_kick_impulse` | Physics | 1, 2 (hips) | `d/dt(L_barrel)` during HIP_KICK_RECOVERY; peak positive value | `[5, 20]` N·m | N·m |
| `kick_impulse_cv` | Physics | 1, 2 | `std([kick per rev]) / mean([kick per rev])` | `< 0.20` good; `> 0.35` dying | dimensionless |
| `v_tangential_feet` | Physics | 10, 11 | `||vel(j10)||` and `||vel(j11)||` during sweep phases | `[2.5, 5.0]` m/s each | m/s |
| `feet_tangential_cv` | Physics | 10, 11 | `std((v_j10 + v_j11)/2) / mean(...)` during sweep | `< 0.20` clean; `> 0.35` dying | dimensionless |
| `v_axial_j0` | Physics | 0 (pelvis) | component of vel(j0) along barrel axis | `< 0.30` in-place; `> 0.60` traveling | m/s |
| `floor_drift_m` | Physics | 0–23 (CoM) | `||CoM_xy(T) - CoM_xy(0)||` | informational; `< 0.30m` in-place | m |
| `inversion_depth` | Physics + Phase | 0 (pelvis), 15 (head) | `j0.z - j15.z` during INVERSION_PEAK | `[0.30, 0.80]` m | m |
| `pelvis_peak_z` | Physics + Phase | 0 | `max(j0.z)` per revolution | `[0.60, 0.90]` m | m |
| `leg_extension_peak` | Physics | 0, 4, 5, 7, 8, 10, 11 | `||j10 - j0|| + ||j11 - j0||` at INVERSION_PEAK | `> 1.20` m | m |
| `inversion_ratio` | Phase | 0, 15 | `mean(j0.z > j15.z)` over clip | `[0.25, 0.50]` target | fraction |
| `per_rev_peak_cv` | Phase | 0 | `std([max(j0.z) per rev]) / mean(...)` | `< 0.10` consistent; `> 0.20` asymmetric | dimensionless |
| `phase_label` | Phase | 0, 15, 16, 17, 13, 14, 3, 6 | `classify_windmill_phases()` — see pseudo-code | `{ENTRY_SETUP, POWER_DROP, BARREL_R, BACK_ROLL, BARREL_L, INVERSION_PEAK, HIP_KICK, EXIT}` | category |
| `n_revolutions` | Phase | 17 (right shoulder) | count of BARREL_PHASE_RIGHT segments | `>= 1`; more = better vocabulary | count |
| `dur_asymmetry` | Phase | 16, 17 (shoulders) | `|dur_R - dur_L| / max(dur_R, dur_L)` per revolution pair | `< 0.15` good; `> 0.25` flag | fraction |
| `LR_jerk_ratio` | Phase | 16, 17 | `mean(jerk_j16_contacts) / mean(jerk_j17_contacts)` | `[0.85, 1.15]` symmetric | dimensionless |
| `inversion_peak_symmetry` | Phase | 0 | `|mean(peaks_R_led) - mean(peaks_L_led)| / global_mean_peak` | `< 0.10` symmetric | fraction |
| `right_shoulder_contact` | Contact | 17, 14 | `(j17.z < 0.12m OR j14.z < 0.12m) AND min_speed(j17,j14) < 0.45 m/s` | boolean mask `[T]` | bool |
| `left_shoulder_contact` | Contact | 16, 13 | `(j16.z < 0.12m OR j13.z < 0.12m) AND min_speed(j16,j13) < 0.45 m/s` | boolean mask `[T]` | bool |
| `back_contact` | Contact | 13, 14, 3, 6 | `((j13.z+j14.z)/2 < 0.12m) OR min(j3.z,j6.z) < 0.14m` | boolean mask `[T]` | bool |
| `feet_contact` | Contact | 10, 11 | `j10.z < 0.05m AND j11.z < 0.05m AND speed_j10 < 0.25` | boolean mask `[T]` | bool |
| `head_clearance_z` | Contact | 15 | `j15.z - floor_z` | `> 0.10m` always (< 0.10m → headmill alarm) | m |
| `headmill_suspected` | Contact | 15 | `head_clearance_z < 0.10m` sustained > 2 frames during BACK_ROLL or INVERSION | boolean flag | bool |
| `lr_contact_asymmetry_A` | Contact | 16, 17 | `|n_right_frames - n_left_frames| / total_shoulder_frames` (Type A — duration) | `< 0.10` good; `> 0.25` significant | fraction |
| `L_lr_asymmetry_B` | Physics + Contact | 0–23, 16, 17 | `|L_R_phase_mean - L_L_phase_mean| / max(...)` (Type B — momentum) | `< 0.15` good; `> 0.30` significant | fraction |
| `collar_symmetry` | Contact + Phase | 13, 14 | `mean(|j14.z - j13.z|)` during BACK_ROLL_TRANSITION | `< 0.05m` good; `> 0.08m` lateral tilt | m |
| `windmill_variant` | Contact + Phase | 15 | `"windmill"` or `"headmill_suspected"` or `"one_shoulder"` | category | category |
| `beat_align` | Musicality | all (phase-gated) | `BeatAlign(motion_beats, audio_beats, σ=70ms)` phase-weighted | `[0.10, 0.28]` overall; `[0.35, 0.65]` entry/exit only | dimensionless |
| `AHR` | Musicality | see accent_signal | accent hit rate within 70ms tolerance | `[0.20, 0.45]` overall | fraction |
| `mu_mix` | Musicality | all (mass-weighted) | `lagged_corr(full_motion × phase_weight, audio_mix)` | `[0.05, 0.30]` | dimensionless |
| `tau_star` | Musicality | 0, 1, 2, 22, 23 | best-lag in lagged correlation (entry/exit window) | `[-60ms, -20ms]` anticipation ideal | seconds |
| `internal_pulse_score` | Musicality | 13, 14, 16, 17 | `1 - cv(IOI between shoulder_contact_onsets) / 0.35` | `[0.60, 1.00]` for clean chain | dimensionless |
| `floor_z` | Contact | 10, 11 | `percentile(min(j10.z, j11.z), 5)` during feet_contact frames | `0.00 ± 0.02` m | m |
| `KE_barrel` | Physics | 0–23 | `0.5 × I_total × ω_barrel²` ≈ `0.5 × L_barrel² / I_total` | `[30, 70]` J at moderate windmill | J |
| `contact_sequence` | Contact | 16, 17, 13, 14, 3, 6, 10, 11 | ordered contact state machine output | `[feet_wb, r_sh_wb, back_wb, l_sh_wb, spine_wb, repeat]` | sequence |

---

## VALIDATION

### TRIVIUM Sub-Score Expectations for Clean Windmill Chain

| Sub-Score | Expected Range (clean) | Expected Range (poor) | Rationale |
|---|---|---|---|
| **Technique** (BODY×0.40) | `0.65 – 0.85` | `0.30 – 0.50` | Physics-derived; L_consistency + energy_maintenance + LR_symmetry + inversion_depth. Windmill is a technical move — clean mechanics = high score. |
| **Vocabulary** (BODY×0.20) | `0.70 – 0.85` | `0.40 – 0.60` | Windmill chain is a recognized, named power vocabulary item. Longer chain (more revolutions) raises score. One-shoulder variant scores lower. |
| **Progression** (BODY×0.15) | `0.55 – 0.70` | `0.30 – 0.50` | Chain that holds or accelerates L_barrel scores high; decaying chain scores low. |
| **Cleanliness** (BODY×0.25) | `0.60 – 0.80` | `0.25 – 0.50` | SPARC on CoM velocity + low axial drift + clean contact transitions. |
| **Musicality** (SOUL×0.45) | `0.15 – 0.35` | `0.05 – 0.15` | Expected LOW for power move — grade C is correct. Phase-gated: only entry/exit contribute fully. Never penalize for sustained power loop having low beat sync. |
| **Phrasing** (SOUL×0.25) | `0.40 – 0.60` | `0.20 – 0.40` | STUB — needs audio phrase detector. Entry beat sync + exit phrase catch. |
| **Flow** (MIND×0.30) | `0.60 – 0.80` | `0.25 – 0.50` | Barrel roll continuity; smooth pivot migration; low transition jerk outside of contact impacts. |
| **Energy** (MIND×0.20) | `0.70 – 0.90` | `0.40 – 0.60` | Power move by definition. Chain sustained over N revolutions = high energy signal. |
| **StageUse** (MIND×0.20) | `0.40 – 0.65` | `0.20 – 0.40` | Spatial entropy of CoM path. Traveling windmills score higher; stationary but in-place is neutral. |

**Approximate TRIVIUM total for clean windmill chain (3+ revs)**: `62 – 76` out of 100.

---

### Good vs Bad Execution

**Good execution** (all of the following):
- `L_barrel_cv < 0.15` during sweep phases — momentum held
- `energy_decay_per_rev < 0.10` — chain self-sustaining
- `lr_contact_asymmetry_A < 0.10` — equal time on each shoulder
- `L_lr_asymmetry_B < 0.15` — equal momentum on both sides
- `collar_symmetry < 0.05m` — back roll centered
- `inversion_depth > 0.40m` — real inversion achieved
- `per_rev_peak_cv < 0.10` — consistent inversion height across revolutions
- `headmill_suspected = False` — head stays clear
- `LR_jerk_ratio ∈ [0.85, 1.15]` — symmetric shoulder impacts
- `feet_tangential_cv < 0.20` — leg speed consistent

**Bad execution** (any of the following triggers quality flag):
- `L_barrel drops > 40% in < 5 frames` → EXIT_CRASH
- `L_barrel < 5 kg·m²·rad/s` during supposed power phase → stall / degenerate windmill
- `headmill_suspected = True` (j15.z < 0.10m for > 2 frames during BACK_ROLL or INVERSION) → variant reclassification, NOT windmill quality penalty
- `lr_contact_asymmetry_A > 0.30` → strong shoulder preference
- `L_lr_asymmetry_B > 0.30` → hidden asymmetric drive
- `collar_symmetry > 0.08m` → lateral tilt during back roll
- `inversion_depth < 0.10m` → no real inversion (coindown/half-windmill variant)
- `windmill_variant = "one_shoulder"` → left shoulder never contacts → report variant, suppress LR scores

---

### Known HMR Failure Modes

| Failure Mode | Affected Phases | Mitigation |
|---|---|---|
| GVHMR places j15/j16/j17 artificially low when body is near-horizontal (body_tilt > 70° from vertical) | BARREL_PHASE_R/L, BACK_ROLL | Reduce contact detection confidence when `spine_tilt > 70°`; use cluster hysteresis (3-frame persistence) not single-frame threshold |
| SMPL shoulder joint center sits 0.08–0.12m anterior of actual shoulder capsule contact patch | BARREL_PHASE_R/L | The 0.12m threshold already absorbs this offset; do NOT tighten to 0.06m |
| All HMR models: monocular z-estimation uncertainty doubles when body is near-parallel to floor | BARREL_PHASE_R/L | Flag frames where `max(tilt_from_vertical) > 70°` as `low_confidence_contact`; weight these frames 0.5× in contact-derived metrics |
| JOSH v4 head clearance uncertainty ± 0.06m | BACK_ROLL, INVERSION_PEAK | Headmill alarm threshold is 0.10m — this gives only 0.04m margin. Use 3-frame persistence + cluster: flag only if 3 consecutive frames satisfy `j15.z < 0.10m` |
| Revolution segmentation from right-shoulder contact can double-count if contact is noisy | HIP_KICK_RECOVERY | Apply `min_gap = 5 frames` to filter spurious contact re-triggers; merge contact intervals closer than 5 frames |

---

## TESTS

```python
# Test: windmill-chain-01
# Synthetic data generation — does NOT require real video
# All tests runnable with numpy only

import numpy as np
import pytest

MASSES = {
    0:11.17, 1:2.78,  2:2.78,  3:5.00,  4:3.28,  5:3.28,
    6:3.00,  7:0.61,  8:0.61,  9:2.50, 10:0.97, 11:0.97,
   12:1.50, 13:0.50, 14:0.50, 15:5.00, 16:2.00, 17:2.00,
   18:1.14, 19:1.14, 20:0.45, 21:0.45, 22:0.41, 23:0.41
}

def generate_synthetic_windmill(fps=30, n_revolutions=3, rev_duration=1.0,
                                 lr_asymmetry=0.0, energy_decay=0.0,
                                 add_headmill=False):
    """
    Synthetic windmill chain — analytically generates SMPL joint trajectories.
    
    Parameters:
      lr_asymmetry: 0.0 = perfect symmetry; 0.30 = 30% longer on right shoulder
      energy_decay: 0.0 = no decay; 0.20 = 20% per revolution decay
      add_headmill: if True, drives j15.z < 0.10m during BACK_ROLL phases
    
    Returns:
      joints_3d [T, 24, 3], beat_times [B], expected_scores dict
    """
    entry_frames = 15   # 0.5s entry
    exit_frames  = 15   # 0.5s exit
    rev_frames   = int(rev_duration * fps)
    total_power  = n_revolutions * rev_frames
    T = entry_frames + total_power + exit_frames
    joints = np.zeros((T, 24, 3))

    # ── ENTRY: toprock ────────────────────────────────────────────────────
    t_e = np.linspace(0, 1, entry_frames)
    joints[:entry_frames, 0, 2] = 0.90 - 0.40 * t_e  # pelvis descends 0.90 → 0.50
    joints[:entry_frames, 15, 2] = 1.70 - 0.40 * t_e  # head follows
    joints[:entry_frames, 10, 2] = 0.0   # feet on floor
    joints[:entry_frames, 11, 2] = 0.0
    # Arm sweep peaks at end of entry
    joints[:entry_frames, 22, 2] = 0.90 * (1 - t_e)  # left hand drops
    joints[:entry_frames, 23, 2] = 0.90 * (1 - t_e)

    # ── POWER: N windmill revolutions ─────────────────────────────────────
    for rev in range(n_revolutions):
        start = entry_frames + rev * rev_frames
        end   = start + rev_frames
        t_r   = np.linspace(0, 2 * np.pi, rev_frames)
        
        # L_barrel decays with energy_decay per rev
        amplitude_scale = (1.0 - energy_decay) ** rev
        # LR asymmetry: right shoulder phase is (1 + lr_asymmetry/2) longer fraction
        r_frac = 0.5 + lr_asymmetry / 2
        r_end  = int(r_frac * rev_frames * 0.35)  # right shoulder frames
        l_end  = int((1 - r_frac) * rev_frames * 0.35)

        # Pelvis oscillates: min at shoulder contact (~0.25m), max at inversion (~0.75m)
        pelvis_z_cycle = 0.25 + 0.50 * (0.5 - 0.5 * np.cos(t_r))
        joints[start:end, 0, 2] = pelvis_z_cycle * amplitude_scale + 0.25 * (1 - amplitude_scale)

        # Head stays 0.40m below pelvis at shoulder contact, 0.15m at inversion
        head_z_cycle = np.where(
            pelvis_z_cycle < 0.45,
            pelvis_z_cycle + 0.20,  # near shoulder-contact: head below pelvis
            pelvis_z_cycle - 0.35   # near inversion: head below pelvis confirmed
        )
        if add_headmill:
            # Force j15.z < 0.10m during back-roll region (~30-40% of cycle)
            back_region = (t_r > 0.9 * np.pi) & (t_r < 1.1 * np.pi)
            head_z_cycle[back_region] = 0.05
        joints[start:end, 15, 2] = np.maximum(0.08, head_z_cycle)

        # Right shoulder: low when t ∈ [0, π) → right shoulder contact
        r_contact_mask = t_r < np.pi
        joints[start:end, 17, 2] = np.where(r_contact_mask, 0.08, 0.45) * amplitude_scale + 0.08
        # Left shoulder: low when t ∈ [π, 2π) → left shoulder contact
        l_contact_mask = t_r >= np.pi
        joints[start:end, 16, 2] = np.where(l_contact_mask, 0.08, 0.45) * amplitude_scale + 0.08

        # Collar back: low during mid-transition (t ≈ π/2 and 3π/2)
        back_mask = ((t_r > 0.4*np.pi) & (t_r < 0.6*np.pi)) | \
                    ((t_r > 1.4*np.pi) & (t_r < 1.6*np.pi))
        joints[start:end, 13, 2] = np.where(back_mask, 0.08, 0.30)
        joints[start:end, 14, 2] = np.where(back_mask, 0.08, 0.30)

        # Feet sweep in a circle (leg whip) at ~0.40m radius from pelvis
        leg_speed = 4.0 * amplitude_scale  # m/s tangential
        omega_legs = leg_speed / 0.50  # rad/s = v/r
        joints[start:end, 10, 0] = 0.50 * np.cos(t_r + np.pi/6)  # left foot
        joints[start:end, 10, 1] = 0.50 * np.sin(t_r + np.pi/6)
        joints[start:end, 10, 2] = np.maximum(0.02, 0.50 + 0.40 * np.sin(t_r))
        joints[start:end, 11, 0] = 0.50 * np.cos(t_r + np.pi + np.pi/6)  # right foot
        joints[start:end, 11, 1] = 0.50 * np.sin(t_r + np.pi + np.pi/6)
        joints[start:end, 11, 2] = np.maximum(0.02, 0.50 + 0.40 * np.sin(t_r + np.pi))

        # Spine chain: j3 (spine1) near floor during re-drive (t ≈ 1.75π)
        joints[start:end, 3, 2] = np.where(
            (t_r > 1.65*np.pi) & (t_r < 1.90*np.pi), 0.10, 0.40
        )
        joints[start:end, 6, 2] = joints[start:end, 3, 2] + 0.10  # spine2 above spine1

    # ── EXIT: controlled rise ─────────────────────────────────────────────
    start_exit = entry_frames + total_power
    t_x = np.linspace(0, 1, exit_frames)
    joints[start_exit:, 0, 2] = 0.25 + 0.65 * t_x  # pelvis rises 0.25 → 0.90
    joints[start_exit:, 15, 2] = 1.30 + 0.40 * t_x  # head rises
    joints[start_exit:, 10, 2] = 0.0
    joints[start_exit:, 11, 2] = 0.0

    # Beat times: 120 BPM, 8 beats covering the clip
    clip_duration = T / fps
    beat_times = np.arange(0, clip_duration, 0.5)   # 120 BPM = 0.5s per beat

    # Expected scores for ASSERTIONS below
    expected_scores = {
        "phase_labels_power_fraction": 0.75,
        "beat_align_overall_max":  0.30,  # power move — expected low
        "beat_align_entry_min":    0.15,  # entry has some sync
        "L_barrel_min":  5.0,             # never drops below this in clean windmill
        "inversion_depth_min": 0.25,      # confirmed inversion
        "LR_contact_asym_max": 0.10 + lr_asymmetry,  # tolerance includes injected asymmetry
        "energy_decay_per_rev_max": energy_decay + 0.05,
        "headmill_expected": add_headmill,
    }
    return joints, beat_times, expected_scores


# ── TEST SUITE ────────────────────────────────────────────────────────────────

class TestWindmillChain01:

    def test_phase_detection_clean(self):
        """Phase detector correctly labels power phases for clean windmill."""
        joints, beats, _ = generate_synthetic_windmill(n_revolutions=3)
        from trivium.phase import classify_windmill_phases
        result = classify_windmill_phases(joints, fps=30)
        
        labels = result['labels']
        power_phases = {'BARREL_PHASE_RIGHT', 'BARREL_PHASE_LEFT', 'BACK_ROLL_TRANSITION',
                        'INVERSION_PEAK', 'HIP_KICK_RECOVERY'}
        power_fraction = np.mean(np.isin(labels, list(power_phases)))
        
        assert power_fraction > 0.70, f"Expected >70% power frames, got {power_fraction:.2f}"
        assert result['n_revolutions'] == 3, f"Expected 3 revolutions, got {result['n_revolutions']}"
        assert result['variant'] == 'windmill', f"Clean windmill flagged as {result['variant']}"

    def test_L_barrel_vs_L_z_dominance(self):
        """L_barrel must dominate L_z during power phases — key TRIVIUM v0.1 gap."""
        joints, _, _ = generate_synthetic_windmill(n_revolutions=2)
        from trivium.physics import compute_barrel_L, compute_L_z, smooth_velocity
        
        vel = smooth_velocity(joints, fps=30)
        _, L_barrel = compute_barrel_L(joints, vel)
        L_z = compute_L_z(joints, vel)
        
        # During power phases, L_barrel >> L_z
        assert np.mean(L_barrel[15:75]) > np.mean(np.abs(L_z[15:75])) * 3.0, \
            "L_barrel should dominate L_z by 3× during power phases"
        assert np.mean(L_barrel[15:75]) > 8.0, \
            "L_barrel below 8 kg·m²·rad/s — windmill not generating enough rotation"

    def test_lr_symmetry_clean(self):
        """Left-right contact symmetry metrics pass for symmetric windmill."""
        joints, beats, _ = generate_synthetic_windmill(n_revolutions=3, lr_asymmetry=0.0)
        from trivium.physics import windmill_chain_physics_score
        from trivium.musicality import windmill_chain_musicality_score
        
        scores = windmill_chain_physics_score(joints, fps=30)
        assert scores['lr_contact_symmetry'] > 0.85, \
            f"LR contact symmetry too low: {scores['lr_contact_symmetry']}"
        assert scores['lr_L_symmetry'] > 0.80, \
            f"LR L symmetry too low: {scores['lr_L_symmetry']}"

    def test_lr_asymmetry_detected(self):
        """Injected 30% LR asymmetry is detected and penalized."""
        joints, beats, _ = generate_synthetic_windmill(n_revolutions=3, lr_asymmetry=0.30)
        from trivium.physics import windmill_chain_physics_score
        
        scores = windmill_chain_physics_score(joints, fps=30)
        assert scores['lr_contact_symmetry'] < 0.60, \
            f"Injected asymmetry not detected: {scores['lr_contact_symmetry']}"

    def test_energy_decay_detected(self):
        """20% per-revolution energy decay is detected and lowers energy_maintenance."""
        joints_clean, _, _ = generate_synthetic_windmill(n_revolutions=4, energy_decay=0.0)
        joints_decay, _, _ = generate_synthetic_windmill(n_revolutions=4, energy_decay=0.20)
        
        from trivium.physics import windmill_chain_physics_score
        s_clean = windmill_chain_physics_score(joints_clean)
        s_decay = windmill_chain_physics_score(joints_decay)
        
        assert s_clean['energy_maintenance'] > s_decay['energy_maintenance'] + 0.20, \
            "Energy decay not penalized in score"

    def test_headmill_detection(self):
        """Head contacting floor triggers headmill_suspected flag, not windmill penalty."""
        joints_hm, _, _ = generate_synthetic_windmill(n_revolutions=2, add_headmill=True)
        from trivium.phase import classify_windmill_phases
        
        result = classify_windmill_phases(joints_hm)
        assert result['variant'] == 'headmill_suspected', \
            "Head-floor contact should flag headmill_suspected, not score as failed windmill"

    def test_musicality_low_for_power_move(self):
        """Musicality score is correctly low for sustained power chain."""
        joints, beats, _ = generate_synthetic_windmill(n_revolutions=3)
        from trivium.musicality import windmill_chain_musicality_score
        from trivium.contact import detect_windmill_contacts
        from trivium.phase import classify_windmill_phases
        
        vel = np.gradient(joints, axis=0) * 30
        contact_states, _, _ = detect_windmill_contacts(joints, vel)
        phase_result = classify_windmill_phases(joints)
        
        contact_dict = {
            'left_shoulder':  np.array([s == 'left_shoulder_wb' for s in contact_states]),
            'right_shoulder': np.array([s == 'right_shoulder_wb' for s in contact_states]),
        }
        audio_bands = {
            'kick':  np.random.rand(joints.shape[0]) * 0.5,
            'snare': np.random.rand(joints.shape[0]) * 0.3,
            'hat':   np.random.rand(joints.shape[0]) * 0.2,
            'mix':   np.random.rand(joints.shape[0]) * 0.6,
        }
        scores = windmill_chain_musicality_score(
            joints, beats, audio_bands, contact_dict, phase_result['labels']
        )
        assert scores['musicality_composite'] < 0.40, \
            f"Power move musicality too high ({scores['musicality_composite']:.2f}) — phase gating not applied"

    def test_inversion_confirmed(self):
        """Inversion is confirmed (j0.z > j15.z) during expected frames."""
        joints, _, _ = generate_synthetic_windmill(n_revolutions=2)
        inversion_mask = joints[:, 0, 2] > joints[:, 15, 2]
        
        # Should have real inversion during power phases
        power_start = 15  # after entry
        power_end   = 15 + 2 * int(1.0 * 30)
        assert np.any(inversion_mask[power_start:power_end]), \
            "No inversion frames detected in power segment"
        
        inversion_depth = joints[inversion_mask, 0, 2] - joints[inversion_mask, 15, 2]
        assert np.max(inversion_depth) > 0.25, \
            f"Inversion depth too shallow: max {np.max(inversion_depth):.2f}m"

    def test_single_revolution_baseline(self):
        """Single revolution scores energy_maintenance as neutral (0.5)."""
        joints, _, _ = generate_synthetic_windmill(n_revolutions=1)
        from trivium.physics import windmill_chain_physics_score
        
        scores = windmill_chain_physics_score(joints)
        assert scores['n_revolutions'] == 1
        assert scores['energy_maintenance'] == 0.5, \
            "Single revolution should return neutral energy_maintenance=0.5"

    def test_clip_starts_mid_revolution(self):
        """If clip starts mid-revolution, phase detector should not crash and entry metrics are downweighted."""
        joints, beats, _ = generate_synthetic_windmill(n_revolutions=3)
        # Trim entry: start mid-first-revolution
        joints_trimmed = joints[20:, :, :]  # skip entry + first ~7 power frames
        
        from trivium.phase import classify_windmill_phases
        result = classify_windmill_phases(joints_trimmed)
        assert result['variant'] in ('windmill', 'headmill_suspected'), \
            "Mid-clip start should not crash phase detector"
        # n_revolutions should be at least 2 (lost some of rev 1)
        assert result['n_revolutions'] >= 2
```

---

## PSEUDO-CODE

```python
"""
TRIVIUM v0.2 — windmill-chain-01 scoring
Grounded in SMPL 24 joints, formulas from Physics/Phase/Contact/Musicality agents.
All array shapes in comments.
"""

import numpy as np
from typing import Dict, Any

# ── CONSTANTS ────────────────────────────────────────────────────────────────

SMPL_MASSES = np.array([
    11.17, 2.78, 2.78, 5.00, 3.28, 3.28, 3.00, 0.61, 0.61, 2.50, 0.97, 0.97,
     1.50, 0.50, 0.50, 5.00, 2.00, 2.00, 1.14, 1.14, 0.45, 0.45, 0.41, 0.41
])  # [24] kg — De Leva proportions scaled to 70 kg
TOTAL_MASS = SMPL_MASSES.sum()   # ~70 kg

# Contact thresholds (Contact Agent)
SHOULDER_Z_THRESH  = 0.12   # j16/j17 — absorbs SMPL joint-center offset
COLLAR_Z_THRESH    = 0.12   # j13/j14 — bilateral back patch
SPINE_Z_THRESH     = 0.14   # j3/j6 — hip-kick recovery support
FOOT_Z_THRESH      = 0.05   # j10/j11 — entry/exit weight-bearing
HEAD_ALARM_Z       = 0.10   # j15 — headmill detection threshold
SHOULDER_SPEED_MAX = 0.45   # m/s — rolling contact speed filter
FOOT_SPEED_MAX     = 0.25   # m/s — landing/static filter

# ── UTILITIES ────────────────────────────────────────────────────────────────

def smooth_velocity(joints_3d: np.ndarray, fps: int = 30) -> np.ndarray:
    """Central-difference velocity + 3-frame smoothing. Returns [T, 24, 3] m/s."""
    vel = np.gradient(joints_3d, axis=0) * fps
    kernel = np.array([0.25, 0.50, 0.25])
    for j in range(24):
        for ax in range(3):
            vel[:, j, ax] = np.convolve(vel[:, j, ax], kernel, mode='same')
    return vel

def center_of_mass(joints_3d: np.ndarray) -> np.ndarray:
    """Compute CoM trajectory. Returns [T, 3] m."""
    return np.einsum('j,tjk->tk', SMPL_MASSES, joints_3d) / TOTAL_MASS

def estimate_floor_z(joints_3d: np.ndarray) -> float:
    """
    Floor estimation: 5th percentile of min(j10.z, j11.z) when feet are stationary.
    Falls back to shoulder/back minima if feet never contact floor (mid-clip start).
    """
    foot_z = np.minimum(joints_3d[:, 10, 2], joints_3d[:, 11, 2])
    if np.any(foot_z < 0.10):
        return float(np.percentile(foot_z[foot_z < 0.10], 5))
    # Fallback: back joints
    back_z = np.minimum(joints_3d[:, 13, 2], joints_3d[:, 14, 2])
    return float(np.percentile(back_z, 5))

def compute_barrel_L(
    joints_3d: np.ndarray, vel: np.ndarray
) -> tuple[np.ndarray, np.ndarray]:
    """
    Angular momentum about barrel roll axis (horizontal spine axis).
    Returns (L_full [T,3], L_barrel [T] scalar).
    
    Barrel axis = unit vector from j0 (pelvis) to j9 (spine3) at mid-clip.
    This is approximately the dancer's long-axis during inversion and
    the horizontal axis of rotation during the barrel roll.
    """
    T = joints_3d.shape[0]
    com = center_of_mass(joints_3d)  # [T, 3]
    
    L = np.zeros((T, 3))
    for j, m in enumerate(SMPL_MASSES):
        r = joints_3d[:, j, :] - com    # [T, 3] — moment arm from CoM
        v = vel[:, j, :]                 # [T, 3]
        L += m * np.cross(r, v)          # [T, 3]
    
    # Barrel axis from spine direction at mid-clip
    mid = T // 2
    spine_vec = joints_3d[mid, 9, :] - joints_3d[mid, 0, :]
    spine_hat = spine_vec / (np.linalg.norm(spine_vec) + 1e-6)
    
    L_barrel = np.abs(np.einsum('ti,i->t', L, spine_hat))  # [T] scalar
    return L, L_barrel

def compute_L_z(joints_3d: np.ndarray, vel: np.ndarray) -> np.ndarray:
    """Vertical angular momentum (orbit axis). Should be < 3 kg·m²·rad/s for windmill."""
    com = center_of_mass(joints_3d)
    Lz = np.zeros(joints_3d.shape[0])
    for j, m in enumerate(SMPL_MASSES):
        r  = joints_3d[:, j, :] - com
        rv = np.cross(r, vel[:, j, :])  # [T, 3]
        Lz += m * rv[:, 2]
    return Lz

# ── CONTACT DETECTION (Contact Agent) ────────────────────────────────────────

def detect_windmill_contacts(
    joints_3d: np.ndarray, vel: np.ndarray, floor_z: float = 0.0
) -> tuple[list[str], float, bool, np.ndarray, np.ndarray, np.ndarray]:
    """
    Contact state machine for windmill.
    Returns (states[T], lr_contact_asym, headmill_suspected,
             right_mask[T], left_mask[T], back_mask[T])
    """
    z = joints_3d[:, :, 2] - floor_z
    speed = np.linalg.norm(vel, axis=-1)  # [T, 24]
    T = joints_3d.shape[0]

    # Per-frame boolean masks — cluster filter applied below
    feet_raw  = ((z[:, 10] < FOOT_Z_THRESH) & (speed[:, 10] < FOOT_SPEED_MAX) &
                 (z[:, 11] < FOOT_Z_THRESH) & (speed[:, 11] < FOOT_SPEED_MAX))
    r_sh_raw  = ((z[:, 17] < SHOULDER_Z_THRESH) | (z[:, 14] < SHOULDER_Z_THRESH)) & \
                (np.minimum(speed[:, 17], speed[:, 14]) < SHOULDER_SPEED_MAX)
    l_sh_raw  = ((z[:, 16] < SHOULDER_Z_THRESH) | (z[:, 13] < SHOULDER_Z_THRESH)) & \
                (np.minimum(speed[:, 16], speed[:, 13]) < SHOULDER_SPEED_MAX)
    back_raw  = (((z[:, 13] + z[:, 14]) / 2 < COLLAR_Z_THRESH) |
                 (np.minimum(z[:, 3], z[:, 6]) < SPINE_Z_THRESH))
    head_raw  = (z[:, 15] < HEAD_ALARM_Z) & (speed[:, 15] < FOOT_SPEED_MAX)

    # 3-frame cluster filter (prevents single-frame noise triggers)
    def cluster_filter(mask, min_frames=3):
        out = np.zeros_like(mask)
        for t in range(len(mask)):
            window = mask[max(0,t-1):min(len(mask),t+2)]
            out[t] = window.sum() >= min_frames
        return out

    r_sh = cluster_filter(r_sh_raw)
    l_sh = cluster_filter(l_sh_raw)
    back = cluster_filter(back_raw)
    head = cluster_filter(head_raw)

    # Body-tilt confidence: reduce weight when near-horizontal
    spine_vec = joints_3d[:, 9, :] - joints_3d[:, 0, :]  # [T, 3]
    tilt_from_vertical = np.degrees(np.arctan2(
        np.linalg.norm(spine_vec[:, :2], axis=1), np.abs(spine_vec[:, 2])
    ))
    low_confidence = tilt_from_vertical > 70  # flag only, not used to suppress contact

    # Priority contact state machine
    states = []
    for t in range(T):
        if feet_raw[t]:
            states.append('feet_wb')
        elif r_sh[t] and not l_sh[t] and not back[t]:
            states.append('right_shoulder_wb')
        elif back[t]:
            states.append('back_transfer_wb')
        elif l_sh[t] and not r_sh[t]:
            states.append('left_shoulder_wb')
        elif np.minimum(z[t, 3], z[t, 6]) < SPINE_Z_THRESH:
            states.append('spine_wb')
        else:
            states.append('free_or_inversion')

    # LR contact asymmetry (Type A — duration)
    n_right = states.count('right_shoulder_wb')
    n_left  = states.count('left_shoulder_wb')
    total   = n_right + n_left
    lr_contact_asym = abs(n_right - n_left) / max(total, 1)

    # Headmill detection: head low during back_transfer or inversion
    back_inversion_frames = np.array([
        s in ('back_transfer_wb', 'free_or_inversion') for s in states
    ])
    headmill_suspected = bool(np.sum(head & back_inversion_frames) > 2)

    # One-shoulder windmill detection (returns variant flag, not called here directly)
    # Handled in classify_windmill_phases below.

    return states, lr_contact_asym, headmill_suspected, r_sh, l_sh, back

# ── PHASE CLASSIFICATION (Phase Agent) ───────────────────────────────────────

def segment_phase(labels: np.ndarray, target: str) -> list[tuple[int,int]]:
    """Extract (start, end) frame pairs for each run of target label."""
    segs = []
    in_seg = False
    start = 0
    for t, lbl in enumerate(labels):
        if lbl == target and not in_seg:
            start = t
            in_seg = True
        elif lbl != target and in_seg:
            segs.append((start, t))
            in_seg = False
    if in_seg:
        segs.append((start, len(labels)))
    return segs

def classify_windmill_phases(
    joints_3d: np.ndarray, fps: int = 30
) -> Dict[str, Any]:
    """
    Per-frame phase labels for windmill-chain-01.
    Combines contact detection with L_barrel physics.
    Returns dict with labels[T], transitions, variant, n_revolutions,
    lr_duration_parity, lr_jerk_ratio, inversion_peak_symmetry.
    """
    T = joints_3d.shape[0]
    vel = smooth_velocity(joints_3d, fps)
    floor_z = estimate_floor_z(joints_3d)
    
    _, L_barrel = compute_barrel_L(joints_3d, vel)
    states, _, headmill_suspected, r_sh, l_sh, back = detect_windmill_contacts(
        joints_3d, vel, floor_z
    )
    
    pelvis_z = joints_3d[:, 0, 2] - floor_z
    head_z   = joints_3d[:, 15, 2] - floor_z
    inversion = pelvis_z > head_z
    feet_up   = (joints_3d[:, 10, 2] > floor_z + 0.15) & \
                (joints_3d[:, 11, 2] > floor_z + 0.15)
    spine_contact = (np.minimum(joints_3d[:, 3, 2], joints_3d[:, 6, 2]) - floor_z) < SPINE_Z_THRESH

    # Primary label assignment
    labels = np.full(T, 'UNKNOWN', dtype=object)
    for t in range(T):
        if pelvis_z[t] > 0.70 and L_barrel[t] < 2.0 and not r_sh[t] and not l_sh[t]:
            labels[t] = 'ENTRY_SETUP_TOPROCK'
        elif pelvis_z[t] < 0.50 and L_barrel[t] < 3.0 and not r_sh[t]:
            labels[t] = 'ENTRY_SETUP_FOOTWORK'
        elif r_sh[t] and not back[t] and not l_sh[t]:
            labels[t] = 'BARREL_PHASE_RIGHT'
        elif l_sh[t] and not back[t] and not r_sh[t]:
            labels[t] = 'BARREL_PHASE_LEFT'
        elif back[t]:
            labels[t] = 'BACK_ROLL_TRANSITION'
        elif inversion[t] and not r_sh[t] and not l_sh[t]:
            labels[t] = 'INVERSION_PEAK'
        elif spine_contact[t] and L_barrel[t] > 5.0:
            labels[t] = 'HIP_KICK_RECOVERY'
        elif L_barrel[t] > 5.0 and feet_up[t]:
            labels[t] = 'BARREL_UNKNOWN'  # in-flight, contact unresolved
        elif pelvis_z[t] > 0.60 and L_barrel[t] < 3.0:
            labels[t] = 'EXIT_CONTROLLED'
        elif L_barrel[t] < 1.0:
            labels[t] = 'POWER_DROP'
        else:
            labels[t] = 'POWER_DROP'

    # 3-frame minimum segment filter (reduce label flicker)
    def smooth_labels(lbl, min_seg=3):
        out = lbl.copy()
        i = 0
        while i < len(out):
            j = i
            while j < len(out) and out[j] == out[i]:
                j += 1
            if j - i < min_seg and i > 0:
                out[i:j] = out[i-1]
            i = j
        return out
    labels = smooth_labels(labels)

    # Variant detection
    L_segs = segment_phase(labels, 'BARREL_PHASE_LEFT')
    one_shoulder = len(L_segs) == 0
    variant = 'one_shoulder' if one_shoulder else ('headmill_suspected' if headmill_suspected else 'windmill')

    # Transition event list
    def compute_jerk(jts, t, window=3):
        lo = max(0, t - window)
        hi = min(len(jts), t + window + 1)
        accel = np.gradient(np.gradient(jts[lo:hi, :, :], axis=0), axis=0)
        return float(np.linalg.norm(accel, axis=-1).max())

    transitions = []
    for t in range(1, T):
        if labels[t] != labels[t-1]:
            L_cont = abs(L_barrel[t] - L_barrel[t-1]) / (L_barrel[t-1] + 1e-6)
            transitions.append({
                'frame': t,
                'from': labels[t-1],
                'to': labels[t],
                'jerk': compute_jerk(joints_3d, t),
                'L_continuity_change': round(L_cont, 3),
            })

    # Left-right duration parity
    R_segs = segment_phase(labels, 'BARREL_PHASE_RIGHT')
    dur_parities = []
    for r_seg, l_seg in zip(R_segs, L_segs):
        dr = r_seg[1] - r_seg[0]
        dl = l_seg[1] - l_seg[0]
        dur_parities.append(1.0 - abs(dr - dl) / max(dr, dl, 1))
    lr_duration_parity = float(np.mean(dur_parities)) if dur_parities else 0.5

    # LR jerk ratio at shoulder contact impacts
    r_contact_events = [tr for tr in transitions if tr['to'] == 'BARREL_PHASE_RIGHT']
    l_contact_events = [tr for tr in transitions if tr['to'] == 'BARREL_PHASE_LEFT']
    jerk_R = np.mean([e['jerk'] for e in r_contact_events]) if r_contact_events else 1.0
    jerk_L = np.mean([e['jerk'] for e in l_contact_events]) if l_contact_events else 1.0
    lr_jerk_ratio = float(jerk_L / (jerk_R + 1e-6))

    # Inversion peak symmetry: compare pelvis peak across R-led vs L-led revolutions
    peaks_R, peaks_L = [], []
    for i, (r_seg, l_seg) in enumerate(zip(R_segs, L_segs)):
        # R-led revolution: from start of BARREL_R to end of next BARREL_R
        if i + 1 < len(R_segs):
            rev_end = R_segs[i+1][0]
        else:
            rev_end = T
        inv_frames = labels[r_seg[0]:rev_end] == 'INVERSION_PEAK'
        if np.any(inv_frames):
            peaks_R.append(float(np.max(joints_3d[r_seg[0]:rev_end][inv_frames, 0, 2])))
        l_inv = labels[l_seg[0]:l_seg[1]] == 'INVERSION_PEAK'
        if np.any(l_inv):
            peaks_L.append(float(np.max(joints_3d[l_seg[0]:l_seg[1]][l_inv, 0, 2])))
    if peaks_R and peaks_L:
        mean_all = np.mean(peaks_R + peaks_L)
        inversion_peak_symmetry = float(abs(np.mean(peaks_R) - np.mean(peaks_L)) / (mean_all + 1e-6))
    else:
        inversion_peak_symmetry = 0.5

    return {
        'labels': labels,
        'transitions': transitions,
        'variant': variant,
        'n_revolutions': len(R_segs),
        'lr_duration_parity': round(lr_duration_parity, 3),
        'lr_jerk_ratio': round(lr_jerk_ratio, 3),
        'inversion_peak_symmetry': round(inversion_peak_symmetry, 3),
    }

# ── PHYSICS SCORING (Physics Agent) ──────────────────────────────────────────

def windmill_physics_score(joints_3d: np.ndarray, fps: int = 30) -> Dict[str, float]:
    """
    Physics quality scores for windmill-chain-01.
    Keys match Properties table above.
    """
    T = joints_3d.shape[0]
    floor_z = estimate_floor_z(joints_3d)
    vel = smooth_velocity(joints_3d, fps)
    _, L_barrel = compute_barrel_L(joints_3d, vel)
    _, _, _, r_sh, l_sh, back = detect_windmill_contacts(joints_3d, vel, floor_z)

    # Sweep phases: neither shoulder nor back contacting
    sweep = ~r_sh & ~l_sh & ~back
    L_sweep = L_barrel[sweep] if np.any(sweep) else L_barrel

    # 1. Angular momentum consistency
    L_cv = np.std(L_sweep) / (np.mean(L_sweep) + 1e-6)
    L_consistency = float(np.clip(1.0 - L_cv * 2, 0, 1))

    # 2. Left-right symmetry Type A (contact duration)
    n_r = int(r_sh.sum())
    n_l = int(l_sh.sum())
    total_sh = n_r + n_l
    lr_asym_A = abs(n_r - n_l) / max(total_sh, 1)
    lr_contact_symmetry = float(np.clip(1.0 - lr_asym_A * 4, 0, 1))

    # 3. Left-right symmetry Type B (L_barrel during each phase)
    L_r_phases = L_barrel[r_sh] if np.any(r_sh) else np.array([0.0])
    L_l_phases = L_barrel[l_sh] if np.any(l_sh) else np.array([0.0])
    mean_r, mean_l = np.mean(L_r_phases), np.mean(L_l_phases)
    L_lr_ratio = abs(mean_r - mean_l) / (max(mean_r, mean_l) + 1e-6)
    lr_L_symmetry = float(np.clip(1.0 - L_lr_ratio / 0.30, 0, 1))

    # 4. Energy maintenance across revolutions
    phase_result = classify_windmill_phases(joints_3d, fps)
    R_segs = segment_phase(phase_result['labels'], 'BARREL_PHASE_RIGHT')
    n_revs = len(R_segs)
    if n_revs >= 2:
        rev_L_means = [float(np.mean(L_barrel[s:e])) for s, e in R_segs]
        decay_rates = [(rev_L_means[i] - rev_L_means[i+1]) / (rev_L_means[i] + 1e-6)
                       for i in range(len(rev_L_means) - 1)]
        mean_decay = float(np.mean(decay_rates))
        energy_maintenance = float(np.clip(1.0 - mean_decay / 0.20, 0, 1))
    else:
        energy_maintenance = 0.5  # neutral for single revolution

    # 5. Inversion quality
    inversion_mask = joints_3d[:, 0, 2] > joints_3d[:, 15, 2]
    inversion_ratio = float(np.mean(inversion_mask))
    inv_score = float(np.clip(1.0 - abs(inversion_ratio - 0.35) / 0.20, 0, 1))
    peak_pelvis_z = float(np.max(joints_3d[inversion_mask, 0, 2])) if np.any(inversion_mask) else 0.0
    inv_depth_score = float(np.clip((peak_pelvis_z - 0.40) / 0.50, 0, 1))

    # Per-revolution inversion consistency
    if n_revs >= 2:
        per_rev_peaks = []
        for s, e in R_segs:
            seg_inv = inversion_mask[s:e]
            if np.any(seg_inv):
                per_rev_peaks.append(float(np.max(joints_3d[s:e][seg_inv, 0, 2])))
        if len(per_rev_peaks) >= 2:
            peak_cv = np.std(per_rev_peaks) / (np.mean(per_rev_peaks) + 1e-6)
            inv_consistency = float(np.clip(1.0 - peak_cv / 0.20, 0, 1))
        else:
            inv_consistency = 0.8
    else:
        inv_consistency = 0.8

    # 6. Tangential velocity at feet during sweep
    v_j10 = np.linalg.norm(vel[:, 10, :], axis=1)
    v_j11 = np.linalg.norm(vel[:, 11, :], axis=1)
    if np.any(sweep):
        v_feet = (v_j10 + v_j11)[sweep] / 2
        feet_cv = np.std(v_feet) / (np.mean(v_feet) + 1e-6)
        leg_speed_consistency = float(np.clip(1.0 - feet_cv * 1.5, 0, 1))
        power_level = float(np.mean(v_feet > 1.5))
    else:
        leg_speed_consistency, power_level = 0.5, 0.0

    # 7. Axial drift (floor drift check)
    com = center_of_mass(joints_3d)
    total_drift = float(np.linalg.norm(com[-1, :2] - com[0, :2]))
    drift_score = float(np.clip(1.0 - total_drift / 0.60, 0, 1))

    # 8. Hip kick impulse consistency
    hip_kick_frames = phase_result['labels'] == 'HIP_KICK_RECOVERY'
    if np.any(hip_kick_frames):
        L_kick_segments = []
        kick_segs = segment_phase(phase_result['labels'], 'HIP_KICK_RECOVERY')
        for s, e in kick_segs:
            dL = np.diff(L_barrel[s:e])
            peak_impulse = float(np.max(dL)) if len(dL) > 0 else 0.0
            L_kick_segments.append(peak_impulse)
        if len(L_kick_segments) >= 2:
            kick_cv = np.std(L_kick_segments) / (np.mean(L_kick_segments) + 1e-6)
            hip_kick_consistency = float(np.clip(1.0 - kick_cv / 0.35, 0, 1))
        else:
            hip_kick_consistency = 0.7
    else:
        hip_kick_consistency = 0.5

    # ── Composite physics score ──
    composite = (
        0.18 * L_consistency        +
        0.18 * energy_maintenance   +
        0.12 * lr_contact_symmetry  +  # Type A — duration
        0.12 * lr_L_symmetry        +  # Type B — momentum
        0.10 * inv_score            +
        0.10 * inv_depth_score      +
        0.05 * inv_consistency      +
        0.08 * leg_speed_consistency +
        0.04 * power_level          +
        0.03 * hip_kick_consistency
        # drift_score: informational only — traveling windmills valid
    )

    return {
        'L_consistency':          round(L_consistency, 3),
        'energy_maintenance':     round(energy_maintenance, 3),
        'lr_contact_symmetry':    round(lr_contact_symmetry, 3),   # Type A
        'lr_L_symmetry':          round(lr_L_symmetry, 3),         # Type B
        'inversion_ratio_score':  round(inv_score, 3),
        'inversion_depth':        round(inv_depth_score, 3),
        'inversion_consistency':  round(inv_consistency, 3),
        'leg_speed_consistency':  round(leg_speed_consistency, 3),
        'power_level':            round(power_level, 3),
        'hip_kick_consistency':   round(hip_kick_consistency, 3),
        'floor_drift_m':          round(total_drift, 3),           # informational
        'n_revolutions':          n_revs,                          # vocabulary signal
        'physics_composite':      round(composite, 3),
    }

# ── MUSICALITY SCORING (Musicality Agent) ────────────────────────────────────

def windmill_musicality_score(
    joints_3d: np.ndarray,
    beat_times: np.ndarray,
    audio_bands: Dict[str, np.ndarray],
    phase_labels: np.ndarray,
    fps: int = 30
) -> Dict[str, float]:
    """
    Phase-gated musicality for windmill-chain-01.
    20% global weight because this is a power move.
    Full 1.0x weight only on ENTRY and EXIT windows.
    """
    T = joints_3d.shape[0]
    t_axis = np.arange(T) / fps
    vel = smooth_velocity(joints_3d, fps)
    speed = np.linalg.norm(vel, axis=-1)  # [T, 24]

    # Phase weight mask — Power Agent dictates this
    phase_weight = np.full(T, 0.20)
    entry_exit = np.isin(phase_labels, ['ENTRY_SETUP_TOPROCK', 'ENTRY_SETUP_FOOTWORK',
                                         'POWER_DROP', 'EXIT_CONTROLLED'])
    phase_weight[entry_exit] = 1.00

    # Accent signal: entry drop + arm throw + shoulder-contact onsets + hip kick
    _, _, _, r_sh, l_sh, _ = detect_windmill_contacts(
        joints_3d, vel, estimate_floor_z(joints_3d)
    )
    shoulder_onsets = (np.diff(r_sh.astype(int), prepend=0) > 0) | \
                      (np.diff(l_sh.astype(int), prepend=0) > 0)
    pelvis_drop = np.maximum(0.0, -np.gradient(joints_3d[:, 0, 2]) * fps)
    arm_throw   = np.linalg.norm(vel[:, 22, :], axis=1) + np.linalg.norm(vel[:, 23, :], axis=1)
    hip_kick    = np.linalg.norm(vel[:, 1, :], axis=1) + np.linalg.norm(vel[:, 2, :], axis=1)

    accent_signal = (0.30 * pelvis_drop + 0.25 * arm_throw +
                     0.20 * shoulder_onsets.astype(float) + 0.25 * hip_kick)
    z_sig = (accent_signal - accent_signal.mean()) / (accent_signal.std() + 1e-6)

    # Peak pick with 4-frame min gap
    accent_frames = []
    last = -10
    for i in range(1, T - 1):
        if z_sig[i] > 0.8 and z_sig[i] >= z_sig[i-1] and z_sig[i] >= z_sig[i+1] and (i - last) >= 4:
            accent_frames.append(i)
            last = i

    # Apply phase weighting to accent selection
    motion_beats = [t_axis[f] for f in accent_frames if phase_weight[f] >= 0.5]

    # Beat alignment (Gaussian, σ=70ms)
    def beat_align(mb, ab, sigma=0.070):
        if not mb or len(ab) == 0:
            return 0.0
        return float(np.mean([max(np.exp(-((m - a)**2) / (2*sigma**2)) for a in ab) for m in mb]))

    ba = beat_align(motion_beats, beat_times)

    # Lagged correlation per band (max_lag = 200ms)
    def lagged_corr(x, y, max_lag_ms=200):
        max_lag = int(round(max_lag_ms * fps / 1000))
        x = (x - x.mean()) / (x.std() + 1e-6)
        y = (y - y.mean()) / (y.std() + 1e-6)
        n = min(len(x), len(y))
        x, y = x[:n], y[:n]
        best_mu, best_lag = -1.0, 0
        for lag in range(-max_lag, max_lag + 1):
            if lag < 0:   mu = float(np.corrcoef(x[-lag:], y[:lag])[0, 1])
            elif lag > 0: mu = float(np.corrcoef(x[:-lag], y[lag:])[0, 1])
            else:         mu = float(np.corrcoef(x, y)[0, 1])
            if np.isfinite(mu) and mu > best_mu:
                best_mu, best_lag = mu, lag
        return best_mu, best_lag / fps

    kick_motion  = speed[:, [0,1,2,10,11]] @ SMPL_MASSES[[0,1,2,10,11]]
    snare_motion = speed[:, [18,19,20,21,22,23]].mean(axis=1)
    hat_motion   = speed[:, [13,14,15,16,17]].mean(axis=1)
    full_motion  = (speed @ SMPL_MASSES) * phase_weight

    mu_mix,   tau_mix   = lagged_corr(full_motion, audio_bands['mix'])
    mu_kick,  tau_kick  = lagged_corr(kick_motion, audio_bands['kick'])
    mu_snare, _         = lagged_corr(snare_motion, audio_bands['snare'])
    mu_hat,   _         = lagged_corr(hat_motion, audio_bands['hat'])

    # Accent hit rate within 70ms
    ahr_hits = sum(1 for mb in motion_beats if any(abs(mb - ab) <= 0.070 for ab in beat_times))
    ahr = ahr_hits / max(len(motion_beats), 1)

    # Internal left-right pulse regularity (distinct from beat sync)
    shoulder_times = np.where(shoulder_onsets)[0] / fps
    if len(shoulder_times) >= 3:
        ioi = np.diff(shoulder_times)
        ioi_cv = np.std(ioi) / (np.mean(ioi) + 1e-6)
        internal_pulse = float(np.clip(1.0 - ioi_cv / 0.35, 0, 1))
    else:
        internal_pulse = 0.5

    # Anticipation bonus: reward slight early timing
    tau_star = tau_kick if abs(tau_kick) < 0.200 else tau_mix
    anticipation_bonus = 1.0 + 0.25 * np.tanh((-tau_star) / 0.050)

    joint_band_score = float(np.mean([
        np.clip(mu_kick, 0, 1),
        np.clip(mu_snare, 0, 1),
        np.clip(mu_hat, 0, 1),
    ]))

    composite = (
        0.35 * ba                                          +
        0.20 * float(np.clip(mu_mix, 0, 1)) * anticipation_bonus +
        0.20 * ahr                                         +
        0.15 * joint_band_score                            +
        0.10 * internal_pulse
    )

    return {
        'BeatAlign':             round(float(ba), 3),
        'AHR':                   round(float(ahr), 3),
        'mu_mix':                round(float(mu_mix), 3),
        'tau_star_s':            round(float(tau_star), 3),
        'internal_pulse':        round(float(internal_pulse), 3),
        'musicality_composite':  round(float(np.clip(composite, 0, 1)), 3),
    }

# ── TRIVIUM v0.2 COMPOSITE SCORING ───────────────────────────────────────────

def score_windmill_chain_01(
    joints_3d: np.ndarray,
    beat_times: np.ndarray,
    audio_bands: Dict[str, np.ndarray],
    fps: int = 30
) -> Dict[str, Any]:
    """
    TRIVIUM v0.2 full scoring for windmill-chain-01.
    S_total = 0.40*BODY + 0.35*SOUL + 0.25*MIND (0-100 scale)
    
    BODY = 0.40*Technique + 0.20*Vocabulary + 0.15*Progression + 0.25*Cleanliness
    SOUL = 0.45*Musicality + 0.25*Phrasing[STUB] + 0.30*Creativity[STUB]
    MIND = 0.30*Flow + 0.20*Energy + 0.30*Response[STUB] + 0.20*StageUse
    """
    T = joints_3d.shape[0]
    vel = smooth_velocity(joints_3d, fps)
    floor_z = estimate_floor_z(joints_3d)

    # ── Phase detection (drives all subsequent scoring) ───────────────────
    phase_result = classify_windmill_phases(joints_3d, fps)
    labels       = phase_result['labels']
    n_revs       = phase_result['n_revolutions']
    variant      = phase_result['variant']

    # Abort gracefully for non-windmill variants
    if variant == 'one_shoulder':
        return _one_shoulder_fallback(joints_3d, beat_times, audio_bands, fps, labels)

    # ── Contact signatures ────────────────────────────────────────────────
    states, lr_asym, headmill, r_sh, l_sh, back = detect_windmill_contacts(
        joints_3d, vel, floor_z
    )

    # ── Physics scores ────────────────────────────────────────────────────
    phys = windmill_physics_score(joints_3d, fps)

    # ── Musicality scores ─────────────────────────────────────────────────
    mus = windmill_musicality_score(joints_3d, beat_times, audio_bands, labels, fps)

    # ── BODY (40%) ────────────────────────────────────────────────────────

    # Technique: physics-derived, prioritizing LR consistency per scenario notes
    # Weights: L_consistency (chain quality), LR symmetry (scenario primary stress),
    #          inversion quality, energy maintenance, leg speed
    technique = (
        0.25 * phys['L_consistency']        +
        0.20 * phys['lr_contact_symmetry']  +   # Type A — SCENARIO PRIMARY
        0.20 * phys['lr_L_symmetry']        +   # Type B — SCENARIO PRIMARY
        0.15 * phys['energy_maintenance']   +
        0.10 * phys['inversion_depth']      +
        0.05 * phys['inversion_consistency']+
        0.05 * phys['leg_speed_consistency']
    )

    # Vocabulary: move complexity × chain length
    # Windmill chain = recognized move (base 0.70); more revs = richer vocabulary
    rev_bonus = float(np.clip((n_revs - 1) * 0.05, 0, 0.20))
    headmill_penalty = -0.10 if headmill else 0.0  # variant divergence
    vocabulary = float(np.clip(0.70 + rev_bonus + headmill_penalty, 0.0, 1.0))

    # Progression: energy trend across revolutions
    # Rising L = acceleration (rare skill); decaying = fading
    progression = phys['energy_maintenance']

    # Cleanliness: SPARC on CoM + axial drift penalty + collar symmetry
    com = center_of_mass(joints_3d)
    com_vel = np.linalg.norm(np.gradient(com, axis=0) * fps, axis=1)
    # SPARC: spectral arc length smoothness metric (lower value = smoother = better)
    freq = np.fft.rfftfreq(T, d=1.0/fps)
    fft_val = np.abs(np.fft.rfft(com_vel - com_vel.mean()))
    arc_len = float(np.sum(np.sqrt(np.diff(fft_val)**2 + np.diff(freq)**2)))
    sparc_score = float(np.clip(1.0 - arc_len / 200.0, 0, 1))

    # Collar symmetry (floor contact quality signal)
    back_frames = np.where(back)[0]
    if len(back_frames) > 0:
        collar_asym = float(np.mean(np.abs(
            joints_3d[back_frames, 14, 2] - joints_3d[back_frames, 13, 2]
        )))
        collar_score = float(np.clip(1.0 - collar_asym / 0.08, 0, 1))
    else:
        collar_score = 0.7  # no back contact detected — uncertain

    # Drift score: informational but feeds cleanliness mildly
    drift_penalty = float(np.clip(phys['floor_drift_m'] / 0.60, 0, 1)) * 0.15

    cleanliness = (0.60 * sparc_score + 0.30 * collar_score - drift_penalty)
    cleanliness = float(np.clip(cleanliness, 0, 1))

    BODY = 0.40 * technique + 0.20 * vocabulary + 0.15 * progression + 0.25 * cleanliness

    # ── SOUL (35%) ────────────────────────────────────────────────────────

    # Musicality: phase-gated composite (20% effective weight for power move)
    # The 0.20 global weight is baked into windmill_musicality_score via phase_weight mask
    musicality = mus['musicality_composite']

    # Phrasing: STUB — needs phrase-boundary detector from audio
    # Placeholder uses BeatAlign on entry/exit windows only
    phrasing = float(np.clip(mus['BeatAlign'] * 1.5, 0, 0.7))  # STUB

    # Creativity: STUB — needs movement prediction model
    creativity = 0.5  # STUB

    SOUL = 0.45 * musicality + 0.25 * phrasing + 0.30 * creativity

    # ── MIND (25%) ────────────────────────────────────────────────────────

    # Flow: SPARC on CoM velocity (same signal, already computed)
    flow = sparc_score

    # Energy: sustained power level over chain
    # High n_revs + high power_level = high energy
    energy = float(np.clip(
        0.50 * phys['power_level'] + 0.50 * float(np.clip(n_revs / 5.0, 0, 1)),
        0, 1
    ))

    # Response: STUB — needs opponent/judge data
    response = 0.5  # STUB

    # Stage use: spatial entropy of CoM x-y path
    com_xy = com[:, :2]
    # Discretize to 10x10 grid, compute entropy
    x_norm = (com_xy[:, 0] - com_xy[:, 0].min()) / (com_xy[:, 0].ptp() + 1e-6)
    y_norm = (com_xy[:, 1] - com_xy[:, 1].min()) / (com_xy[:, 1].ptp() + 1e-6)
    bins = np.zeros((10, 10))
    for xi, yi in zip((x_norm * 9.99).astype(int), (y_norm * 9.99).astype(int)):
        bins[xi, yi] += 1
    probs = bins.flatten() / (bins.sum() + 1e-6)
    probs = probs[probs > 0]
    stage_use = float(np.clip(-np.sum(probs * np.log(probs)) / np.log(100), 0, 1))

    MIND = 0.30 * flow + 0.20 * energy + 0.30 * response + 0.20 * stage_use

    # ── Total ─────────────────────────────────────────────────────────────
    total = (0.40 * BODY + 0.35 * SOUL + 0.25 * MIND) * 100

    return {
        # Totals
        'total':          round(total, 1),
        'BODY':           round(BODY * 100, 1),
        'SOUL':           round(SOUL * 100, 1),
        'MIND':           round(MIND * 100, 1),
        # BODY components
        'technique':      round(technique * 100, 1),
        'vocabulary':     round(vocabulary * 100, 1),
        'progression':    round(progression * 100, 1),
        'cleanliness':    round(cleanliness * 100, 1),
        # SOUL components
        'musicality':     round(musicality * 100, 1),
        'phrasing':       round(phrasing * 100, 1),   # STUB
        'creativity':     round(creativity * 100, 1),  # STUB
        # MIND components
        'flow':           round(flow * 100, 1),
        'energy':         round(energy * 100, 1),
        'response':       round(response * 100, 1),   # STUB
        'stage_use':      round(stage_use * 100, 1),
        # Diagnostics
        'n_revolutions':  n_revs,
        'variant':        variant,
        'headmill_suspected': headmill,
        'lr_contact_asym_A':  round(lr_asym, 3),
        'lr_L_asym_B':        round(phys['lr_L_symmetry'], 3),
        'floor_drift_m':      phys['floor_drift_m'],
        'L_barrel_mean':      None,  # caller can retrieve from physics module
        'phase_labels':       labels,
        # Raw sub-scores for diagnostics
        '_phys': phys,
        '_mus':  mus,
        '_phase': {
            'lr_duration_parity':    phase_result['lr_duration_parity'],
            'lr_jerk_ratio':         phase_result['lr_jerk_ratio'],
            'inversion_peak_sym':    phase_result['inversion_peak_symmetry'],
        }
    }


def _one_shoulder_fallback(joints_3d, beat_times, audio_bands, fps, labels):
    """
    One-shoulder windmill: valid move, different scoring.
    Suppress LR metrics. Score as 'coindown' variant.
    """
    return {
        'total': None,
        'variant': 'one_shoulder',
        'message': 'One-shoulder windmill detected. Requires separate scoring model. '
                   'LR symmetry metrics not applicable.',
        'phase_labels': labels,
    }
```

---

## POSITIVE

What TRIVIUM v0.1 already handles well for this scenario:

1. **Pelvis height tracking (`j0.z`)** directly captures the CoM oscillation pattern — maps well to INVERSION_PEAK detection and the inversion gate (`j0.z > j15.z`). No change needed.
2. **Velocity smoothing (central difference + 3-frame window)** handles high-jerk contact impacts at FIRST_SHOULDER_CONTACT without over-penalizing the transition. The smoothing already exists in v0.1's framework.
3. **Foot velocity at `j10/j11`** is the right place to measure leg whip power — only the axis decomposition needs extending from vertical (headspin) to horizontal barrel roll.
4. **SPARC smoothness on CoM velocity** — already in v0.1 and maps directly to `cleanliness` and `flow` sub-scores here.
5. **JOSH v4 bboy-tuned model** reduces floor-contact estimation error for near-horizontal body poses (the hardest pose class for general HMR models). The `prior_loss_weight=15` setting in JOSH v4 allows unusual inverted/near-floor poses that general models catastrophically fail on.
6. **Gaussian BeatAlign with σ=70ms** — correctly forgiving for power accents where ±1–2 frames at 30fps is mechanically acceptable. No change needed.
7. **Contact `detect_contacts()` framework** is correctly structured for binary per-joint detection. Extension to the 4-state contact chain (feet → right shoulder → back → left shoulder → spine) requires only adding the new threshold constants.

---

## GAPS

| Gap | Difficulty | Source Agent | What's Needed |
|---|---|---|---|
| `L_barrel` (barrel-roll axis) vs `L_z` (vertical) | **Medium** | Physics | `compute_barrel_L()` using spine direction `j0→j9` as axis. Replace `L_z` for power move detection. ~40 LOC new function. |
| Per-revolution segmentation | **Medium** | Physics + Phase | `segment_revolutions()` from right-shoulder contact rising edges with `min_gap=5` filter. Required by energy_maintenance, kick_cv, inversion_peak_symmetry. ~30 LOC. |
| Left-right symmetry — Type A (contact duration) | **Easy** | Contact + Physics | Already implicit in `lr_contact_asym` from contact agent. Needs named metric in TRIVIUM output. ~5 LOC. |
| Left-right symmetry — Type B (L asymmetry per phase) | **Medium** | Physics | Per-phase L_barrel mean comparison. Requires phase labels from Phase agent. ~20 LOC. |
| Phase-aware musicality weighting | **Easy** | Musicality | `phase_weight` mask: 1.0 on ENTRY/EXIT, 0.20 on POWER states. Prevents unfair low musicality penalty on power chains. ~15 LOC. |
| Migrating pivot in RTA decomposition | **Hard** | Physics | v0.1 assumes fixed pivot (headspin geometry). Windmill needs migrating contact point tracked per frame. Replace `fixed_pivot` with `detect_pivot(contacts, joints_3d)` returning per-frame contact centroid. ~80 LOC. |
| Collar symmetry (`|j14.z - j13.z|` during BACK_ROLL) | **Easy** | Contact + Phase | Phase-gated metric during BACK_ROLL_TRANSITION. Most informative location for lateral tilt detection. ~10 LOC. |
| Headmill variant detection and routing | **Easy** | Contact + Phase | `j15.z < 0.10m` cluster check during BACK_ROLL/INVERSION. Return `variant='headmill_suspected'` and suppress windmill quality score. ~15 LOC. |
| One-shoulder windmill detection | **Easy** | Phase | Check if BARREL_PHASE_LEFT ever fires. If not, flag `variant='one_shoulder'` and suppress LR metrics. ~10 LOC. |
| Hip kick impulse per revolution | **Medium** | Physics | `d/dt(L_barrel)` peak during HIP_KICK_RECOVERY segments. Track CV across revolutions for chain sustainability signal. ~25 LOC. |
| Internal pulse regularity separated from beat sync | **Easy** | Musicality | IOI from shoulder contact onset timestamps (j16/j17). Already in musicality pseudo-code. ~20 LOC to wire into output. |
| Body-tilt confidence downweighting | **Easy** | Contact | When `tilt_from_vertical > 70°`, multiply contact confidence by 0.5×. Propagates uncertainty through contact-derived metrics. ~10 LOC. |
| Phrasing sub-score (STUB) | **Hard** | Musicality | Needs audio phrase boundary detector (4-bar, 8-bar structure recognition). Requires audio DSP pipeline not yet in TRIVIUM. |
| Creativity sub-score (STUB) | **Very Hard** | — | Needs movement prediction model (predict what dancer will do next; surprise = creativity). Out of scope for v0.2. |
| Response sub-score (STUB) | **Hard** | — | Needs opponent joint data and cypher-context awareness. Out of scope for v0.2. |
