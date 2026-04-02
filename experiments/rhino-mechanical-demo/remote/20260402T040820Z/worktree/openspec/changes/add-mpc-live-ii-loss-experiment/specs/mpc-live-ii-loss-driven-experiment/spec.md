## ADDED Requirements

### Requirement: Repo-local MPC Live II experiment objective
The system SHALL define the canonical MPC Live II experiment objective inside `rhino-nlcli` and SHALL load that objective when evaluating unattended experiment rounds.

#### Scenario: Evaluate using the repo-local objective
- **WHEN** the overnight MPC Live II experiment evaluates a candidate
- **THEN** the evaluator SHALL load the canonical objective from `research/mpc-live-ii/objective.json`
- **THEN** the evaluator SHALL use the objective-defined binary metric order, ordered layer names, and geometry tolerances
- **THEN** the evaluator SHALL persist the objective name with the recorded evaluation result

### Requirement: Numerical loss-based candidate selection
The system SHALL minimize a numerical loss that is dominated by binary pass fraction and secondarily shaped by live-build quality.

#### Scenario: Prefer the lower-loss candidate
- **WHEN** two candidate evaluations are compared for keep versus discard
- **THEN** the system SHALL compute loss from binary pass fraction and secondary score using the configured secondary weight
- **THEN** the system SHALL keep the candidate with the lower loss
- **THEN** the system SHALL only use the secondary score as a tie-break when the computed loss is equal

### Requirement: Bounded unattended experiment execution
The system SHALL stop an unattended MPC Live II experiment when the configured deadline has passed or when Rhino emits fresh crash evidence after the run is initialized.

#### Scenario: Stop on deadline
- **WHEN** the configured experiment stop time has been reached between rounds
- **THEN** the overnight loop SHALL stop before launching another round
- **THEN** the current best snapshot SHALL remain available in `rhino-nlcli`

#### Scenario: Stop on fresh Rhino crash evidence
- **WHEN** a Rhino error-reporting process is active or a newer Rhino crash report appears after the experiment baseline has been seeded
- **THEN** the overnight loop SHALL stop instead of starting another evaluation round
- **THEN** the stop reason SHALL be recorded in the experiment outputs
