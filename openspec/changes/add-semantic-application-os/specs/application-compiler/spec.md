## ADDED Requirements

### Requirement: Deterministic Lowering
The system SHALL lower a validated semantic IR into runtime-specific artifacts through deterministic compiler passes.

#### Scenario: Lowering to runtime adapter
- **WHEN** a normalized IR is approved
- **THEN** the compiler SHALL emit storage definitions, query/function definitions, workflows, policies, and view metadata for the selected runtime adapter
- **AND** the compiler SHALL produce the same output for the same IR and adapter version

### Requirement: Migration Awareness
The compiler SHALL treat application evolution as a first-class concern.

#### Scenario: Model change produces migration review
- **WHEN** an existing application model changes
- **THEN** the compiler SHALL emit semantic diffs, storage diffs, workflow diffs, policy diffs, and a backfill/breakage summary before changes are accepted

#### Scenario: Unsafe change blocked
- **WHEN** a proposed change would orphan data, invalidate policies, or break workflow invariants without a declared migration path
- **THEN** the compiler SHALL mark the change as unsafe
- **AND** acceptance SHALL require explicit human approval or a generated remediation plan
