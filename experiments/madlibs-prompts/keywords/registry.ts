/**
 * THE KERNEL — single source of truth for M01–M08 mermaid dispatch.
 *
 * Rules:
 *  1. Edit triggers here → everything downstream changes automatically.
 *  2. Priority order matters — first match wins (scan M01→M08).
 *  3. Templates use {slot} placeholders; examples show filled versions.
 *  4. This file is the ONLY thing you hand-edit. Prompts and scores
 *     are derived, never manually written.
 */

import type { MTypeEntry } from "./types.ts";

export const REGISTRY = [
  {
    id: "M01",
    type: "Flowchart",
    syntax: "flowchart TD",
    priority: 1,
    triggers: [
      "flow", "process", "pipeline", "workflow",
      "architecture", "system", "deploy", "how it works",
    ],
    template: "Plan a {scope} that shows the {subject} flow from {start} to {end}.",
    examples: [
      "Plan a deployment pipeline that shows the CI/CD flow from commit to production.",
    ],
    skeleton: `flowchart TD
    A[Input] --> B{Decision}
    B -->|Yes| C[Action A]
    B -->|No| D[Action B]`,
  },
  {
    id: "M02",
    type: "Mindmap",
    syntax: "mindmap",
    priority: 2,
    triggers: [
      "implement", "build", "refactor", "plan",
      "task", "breakdown", "feature",
    ],
    template: "Plan how to implement {feature}, breaking it down into {layers}.",
    examples: [
      "Plan how to implement dark mode, breaking it down into UI, state, and storage layers.",
    ],
    skeleton: `mindmap
  root((Task))
    Subtask A
      Detail
    Subtask B
    Subtask C`,
  },
  {
    id: "M03",
    type: "Sequence",
    syntax: "sequenceDiagram",
    priority: 3,
    triggers: [
      "interaction", "API call", "debug", "trace",
      "request/response", "between services",
    ],
    template: "Plan the interaction between {serviceA} and {serviceB} when a user {action}.",
    examples: [
      "Plan the interaction between the auth API and the database when a user logs in.",
    ],
    skeleton: `sequenceDiagram
    A->>B: Request
    B->>C: Query
    C-->>B: Result
    B-->>A: Response`,
  },
  {
    id: "M04",
    type: "ER Diagram",
    syntax: "erDiagram",
    priority: 4,
    triggers: [
      "schema", "database", "entity", "relationship",
      "data model", "tables",
    ],
    template: "Plan the database schema for {domain}, showing relationships between {entities}.",
    examples: [
      "Plan the database schema for an e-commerce app, showing relationships between users, orders, and products.",
    ],
    skeleton: `erDiagram
    USER ||--o{ ORDER : places
    ORDER ||--|{ ITEM : contains`,
  },
  {
    id: "M05",
    type: "State",
    syntax: "stateDiagram-v2",
    priority: 5,
    triggers: [
      "state", "lifecycle", "status", "transition",
      "phase", "order states",
    ],
    template: "Plan the lifecycle of a {entity}, showing every state transition from {initial} to {final}.",
    examples: [
      "Plan the lifecycle of a support ticket, showing every state transition from open to resolved.",
    ],
    skeleton: `stateDiagram-v2
    [*] --> Idle
    Idle --> Active: start
    Active --> [*]: stop`,
  },
  {
    id: "M06",
    type: "Gantt",
    syntax: "gantt",
    priority: 6,
    triggers: [
      "timeline", "roadmap", "schedule",
      "milestone", "sprint", "phases over time",
    ],
    template: "Plan a timeline for {project}, showing milestones across {phases}.",
    examples: [
      "Plan a timeline for the v2 launch, showing milestones across design, dev, and QA phases.",
    ],
    skeleton: `gantt
    title Roadmap
    section Phase 1
    Task A: a1, 2024-01-01, 30d
    Task B: after a1, 20d`,
  },
  {
    id: "M07",
    type: "Class",
    syntax: "classDiagram",
    priority: 7,
    triggers: [
      "class", "interface", "inheritance",
      "OOP", "type hierarchy",
    ],
    template: "Plan the class hierarchy for {system}, showing inheritance between {classes}.",
    examples: [
      "Plan the class hierarchy for the notification system, showing inheritance between Alert, Toast, and Banner.",
    ],
    skeleton: `classDiagram
    class Base { +method() }
    Base <|-- Child`,
  },
  {
    id: "M08",
    type: "Git Graph",
    syntax: "gitGraph",
    priority: 8,
    triggers: [
      "branching", "merge strategy", "git flow",
      "release branches",
    ],
    template: "Plan the branching strategy for {repo}, showing how {branches} merge into {target}.",
    examples: [
      "Plan the branching strategy for the monorepo, showing how feature and hotfix branches merge into main.",
    ],
    skeleton: `gitGraph
    commit
    branch feature
    commit
    checkout main
    merge feature`,
  },
] as const satisfies readonly MTypeEntry[];

/** Lookup helper — returns the entry or undefined */
export function getEntry(id: string): MTypeEntry | undefined {
  return REGISTRY.find((e) => e.id === id);
}

/** All trigger keywords flattened, useful for grep/search */
export function allTriggers(): string[] {
  return REGISTRY.flatMap((e) => [...e.triggers]);
}
