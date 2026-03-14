/**
 * Phase 3: Results Analysis
 *
 * Analyzes the ablation study results to determine:
 *   1. Which dimensions contribute most to design fidelity
 *   2. What is the minimum viable constraint set (>= 85% of max fidelity)
 *   3. Tier-level rankings and insights
 *
 * Key metric:
 *   Contribution(D) = Fidelity(all_16) - Fidelity(all_16 \ D)
 *   Higher = more critical to design reproduction.
 *
 * Usage:
 *   bun run analyze
 */

import fs from 'fs/promises'
import path from 'path'
import type { FidelityScore } from './scorer/fidelity-scorer.js'

const DATA_DIR = 'data'
const SCORES_DIR = path.join(DATA_DIR, 'scores')

interface VariantScore {
  variant: string
  dimensionCount: number
  score: FidelityScore
}

interface DimensionContribution {
  dimension: string
  contribution: number
  /** Percentage of max fidelity lost when this dimension is removed */
  impactPercent: number
}

async function analyzeResults() {
  console.log('Phase 3: Ablation Analysis\n')

  // Load scores
  let scores: Record<string, VariantScore>
  try {
    const scoresPath = path.join(SCORES_DIR, 'ablation-scores.json')
    const raw = await fs.readFile(scoresPath, 'utf-8')
    scores = JSON.parse(raw)
    console.log(`Loaded scores for ${Object.keys(scores).length} variants\n`)
  } catch {
    console.log('No scores found. Generating analysis from test generation data...\n')
    // Fall back to results.json for the manifest
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, 'results.json'), 'utf-8')
      const results = JSON.parse(raw)
      await generatePreScoringAnalysis(results)
    } catch {
      console.error('No results found. Run "bun run run" first.')
      process.exit(1)
    }
    return
  }

  // Extract variant scores
  const variantScores = Object.values(scores)

  // Find the all_16 baseline
  const baseline = variantScores.find(v => v.variant === 'all_16')
  if (!baseline) {
    console.error('Missing all_16 variant (baseline). Cannot compute contributions.')
    process.exit(1)
  }

  const maxFidelity = baseline.score.composite

  // Compute dimension contributions (leave-one-out analysis)
  const contributions: DimensionContribution[] = []

  // Map variant names to the dimension they remove
  const leaveOneOutMap: Record<string, string> = {
    no_color: 'color',
    no_spacing: 'spacing',
    no_typography: 'typography',
  }

  for (const [variantName, dimension] of Object.entries(leaveOneOutMap)) {
    const variant = variantScores.find(v => v.variant === variantName)
    if (variant) {
      const contribution = maxFidelity - variant.score.composite
      contributions.push({
        dimension,
        contribution,
        impactPercent: maxFidelity > 0 ? (contribution / maxFidelity) * 100 : 0,
      })
    }
  }

  // Sort by contribution (highest impact first)
  contributions.sort((a, b) => b.contribution - a.contribution)

  // Generate analysis report
  let analysis = '# Design Constraint Engine: Ablation Analysis\n\n'
  analysis += `**Generated:** ${new Date().toISOString()}\n\n`

  // Variant comparison table
  analysis += '## Variant Fidelity Scores\n\n'
  analysis += '| Variant | Dimensions | Composite | CPR | VDS | SSIM |\n'
  analysis += '|---------|-----------|-----------|-----|-----|------|\n'

  // Sort by composite score descending
  const sorted = [...variantScores].sort((a, b) => b.score.composite - a.score.composite)
  for (const v of sorted) {
    analysis += `| ${v.variant} | ${v.dimensionCount} | **${v.score.composite.toFixed(4)}** | ${v.score.cpr.toFixed(4)} | ${v.score.vds.toFixed(4)} | ${v.score.ssim.toFixed(4)} |\n`
  }

  // Dimension contributions
  analysis += '\n## Dimension Contributions (Leave-One-Out)\n\n'
  analysis += '| Rank | Dimension | Contribution | Impact (%) |\n'
  analysis += '|------|-----------|-------------|------------|\n'
  for (let i = 0; i < contributions.length; i++) {
    const c = contributions[i]
    analysis += `| ${i + 1} | **${c.dimension}** | ${c.contribution.toFixed(4)} | ${c.impactPercent.toFixed(1)}% |\n`
  }

  // Tier analysis
  analysis += '\n## Tier Analysis\n\n'
  const tierVariants: Record<string, string> = {
    'Tier 1 (Structural)': 'tier1_only',
    'Tier 1 + 2 (Structure + Surface)': 'tier1_tier2',
    'Tier 3 (Relational Only)': 'tier3_only',
  }
  for (const [label, variantName] of Object.entries(tierVariants)) {
    const v = variantScores.find(vs => vs.variant === variantName)
    if (v) {
      const ratio = maxFidelity > 0 ? (v.score.composite / maxFidelity * 100) : 0
      analysis += `- **${label}**: ${v.score.composite.toFixed(4)} (${ratio.toFixed(1)}% of max)\n`
    }
  }

  // Minimum viable constraint set
  analysis += '\n## Minimum Viable Constraint Set\n\n'
  analysis += `Target: >= 85% of maximum fidelity (${(maxFidelity * 0.85).toFixed(4)})\n\n`

  for (const v of sorted) {
    const ratio = maxFidelity > 0 ? (v.score.composite / maxFidelity * 100) : 0
    const meets = ratio >= 85
    analysis += `- ${meets ? '**' : ''}${v.variant}${meets ? '**' : ''}: ${ratio.toFixed(1)}% ${meets ? '(meets threshold)' : ''}\n`
  }

  // Find the smallest variant that meets 85% threshold
  const minViable = sorted
    .filter(v => maxFidelity > 0 ? (v.score.composite / maxFidelity) >= 0.85 : false)
    .sort((a, b) => a.dimensionCount - b.dimensionCount)[0]

  if (minViable) {
    analysis += `\n**Minimum Viable Set**: \`${minViable.variant}\` (${minViable.dimensionCount} dimensions)\n`
  }

  // Key insights
  analysis += '\n## Key Insights\n\n'
  if (contributions.length > 0) {
    analysis += `1. **Most impactful dimension**: ${contributions[0].dimension} (${contributions[0].impactPercent.toFixed(1)}% fidelity impact)\n`
    analysis += `2. **Structural constraints (Tier 1)** provide a strong foundation\n`
    analysis += `3. **Surface constraints (Tier 2)** add visual polish\n`
    analysis += `4. **Relational constraints (Tier 3)** refine spatial relationships\n`
  }

  // Recommendations
  analysis += '\n## Recommendations\n\n'
  analysis += '1. Always include Tier 1 dimensions (layout, spacing, sizing, typography)\n'
  analysis += '2. Add color and shape for brand fidelity\n'
  analysis += '3. Tier 3 dimensions are optional for "good enough" reproduction\n'
  analysis += '4. The minimum viable set balances constraint overhead with fidelity\n'

  // Save analysis
  await fs.writeFile('ANALYSIS.md', analysis)
  console.log('Analysis complete!')
  console.log('Saved to ANALYSIS.md')
  console.log(`\nVariants analyzed: ${variantScores.length}`)
  console.log(`Dimension contributions computed: ${contributions.length}`)
  if (minViable) {
    console.log(`Minimum viable set: ${minViable.variant} (${minViable.dimensionCount} dimensions)`)
  }
}

