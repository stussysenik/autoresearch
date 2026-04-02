## Why

Basic solids prove the bridge path, but they do not look like a compelling Rhino showcase. The demo needs one deterministic shape that reads as more organic and presentational without turning the planner into an open-ended modeling grammar.

## What Changes

- Add deterministic planning support for `create organic blob named pod-a` style prompts.
- Extend the mock and live Rhino paths with `rhino.geometry.create_organic_blob`.
- Generate the live shape as a fixed, deterministic cluster of overlapping spheres merged into a single blob.
- Frame the active Rhino view after blob creation so the result presents cleanly during a demo.

## Capabilities

### New Capabilities
- `organic-rhino-demo-shape`: Support one deterministic organic blob shape for the Rhino demo surface, including presentation-friendly framing.

### Modified Capabilities

None.

## Impact

- Extends the planner, action enum, and prompt help in `src/`
- Adds mock-bridge and live-Rhino execution support for `rhino.geometry.create_organic_blob`
- Updates Rhino bridge contract docs and request/plan schemas
- Adds README demo guidance for the organic blob flow
