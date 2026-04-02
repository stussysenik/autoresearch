## 1. OpenSpec Artifacts

- [x] 1.1 Define requirements for runtime configuration precedence and diagnostics
- [x] 1.2 Define requirements for bridge profile selection and runtime handshake
- [x] 1.3 Document the technical design for config resolution and handshake flow

## 2. Runtime Configuration

- [x] 2.1 Add a typed config module that resolves defaults, `.env.local`, process env, and CLI overrides
- [x] 2.2 Add inspection commands that print the effective runtime config and field sources
- [x] 2.3 Add a checked-in `.env.local.example` for the supported config surface

## 3. Bridge Readiness

- [x] 3.1 Replace raw socket-path dispatch with a typed bridge target/profile abstraction
- [x] 3.2 Add `rhino.system.ping` and `rhino.system.describe_runtime` to the bridge client and mock bridge
- [x] 3.3 Preflight `run` with bridge runtime inspection before geometry dispatch

## 4. Contract And Verification

- [x] 4.1 Update Rhino bridge docs and JSON schemas to include runtime handshake methods and payloads
- [x] 4.2 Add tests for config precedence, dotenv validation, profile resolution, and handshake parsing
- [x] 4.3 Verify `config show`, `bridge status`, and the existing mock create/move flow end to end
