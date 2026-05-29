## ADDED Requirements

### Requirement: Benchmark-Driven Verification
The system SHALL verify progress through a benchmark corpus instead of ad hoc demos alone.

#### Scenario: Measure benchmark progress
- WHEN a benchmark app is compiled and executed
- THEN the harness records correctness, edit survival, migration safety, permission fidelity, and artifact complexity metrics

### Requirement: Change Replay
The system SHALL replay sequential product changes against a generated application.

#### Scenario: Ten-step product evolution
- WHEN the benchmark replays ten scripted edits
- THEN the system recompiles and verifies each revision without losing previously established semantics

### Requirement: Harvest Loop
The harness SHALL feed failures and human corrections back into the research loop.

#### Scenario: Failed permission check
- WHEN proof detects a permission regression
- THEN the failure is stored as benchmark evidence
- AND the system can reuse that evidence during later research and compilation attempts
