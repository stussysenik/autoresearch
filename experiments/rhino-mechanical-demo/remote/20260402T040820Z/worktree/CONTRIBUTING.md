# Contributing

## Project Stage

This repository is in the early architecture and bootstrap phase.

That means contributions should optimize for clarity and leverage, not volume. A small change that sharpens a contract is more valuable than a large change that adds implementation noise before the foundations are stable.

## Working Rules

### Keep The Core Deterministic

Execution policy, validation, units, and math belong in the core. Do not hide those responsibilities inside prompts or host bridges.

### Keep Bridges Narrow

Bridge processes should execute typed requests and return typed results. They should not accumulate planner logic or ad hoc workflow behavior.

### Prefer Schema-Backed Design

If a capability can be derived from authoritative SDK data, prefer that over hand-written prompt instructions.

### Make State Explicit

If a feature depends on remembering objects, aliases, or prior commands, add or update the session model instead of relying on conversational context.

### Build Vertical Slices

Prefer end-to-end slices that prove the architecture over isolated experiments that do not connect back to the main flow.

## What Good Contributions Look Like

- tightening the protocol contract
- improving the capability model
- adding deterministic validation logic
- making a bridge more reliable or more transparent
- improving session identity handling
- documenting non-obvious architectural decisions

## What To Avoid

- embedding app-specific business logic in the core without a clear abstraction
- embedding planner logic in bridges
- introducing GUI automation as the primary execution path
- adding infrastructure that exceeds the current stage of the product
- hard-coding the project to one model vendor

## Suggested Repo Shape

As implementation begins, contributions should move the repository toward a structure like this:

```text
/
  README.md
  PRD.md
  VISION.md
  TECHSTACK.md
  ARCHITECTURE.md
  ROADMAP.md
  CONTRIBUTING.md
  core/
  bridges/
    rhino/
    rive/
    unreal/
  schemas/
  fixtures/
  scripts/
```

## Decision Making

When introducing a meaningful change, document:

- what problem it solves
- why it belongs in the chosen layer
- what contract it changes
- what future flexibility it preserves or reduces

If a decision materially changes architecture, reflect it in the relevant docs rather than leaving the reasoning trapped in code alone.

## Definition Of Done

A change is in good shape when:

- the responsibility boundary is clear
- the behavior is testable or at least contract-verifiable
- failure modes are understood
- docs are updated if architecture or workflow changed

## First Contribution Priorities

If you are looking for the highest-leverage early work, start here:

1. Define the Zig daemon skeleton and package layout.
2. Draft the JSON-RPC contract and method naming conventions.
3. Build the Rhino bridge stub with one verified command path.
4. Design the SQLite schema for sessions and object mapping.
