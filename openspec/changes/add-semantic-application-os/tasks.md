## 1. OpenSpec Foundation

- [ ] 1.1 Confirm `autoresearch-playground` is the long-term planning home for the application OS work
- [ ] 1.2 Review and refine `openspec/project.md` against the actual intended product boundary
- [ ] 1.3 Approve or rename the `add-semantic-application-os` change set

## 2. Benchmark Corpus (spec: verification-harness)

- [ ] 2.1 Define 10 benchmark app families the system must handle
- [ ] 2.2 Define 20 canonical change requests that stress migrations, policies, and workflows
- [ ] 2.3 Define pass/fail criteria for compile, runtime, browser, and policy verification
- [ ] 2.4 Store benchmark fixtures in a replayable format with provenance

## 3. Semantic Kernel (spec: semantic-kernel)

- [ ] 3.1 Define the canonical IR schema for concepts, entities, relations, statecharts, actions, constraints, policies, views, effects, artifacts, and provenance
- [ ] 3.2 Define validation rules and normalization passes for the IR
- [ ] 3.3 Define semantic diff format and review presentation
- [ ] 3.4 Define override model for human edits without losing canonical semantics

## 4. Application Compiler (spec: application-compiler)

- [ ] 4.1 Define the compile pipeline from prompt/imported evidence into normalized IR
- [ ] 4.2 Define lowering contracts for runtime adapters
- [ ] 4.3 Define policy emission strategy and workflow/state-machine emission strategy
- [ ] 4.4 Define migration generation and breakage summaries

## 5. Runtime Adapters (spec: application-compiler)

- [ ] 5.1 Prototype a Convex adapter for schema, functions, queries, and reactive views
- [ ] 5.2 Prototype a Postgres adapter for relational schema and migration output
- [ ] 5.3 Prototype a DuckDB analysis path for replay, analytics, and trace introspection
- [ ] 5.4 Decide the minimum common execution contract shared across adapters

## 6. Agent Orchestration (spec: agent-orchestration)

- [ ] 6.1 Define technical agent roles and responsibility boundaries
- [ ] 6.2 Define function-calling contracts for research, compile, verify, and integrate stages
- [ ] 6.3 Define artifact handoff format between agents
- [ ] 6.4 Define failure handling when agents disagree or verification fails

## 7. Studio and Review UX

- [ ] 7.1 Define the semantic studio information architecture
- [ ] 7.2 Define views for world model inspection, workflow graphs, migration previews, and evidence provenance
- [ ] 7.3 Define how humans approve, reject, or refine generated changes

## 8. Proof of Value

- [ ] 8.1 Run the full flow on a Ramp-like approvals app
- [ ] 8.2 Run the full flow on a Linear-like issue/workflow app
- [ ] 8.3 Run the full flow on a Notion-like structured workspace app
- [ ] 8.4 Measure whether the system survives at least 20 sequential product changes without model drift
