/**
 * Type definitions for the Mermaid dispatch registry.
 *
 * Every M-type (M01–M08) maps a set of trigger keywords to a mermaid
 * diagram syntax. The registry is immutable (`as const`) so downstream
 * tooling can narrow on literal types — e.g. `entry.id` is `"M01"`,
 * not `string`.
 */

/** One slot placeholder inside a template string, e.g. "{system}" */
export type Slot = string;

/** A single M-type entry in the dispatch registry */
export interface MTypeEntry {
  /** Registry id — M01 through M08 */
  readonly id: string;
  /** Human-readable diagram kind, e.g. "Flowchart" */
  readonly type: string;
  /** The mermaid opening keyword, e.g. "flowchart TD" */
  readonly syntax: string;
  /** Lower number = matched first (first-match wins) */
  readonly priority: number;
  /** Words/phrases that trigger this diagram type */
  readonly triggers: readonly string[];
  /** Prompt template with {slot} placeholders */
  readonly template: string;
  /** One concrete example: filled slots → expected prompt text */
  readonly examples: readonly string[];
  /** Mermaid skeleton — minimal working example of this diagram type */
  readonly skeleton: string;
}

/** The full registry is a readonly tuple of MTypeEntry objects */
export type Registry = readonly MTypeEntry[];
