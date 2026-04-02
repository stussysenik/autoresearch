## Why

The current prototype can create a cube, but that is too thin for a compelling early demo. Before the real Rhino worker arrives, the deterministic planning and bridge contract should support a small set of basic solids so the first Rhino showcase feels like a modeling tool rather than a single hard-coded command.

## What Changes

- Add deterministic planning support for sphere and cylinder creation prompts.
- Extend the Rhino bridge contract and schemas with sphere and cylinder methods.
- Update the mock Rhino bridge to execute those methods through the same document-scoped path as cube creation.
- Refresh the README and prompt help so the expanded demo surface is visible.

## Capabilities

### New Capabilities

- `basic-rhino-solids`: Support a small deterministic set of basic Rhino solids for the early demo surface.

### Modified Capabilities

None.

## Impact

- Expands the local demo from one basic solid to three
- Preserves the same planner, bridge, and persistence model
- Keeps the surface narrow enough to map directly onto a future Rhino worker
