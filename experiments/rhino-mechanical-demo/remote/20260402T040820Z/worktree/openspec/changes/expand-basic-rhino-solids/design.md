## Context

The prototype is now document-scoped and close to the execution model a real Rhino worker will need, but the shape vocabulary is still minimal. For a fast demo, the next highest-value addition is a tiny set of basic solids that reuse the same deterministic planner and bridge contract.

This change stays narrow: it adds sphere and cylinder support on top of cube creation without introducing a more general modeling grammar.

## Goals / Non-Goals

**Goals:**
- Add deterministic prompts for sphere and cylinder creation
- Keep geometry creation document-scoped through the existing bridge/session model
- Extend the mock bridge and schemas with minimal new methods
- Keep measurements normalized to millimeters

**Non-Goals:**
- Box dimensions or arbitrary extrusion support
- Boolean operations or editing operations
- LLM-backed planning
- Real Rhino.Inside implementation

## Decisions

### Decision: Reuse existing numeric fields where possible

Sphere creation only needs `radius_mm`, and cylinder creation can reuse `radius_mm` plus `height_mm`. That avoids growing the normalized action shape unnecessarily.

Alternative considered:
- Introduce a generic parameter bag for every new shape. Rejected because it would weaken the deterministic plan contract.

### Decision: Keep prompt grammar explicit instead of trying to infer shapes loosely

The accepted shapes will be keyed off explicit tokens like `sphere` and `cylinder`, with simple `radius`, `height`, and `named` phrases.

Alternative considered:
- Add fuzzy parsing for many shape phrases at once. Rejected because the early demo benefits more from predictability than breadth.

## Risks / Trade-offs

- [Prompt grammar remains narrow] → Accept this because the demo goal is a small, reliable shape set.
- [Future Rhino worker must implement more methods] → Keep the added methods few and obvious: sphere and cylinder only.
- [README and schemas can drift] → Update contract docs and schema files in the same change.

## Migration Plan

1. Add OpenSpec requirements for the expanded solid set.
2. Extend the planner and action enum with sphere and cylinder.
3. Update the mock bridge and Rhino schemas.
4. Verify end-to-end create flows for the new solids.
