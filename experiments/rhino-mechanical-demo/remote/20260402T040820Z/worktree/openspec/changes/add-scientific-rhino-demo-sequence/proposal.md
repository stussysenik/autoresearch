## Why

The live Rhino path can now create organic shapes reliably, but it still does not deliver the kind of narrated, visually legible demo that shows geometry being constructed step by step. A deterministic scientific shell with clear 2D guides, a visible lift into 3D, rendered presentation, and deterministic export is the fastest way to turn the current bridge into a showcase.

## What Changes

- Add a deterministic `scientific shell` demo action that starts from a 2D spiral guide and builds a 3D lofted shell form in Rhino.
- Stage the live Rhino script so users can watch guide curves, lifted sections, lofting, meshing, and final presentation happen in sequence.
- Generate a final mesh representation for the scientific demo and export a deterministic STL artifact alongside the saved `.3dm` file.
- Extend planner help, mock bridge support, schemas, and README examples for the new scientific demo prompt.

## Capabilities

### New Capabilities
- `scientific-rhino-demo-sequence`: Deterministic scientific Rhino demo creation with staged visual steps, rendered framing, mesh generation, and STL export.

### Modified Capabilities
- None.

## Impact

- Affected code: `src/types.zig`, `src/planner.zig`, `src/mock_bridge.zig`, `src/app.zig`, `src/rhino_live_demo.zig`
- Affected docs/contracts: `bridges/rhino/json-rpc-contract.md`, `bridges/rhino/README.md`, `schemas/rhino/*.json`, `README.md`
- Affected runtime artifacts: `var/real-rhino/docs/`, `var/real-rhino/results/`, `var/real-rhino/exports/`
