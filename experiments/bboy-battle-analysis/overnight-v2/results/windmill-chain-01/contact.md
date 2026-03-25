**Contact Signature**
### CONTACT SIGNATURE: `windmill-chain-01`

Unlike `headspin-loop-01`, this is not a fixed single-point pivot. The clean fingerprint is a migrating, alternating shoulder-back chain with the head clear of the floor.

**Contact Pattern**: `MIGRATING`, periodic, left-right alternating  
**Primary Contact Joints**: `j16 left_shoulder`, `j17 right_shoulder`, `j13 left_collar`, `j14 right_collar`, back surface proxy from `j3/j6` and upper-back collar region; `j10/j11` only for entry/exit  
**Contact Sequence**: `[feet WB] -> [first shoulder WB] -> [bilateral upper-back/collar WB] -> [opposite shoulder WB] -> [spine/back WB in re-drive] -> repeat`  
If `j15 head` becomes sustained contact during back-roll or inversion, classify `headmill_suspected`, not a failed windmill.

**Weight-Bearing Timeline**

| State / segment | Contact state |
|---|---|
| `ENTRY_SETUP` | `j10,j11` weight-bearing; `j22,j23` free or light touching only |
| `POWER_DROP` | feet unload from weight-bearing to touching/free; first shoulder (`j17` or `j16`) becomes touching then weight-bearing |
| `BARREL_PHASE_RIGHT` | `j17` weight-bearing; `j14` touching/secondary support; feet free; head free |
| `BACK_ROLL_TRANSITION` | `j13,j14` plus upper/lower back (`j3/j6`) weight-bearing as a surface patch; both shoulders may be touching |
| `BARREL_PHASE_LEFT` | `j16` weight-bearing; `j13` touching/secondary support; feet free; head free |
| `INVERSION_PEAK` | upper back light touching or brief free phase; support can become degenerate; head must stay non-contact |
| `HIP_KICK_RECOVERY` | `j3/j6` back surface weight-bearing; shoulders touching/free as load migrates back to next shoulder |
| `EXIT_CONTROLLED` | `j10,j11` return to touching then weight-bearing |

**Contact Signature Fingerprint**

| Time Segment | Contact Joints | Classification | Move ID |
|---|---|---|---|
| Entry | `j10,j11` | `weight_bearing` | `windmill_entry` |
| First half-rev | `j17` or `j16` + ipsi collar | `weight_bearing + touching` | `windmill_shoulder_lead` |
| Transfer | `j13,j14,j3/j6` | `weight_bearing` | `windmill_back_roll` |
| Opposite half-rev | opposite shoulder + ipsi collar | `weight_bearing + touching` | `windmill_shoulder_lead_mirror` |
| Re-drive | `j3/j6` | `weight_bearing` | `windmill_hip_kick_recovery` |
| Fault case | `j15` sustained low | `weight_bearing/touching` | `headmill_suspected` |

**Support Polygon Analysis**
- Entry/exit: line segment between `j10` and `j11`; statically stable; CoM should project inside or near center.
- Single-shoulder phases: effective support is a point or very short line around the shoulder capsule/back patch; stability is `gyroscopic`, not static; CoM will often sit outside the instantaneous polygon.
- Back-roll transition: short line or small triangle across `j13/j14` and back proxy `j3/j6`; this is the most centered support moment of the cycle.
- Inversion peak: support may collapse to a degenerate line or disappear briefly; momentum carries the move.

**Scenario-Critical Contact Checks**
- Left-right contact duration asymmetry: `abs(frames_R_shoulder - frames_L_shoulder) / total_shoulder_frames`, target `< 0.10`.
- Back-transfer symmetry: mean `abs(j14.z - j13.z)` during transfer, target `< 0.05 m`; `> 0.08 m` suggests tilt/favoring one side.
- Head-clearance rule: `j15.z > 0.10 m` through back-roll and inversion; repeated violation means variant change, not just bad contact.

**Detection Thresholds**

| Joint / proxy | z_threshold (m) | speed_threshold (m/s) | Rationale |
|---|---:|---:|---|
| `j10,j11` feet | `0.05` | `0.25` | entry/exit support, allow landing motion |
| `j16,j17` shoulders | `0.12` | `0.45` | SMPL shoulder center sits above true capsule contact; rolling contact is not stationary |
| `j13,j14` collar / upper-back proxy | `0.12` | `0.50` | main transfer patch in windmill, especially for LR symmetry checks |
| `j3/j6` spine back proxy | `0.14` | `0.45` | hip-kick recovery support; joint centers sit above actual floor patch |
| `j22,j23` hands | `0.06` | `0.25` | optional assisted entry only, not primary chain support |
| `j15` head alarm | `0.10` | `0.25` | used to detect headmill contamination / false windmill labeling |

**Floor Plane**
- Expected `floor_z`: `0.00 m` in world-grounded JOSH output, practical tolerance `+/- 0.02 m`.
- Confidence: `high` if entry/exit foot contacts exist; `medium` if the clip starts mid-spin.
- Best estimator here is feet-first, then shoulder/back minima. Do not let isolated head lows define the floor.

**Pseudo-Code**
```python
def detect_windmill_contacts(joints_3d, vel, fps=30):
    floor_z = estimate_floor_from_feet_then_back(joints_3d)
    z = joints_3d[..., 2] - floor_z
    speed = np.linalg.norm(vel, axis=-1)

    feet = (z[:,10] < 0.05) & (speed[:,10] < 0.25), (z[:,11] < 0.05) & (speed[:,11] < 0.25)
    r_sh = ((z[:,17] < 0.12) | (z[:,14] < 0.12)) & (np.minimum(speed[:,17], speed[:,14]) < 0.45)
    l_sh = ((z[:,16] < 0.12) | (z[:,13] < 0.12)) & (np.minimum(speed[:,16], speed[:,13]) < 0.45)
    back = (((z[:,13] + z[:,14]) / 2) < 0.12) | (np.minimum(z[:,3], z[:,6]) < 0.14)
    head_alarm = (z[:,15] < 0.10) & (speed[:,15] < 0.25)

    states = []
    for t in range(len(joints_3d)):
        if feet[0][t] and feet[1][t]:
            states.append("feet_wb")
        elif r_sh[t] and not l_sh[t]:
            states.append("right_shoulder_wb")
        elif back[t]:
            states.append("back_transfer_wb")
        elif l_sh[t] and not r_sh[t]:
            states.append("left_shoulder_wb")
        else:
            states.append("free_or_inversion")

    lr_contact_asym = abs(states.count("right_shoulder_wb") - states.count("left_shoulder_wb")) / max(
        1, states.count("right_shoulder_wb") + states.count("left_shoulder_wb")
    )
    headmill_suspected = head_alarm[np.isin(states, ["back_transfer_wb", "free_or_inversion"])].sum() > 2
    return states, lr_contact_asym, headmill_suspected
```

**Positive**: JOSH v4 + BSTRO should help a lot here because the real support is a sliding shoulder/back surface patch, not a single joint. That is exactly where vertex-level contact beats raw SMPL joint thresholds.

**Gap**: SMPL 24 has no sternum/scapula/palm surface representation, so shoulder/back contact is still a proxy. Monocular inversion errors can also push `j15`, `j16`, or `j17` artificially low, so contact should be cluster-based with hysteresis, not a single-joint hard threshold.