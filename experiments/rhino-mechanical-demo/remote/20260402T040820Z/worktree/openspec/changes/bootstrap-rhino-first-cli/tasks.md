## 1. Project Scaffold

- [x] 1.1 Add the Zig build files and source tree for the CLI and mock bridge entrypoints
- [x] 1.2 Add a minimal repository layout for runtime data, fixtures, and developer commands

## 2. Deterministic Planning

- [x] 2.1 Implement prompt parsing for the supported prototype commands: create cube, create spiral staircase, and move named object
- [x] 2.2 Implement plan validation and unit normalization into deterministic millimeter-based payloads
- [x] 2.3 Add a `plan` CLI command that prints the normalized action plan as JSON

## 3. Session Persistence

- [x] 3.1 Implement SQLite schema bootstrap for sessions, objects, and command history
- [x] 3.2 Persist successful execution history and returned host object identifiers
- [x] 3.3 Resolve stored aliases during follow-up commands and expose a `session show` command

## 4. Bridge Execution

- [x] 4.1 Implement Unix domain socket JSON-RPC helpers for client and server communication
- [x] 4.2 Implement the mock Rhino bridge with supported create and move methods
- [x] 4.3 Add a `run` CLI command that dispatches validated plans to the bridge and prints structured results

## 5. Verification

- [x] 5.1 Run the prototype end-to-end for create and follow-up move flows
- [x] 5.2 Update the README with concrete prototype usage instructions
