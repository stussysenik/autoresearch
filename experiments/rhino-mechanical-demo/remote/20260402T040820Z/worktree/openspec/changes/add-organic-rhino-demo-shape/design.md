## Context

The current demo surface is deterministic and reliable, but it still looks like a tool that can only place primitives. For a showcase, one organic-looking shape adds more value than several more engineering solids, as long as the implementation remains narrow and predictable.

The most practical first shape is a fixed sphere-cluster blob. It is deterministic, it fits the current planner contract, it can run in both the mock and live paths, and it does not require inventing a generalized organic modeling grammar.

## Goals / Non-Goals

**Goals:**
- Add one deterministic `organic blob` prompt and action
- Keep the mock and live bridge surfaces aligned under one new method
- Make the live blob look demo-ready by framing the active view automatically
- Reuse existing persistence and alias behavior unchanged

**Non-Goals:**
- General-purpose organic modeling
- Randomized or AI-generated geometry
- Multiple blob archetypes in the same change
- Full viewport choreography beyond a single presentation-friendly framing step

## Decisions

### Decision: Use a fixed sphere-cluster recipe

The organic blob will be constructed from a fixed arrangement of overlapping spheres scaled by one `size_mm` value. This preserves determinism while still producing a form that reads as organic.

Alternative considered:
- Randomized sphere placement. Rejected because the demo needs repeatability more than novelty.

### Decision: Boolean-union the recipe into one object

The live path will merge the sphere cluster into one blob when possible so the result reads as one modeled object rather than a loose set of parts.

Alternative considered:
- Leave the spheres separate. Rejected because it weakens the visual impact of the demo.

### Decision: Keep the prompt grammar explicit

The planner will recognize `organic blob` explicitly and reuse `size_mm` plus `alias` instead of adding a richer organic-shape language.

Alternative considered:
- Accept many fuzzy organic-shape phrases. Rejected because reliability matters more than breadth in the demo.

### Decision: Frame the result automatically in Rhino

The live path will switch to a perspective view, try to use a rendered display mode, and zoom to the new blob after creation.

Alternative considered:
- Require manual viewport adjustments during the demo. Rejected because presentation quality should not depend on operator cleanup.

## Risks / Trade-offs

- [Boolean union may fail if the recipe is too loose] → Keep the sphere recipe conservative and overlapping.
- [Viewport display mode APIs may vary across Rhino environments] → Treat display-mode selection as best effort and keep zoom framing as the hard requirement.
- [The organic shape is still a narrow recipe, not true freeform modeling] → Accept this because the demo goal is one memorable organic result, not generality.

## Migration Plan

1. Add the new action kind and deterministic prompt parsing.
2. Extend the mock and live paths with `rhino.geometry.create_organic_blob`.
3. Update the bridge docs, schemas, and README with the new demo flow.
4. Verify planning, mock execution, and live Rhino creation.
