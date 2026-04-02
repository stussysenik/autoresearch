## 1. OpenSpec Artifacts

- [x] 1.1 Define document-scoped execution requirements
- [x] 1.2 Document the technical design for active-document persistence and alias scoping

## 2. Bridge Contract

- [x] 2.1 Add document lifecycle methods and payloads to the Rhino bridge client
- [x] 2.2 Update the mock Rhino bridge to maintain document state and reject missing document ids
- [x] 2.3 Update Rhino docs and JSON schemas for document-scoped execution

## 3. Session Persistence

- [x] 3.1 Persist the active document per CLI session in SQLite
- [x] 3.2 Scope stored aliases to a document and clear them on explicit document close
- [x] 3.3 Surface active document metadata in session inspection

## 4. CLI Flow

- [x] 4.1 Resolve or create a document before geometry dispatch
- [x] 4.2 Add a document close command for the active session
- [x] 4.3 Fail clearly on stale or mismatched document context

## 5. Verification

- [x] 5.1 Add tests for document response parsing and store behavior
- [x] 5.2 Verify create, move, inspect, and close flows end to end against the mock bridge
