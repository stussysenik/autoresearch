# Part VII: Competition & Event Readiness

> *"Ship the v1. Iterate in the cypher."*

---

## 7.0 Target Events

| Event | Date | Format | Our Readiness |
|-------|------|--------|---------------|
| Red Bull BC One | Annual | 1v1, judged | Post-hoc analysis ready |
| Outbreak Europe | Annual | 1v1 + crew | Post-hoc analysis ready |
| WDSF Breaking (Olympic qualifier) | Cycle | Standardized | Musicality scoring ready |
| Brisbane local events | Ongoing | Community | iPhone capture ready |
| Practice sessions | Any | Self-study | Full pipeline ready |

---

## 7.1 Three Operational Modes

### Mode 1: Move Learning Day

> *"I want to learn 1990s"* / *"study windmill mechanics"*

**Input**: Skeleton data from any source (iPhone → cloud GPU, or pre-captured)
**Output**: Rotation physics, move signature, quality metrics, comparison to exemplars

| Metric | What it tells the dancer |
|--------|------------------------|
| Spin count | How many rotations in that 1990? |
| $I(t)$ profile | Are you tucking efficiently? (ice skater effect) |
| 96-dim signature | How does your windmill compare to the exemplar? |
| SPARC smoothness | Is your rotation clean or wobbly? |
| Wobble index | Where in the rotation do you lose stability? |

### Mode 2: Battle Study Day

> *"Analyze Red Bull BC One finals"* / *"Why did this bboy lose?"*

**Input**: Battle footage + audio
**Output**: TRIVIUM breakdown, transition graphs, musicality timelines, counter-play analysis

```
Dancer A          vs          Dancer B
─────────────────────────────────────────
Body:  0.72                   Body:  0.81
Soul:  0.68                   Soul:  0.41
Mind:  0.55                   Mind:  0.63
─────────────────────────────────────────
μ = 0.538                     μ = 0.276
Vocabulary: 12 moves          Vocabulary: 8 moves
Coverage: 2.1 m²              Coverage: 1.4 m²

Verdict: A wins on Soul (musicality), B wins on Body (power).
         Judge's call depends on weighting.
```

### Mode 3: Event Inference (Replay Analysis)

> *"Outbreak Europe big screen replay"* / *"VAR for breaking"*

**The honest picture**:

| Capability | Ready? | Speed | Cost |
|------------|--------|-------|------|
| Skeleton → TRIVIUM score | Yes | < 60s CPU | Free |
| Score → Pitch PDF (big screen) | Yes | < 30s CPU | Free |
| Score → CLI display | Yes | < 5s CPU | Free |
| Video → Skeleton (offline) | Needs GPU | ~5min/round | L4 $2-5/hr |
| Video → Skeleton (real-time) | Not yet | Research | — |
| Big screen PDF replay | Yes | < 30s total | Free |

**The pitch**: Think VAR in football, not live tracking. Between rounds or after the battle, the engine produces a replay analysis — TRIVIUM breakdown, musicality timeline, style comparison — ready for a big screen in under 30 seconds.

**For Red Bull BC One scale**:
1. Pre-event: batch-process qualifying rounds on GPU (~$20 total)
2. During event: engine runs on any laptop, < 60s per analysis
3. Big screen: pitch PDF at presentation resolution
4. Commentary: CLI gives instant talking points

---

## 7.2 Brisbane Local Events — Community First

The first deployment target is not Red Bull. It's the local cypher.

### Setup for a local event:

```
Equipment needed:
├── iPhone on tripod (already owned)
├── Laptop (any, for scoring)
└── Optional: portable monitor ($200)

Workflow:
├── Record each round on iPhone (120fps)
├── Between rounds: upload to cloud GPU ($0.50/round)
├── Download joints_3d.npy (~5MB)
├── Run scoring locally (< 60s)
└── Display TRIVIUM breakdown on laptop/monitor

Total cost per event: $2-10 (cloud GPU only)
Total setup time: 5 minutes
```

### What the community gets at a local event:

- **Dancers**: Post-battle analysis showing their $\mu$, coverage, vocabulary
- **Crowd**: Real-time understanding of what just happened (via big screen)
- **Organizers**: Objective data for discussion (not replacing judges)
- **New dancers**: Visual feedback on what "musicality" actually means

---

## 7.3 Preparation Timeline

