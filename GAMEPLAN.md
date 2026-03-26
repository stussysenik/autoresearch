# Breaking Analytics Engine — GAMEPLAN

> Target: Event-ready by April 26, 2026

## What We Built (Session 2026-03-26)

34 Python files, 6,937 LOC across 4 packages — a complete breaking analytics engine with dependency injection, mathematical move fingerprinting, graph theory, and visualization.

| Layer | Package | Files | LOC | Status |
|-------|---------|-------|-----|--------|
| DI Engine | `engine/` | 14 | ~2,400 | Tested, 4 modes working |
| Move Algebra | `algebra/` | 6 | ~2,100 | Tested, rotation physics validated |
| Graph Engine | `graphs/` | 6 | ~1,400 | Tested, Markov chains + style signatures |
| Visualization | `viz/` | 6 | ~1,000 | Tested, CLI + matplotlib + PDF |

Plus: 6 OpenSpec capability specs, 62 implementation tasks, 3 validator agent reviews (all passing).

---

## 3 Operational Modes

### Mode 1: Move Learning Day

> "I want to learn 1990s" / "study windmill mechanics" / "understand freeze patterns"

**Engine mode:** `move_drill`

**What you get:**
- Spin counting (how many rotations in that 1990?)
- Rotation physics (angular momentum L(t), moment of inertia I(t), ice skater effect)
- Move signature fingerprint (64-dim pose + 32-dim spectral + angular profile)
- Pattern completion — if we know the matrix signature of a windmill, we can count reps, detect technique degradation, compare against exemplars
- Quality metrics: smoothness (SPARC), complexity, symmetry, wobble

**How it works:**
```bash
# Analyze a single move from skeleton data
python engine/cli.py move_drill skeleton.npz --output table

# Deep physics analysis of a 1990s
python engine/cli.py move_drill 1990s_clip.npz --output json
```

**What makes this powerful:** Every move becomes a mathematical object. Two 1990s can be compared numerically. You can track skill progression across sessions. The matrix signature IS the move — if the signature matches, the move matches. Count windmills by counting signature repetitions in the time series.

---

### Mode 2: Battle Study Day

> "Analyze Red Bull BC One finals" / "Why did this bboy lose?" / "Study the dynamics"

**Engine modes:** `battle_eval` + `musicality`

**What you get:**
- TRIVIUM score breakdown: BODY (40%) / SOUL (35%) / MIND (25%)
- Transition graph per dancer — who has wider vocabulary?
- Style signature comparison — graph metrics reveal strategic differences
- Musicality timeline — who rode the beat, who missed opportunities
- Momentum arc — energy trajectory across rounds
- Counter-play analysis — what worked, what didn't

**How it works:**
```bash
# Full battle evaluation with audio
python engine/cli.py battle_eval battle_dir/ --audio track.wav --output pdf

# Musicality deep-dive
python engine/cli.py musicality dancer_clip.npz --audio track.wav --output table
```

**What makes this powerful:** Graph theory reveals what numbers hide. A dancer might score high on technique but their transition graph shows they always do the same 3-move combo — predictable. Style signatures let you compare dancers across different battles. The battle flow DAG shows momentum shifts that explain why someone "felt" like the winner.

---

### Mode 3: Event Inference (Replay Analysis)

> "Outbreak Europe big screen replay" / "Judge decision support" / "Television analysis"

**Engine mode:** `battle_eval` with pre-computed skeletons

**The honest picture:**

| Capability | Ready? | Speed | Cost |
|------------|--------|-------|------|
| Skeleton data → TRIVIUM score | Yes | < 60s CPU | Free |
| Score → Pitch PDF (big screen ready) | Yes | < 30s CPU | Free |
| Score → CLI instant display | Yes | < 5s CPU | Free |
| Video → Skeleton (offline batch) | Needs GPU | ~5min/round | L4 $2-5/hr |
| Video → Skeleton (real-time) | Not yet | Research phase | — |
| Big screen PDF replay | Yes | < 30s total | Free |
| Live judge support (pre-computed) | Partial | Works if skeletons pre-captured | — |

**The pitch:** Think VAR in football, not live tracking. During a battle, skeleton data is captured (either pre-processed or via GPU pipeline). Between rounds or after the battle, the engine produces a replay analysis — TRIVIUM breakdown, musicality timeline, style comparison — ready for a big screen in under 30 seconds.

