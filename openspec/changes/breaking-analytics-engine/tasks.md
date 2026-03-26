# Breaking Analytics Engine — Tasks

## 1. Project Foundation
- [ ] 1.1 Create directory structure: `engine/`, `algebra/`, `graphs/`, `viz/` with `__init__.py`
- [ ] 1.2 Install dependencies: `pip install networkx rich` (numpy, scipy, matplotlib already available)
- [ ] 1.3 Create `bboy` CLI entry point script

## 2. DI Engine Core (Workstream 1)
- [ ] 2.1 Implement `AnalysisContext` dataclass in `engine/context.py`
- [ ] 2.2 Implement `Analyzer` Protocol and `AnalysisResult` in `engine/analyzers/base.py`
- [ ] 2.3 Implement mode registry with `@register_mode` decorator in `engine/registry.py`
- [ ] 2.4 Implement pipeline orchestrator with topological sort in `engine/pipeline.py`
- [ ] 2.5 Wrap `analyze_motion.py` as `MotionAnalyzer` in `engine/analyzers/motion.py`
- [ ] 2.6 Wrap `analyze_track.py` as `AudioAnalyzer` in `engine/analyzers/audio.py`
- [ ] 2.7 Wrap `match_beats.py` as `ScoringAnalyzer` in `engine/analyzers/scoring.py`
- [ ] 2.8 Implement `PhysicsAnalyzer` (rotation, momentum, energy) in `engine/analyzers/physics.py`
- [ ] 2.9 Implement `move_drill` mode in `engine/modes/move_drill.py`
- [ ] 2.10 Implement `battle_eval` mode in `engine/modes/battle_eval.py`
- [ ] 2.11 Implement `musicality` mode in `engine/modes/musicality.py`
- [ ] 2.12 Implement `pattern_hunt` mode in `engine/modes/pattern_hunt.py`
- [ ] 2.13 Implement CLI entry point in `engine/cli.py`
- [ ] 2.14 Unit tests for engine pipeline and mode switching

## 3. Move Algebra (Workstream 2)
- [ ] 3.1 Implement `MoveSignature` dataclass in `algebra/signature.py`
- [ ] 3.2 Implement pose hash via PCA reduction in `algebra/signature.py`
- [ ] 3.3 Implement spectral envelope via FFT in `algebra/signature.py`
- [ ] 3.4 Implement angular profile extraction in `algebra/signature.py`
- [ ] 3.5 Implement energy curve extraction in `algebra/signature.py`
- [ ] 3.6 Implement `move_distance()` similarity metrics in `algebra/similarity.py`
- [ ] 3.7 Implement DBSCAN and spectral clustering in `algebra/clustering.py`
- [ ] 3.8 Implement taxonomy mapping in `algebra/taxonomy.py`
- [ ] 3.9 Unit tests for signature extraction and similarity

## 4. 1990s Proving Ground (Workstream 2 — Priority)
- [ ] 4.1 Implement `detect_rotation_axis()` in `algebra/rotation.py`
- [ ] 4.2 Implement `validate_pivot()` in `algebra/rotation.py`
- [ ] 4.3 Implement `count_spins()` in `algebra/rotation.py`
- [ ] 4.4 Implement `compute_moment_of_inertia_profile()` in `algebra/rotation.py`
- [ ] 4.5 Implement `quantify_wobble()` in `algebra/rotation.py`
- [ ] 4.6 Implement `analyze_entry_exit()` in `algebra/rotation.py`
- [ ] 4.7 Implement `detect_leg_extension_events()` in `algebra/rotation.py`
- [ ] 4.8 Integrate rotation fields into MoveSignature
- [ ] 4.9 Validate against BREAKING_PHYSICS_MODEL.md equations
- [ ] 4.10 Test with BRACE power move segments

## 5. Graph Engine (Workstream 3)
- [ ] 5.1 Implement `build_transition_graph()` in `graphs/transition.py`
- [ ] 5.2 Implement `compute_style_signature()` in `graphs/style.py`
- [ ] 5.3 Implement `build_strategy_graph()` in `graphs/strategy.py`
- [ ] 5.4 Implement `build_battle_dag()` in `graphs/battle_flow.py`
- [ ] 5.5 Implement graph metrics module in `graphs/metrics.py`
- [ ] 5.6 Unit tests for graph construction and metrics

## 6. Viz Layer (Workstream 4)
- [ ] 6.1 Implement CLI quick-look display with `rich` in `viz/cli_display.py`
- [ ] 6.2 Implement matrix heatmap rendering in `viz/matrix_heatmaps.py`
- [ ] 6.3 Implement graph visualization in `viz/graph_plots.py`
- [ ] 6.4 Implement energy/momentum time series plots in `viz/energy_plots.py`
- [ ] 6.5 Implement pitch PDF export in `viz/pitch_export.py`
- [ ] 6.6 Implement JSON/CSV data export in `viz/cli_display.py`
- [ ] 6.7 Unit tests for visualization outputs

## 7. Integration & Hardening
- [ ] 7.1 Wire all 4 layers through DI engine end-to-end
- [ ] 7.2 Integration test: skeleton.npz → engine → signature → graph → viz
- [ ] 7.3 Integration test: battle data → battle_eval mode → pitch PDF
- [ ] 7.4 Performance benchmark: full pipeline < 60 seconds on CPU
- [ ] 7.5 Edge case hardening: empty data, single frame, missing audio

## 8. Validator Agent Setup
- [ ] 8.1 Write Physics Validator agent prompt with BREAKING_PHYSICS_MODEL.md context
- [ ] 8.2 Write DX Mentor agent prompt with API design principles
- [ ] 8.3 Write Architecture Reviewer agent prompt with DI patterns context
- [ ] 8.4 Write Breaking Culture Mentor agent prompt with hip-hop knowledge
- [ ] 8.5 Write Integration Smoke Tester agent prompt with end-to-end test plan
- [ ] 8.6 Run first validator review cycle on 1990s proving ground code
- [ ] 8.7 Address blocking issues from validator reviews

## 9. Event Readiness
- [ ] 9.1 Stress test all 4 analysis modes with varied inputs
- [ ] 9.2 Demo rehearsal: analyze a full battle end-to-end
- [ ] 9.3 Usage guide: how to set up for a live event
- [ ] 9.4 Final validator review cycle
