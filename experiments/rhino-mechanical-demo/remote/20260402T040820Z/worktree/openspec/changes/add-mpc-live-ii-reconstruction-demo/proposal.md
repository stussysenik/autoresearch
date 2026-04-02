## Why

The Rhino demo can already create generic forms, but it cannot yet stage a believable hardware reconstruction workflow for a real commercial product. We need a source-backed MPC Live II demo now so we can show controlled, checkpointed modeling of a recognizable object, while being explicit about which dimensions come from official Akai sources and which surfaces are inferred.

## What Changes

- Add a new prompt path for creating an MPC Live II reference button cap in Rhino using official device dimensions, official control naming, and a documented calibration workflow for inferred cap geometry.
- Add a staged MPC Live II top-panel demo that shows checkpoints live: chassis envelope, control-map anchors, button families, cap placement, viewport setup, and export.
- Add provenance-aware output metadata so the demo distinguishes official measurements from calibrated or inferred geometry instead of presenting every feature as exact.
- Add live-demo viewport and layer management for hardware reconstruction sequences so the Rhino session reads like a product-modeling demo rather than a generic shape script.
- Add STL export for the cap-focused flow so the reconstructed cap can be handed off as a 3D artifact.

## Capabilities

### New Capabilities
- `mpc-live-ii-button-cap-reference`: Create a source-backed MPC Live II button-cap reconstruction with explicit provenance and export output.
- `mpc-live-ii-panel-demo-sequence`: Create a staged MPC Live II top-panel reconstruction demo with named checkpoints, layers, and presentation views.

### Modified Capabilities

## Impact

- Affected code: `src/types.zig`, `src/planner.zig`, `src/app.zig`, `src/mock_bridge.zig`, `src/rhino_live_demo.zig`
- Affected bridge/docs: `bridges/rhino/README.md`, `bridges/rhino/json-rpc-contract.md`, `schemas/rhino/plan.schema.json`, `schemas/rhino/request.schema.json`, `README.md`
- New OpenSpec specs for the button-cap reference flow and the staged panel demo flow
- External references: official Akai product specs and the official MPC user guide / control map
