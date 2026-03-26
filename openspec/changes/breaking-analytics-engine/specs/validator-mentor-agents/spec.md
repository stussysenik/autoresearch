# Validator + Mentor Agents

## ADDED Requirements

### Requirement: Physics Validator agent

A review agent with deep knowledge of biomechanics, dynamics, and the BREAKING_PHYSICS_MODEL.md equations. Reviews rotation code, energy calculations, and conservation law implementations.

#### Scenario: Review rotation analysis code
- **WHEN** the Physics Validator reviews `algebra/rotation.py`
- **THEN** it checks: units consistency (rad/s, kg*m^2, N*m), L conservation within tolerance, moment of inertia formula correctness, edge cases (zero velocity, singular axis), and numerical stability

#### Scenario: Structured PASS/FAIL output
- **WHEN** the Physics Validator completes a review
- **THEN** it produces a report with per-criterion PASS/FAIL, confidence level (high/medium/low), evidence (specific line numbers and values), and recommendations for failures

### Requirement: DX Mentor agent

A review agent focused on developer experience: API ergonomics, CLI usability, error messages, documentation quality. Tests whether a new developer can use the system in 5 minutes.

#### Scenario: Review CLI interface
- **WHEN** the DX Mentor reviews `engine/cli.py`
- **THEN** it checks: help text completeness, error messages clarity, argument validation, reasonable defaults, output format consistency, and "5-minute onboarding" test (can someone read --help and use it correctly?)

### Requirement: Architecture Reviewer agent

A review agent evaluating module boundaries, dependency injection patterns, testability, and extensibility. Thinks like a principal engineer.

#### Scenario: Review engine architecture
- **WHEN** the Architecture Reviewer reviews the `engine/` package
- **THEN** it checks: clean separation of concerns, no circular dependencies, Protocol classes used correctly, analyzers are independently testable, new modes can be added without modifying core, and dependency graph is shallow

### Requirement: Breaking Culture Mentor agent

A review agent with knowledge of hip-hop culture, breaking history, and community terminology. Ensures the system respects the culture and uses accurate terminology.

#### Scenario: Review taxonomy and scoring
- **WHEN** the Breaking Culture Mentor reviews move taxonomy and TRIVIUM scoring
- **THEN** it checks: move names match community usage, scoring dimensions reflect what real judges evaluate, no cultural appropriation in terminology, and the system amplifies (not replaces) human judgment

### Requirement: Integration Smoke Tester agent

A review agent that runs the full pipeline end-to-end: skeleton → engine → signature → graph → visualization. Verifies the chain works without errors.

#### Scenario: End-to-end smoke test
- **WHEN** the Integration Smoke Tester runs with a sample skeleton .npz file
- **THEN** it executes `bboy analyze move-drill <input>` and verifies: no exceptions, output is valid JSON/table, all expected fields are present, and execution completes in < 60 seconds

### Requirement: Review gate at milestones

After each workstream milestone (weekly), all 5 validator agents are dispatched in parallel. Blocking issues (high-confidence FAIL) must be resolved before proceeding. Non-blocking suggestions are tracked for the polish phase.

#### Scenario: Milestone review cycle
- **WHEN** workstream 2 (Move Algebra) reaches its Week 1 milestone (1990s signature working)
- **THEN** all 5 validators are dispatched, each produces a structured report, blocking issues are aggregated, and the developer receives a unified review summary
