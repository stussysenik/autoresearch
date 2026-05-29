## ADDED Requirements

### Requirement: Replayable Verification
The system SHALL verify generated applications using replayable benchmark fixtures and change requests.

#### Scenario: Application generation is verified end-to-end
- **WHEN** the compiler emits a candidate application
- **THEN** the harness SHALL run compile checks, runtime checks, policy checks, and browser/task-flow checks before the candidate is accepted

#### Scenario: Regression replay after model change
- **WHEN** a new model revision is proposed
- **THEN** the harness SHALL replay prior benchmark prompts and accepted change requests
- **AND** regressions SHALL be reported against the last accepted baseline

### Requirement: Corrections Become Training Signal
The harness SHALL persist human corrections and runtime failures as reusable artifacts.

#### Scenario: Human fix is harvested
- **WHEN** a human modifies a generated workflow, field, or policy after verification failure
- **THEN** the correction SHALL be stored with provenance
- **AND** future synthesis runs SHALL be able to reference the correction artifact
