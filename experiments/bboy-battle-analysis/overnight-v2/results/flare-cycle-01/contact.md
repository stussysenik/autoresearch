### CONTACT SIGNATURE: flare-cycle-01

**Contact Pattern**: `ALTERNATING`  
**Primary Contact Joints**: `22 left_hand`, `23 right_hand`  
**Secondary / Transitional Contacts**: `10 left_foot`, `11 right_foot` on entry/exit only  
**Contact Sequence**: `feet WB -> lead hand load -> [L_hand WB -> switch window -> R_hand WB -> switch window]* -> foot catch`  

This diverges cleanly from `headspin-loop-01` and `windmill-chain-01`: there is no fixed `15 head` pivot, and no migrating back/shoulder surface contact. The flare fingerprint is unilateral hand support alternating left-right, with only brief ambiguity at the hand switch.

**Weight-Bearing Timeline****  
Relative, phase-based ranges at `30 fps`:

```text
ENTRY_SETUP          → feet(10,11) weight-bearing; hands(22,23) free or light touching
WIND_UP (5-12f)      → lead hand(22 or 23) touching → weight-bearing; last foot unloading
FLARE_CONTACT_A      → one hand weight-bearing; opposite hand free; feet airborne/free
SWITCH_WINDOW (2-5f) → outgoing hand touching/unloading, incoming hand touching/loading;
                       support = point or brief line; possible 1-3f no confirmed WB if switch is explosive
FLARE_CONTACT_B      → opposite hand weight-bearing; first hand free; feet airborne/free
REPEAT               → alternating unilateral hand support across each half-cycle
EXIT_DECEL (5-20f)   → hand contact duty cycle lengthens; first foot becomes touching then weight-bearing
EXIT_CATCH (5-20f)   → one or both feet weight-bearing; hands touching or free as weight transfers upright
```

**Contact Signature Fingerprint**

| Time Segment | Contact Joints | Classification | Move ID |
|---|---|---|---|
| Entry | `10,11` | `weight_bearing` | flare entry / setup |
| Wind-up | lead `22/23`, trailing `10/11` | hand `touching→weight_bearing`, foot `weight_bearing→touching` | power takeoff |
| Core half-cycle A | one of `22/23` | active hand `weight_bearing`, all others `free` | flare support |
| Hand switch | `22` and/or `23` | outgoing `touching`, incoming `touching→weight_bearing` | flare switch |
| Exit catch | `10/11` plus optional `22/23` | feet `touching→weight_bearing`, hands `touching/free` | flare exit |

**Support Polygon Analysis**
- Shape: `point` during clean flare support, `line` during brief two-hand switch frames, `none` during ballistic/unloaded switch windows, `line/triangle` on entry and catch.
- Stability: `gyroscopic` in the core cycle, not statically stable. Static stability only returns on entry/exit.
- CoM position relative to polygon: usually `outside` a single-hand point support in the core flare, briefly crossing the hand-to-hand line at switch, then returning `inside` the foot-based polygon on catch.

**Detection Thresholds** (scenario-specific)

| Joint | z_threshold (m) | speed_threshold (m/s) | Rationale |
|---|---:|---:|---|
| `22/23` hands | `0.08` | `|vz| < 1.0` for plant confirmation | Dynamic palm pivot; SMPL hand center sits above actual palm patch |
| `10/11` feet | `0.05` WB, `0.08` touching | `< 0.25` WB | Large leg arcs pass near floor; strict threshold avoids false foot contacts mid-flare |
| `15` head | `0.10` | `< 0.25` | Should stay free; sustained contact indicates crash/transition, not clean flare |
| `16/17` shoulders | `0.08` | `< 0.35` | Failure detector; distinguishes flare collapse from windmill-like surface support |
| `18/19` elbows | `0.07` | `< 0.25` | Rare bailout support only; not primary in clean flare |
| `mean(3,6,9)` back | `0.12` | `< 0.40` | Should remain free; contact implies bailout/crash, not flare core |

Use `0.05 m` hysteresis between `22` and `23` at the switch so the active support label does not chatter when both hands are near the floor.

**Floor Plane**
- Expected `floor_z`: `~0.00 m`, ideally estimated from stable hand plants plus entry/exit foot plants, not from all-joint minima.
- Confidence: `medium-high` overall, dropping to `medium` during overhead-leg occlusion and explosive switches because SMPL hand joints do not coincide with the actual palm contact patch.

**Pseudo-Code**
```python
def classify_flare_contacts(joints, fps=30):
    vel = np.gradient(joints, axis=0) * fps
    floor_z = robust_floor_from_contacts(joints, vel, contact_joints=[10,11,22,23])

    hand_z = joints[:, [22,23], 2] - floor_z
    foot_z = joints[:, [10,11], 2] - floor_z
    hand_vz = vel[:, [22,23], 2]
    foot_speed = np.linalg.norm(vel[:, [10,11], :], axis=-1)

    feet_airborne = (foot_z[:,0] > 0.05) & (foot_z[:,1] > 0.05)
    lower_hand = np.where(hand_z[:,0] <= hand_z[:,1] + 0.05, 22, 23)

    state = {10: [], 11: [], 22: [], 23: []}
    for t in range(len(joints)):
        for j in [22, 23]:
            idx = 0 if j == 22 else 1
            if hand_z[t, idx] < 0.08 and abs(hand_vz[t, idx]) < 1.0:
                state[j].append("touching")
            else:
                state[j].append("free")

        for j in [10, 11]:
            idx = 0 if j == 10 else 1
            if foot_z[t, idx] < 0.05 and foot_speed[t, idx] < 0.25:
                state[j].append("weight_bearing")
            elif foot_z[t, idx] < 0.08:
                state[j].append("touching")
            else:
                state[j].append("free")

        if feet_airborne[t]:
            active = lower_hand[t]
            other = 23 if active == 22 else 22
            if state[active][t] == "touching":
                state[active][t] = "weight_bearing"
            # brief dual-support window
            if (state[other][t] == "touching" and
                abs(hand_z[t,0] - hand_z[t,1]) < 0.03):
                state[other][t] = "touching"

    return state
```

**Positive**: JOSH v4 + BSTRO should already give strong hand-vs-foot contact priors, which is exactly what this scenario needs. World-grounded output plus per-vertex hand contact is especially valuable because flare support is a palm patch, not a single SMPL point.

**Gap**: SMPL still gives only one `hand` joint, so it cannot distinguish palm heel vs fingertip load, nor exact wrist angle or contact patch size. In this scenario, large leg arcs and self-occlusion can also create false low foot passes and missed switch frames, so hand-switch hysteresis and foot-contact suppression are necessary.