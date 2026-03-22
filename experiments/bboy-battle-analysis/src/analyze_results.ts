/**
 * Phase 6: Compile Morning Report
 *
 * Reads all research .md files from data/results/ and sends them to claude -p
 * for compilation into a single comprehensive ANALYSIS.md report.
 */

import fs from 'fs/promises'
import path from 'path'
import { research } from './llm.js'
import { loadState, saveState } from './checkpoint.js'

const RESULTS_DIR = path.join(import.meta.dir, '..', 'data', 'results')
const ANALYSIS_PATH = path.join(import.meta.dir, '..', 'ANALYSIS.md')

function timestamp(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║  Phase 6: Compile Morning Report                 ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  // Read all research artifacts
  let files: string[]
  try {
    files = (await fs.readdir(RESULTS_DIR))
      .filter(f => f.endsWith('.md'))
      .sort()
  } catch {
    console.error('No results directory found. Nothing to analyze.')
    process.exit(1)
  }

  if (files.length === 0) {
    console.error('No research artifacts found in data/results/.')
    process.exit(1)
  }

  console.log(`Found ${files.length} research artifacts:`)
  for (const f of files) {
    const stats = await fs.stat(path.join(RESULTS_DIR, f))
    console.log(`  - ${f} (${(stats.size / 1024).toFixed(1)} KB)`)
  }

  // Gather all research content
  const allResearch: string[] = []
  let totalBytes = 0
  for (const file of files) {
    const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8')
    allResearch.push(`\n\n========== ${file} ==========\n\n${content}`)
    totalBytes += Buffer.byteLength(content)
  }

  console.log(`\nTotal research: ${(totalBytes / 1024).toFixed(1)} KB across ${files.length} files`)

  // Build context — truncate if needed to stay within reasonable token limits
  let researchContext = allResearch.join('')
  // v2: Per-section compilation to avoid massive single prompt
  // Group files by phase for targeted compilation
  const phaseGroups: Record<string, string[]> = {}
  for (const file of files) {
    const phase = file.match(/^(phase-\d+)/)?.[1] || 'misc'
    if (!phaseGroups[phase]) phaseGroups[phase] = []
    phaseGroups[phase].push(file)
  }

  const state = await loadState()
  const statePhases = Object.values(state.phases)
  const completed = statePhases.filter(p => p.status === 'complete').length
  const failed = statePhases.filter(p => p.status === 'failed').length
  const totalArtifacts = statePhases.reduce((sum, p) => sum + p.artifacts.length, 0)

  const sectionNames: Record<string, string> = {
    'phase-0': 'Research Landscape & Seed Discovery',
    'phase-1': 'Mathematical Foundation (TRIVIUM Scoring, Physics, Movement Spectrogram)',
    'phase-2': 'Visualization Engine (Blender, UE5, Godot, Unity, Three.js, Creative Modes)',
    'phase-3': 'Data Model & Universal Skeleton Format',
    'phase-4': 'Architecture & Integration (Pipeline, MATLAB Port, iPhone)',
    'phase-5': 'Creative Exploration (AR/VR, Coaching, Generative Art)',
  }

  console.log(`\nCompiling ${Object.keys(phaseGroups).length} sections...`)

  const compiledSections: string[] = []
  const startTime = Date.now()

  for (const [phase, phaseFiles] of Object.entries(phaseGroups).sort()) {
    const sectionTitle = sectionNames[phase] || phase
    console.log(`  [${timestamp()}] Compiling: ${sectionTitle}...`)

    // Gather content for this section
    let sectionContent = ''
    for (const file of phaseFiles) {
      const content = await fs.readFile(path.join(RESULTS_DIR, file), 'utf-8')
      sectionContent += `\n\n--- ${file} ---\n${content}`
    }

    // Truncate if needed
    if (sectionContent.length > 80_000) {
      sectionContent = sectionContent.slice(0, 80_000)
    }

    const sectionPrompt = `You are compiling research findings into a section of a technical report.

## Section: ${sectionTitle}

## Source Research

${sectionContent}

## Task

Write a comprehensive, well-structured section for this topic. Include:
- All mathematical formulations and proofs (preserve LaTeX notation)
- Architecture diagrams (mermaid or ASCII)
- Comparison tables where applicable
- Specific model/library recommendations with justification
- Code snippets where helpful

Use markdown. Be thorough — preserve the depth of the source research.`

    try {
      const section = await research(sectionPrompt, 900_000)
      compiledSections.push(`## ${sectionTitle}\n\n${section}`)
      console.log(`  [${timestamp()}] Done (${(section.length / 1024).toFixed(1)} KB)`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [${timestamp()}] Section compilation failed: ${msg}`)
      // Include raw content as fallback
      compiledSections.push(`## ${sectionTitle}\n\n*[Compilation failed — raw research below]*\n\n${sectionContent.slice(0, 20_000)}`)
    }
  }

  // Final stitch: executive summary + all sections
  console.log(`\n[${timestamp()}] Stitching final report with executive summary...`)

  const stitchPrompt = `You are writing the executive summary for a technical report on a breakdancing analysis + visualization system.

## Sections Already Compiled

${compiledSections.map(s => s.slice(0, 500) + '...\n').join('\n')}

## Task

Write:
1. **Executive Summary** (3-5 paragraphs): Key findings across all sections, recommended approach, critical insights
2. **Table of Contents**: Linking to each section
3. **Open Questions & Next Steps**: Aggregated across all sections
4. **Appendix**: Research methodology (${completed} phases, ${totalArtifacts} artifacts, ${(totalBytes / 1024).toFixed(1)} KB)

Keep the executive summary high-level. The sections have the detail.`

  try {
    const wrapper = await research(stitchPrompt, 600_000)
    const report = wrapper + '\n\n---\n\n' + compiledSections.join('\n\n---\n\n')
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[${timestamp()}] Got report in ${elapsed}s (${report.length} chars)`)

    // Write the final analysis
    const header = `<!--
  Breakdancing Battle Analysis System: SOTA Architecture Report
  Generated: ${new Date().toISOString()}
  Research Duration: ${((Date.now() - new Date(state.startedAt).getTime()) / 3_600_000).toFixed(1)} hours
  Phases Completed: ${completed}/${statePhases.length}
  Total Artifacts: ${totalArtifacts} documents
-->\n\n`

    await fs.writeFile(ANALYSIS_PATH, header + report)
    console.log(`\nReport saved to ANALYSIS.md (${(Buffer.byteLength(header + report) / 1024).toFixed(1)} KB)`)

    // Mark experiment as completed
    state.completed = true
    await saveState(state)

    // Print summary stats
    console.log('\n══════════════════════════════════════════════════')
    console.log('  EXPERIMENT COMPLETE')
    console.log('══════════════════════════════════════════════════')
    console.log(`  Phases: ${completed}/${phases.length} completed${failed > 0 ? `, ${failed} failed` : ''}`)
    console.log(`  Artifacts: ${totalArtifacts} research documents`)
    console.log(`  Report: ANALYSIS.md (${(Buffer.byteLength(header + report) / 1024).toFixed(1)} KB)`)
    console.log(`  Total data: ${(state.totalBytesWritten / 1024).toFixed(1)} KB`)
    console.log('══════════════════════════════════════════════════\n')
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`\nCompilation failed: ${msg}`)
    console.error('Research artifacts are preserved in data/results/ for manual review.')
    process.exit(1)
  }
}

main()
