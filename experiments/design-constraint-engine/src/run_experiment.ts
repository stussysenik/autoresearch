/**
 * Phase 2: Experiment Runner
 *
 * Orchestrates the ablation study by running each variant through the full pipeline:
 *   1. Load a Blueprint from Phase 1
 *   2. For each ablation variant (dimension subset):
 *      a. Generate Playwright test file with only those dimensions
 *      b. Call Builder LLM to produce HTML/CSS
 *      c. Serve the built HTML and run Playwright tests
 *      d. Capture screenshot of the built output
 *      e. Compute fidelity score (CPR + VDS + SSIM)
 *   3. Collect all scores for Phase 3 analysis
 *
 * Usage:
 *   bun run run
 *   bun run run -- --blueprint data/blueprints/login-card.blueprint.json
 *   bun run run -- --variant all_16  # Run a single variant
 */

import fs from 'fs/promises'
import path from 'path'
import { loadBlueprint } from './analyzer/image-analyzer.js'
import { generateTestFile, generateConstraintSummary } from './generator/test-generator.js'
import { computeFidelityScore, type FidelityScore, saveScores } from './scorer/fidelity-scorer.js'
import { buildWithLLM } from './builder/builder-llm.js'
import { startTestServer } from './executor/test-server.js'
import { runPlaywrightTests } from './executor/test-runner.js'
import { captureScreenshot, closeBrowser } from './utils/screenshot.js'
import { variants, getVariant } from './variants.js'
import type { DimensionName } from './types/blueprint.js'

const DATA_DIR = 'data'
const BLUEPRINTS_DIR = path.join(DATA_DIR, 'blueprints')
const RESULTS_DIR = path.join(DATA_DIR, 'results')
const SCORES_DIR = path.join(DATA_DIR, 'scores')
const TESTS_DIR = 'tests/generated'

interface ExperimentResult {
  variant: string
  dimensions: readonly DimensionName[]
  dimensionCount: number
  testFile: string
  /** Path to Builder LLM's generated HTML */
  builtHtml?: string
  /** Fidelity score (populated after scoring) */
  score?: FidelityScore
  metadata: {
    timestamp: string
    blueprintId: string
    assertionCount: number
  }
}

