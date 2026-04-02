## Context

The runtime-readiness slice added configuration, bridge profiles, and handshake inspection, but the execution path still dispatches geometry methods without any explicit document context. That is fine for a stateless mock, but it does not match how Rhino actually operates. Real object identifiers, unit systems, model tolerance, and document lifecycle all belong to a specific `RhinoDoc`.

This change makes the core document-aware before a real Rhino worker exists. The mock bridge will emulate document lifecycle so the core can prove the session model now.

## Goals / Non-Goals

**Goals:**
- Add document lifecycle methods to the Rhino bridge contract
- Persist the active document per CLI session in SQLite
- Ensure geometry dispatch includes a `document_id`
- Scope stored aliases to the active document and fail fast on document mismatch or stale document state
- Expose document context through CLI inspection and explicit close behavior

**Non-Goals:**
- Real Rhino.Inside or RhinoCommon execution
- File-backed document open/save flows
- Multiple open documents per CLI session
- Broader planner coverage or LLM-backed planning
- Bridge launch orchestration

## Decisions

### Decision: Treat the active document as session-scoped execution context

Each CLI session will have at most one active Rhino document. `run` will resolve that document before dispatch: if none exists for a create flow, it will open a headless document; if one exists, it will validate it with `rhino.document.describe`.

Alternative considered:
- Allow multiple active documents per session immediately. Rejected because the prototype does not yet have a natural-language or CLI model for selecting between them.

### Decision: Store document metadata separately from object aliases

The SQLite store will add an `active_documents` table and an `object_documents` mapping table. This avoids destructive schema changes to the existing `objects` table while still letting aliases be validated against a concrete document.

Alternative considered:
- Alter the existing `objects` table in place to add `document_id`. Rejected because the prototype should stay simple and tolerant of pre-existing local databases.

### Decision: Reuse stored object document ids only as a recovery hint

If a move command references an alias and the active document record is missing, the core may attempt to describe the document associated with that alias and restore it as the active document. If the bridge rejects that document, execution fails rather than silently creating a new one.

Alternative considered:
- Always open a fresh headless document when no active document exists. Rejected because that would make persisted object aliases look valid across unrelated documents.

### Decision: Explicit document close clears session-scoped aliases

When the user closes the active document through the CLI, the core will delete the active document record and clear stored aliases for that session. Those aliases are not meaningful after the document is gone.

Alternative considered:
- Preserve aliases after close and let later commands fail at the bridge. Rejected because it leaves misleading session state around.

## Risks / Trade-offs

- [Document validation adds an extra bridge round-trip] → Accept it now because document context correctness matters more than one local mock call.
- [Session state becomes stricter] → Return clear document-specific errors instead of trying to paper over stale context.
- [The mock bridge becomes stateful] → Keep the state model narrow: document existence and document metadata only.
- [A future real bridge may expose richer document metadata] → Keep the required fields small and additive so richer metadata can arrive later without breaking the core.

## Migration Plan

1. Add OpenSpec requirements for document-scoped execution and inspection.
2. Extend the bridge contract and mock bridge with document lifecycle methods.
3. Add SQLite persistence for the active document and alias-to-document mapping.
4. Update `run`, `session show`, and document-specific CLI commands to use the new session model.
5. Verify create, move, inspect, and close flows end to end against the mock bridge.

Rollback is straightforward because the change is additive: remove the document lifecycle methods, the new store tables, and the document-aware execution logic.

## Open Questions

- Should a later real Rhino bridge expose document units as a stable enum instead of a string?
- Should file-backed document open/save flows be modeled as separate methods or as extensions of the headless document lifecycle?