| Week | Target | Deliverable |
|------|--------|-------------|
| 1 | Rotation physics on real data | Spin counts validated against visual ground truth |
| 2 | Engine + algebra MVP | Signatures for all 5 move types |
| 3 | Graphs + battle pipeline | Transition graphs from BRACE dataset |
| 4 | Viz + pitch + event prep | Big-screen PDF, commentator talking points |
| 5 | Event hardening | Stress test, edge cases, setup guide |

---

## 7.4 Red Bull BC One — Specific Preparation

### Data Available

BRACE dataset provides:
- 1,352 annotated segments
- 64 professional dancers
- Beat annotations with confidence scores
- Shot boundaries and dancer identification
- 2D keypoints (manual + interpolated)

### Analysis Plan for BC One

1. **Batch process** all available BC One footage through GVHMR/JOSH
2. **Extract** TRIVIUM scores for every round of every battle
3. **Build** transition graphs for every dancer
4. **Compute** style signatures — who is power-heavy, who is musicality-heavy
5. **Map** the knowledge pool with BC One vocabulary
6. **Generate** comparison reports: "What differentiates winners from finalists?"

### Commentary Support

For each round, the CLI produces:

```
═══ ROUND ANALYSIS ═══
Dancer: lil g
μ = 0.380 (STRONG musicality)
τ* = 200ms (reactive, late in window)
Coverage: 0.46 m² (moderate)
Vocabulary: 9 distinct moves
Best segment: toprock (μ = 0.52)
Weakest segment: powermove (μ = 0.09)
Flow: 0.3 (some jarring transitions)

Talking points:
- Strong beat follower, especially in toprock
- Power moves not synchronized to music (expected)
- Could improve stage coverage
- Vocabulary diverse but predictable sequence
═══════════════════════
```

---

## 7.5 Low Condition Capture — The Real World

Most breaking footage is terrible. Phone in a friend's hand, bad lighting, cropped weirdly, compressed to hell. The pipeline must degrade gracefully.

### Graceful Degradation

| Condition | Impact | Mitigation |
|-----------|--------|-----------|
| Low resolution (< 480p) | 2D pose degraded | Sapiens still works at 256×192 |
| Camera shake | GVHMR W-MPJPE increases | Tripod eliminates; ask for stabilized |
| Motion blur (slow shutter) | Tracking failures | Request 1/250s shutter if possible |
| Bad lighting | Segmentation errors | SAM 3 handles most conditions |
| Multi-person occlusion | Track swaps | CoTracker3 with explicit re-init |
| Cropped/clipped | Missing joints | Score what's visible, flag incomplete |
| Vertical video | Reduced horizontal coverage | Rotate, score with available data |
| Compressed (TikTok quality) | Artifact noise in reconstruction | Accept degraded, don't crash |

### Minimum Viable Input

For any analysis to produce meaningful results:
- At least 10 seconds of continuous footage
- Dancer visible from approximately waist-up minimum
- Some music audible (for beat detection)
- Frame rate $\geq 24$ fps

Below these thresholds, the system returns "insufficient data" rather than garbage scores.

---

## 7.6 GoPro and Drone Capture

### GoPro (Floor Level)

```
GoPro Hero 12+ on small tripod at floor level
├── 1080p @ 120fps (Linear mode, no fisheye)
├── Wide enough for full cypher at 3m distance
├── Rugged, waterproof, no external power needed
├── $300-400
└── Limitation: no manual exposure control in some modes
```

**Best for**: Practice recording, outdoor cyphers, events where you can't set up a proper rig

### Drone (Elevated Angle)

```
DJI Mini 4 Pro (or similar)
├── Hovering at 3-5m height, angled down 30°
├── 1080p @ 60fps (120fps crops)
├── Stabilized gimbal = no camera shake
├── Captures full cypher + spatial coverage
└── $500-800
```

**Best for**: Outdoor events, showcase footage, coverage analysis
**Limitation**: 60fps (not ideal for fast footwork), wind noise on audio, FAA regulations indoors

### Recommended for Events

| Scenario | Capture | Why |
|----------|---------|-----|
| Indoor competition | GH5 on tripod | Best quality, controlled |
| Outdoor cypher | GoPro on floor | Rugged, wide angle |
| Practice session | iPhone on tripod | Already in pocket |
| Drone coverage | DJI Mini elevated | Spatial analysis + dramatic footage |
| Multi-angle study | 2-3× iPhone array | Triangulation, better occlusion handling |

---

*Next: [Appendix A — Capture Recipes](08-APPENDIX-CAPTURE.md)*
