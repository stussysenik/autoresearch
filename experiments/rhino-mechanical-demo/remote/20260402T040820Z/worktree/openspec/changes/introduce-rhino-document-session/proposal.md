## Why

The current prototype can create and move Rhino-scoped objects, but it still treats bridge execution as if object identifiers live in a vacuum. A real Rhino bridge will execute against a concrete `RhinoDoc`, and object identifiers, tolerances, and units are only meaningful inside that document context.

Before trying a real Rhino-backed worker, the core needs an explicit document session model. Without it, follow-up commands will keep relying on mock-only assumptions that do not match how Rhino actually scopes geometry.

## What Changes

- Add document-scoped Rhino bridge methods for opening, describing, and closing a headless document.
- Persist the active Rhino document per CLI session in SQLite and scope stored aliases to that document.
- Require geometry execution requests to include a `document_id`.
- Extend session inspection so developers can see the active document context.
- Clear document-scoped aliases when the active document is explicitly closed.

## Capabilities

### New Capabilities

- `rhino-document-session`: Open, persist, inspect, and close a headless Rhino document so all geometry execution happens inside an explicit document context.

### Modified Capabilities

None.

## Impact

- Adds document lifecycle methods to the Rhino JSON-RPC contract
- Extends the Zig core and store with active-document persistence and document-scoped alias validation
- Updates the mock Rhino bridge to emulate document creation and stale-document failures
- Brings the local prototype closer to real Rhino execution without requiring Rhino.Inside in this environment
