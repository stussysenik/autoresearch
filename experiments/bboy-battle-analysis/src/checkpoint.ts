/**
 * Checkpoint/resume engine.
 *
 * Persists experiment state to JSON so the pipeline can survive interruptions
 * and resume from where it left off.
 *
 * Run with --status flag for a progress summary:
 *   bun run src/checkpoint.ts --status
 */

import fs from 'fs/promises'
import path from 'path'
import type { Checkpoint, ExperimentState, PhaseStatus } from './types.js'

const DATA_DIR = path.join(import.meta.dir, '..', 'data')
const MANIFEST_PATH = path.join(DATA_DIR, 'manifest.json')
const CHECKPOINTS_DIR = path.join(DATA_DIR, 'checkpoints')

/**
 * Load experiment state from manifest.json.
 * If manifest is missing/corrupt, reconstructs from individual checkpoint files.
 */
export async function loadState(): Promise<ExperimentState> {
  try {
    const raw = await fs.readFile(MANIFEST_PATH, 'utf-8')
    return JSON.parse(raw) as ExperimentState
  } catch {
    // Try to reconstruct from individual checkpoint files
    const state: ExperimentState = {
      experimentId: `bboy-${Date.now()}`,
      startedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      phases: {},
      totalBytesWritten: 0,
      completed: false,
    }

    try {
      const files = await fs.readdir(CHECKPOINTS_DIR)
      for (const file of files) {
        if (file.endsWith('.checkpoint.json')) {
          const raw = await fs.readFile(path.join(CHECKPOINTS_DIR, file), 'utf-8')
          const cp = JSON.parse(raw) as Checkpoint
          state.phases[cp.phaseId] = cp
        }
      }
    } catch {
      // No checkpoints exist yet — fresh start
    }

    return state
  }
}

/**
 * Save experiment state to manifest.json and the individual checkpoint file.
 */
export async function saveState(state: ExperimentState): Promise<void> {
  state.lastUpdated = new Date().toISOString()
  await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true })
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(state, null, 2))
}

/**
 * Update a single phase's checkpoint and persist to both manifest and individual file.
 */
export async function saveCheckpoint(
  state: ExperimentState,
  phaseId: string,
  update: Partial<Checkpoint>,
): Promise<void> {
  const existing = state.phases[phaseId] || createEmptyCheckpoint(phaseId)
  state.phases[phaseId] = { ...existing, ...update }

  // Save individual checkpoint file
  await fs.mkdir(CHECKPOINTS_DIR, { recursive: true })
  await fs.writeFile(
    path.join(CHECKPOINTS_DIR, `${phaseId}.checkpoint.json`),
    JSON.stringify(state.phases[phaseId], null, 2),
  )

  // Save master manifest
  await saveState(state)
}

/**
 * Check if a phase is already complete (for resume logic).
 */
export function isPhaseComplete(state: ExperimentState, phaseId: string): boolean {
  return state.phases[phaseId]?.status === 'complete'
}

/**
 * Create an empty checkpoint for a phase.
 */
export function createEmptyCheckpoint(phaseId: string): Checkpoint {
  return {
    phaseId,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    followupsCompleted: 0,
    artifacts: [],
    bytesWritten: 0,
  }
}

// CLI mode: --status flag
if (process.argv.includes('--status')) {
  const state = await loadState()
  console.log(`\n=== Experiment Status ===`)
  console.log(`ID: ${state.experimentId}`)
  console.log(`Started: ${state.startedAt}`)
  console.log(`Last Updated: ${state.lastUpdated}`)
  console.log(`Completed: ${state.completed}`)
  console.log(`Total Bytes Written: ${(state.totalBytesWritten / 1024).toFixed(1)} KB`)
  console.log(`\nPhases:`)

  const phases = Object.values(state.phases)
  if (phases.length === 0) {
    console.log('  No phases started yet.')
  } else {
    for (const p of phases) {
      const icon = p.status === 'complete' ? '✓' : p.status === 'in_progress' ? '…' : p.status === 'failed' ? '✗' : '○'
      console.log(`  ${icon} ${p.phaseId}: ${p.status} (${p.artifacts.length} artifacts, ${p.followupsCompleted} followups)`)
      if (p.error) console.log(`    Error: ${p.error}`)
    }
  }
  console.log()
}
