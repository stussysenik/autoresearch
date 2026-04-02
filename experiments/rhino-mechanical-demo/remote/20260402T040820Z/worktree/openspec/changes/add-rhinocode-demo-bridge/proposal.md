## Why

The prototype can already plan and execute against a mock Rhino bridge, but that is not enough for a credible Rhino showcase. This machine has Rhino 8 installed, and the fastest path to a real-host demo is to drive narrow Python scripts through Rhino startup commands instead of waiting for the longer-term .NET worker.

## What Changes

- Add a real-Rhino demo bridge server behind the existing `rhino-inside` profile and Unix socket contract.
- Execute document lifecycle and basic solid creation requests by launching Rhino with startup scripts that run Python inside the app.
- Detect already-open Rhino instances before launch so the demo bridge avoids trampling an active user session or spawning ambiguous duplicate instances.
- Support cube, sphere, and cylinder creation in a real Rhino document while preserving the current session and alias persistence model.
- Keep the mock bridge unchanged and document the real bridge as a tactical demo implementation rather than the final production backend.

## Capabilities

### New Capabilities
- `real-rhino-demo-bridge`: Resolve and report a real Rhino-backed bridge runtime through the existing bridge profile and JSON-RPC surface.
- `real-rhino-basic-solids`: Create a small deterministic set of basic solids in a real Rhino document for the first live demo path.

### Modified Capabilities

None.

## Impact

- Adds a new real-Rhino bridge server module in `src/`
- Extends CLI bridge startup and runtime help for the real profile
- Introduces repo-local Rhino Python script templates and file-based result handoff
- Updates README and bridge documentation with a manual verification path and the `StartScriptServer` / startup-script prerequisites
