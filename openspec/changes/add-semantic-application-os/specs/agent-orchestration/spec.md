## ADDED Requirements

### Requirement: Bounded Multi-Agent Roles
The system SHALL orchestrate specialist agents with explicit responsibilities and artifact contracts.

#### Scenario: Research and synthesis are separated
- **WHEN** a new application request begins
- **THEN** the system SHALL allow distinct research, semantic-architecture, runtime, product, verification, and integration roles
- **AND** each role SHALL exchange structured artifacts rather than only free-form prose

#### Scenario: Verification failure blocks integration
- **WHEN** the verification role reports a failed policy, migration, or browser-flow check
- **THEN** the integration role SHALL reject promotion of the candidate
- **AND** the failure SHALL be attached to the relevant semantic revision

### Requirement: Integration Is Controlled
Only one role SHALL be able to advance the canonical accepted model revision.

#### Scenario: Integrator advances accepted revision
- **WHEN** research, synthesis, and verification outputs all pass review
- **THEN** the integrator SHALL record the accepted semantic revision and associated artifacts
- **AND** downstream generations SHALL use that revision as the new baseline
