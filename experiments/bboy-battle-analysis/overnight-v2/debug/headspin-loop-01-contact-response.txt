### CONTACT SIGNATURE: headspin-loop-01

**Contact Pattern**: `FIXED`  
**Primary Contact Joints**: `15=head` with crown correction (`j15 + [0, 0, -0.06]`); transient `22,23=hands`; optional `10,11=feet` only at approach/landing  
**Contact Sequence**: Canonical full sequence is `[feet] -> [head + hands] -> [head] x N -> [head + hand/feet] -> [feet or next phase]`. The move-identifying fingerprint is the steady loop: persistent single-point head contact with no migrating back/shoulder support.

**Weight-Bearing Timeline****:**
`[entry-approach, optional]` → feet `10,11` weight-bearing; head/hands free  
`[head-plant, ~9-18f @30fps]` → head `15` touching then weight-bearing; one/both hands `22,23` touching or brief weight-bearing; feet unloading  
`[headspin-loop, ~30-600+f]` → head `15` weight-bearing continuously; hands `22,23` mostly free, with only brief touching taps allowed; feet `10,11`, knees `4,5`, shoulders `16,17`, back `mean(3,6,9)` free  
`[exit-dismount, ~9-20f]` → head `15` weight-bearing then touching as hands or feet re-enter support  
`[clip starts mid-loop]` → visible window should read as head `15` weight-bearing throughout; missing entry is not a contact error

**Contact Signature Fingerprint**:

| Time Segment | Contact Joints | Classification | Move ID |
|-------------|---------------|---------------|---------|
| Entry approach | `10,11` | `weight_bearing` | setup into headspin |
| Head plant | `15`, `22,23` | `15=touching->weight_bearing`, `22,23=touching/brief weight_bearing` | headspin entry |
| Steady loop | `15` | `weight_bearing` | HEADSPIN |
| Wobble frames | `15`, optional `22` or `23` | `15=weight_bearing`, hand=`touching` | assisted correction, not new move |
| Exit catch | `15` + `22,23` or `10,11` | `15=touching/weight_bearing`, catch joint=`weight_bearing` | headspin exit |

**Support Polygon Analysis**:
- Shape: `point` during the loop; briefly `line` or small `triangle` during plant/exit if hands join.
- Stability: `gyroscopic` in the loop, not statically stable.
- CoM position relative to polygon: `outside` in a strict static test for many frames; acceptable because angular momentum, not polygon area, stabilizes the move.

**Detection Thresholds** (scenario-specific):

| Joint | z_threshold (m) | speed_threshold (m/s) | Rationale |
|-------|----------------|----------------------|-----------|
| `15 head` using corrected crown | `0.03` | `0.20` | Real support is crown contact, not raw head-center joint. |
| `22,23 hands` | `0.06` | `0.20` | Allow brief stabilizing taps despite blur; sustained contact means assisted headspin or exit. |
| `10,11 feet` | `0.05` | `0.15` | Relevant only for approach/landing, not steady loop. |
| `16,17 shoulders` | `0.08` | `0.25` | Detect collapse into halo/windmill-like support; should stay free in clean loop. |
| `mean(3,6,9) back` | `0.10` | `0.25` | Back contact indicates degradation toward backspin, not headspin. |
| `4,5 knees` | `0.08` | `0.20` | Catch knee drops or failed exit; should remain free in clean loop. |

**Floor Plane**:
- Expected `floor_z`: `0.00m` for JOSH world-grounded output; in practice use `median(corrected_head_crown_z)` on confident loop frames, expected within about `±0.02m`.
- Confidence: `medium-high` if crown correction is applied; `medium/low` if using raw `j15` or if inversion reconstruction is suspect.

**Pseudo-Code**:
```python
import numpy as np

HEAD_CROWN_OFFSET = 0.06

def detect_headspin_contact(joints_3d, fps=30):
    dt = 1.0 / fps
    vel = np.gradient(joints_3d, dt, axis=0)
    speed = np.linalg.norm(vel, axis=-1)

    head_crown = joints_3d[:, 15].copy()
    head_crown[:, 2] -= HEAD_CROWN_OFFSET
    head_crown_vel = np.gradient(head_crown, dt, axis=0)
    head_crown_speed = np.linalg.norm(head_crown_vel, axis=-1)

    inverted = joints_3d[:, 15, 2] < joints_3d[:, 0, 2]

    # Use the persistent crown anchor, not global min-z, for this scenario.
    floor_z = np.median(head_crown[inverted, 2]) if np.any(inverted) else np.percentile(joints_3d[..., 2], 5)

    head_touch = (head_crown[:, 2] - floor_z < 0.03) & (head_crown_speed < 0.20) & inverted
    hand_touch = ((joints_3d[:, [22,23], 2] - floor_z) < 0.06) & (speed[:, [22,23]] < 0.20)

    # Static CoM-in-polygon fails for a 1-point spinning support.
    # For headspin, treat persistent low-drift inverted crown contact as weight-bearing.
    pivot_drift = np.linalg.norm(head_crown[:, :2] - head_crown[:, :2].mean(axis=0), axis=1)
    head_wb = head_touch & (pivot_drift < 0.04)

    # Hands are usually touching only; call them weight-bearing only in plant/exit windows
    # or when head support is not yet established.
    hand_wb = hand_touch & (~head_wb[:, None])

    shoulder_back_fail = (
        (joints_3d[:, [16,17], 2] - floor_z < 0.08).any(axis=1) |
        (joints_3d[:, [3,6,9], 2].mean(axis=1) - floor_z < 0.10)
    )

    move_id = "HEADSPIN" if head_wb.mean() > 0.7 and shoulder_back_fail.mean() < 0.1 else "assisted_or_invalid"

    return {
        "floor_z": float(floor_z),
        "head_weight_bearing": head_wb,
        "hand_touch": hand_touch,
        "hand_weight_bearing": hand_wb,
        "shoulder_back_failure": shoulder_back_fail,
        "move_id": move_id,
    }
```

**Positive**: JOSH v4 BSTRO should give a tight crown-contact patch, better palm-vs-noncontact evidence on brief hand taps, and better rejection of false back/shoulder contact than joint-only SMPL.

**Gap**: SMPL still gives only one head point and one hand point per side, so it cannot directly separate crown vs temple, palm vs fingertips, or true load-sharing vs a light brush. GVHMR-style inversion failures can also hallucinate floor hits or place the head below the floor, so contact detection needs crown correction, temporal hysteresis, and reconstruction-confidence gating.