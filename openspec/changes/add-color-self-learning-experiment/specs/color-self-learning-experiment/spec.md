## ADDED Requirements

### Requirement: Timed Self-Learning Loop
The system SHALL support a bounded self-learning experiment that iteratively proposes, evaluates, and accepts color-science train configurations until an explicit deadline.

#### Scenario: Timed loop runs until deadline
- **WHEN** a timed self-learning run is launched with a deadline
- **THEN** the system SHALL continue proposing candidate configurations until that deadline is reached or a configured iteration cap is exceeded
- **AND** the run SHALL record iteration-level progress in a durable log

### Requirement: Layered Optimization Boundary
The system SHALL keep the benchmark evaluator fixed while allowing the train configuration to evolve through structured state.

#### Scenario: Candidate config changes without evaluator drift
- **WHEN** the self-learning loop proposes a new learning rate, loss weight, or sensor basis
- **THEN** the system SHALL encode that proposal in structured configuration
- **AND** the evaluator and scoring formulas SHALL remain unchanged during the run

### Requirement: Keep/Discard Integration
The self-learning loop SHALL reuse the canonical acceptance runner.

#### Scenario: Candidate is rejected
- **WHEN** a proposed configuration does not improve the benchmark score or crashes
- **THEN** the system SHALL restore the last accepted train/config state
- **AND** the next proposal SHALL start from the restored accepted baseline

#### Scenario: Candidate is accepted
- **WHEN** a proposed configuration improves the benchmark score
- **THEN** the runner SHALL preserve both `train.py` and the structured config for that accepted state

### Requirement: Statistical Reporting
The system SHALL expose the optimization statistics that define how the surrogate was fit.

#### Scenario: Fit statistics are printed
- **WHEN** the benchmark train entrypoint runs
- **THEN** it SHALL report the learning rate, optimization step count, explicit loss definition, and fit loss summary
- **AND** those statistics SHALL be inspectable alongside the benchmark metrics