**For Outbreak Europe / Red Bull BC One scale:**
1. Pre-event: batch-process all qualifying rounds on GPU (Lightning L4, ~$20 total)
2. During event: engine runs on any laptop, < 60s per analysis
3. Big screen: pitch PDF exports at presentation resolution
4. Commentary: CLI gives instant talking points for commentators

---

## Technology Stack

```
Video Input (future: SAM3 → CoTracker3 → GVHMR)
       ↓
Skeleton Data [T, 24, 3] (SMPL joints)
       ↓
┌──────────────────────────────────────────┐
│          engine/ — DI Pipeline           │
│  ┌─────────┐ ┌─────────┐ ┌───────────┐  │
│  │ Motion  │ │  Audio  │ │ Physics   │  │
│  │Analyzer │ │Analyzer │ │ Analyzer  │  │
│  └────┬────┘ └────┬────┘ └─────┬─────┘  │
│       └─────┬─────┘            │         │
│        ┌────┴─────┐            │         │
│        │ Scoring  │            │         │
│        │Analyzer  │            │         │
│        └──────────┘            │         │
└──────────────────────────────────────────┘
       ↓                         ↓
┌──────────────┐        ┌──────────────┐
│  algebra/    │        │   graphs/    │
│ MoveSignature│        │ Transition   │
│ Similarity   │        │ Style        │
│ Rotation     │        │ Strategy     │
│ Clustering   │        │ Battle DAG   │
└──────┬───────┘        └──────┬───────┘
       └──────────┬────────────┘
                  ↓
          ┌──────────────┐
          │    viz/       │
          │ CLI display   │
          │ Heatmaps      │
          │ Graph plots   │
          │ Pitch PDF     │
          └──────────────┘
```

All CPU-only. Pure Python + NumPy + SciPy + NetworkX + Matplotlib + Rich.

---

## Timeline (Inverse Law)

### Week 1: Mar 27 – Apr 2 — 1990s PROVING GROUND
- [ ] Feed real BRACE power move data into rotation analysis
- [ ] Validate spin counts against visual ground truth
- [ ] Validate I(t) profiles show ice skater effect
- [ ] First move signatures that discriminate power move types
- [ ] Validator agent review cycle #2

### Week 2: Apr 3 – Apr 9 — ENGINE + ALGEBRA MVP
- [ ] CLI hardened with real data paths
- [ ] Signature extraction for all 5 move types (toprock/footwork/power/freeze/transition)
- [ ] Similarity metrics validated: same-type < cross-type distance
- [ ] Pattern counting: detect repeated windmills in a sequence

### Week 3: Apr 10 – Apr 16 — GRAPHS + BATTLE PIPELINE
- [ ] Transition graph from BRACE dataset (1352 segments, 64 dancers)
- [ ] Style signature per dancer — who is power-heavy vs footwork-heavy?
- [ ] Battle flow DAG for a real battle
- [ ] End-to-end: skeleton.npz → battle analysis → comparison table

### Week 4: Apr 17 – Apr 23 — VIZ + PITCH + EVENT PREP
- [ ] Pitch PDF with dark theme, multi-panel layout
- [ ] CLI quick-look for commentator talking points
- [ ] Graph visualization of transition networks (force-directed)
- [ ] Full demo: analyze a real BC One battle, produce big-screen PDF

### Week 5: Apr 24 – Apr 26 — EVENT HARDENING
- [ ] Stress test all 3 modes with varied inputs
- [ ] Demo rehearsal with timing constraints
- [ ] Edge case hardening (missing data, short clips, no audio)
- [ ] Documentation: event setup guide

---

## OpenSpec Reference

Full specs at `openspec/changes/breaking-analytics-engine/`:
- `proposal.md` — Why and what
- `design.md` — 5 key design decisions with rationale
- `specs/di-engine-core/` — Engine requirements
- `specs/move-algebra/` — Signature and similarity specs
- `specs/graph-engine/` — Graph theory specs
- `specs/viz-layer/` — Visualization specs
- `specs/nineteen-nineties-proving-ground/` — 1990s rotation physics specs
- `specs/validator-mentor-agents/` — Quality gate agent specs
