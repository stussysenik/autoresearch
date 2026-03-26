# Breaking Analytics Engine — Design

## Context

The autoresearch project has three mature analysis scripts:
- `analyze_motion.py` (859 LOC) — 9D motion feature extraction from SMPL skeleton
- `match_beats.py` (889 LOC) — TRIVIUM scoring (40% BODY, 35% SOUL, 25% MIND)
- `analyze_track.py` (548 LOC) — 8D psychoacoustic audio analysis with 3 weight profiles

These work but are disconnected. The physics research (`BREAKING_PHYSICS_MODEL.md`, `BREAKING_KINETIC_CHAIN.md`) formalizes rotation, momentum, and energy but isn't yet implemented as computable code. Move relationships (transitions, counters, style) live in documentation, not data structures.

The user needs a unified system that:
1. Switches analysis modes via dependency injection (not code changes)
2. Represents moves as mathematical objects for comparison and pattern discovery
3. Makes move relationships explicit and queryable via graph theory
4. Produces event-ready visualizations from the CLI

## Goals

- Unified engine with 4 injectable analysis modes
- MoveSignature as the universal move representation
- Graph-based move relationship model
- CLI-first visualization with pitch-ready PDF export
- CPU-only — no GPU dependencies
- Event-ready by April 26, 2026

## Non-Goals

- Real-time video processing (GPU pipeline)
- Web-based UI (browser visualization)
- Training ML models (inference only)
- Rewriting existing analyzers (wrap them)

## Decisions

### D1: Dependency Injection via Protocol + Registry (not framework)

**Chosen**: Python Protocol classes + a simple registry dict. Modes declare which analyzers they need, the pipeline resolves and runs them.

**Why not a DI framework** (like `dependency-injector`): Our dependency graph is shallow (modes → analyzers → data). A framework adds complexity without value. Protocol classes give us type safety without inheritance hierarchies.

**Why not just function arguments**: We need the same analyzer to be configured differently per mode (e.g., motion analyzer in musicality mode emphasizes beat-sync features vs. move-drill mode emphasizing technique features).

### D2: MoveSignature as dataclass (not embedding vector)

**Chosen**: Structured `@dataclass` with named fields (pose_hash, spectral_envelope, angular_profile, etc.) rather than a single dense embedding vector.

**Why**: Interpretability. A 128-dim embedding is a black box. Named fields let the physics validator check individual components, let the viz layer render specific aspects, and let humans understand what makes two moves similar or different.

**Trade-off**: Similarity computation is slower than cosine similarity on embeddings. Acceptable at our scale (hundreds of moves, not millions).

### D3: NetworkX for graphs (not Neo4j or custom)

**Chosen**: NetworkX — pure Python, CPU-only, rich algorithm library.

**Why not Neo4j**: Overkill for our dataset size (64 dancers, ~500 unique moves). Adds infrastructure dependency. We need graph algorithms (centrality, clustering, path analysis), not a query language.

**Why not custom**: NetworkX gives us Markov chain analysis, spectral clustering, community detection, and export to GraphML/DOT/JSON for free.

### D4: Wrap existing analyzers (not rewrite)

**Chosen**: Thin adapter classes that import and call existing functions from `analyze_motion.py`, `match_beats.py`, `analyze_track.py`.

**Why**: These scripts are validated (9/9 overnight loop). Rewriting introduces bugs. The adapter pattern lets us add the DI interface without touching working code.

### D5: CLI-first visualization with matplotlib backend

**Chosen**: `rich` library for terminal tables/sparklines + `matplotlib` for publication-quality plots + PDF export.

**Why not browser**: Lightning.ai environment doesn't reliably expose ports. CLI is universal. Matplotlib PDFs are pitch-ready without a design tool.

## Risks / Trade-offs

| Risk | Severity | Mitigation |
|------|----------|------------|
| MoveSignature may not distinguish similar moves | Medium | Start with 1990s (maximally distinct), validate discrimination before expanding |
| Graph sparsity with small dataset | Low | BRACE has 1352 segments — enough for transition statistics. Smooth with Laplace prior |
| Existing analyzer APIs may not wrap cleanly | Medium | Adapter pattern is flexible; worst case, copy specific functions |
| CPU-only limits analysis speed | Low | Target is < 60s per battle; current scripts run in seconds |
| Validator agents may be noisy | Low | Structured PASS/FAIL with confidence; only block on high-confidence failures |
