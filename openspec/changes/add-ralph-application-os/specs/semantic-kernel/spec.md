## ADDED Requirements

### Requirement: Inspectable Semantic World Model
The system SHALL represent each application as a typed semantic world model rather than as prompts, raw tables, or opaque generated code.

#### Scenario: Model core business software
- WHEN a user describes a business application domain
- THEN the system creates an inspectable model containing entities, relations, state, actions, constraints, policies, views, effects, and provenance

#### Scenario: Stable serialization
- WHEN the model is stored or diffed
- THEN the system emits a stable serialized form suitable for deterministic comparison and replay

### Requirement: Provenance and Human Corrections
The system SHALL retain provenance for how each semantic element entered or changed in the model.

#### Scenario: Human correction after generation
- WHEN a user renames an entity, removes a field, or changes a workflow rule
- THEN the system stores the correction as provenance linked to the affected semantic elements
- AND the correction remains visible to later compile and harvest steps

### Requirement: Capability-Aware Modeling
The system SHALL model execution-facing capabilities without forcing a single runtime implementation.

#### Scenario: Render or compute semantics are needed later
- WHEN an application requires rendering, compute, or other effectful behavior
- THEN the model can represent those capabilities as semantic effects and artifacts
- AND runtime-specific lowering is deferred to the adapter layer
