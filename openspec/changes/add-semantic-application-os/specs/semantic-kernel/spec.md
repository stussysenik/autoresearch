## ADDED Requirements

### Requirement: Canonical Semantic IR
The system SHALL maintain a canonical semantic IR as the authoritative model of an application.

#### Scenario: Prompt becomes normalized model
- **WHEN** a user describes an application in natural language and provides optional examples
- **THEN** the system SHALL produce a normalized IR containing concepts, entities, relations, constraints, policies, workflows, views, effects, and provenance
- **AND** the IR SHALL be reviewable independently of generated runtime artifacts

#### Scenario: Imported evidence is preserved
- **WHEN** the system infers structure from schemas, repos, screenshots, or documents
- **THEN** each inferred IR element SHALL retain provenance back to its source evidence

### Requirement: Semantic Diff and Validation
The system SHALL validate and diff the IR before lowering it into runtime targets.

#### Scenario: Invalid model rejected before compile
- **WHEN** the IR contains contradictory constraints, missing workflow states, or invalid policy references
- **THEN** compilation SHALL stop
- **AND** the system SHALL surface the invalid references in the review output

#### Scenario: Human override remains explicit
- **WHEN** a human changes a generated field, relation, or policy
- **THEN** the system SHALL record the override as an explicit semantic change
- **AND** the canonical model SHALL remain reconstructable from the IR plus overrides