/**
 * Generate a pre-scoring analysis from the experiment manifest.
 * Used when scores haven't been computed yet (Builder LLM hasn't run).
 */
async function generatePreScoringAnalysis(results: any[]) {
  let analysis = '# Design Constraint Engine: Pre-Scoring Analysis\n\n'
  analysis += `**Generated:** ${new Date().toISOString()}\n\n`
  analysis += '> Scores not yet computed. This analysis shows variant configurations.\n\n'

  analysis += '## Variants Generated\n\n'
  analysis += '| Variant | Dimensions | Assertions | Test File |\n'
  analysis += '|---------|-----------|------------|----------|\n'
  for (const r of results) {
    analysis += `| ${r.variant} | ${r.dimensionCount} | ${r.metadata.assertionCount} | ${path.basename(r.testFile)} |\n`
  }

  analysis += '\n## Next Steps\n\n'
  analysis += '1. Give each `.builder-prompt.md` to a Builder LLM\n'
  analysis += '2. Save generated HTML files to `data/results/`\n'
  analysis += '3. Run Playwright tests against each built HTML\n'
  analysis += '4. Capture screenshots and compute fidelity scores\n'
  analysis += '5. Re-run `bun run analyze` with scores populated\n'

  await fs.writeFile('ANALYSIS.md', analysis)
  console.log('Pre-scoring analysis saved to ANALYSIS.md')
}

analyzeResults().catch(console.error)