async function runExperiment() {
  console.log('Phase 2: Ablation Experiment\n')

  // Parse CLI arguments
  const args = process.argv.slice(2)
  const blueprintArg = args.indexOf('--blueprint') !== -1
    ? args[args.indexOf('--blueprint') + 1]
    : null
  const variantArg = args.indexOf('--variant') !== -1
    ? args[args.indexOf('--variant') + 1]
    : null

  // Find blueprint(s) to test
  let blueprintPaths: string[]
  if (blueprintArg) {
    blueprintPaths = [blueprintArg]
  } else {
    await fs.mkdir(BLUEPRINTS_DIR, { recursive: true })
    const files = await fs.readdir(BLUEPRINTS_DIR)
    blueprintPaths = files
      .filter(f => f.endsWith('.blueprint.json'))
      .map(f => path.join(BLUEPRINTS_DIR, f))
  }

  if (blueprintPaths.length === 0) {
    console.log('No blueprints found. Run "bun run fetch" first.')
    process.exit(1)
  }

  // Select variants to run
  const selectedVariants = variantArg
    ? [getVariant(variantArg)].filter(Boolean)
    : variants

  if (selectedVariants.length === 0) {
    console.error(`Unknown variant: ${variantArg}`)
    console.error('Available:', variants.map(v => v.name).join(', '))
    process.exit(1)
  }

  // Ensure output directories exist
  await fs.mkdir(RESULTS_DIR, { recursive: true })
  await fs.mkdir(SCORES_DIR, { recursive: true })
  await fs.mkdir(TESTS_DIR, { recursive: true })

  const allResults: ExperimentResult[] = []
  const allScores: Record<string, { variant: string; dimensionCount: number; score: FidelityScore }> = {}

  // Process each blueprint
  for (const bpPath of blueprintPaths) {
    console.log(`\nBlueprint: ${path.basename(bpPath)}`)
    console.log('═'.repeat(50))

    const blueprint = await loadBlueprint(bpPath)
    const viewport = blueprint.source.viewport

    // Find the original design screenshot for visual comparison
    const originalPng = path.join(
      'data/input',
      blueprint.id + '.png',
    )

    // Run each variant
    for (const variant of selectedVariants) {
      if (!variant) continue

      console.log(`\n  Variant: ${variant.name}`)
      console.log(`  Dimensions: ${variant.dimensions.length} (${variant.dimensions.join(', ')})`)
      console.log(`  Purpose: ${variant.purpose}`)
      console.log('  ' + '─'.repeat(46))

      const prefix = `${blueprint.id}-${variant.name}`

      // Step 1: Generate test file
      const testFileName = `${prefix}.spec.ts`
      const testFilePath = path.join(TESTS_DIR, testFileName)
      const testCode = await generateTestFile(blueprint, variant.dimensions, testFilePath)

      // Step 2: Generate constraint summary (supplementary for Builder LLM)
      const summary = generateConstraintSummary(blueprint, variant.dimensions)
      const summaryPath = path.join(RESULTS_DIR, `${prefix}.constraints.md`)
      await fs.writeFile(summaryPath, summary)

      // Count assertions
      const assertionCount = (testCode.match(/expect\(/g) || []).length
      console.log(`  Generated: ${testFileName} (${assertionCount} assertions)`)

      // Step 3: Call Builder LLM to produce HTML
      const htmlPath = path.join(RESULTS_DIR, `${prefix}.html`)
      let builtHtml: string
      try {
        builtHtml = await buildWithLLM(testCode, summary, viewport)
        await Bun.write(htmlPath, builtHtml)
        console.log(`  Built HTML saved: ${htmlPath}`)
      } catch (error) {
        console.error(`  Builder LLM failed for ${variant.name}:`, error)
        // Save the prompt as fallback for manual retry
        const builderPromptPath = path.join(RESULTS_DIR, `${prefix}.builder-prompt.md`)
        await fs.writeFile(builderPromptPath, generateFallbackPrompt(testCode, summary, viewport))
        console.log(`  Fallback prompt saved to: ${builderPromptPath}`)
        allResults.push({
          variant: variant.name,
          dimensions: variant.dimensions,
          dimensionCount: variant.dimensions.length,
          testFile: testFilePath,
          metadata: { timestamp: new Date().toISOString(), blueprintId: blueprint.id, assertionCount },
        })
        continue
      }

      // Step 4: Serve built HTML + run Playwright tests
      const server = startTestServer(htmlPath, 3000)
      let testResultsPath: string
      try {
        const testResult = await runPlaywrightTests(testFilePath, RESULTS_DIR)
        testResultsPath = testResult.resultsPath
      } catch (error) {
        console.error(`  Test runner failed for ${variant.name}:`, error)
        server.stop()
        allResults.push({
          variant: variant.name,
          dimensions: variant.dimensions,
          dimensionCount: variant.dimensions.length,
          testFile: testFilePath,
          builtHtml: htmlPath,
          metadata: { timestamp: new Date().toISOString(), blueprintId: blueprint.id, assertionCount },
        })
        continue
      }
      server.stop()

      // Step 5: Capture screenshot of built HTML for visual comparison
      const builtPngPath = path.join(RESULTS_DIR, `${prefix}.built.png`)
      await captureScreenshot(`file://${path.resolve(htmlPath)}`, builtPngPath, viewport)

      // Step 6: Compute fidelity score
      const diffPath = path.join(RESULTS_DIR, `${prefix}.diff.png`)
      let score: FidelityScore | undefined
      try {
        score = await computeFidelityScore(testResultsPath, originalPng, builtPngPath, diffPath)
        console.log(`  Fidelity: ${score.composite} (CPR=${score.cpr}, VDS=${score.vds}, SSIM=${score.ssim})`)
        allScores[variant.name] = {
          variant: variant.name,
          dimensionCount: variant.dimensions.length,
          score,
        }
      } catch (error) {
        console.error(`  Scoring failed for ${variant.name}:`, error)
      }

      allResults.push({
        variant: variant.name,
        dimensions: variant.dimensions,
        dimensionCount: variant.dimensions.length,
        testFile: testFilePath,
        builtHtml: htmlPath,
        score,
        metadata: {
          timestamp: new Date().toISOString(),
          blueprintId: blueprint.id,
          assertionCount,
        },
      })
    }
  }

  // Save results manifest
  const resultsPath = path.join(DATA_DIR, 'results.json')
  await fs.writeFile(resultsPath, JSON.stringify(allResults, null, 2))

  // Save scores for Phase 3
  if (Object.keys(allScores).length > 0) {
    await saveScores(allScores, path.join(SCORES_DIR, 'ablation-scores.json'))
  }

  // Clean up browser
  await closeBrowser()

  console.log('\n' + '═'.repeat(50))
  console.log('Phase 2 complete!')
  console.log(`Processed ${allResults.length} variants`)
  console.log(`Scored ${Object.keys(allScores).length} variants`)
  console.log(`Results manifest: ${resultsPath}`)
  if (Object.keys(allScores).length > 0) {
    console.log(`Scores: ${SCORES_DIR}/ablation-scores.json`)
    console.log('\nNext: bun run analyze')
  }
}

/**
 * Fallback prompt for manual retry when the Builder LLM API call fails.
 * Saved as .builder-prompt.md so the user can manually feed it to an LLM.
 */
function generateFallbackPrompt(
  testCode: string,
  constraintSummary: string,
  viewport: { width: number; height: number },
): string {
  return `# Build a UI that passes these Playwright tests

You are a frontend developer. Build a single HTML file (with inline CSS) that passes ALL of the following Playwright tests.

## Requirements
- Single HTML file with all CSS inline in a <style> tag
- Viewport: ${viewport.width}x${viewport.height}px
- Use data-testid attributes as specified in the test selectors
- Use exact CSS values that match the test expectations
- No external dependencies (fonts can be system fonts)

## Playwright Test File

\`\`\`typescript
${testCode}
\`\`\`

## Design Constraint Summary

${constraintSummary}

## Output Format

Return ONLY the complete HTML file. No explanation, no markdown wrapping.
Start with <!DOCTYPE html> and end with </html>.`
}

runExperiment().catch(console.error)
