/**
 * Core types for the bboy-battle-analysis overnight experiment.
 *
 * ResearchPhase defines what to research. Checkpoint tracks progress.
 * ExperimentState is the top-level manifest persisted across runs.
 */

export interface ResearchPhase {
  /** Unique identifier, e.g. "phase-0" */
  id: string
  /** Human-readable name */
  name: string
  /** What this phase researches */
  description: string
  /** Initial research questions the LLM must address */
  seedQuestions: string[]
  /** Phase IDs whose output feeds into this one */
  dependencies: string[]
  /** Max self-identified follow-up iterations */
  maxFollowups: number
  /** Soft time limit in minutes */
  timeBudgetMinutes: number
  /** Prompt template — {context} and {questions} are replaced at runtime */
  promptTemplate: string
}

export type PhaseStatus = 'pending' | 'in_progress' | 'complete' | 'failed'

export interface Checkpoint {
  phaseId: string
  status: PhaseStatus
  startedAt: string | null
  completedAt: string | null
  /** Number of follow-up iterations completed */
  followupsCompleted: number
  /** File paths of all artifacts produced */
  artifacts: string[]
  /** Error message if failed */
  error?: string
  /** Total bytes written by this phase */
  bytesWritten: number
}

export interface ExperimentState {
  experimentId: string
  startedAt: string
  lastUpdated: string
  phases: Record<string, Checkpoint>
  /** Total disk usage of data/ directory */
  totalBytesWritten: number
  /** Whether experiment completed normally */
  completed: boolean
}
