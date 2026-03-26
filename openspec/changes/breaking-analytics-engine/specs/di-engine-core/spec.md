# DI Engine Core

## ADDED Requirements

### Requirement: AnalysisContext as injectable container

The engine provides an `AnalysisContext` dataclass that holds the current analysis state: input data (skeleton, audio), configuration (mode, parameters), and results accumulator. All analyzers receive the context rather than raw arguments.

#### Scenario: Create context for move drill
- **WHEN** a user calls `AnalysisContext(mode="move_drill", data=skeleton_data)`
- **THEN** the context is created with the skeleton data loaded and mode set, audio marked as optional

#### Scenario: Create context for battle evaluation
- **WHEN** a user calls `AnalysisContext(mode="battle_eval", data=[skeleton_a, skeleton_b], audio=track)`
- **THEN** the context holds both dancers' data and the shared audio track

### Requirement: Mode registry with analyzer declarations

Each analysis mode declares which analyzers it requires via a registry. The registry maps mode names to analyzer configurations (which analyzers to run, in what order, with what parameters).

#### Scenario: Register a new mode
- **WHEN** a developer decorates a mode class with `@register_mode("custom_analysis")`
- **THEN** the mode is available via `engine.analyze(ctx)` when `ctx.mode == "custom_analysis"`

#### Scenario: Mode declares analyzer dependencies
- **WHEN** the `move_drill` mode declares `requires = [MotionAnalyzer, PhysicsAnalyzer]`
- **THEN** the pipeline instantiates and runs only those analyzers, skipping AudioAnalyzer and ScoringAnalyzer

### Requirement: Pipeline orchestrator with dependency resolution

The pipeline reads the mode's required analyzers, resolves their dependencies (e.g., ScoringAnalyzer depends on MotionAnalyzer output), and runs them in topological order.

#### Scenario: Analyzers with dependencies
- **WHEN** `ScoringAnalyzer` declares `depends_on = [MotionAnalyzer, AudioAnalyzer]`
- **THEN** the pipeline runs MotionAnalyzer and AudioAnalyzer first, then passes their results to ScoringAnalyzer

#### Scenario: Missing dependency
- **WHEN** a mode requires `ScoringAnalyzer` but omits `AudioAnalyzer` from its requirements
- **THEN** the pipeline raises `MissingDependencyError` with a clear message naming the missing analyzer

### Requirement: Analyzer protocol (pluggable interface)

Analyzers implement a `Protocol` with `analyze(ctx: AnalysisContext) -> AnalysisResult`. New analyzers can be added without modifying the engine core.

#### Scenario: Wrap existing analyze_motion.py
- **WHEN** `MotionAnalyzer.analyze(ctx)` is called with skeleton data in the context
- **THEN** it delegates to the existing `extract_features()` function and returns a structured `MotionResult` with 9D features

### Requirement: CLI entry point

A CLI command `bboy analyze <mode> <input_path> [--audio <audio_path>] [--output <format>]` that creates the context, runs the pipeline, and outputs results.

#### Scenario: Analyze a move from CLI
- **WHEN** user runs `bboy analyze move-drill skeleton.npz --output json`
- **THEN** the engine loads the skeleton, runs move_drill mode analyzers, and prints JSON results to stdout

#### Scenario: Analyze a battle from CLI
- **WHEN** user runs `bboy analyze battle-eval battle/ --audio track.wav --output pdf`
- **THEN** the engine loads both dancers' skeletons from the directory, runs battle_eval mode, and exports a pitch-ready PDF

### Requirement: Four built-in analysis modes

The engine ships with four modes: `move_drill` (single move deep analysis), `battle_eval` (head-to-head comparison), `musicality` (audio-motion sync focus), and `pattern_hunt` (cross-session pattern discovery).

#### Scenario: Move drill mode
- **WHEN** mode is `move_drill` with a single skeleton input
- **THEN** the engine runs MotionAnalyzer + PhysicsAnalyzer and produces per-move technique breakdown, difficulty estimate, and quality scores

#### Scenario: Musicality mode
- **WHEN** mode is `musicality` with skeleton + audio input
- **THEN** the engine runs MotionAnalyzer + AudioAnalyzer + ScoringAnalyzer with musicality-weighted parameters and produces beat-sync analysis, anticipation score, and phrasing quality
