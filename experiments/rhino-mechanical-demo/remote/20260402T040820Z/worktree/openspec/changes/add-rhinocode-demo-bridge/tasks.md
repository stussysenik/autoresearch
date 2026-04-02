## 1. OpenSpec Artifacts

- [x] 1.1 Define requirements for the real Rhino demo bridge and document-scoped session behavior
- [x] 1.2 Document the tactical startup-script design for the first live Rhino bridge

## 2. Real Bridge Server

- [ ] 2.1 Add a real Rhino bridge server module that preserves the existing JSON-RPC contract
- [x] 2.2 Add Rhino instance discovery and safe target selection before live execution
- [ ] 2.3 Wire CLI bridge startup and help text for the real `rhino-inside` profile

## 3. Rhino Script Execution

- [x] 3.1 Generate legacy-safe Rhino Python scripts for cube, sphere, and cylinder creation
- [ ] 3.2 Implement document open, describe, and close behavior backed by deterministic `.3dm` paths
- [x] 3.3 Parse JSON result files from Rhino and return structured bridge responses with host identifiers

## 4. Verification

- [ ] 4.1 Add tests for the new bridge server request handling and runtime reporting
- [ ] 4.2 Document the manual live-Rhino verification flow, including the viewport follow-up opportunity
