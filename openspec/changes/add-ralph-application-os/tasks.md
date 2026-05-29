## 1. Foundation

- [ ] 1.1 Create `docs/ralph/` to hold high-signal architecture docs, benchmark corpus notes, and adapter contracts
- [ ] 1.2 Add a repo-level architecture brief linking the autoresearch framework to the application OS direction
- [ ] 1.3 Define the canonical benchmark list and one forcing-function benchmark for the first 90 days
- [ ] 1.4 Define success metrics: time-to-first-app, edit survival, migration safety, permission fidelity, artifact complexity

## 2. Semantic Kernel (spec: semantic-kernel)

- [ ] 2.1 Create a typed IR package with the core primitives from the spec
- [ ] 2.2 Add schema validation and stable serialization for the IR
- [ ] 2.3 Add provenance records for prompt input, human edits, and compiler decisions
- [ ] 2.4 Add semantic diffing for model changes
- [ ] 2.5 Create 3 benchmark app models directly in IR before adding LLM generation

## 3. Compiler (spec: app-compiler)

- [ ] 3.1 Define compiler pass interfaces and artifact types
- [ ] 3.2 Implement normalization and concept-resolution passes
- [ ] 3.3 Implement invariant, policy, and workflow lowering passes
- [ ] 3.4 Implement storage-plan generation and migration diff generation
- [ ] 3.5 Implement view and agent-tool generation
- [ ] 3.6 Add deterministic compiler snapshots for regression testing

## 4. Runtime Adapters (spec: runtime-adapters)

- [ ] 4.1 Define the adapter contract for schema, functions, jobs, policies, and reactive queries
- [ ] 4.2 Build a Convex-first adapter and run one benchmark app end-to-end
- [ ] 4.3 Draft a Postgres adapter design to validate abstraction boundaries
- [ ] 4.4 Add DuckDB-backed analysis outputs for benchmark and proof introspection

## 5. Verification Harness (spec: verification-harness)

- [ ] 5.1 Extend the experiment framework so a benchmark app can be compiled, run, and scored automatically
- [ ] 5.2 Add change-replay scripts for at least 10 sequential product edits on one benchmark
- [ ] 5.3 Add permission, invariant, and workflow verification checks
- [ ] 5.4 Add artifact complexity and compile-cost scoring
- [ ] 5.5 Store corrections and failures as reusable benchmark data

## 6. Semantic Studio (spec: semantic-studio)

- [ ] 6.1 Build a minimal studio shell that renders the domain graph, artifacts, and proof status
- [ ] 6.2 Add model editing with semantic diffs and recompile actions
- [ ] 6.3 Add migration previews and provenance inspection
- [ ] 6.4 Add benchmark comparison views across revisions

## 7. Research Loop

- [ ] 7.1 Define how prompts, screenshots, repos, schemas, and docs are ingested into the Research stage
- [ ] 7.2 Add a structured "proposal to IR" workflow instead of free-form code generation
- [ ] 7.3 Add harvesting rules so human corrections improve future benchmark runs
- [ ] 7.4 Add a compact concept library seeded from the first benchmark apps

## 8. Milestones

- [ ] 8.1 30-day milestone: IR, benchmark corpus, and 3 canonical models complete
- [ ] 8.2 60-day milestone: first benchmark lowered into a running Convex-backed app
- [ ] 8.3 90-day milestone: one benchmark survives 10 scripted product changes
- [ ] 8.4 180-day milestone: second adapter and reusable concept library online
