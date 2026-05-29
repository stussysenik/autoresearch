## Why

The current autoresearch framework is strong at evaluating variants, but it does not yet define how to turn semantic intent into whole software systems. The next step is not "build another database." It is to define a semantic application OS that can research a domain, distill a compact world model, compile that model into a working product, verify the result, and learn from corrections. Without a durable IR, runtime boundaries, and a proof harness, app generation collapses into prompt-shaped demos.

## What Changes

- Add a product and systems proposal for `RALPH`: a semantic application OS built around a small canonical IR and a closed research-to-runtime loop
- Define the v1 wedge as serious business software: workflows, approvals, CRM-ish systems, internal tools, and agent control planes
- Define compiler and runtime boundaries: semantic kernel, application compiler, runtime adapters, verification harness, and agent orchestration
- Define startup-team-style technical agent roles with function-calling boundaries for research, compilation, verification, and integration
- Explicitly defer custom database engines, web engines, OS kernels, and GPU/render runtimes until the semantic kernel proves leverage

## Capabilities

### New Capabilities
- `semantic-kernel`: typed world model for entities, relations, constraints, policies, workflows, views, and effects
- `application-compiler`: deterministic lowering from intent + examples into runtime-specific artifacts
- `verification-harness`: replayable test/eval system for generated applications and change requests
- `agent-orchestration`: bounded research/build/verify agents with explicit function-calling contracts

### Modified Capabilities
- `autoresearch-framework`: expand from experiment optimization into application-level research, synthesis, and regression evaluation

## Impact

- **Repository direction**: broadens `autoresearch-playground` from experiment harness to semantic application OS planning ground
- **Architecture work**: introduces a new planning surface for IR design, runtime adapters, migration safety, and verification
- **Execution model**: future implementation should favor Convex/Postgres/DuckDB adapters over custom infrastructure in v1
- **No immediate codegen/runtime changes**: this change is planning and spec work only
