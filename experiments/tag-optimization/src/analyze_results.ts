/**
 * Results Analysis for Tag Optimization Experiment
 *
 * Analyzes generated tags across 4 prompt variants to identify:
 * - Tag quality (accuracy, discoverability, vibe appropriateness)
 * - Lexical category distribution
 * - Best-performing prompt variant
 */

import { readFileSync, writeFileSync } from 'fs'
import path from 'path'

interface TagResult {
  cardId: string
  cardTitle: string | null
  platform: string
  currentTags: string[]
  promptVariant: string
  generatedTags: string[]
  reasoning?: string
  error?: string
}

/**
 * Analyze lexical categories in tags
 */
function analyzeLexicalCategories(tags: string[]): {
  namedEntities: number
  concepts: number
  adjectives: number
  compounds: number
} {
  const categories = {
    namedEntities: 0,
    concepts: 0,
    adjectives: 0,
    compounds: 0
  }

  const vibeVocab = new Set([
    'kinetic', 'atmospheric', 'minimalist', 'raw', 'nostalgic', 'elegant',
    'chaotic', 'ethereal', 'tactile', 'visceral', 'contemplative', 'playful',
    'precise', 'organic', 'geometric', 'luminous', 'textural', 'rhythmic',
    'fluid', 'stark', 'delicate', 'bold', 'surreal', 'meditative', 'dynamic'
  ])

  for (const tag of tags) {
    if (tag.includes('-')) {
      categories.compounds++
    }

    if (vibeVocab.has(tag)) {
      categories.adjectives++
    } else if (!tag.includes('-')) {
      categories.concepts++
    } else {
      categories.namedEntities++
    }
  }

  return categories
}

/**
 * Count vibe tag usage
 */
function analyzeVibeUsage(tags: string[]): Record<string, number> {
  const vibeVocab = [
    'kinetic', 'atmospheric', 'minimalist', 'raw', 'nostalgic', 'elegant',
    'chaotic', 'ethereal', 'tactile', 'visceral', 'contemplative', 'playful',
    'precise', 'organic', 'geometric', 'luminous', 'textural', 'rhythmic',
    'fluid', 'stark', 'delicate', 'bold', 'surreal', 'meditative', 'dynamic'
  ]

  const usage: Record<string, number> = {}
  vibeVocab.forEach(vibe => usage[vibe] = 0)

  for (const tag of tags) {
    if (vibeVocab.includes(tag)) {
      usage[tag]++
    }
  }

  return usage
}

/**
 * Main analysis function
 */
function analyzeResults() {
  console.log('Analyzing Tag Optimization Results\n')
  console.log('='.repeat(80) + '\n')

  const resultsPath = path.join(import.meta.dir, '..', 'data', 'results.json')

  let results: TagResult[]
  try {
    results = JSON.parse(readFileSync(resultsPath, 'utf-8'))
  } catch {
    console.error('data/results.json not found. Run the experiment first.')
    process.exit(1)
  }

  // Group by prompt variant
  const variantGroups: Record<string, TagResult[]> = {
    baseline: [],
    lexical: [],
    cot: [],
    platform: []
  }

  for (const result of results) {
    if (variantGroups[result.promptVariant]) {
      variantGroups[result.promptVariant].push(result)
    }
  }

  const analysisReport: string[] = []
  analysisReport.push('# Tag Optimization Experiment - Results Analysis\n')
  analysisReport.push(`**Date:** ${new Date().toISOString().split('T')[0]}`)
  analysisReport.push(`**Total Results:** ${results.length}`)
  analysisReport.push(`**Cards Tested:** ${results.length / 4}\n`)
  analysisReport.push('---\n')

  for (const [variantName, variantResults] of Object.entries(variantGroups)) {
    if (variantResults.length === 0) continue

    analysisReport.push(`\n## Variant: ${variantName.toUpperCase()}\n`)

    const allTags = variantResults.flatMap(r => r.generatedTags || [])
    const uniqueTags = new Set(allTags)
    const avgTagsPerCard = allTags.length / variantResults.length

    analysisReport.push(`- **Total tags generated:** ${allTags.length}`)
    analysisReport.push(`- **Unique tags:** ${uniqueTags.size}`)
    analysisReport.push(`- **Average per card:** ${avgTagsPerCard.toFixed(1)}`)
    analysisReport.push(`- **Tag reuse rate:** ${((1 - uniqueTags.size / allTags.length) * 100).toFixed(1)}%\n`)

    const categories = analyzeLexicalCategories(allTags)
    analysisReport.push('**Lexical Category Distribution:**')
    analysisReport.push(`- Named Entities/Compounds: ${categories.namedEntities + categories.compounds}`)
    analysisReport.push(`- Concepts: ${categories.concepts}`)
    analysisReport.push(`- Quality/Vibe Tags: ${categories.adjectives}\n`)

    const vibeUsage = analyzeVibeUsage(allTags)
    const topVibes = Object.entries(vibeUsage)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    if (topVibes.length > 0) {
      analysisReport.push('**Top 5 Vibe Tags:**')
      topVibes.forEach(([vibe, count]) => {
        analysisReport.push(`- ${vibe}: ${count}`)
      })
      analysisReport.push('')
    }

    analysisReport.push('**Sample Generated Tags:**')
    variantResults.slice(0, 3).forEach((result, i) => {
      analysisReport.push(`${i + 1}. [${result.platform}] "${result.cardTitle || 'Untitled'}"`)
      analysisReport.push(`   - Generated: [${result.generatedTags.join(', ')}]`)
      analysisReport.push(`   - Original:  [${result.currentTags.join(', ')}]`)
      if (result.reasoning) {
        analysisReport.push(`   - Reasoning: ${result.reasoning.slice(0, 100)}...`)
      }
      analysisReport.push('')
    })

    analysisReport.push('---\n')
  }

  // Comparative summary
  analysisReport.push('\n## Comparative Summary\n')
  analysisReport.push('| Variant | Total Tags | Unique | Avg/Card | Quality Tags | Reuse Rate |')
  analysisReport.push('|---------|------------|--------|----------|--------------|------------|')

  for (const [variantName, variantResults] of Object.entries(variantGroups)) {
    if (variantResults.length === 0) continue

    const allTags = variantResults.flatMap(r => r.generatedTags || [])
    const uniqueTags = new Set(allTags)
    const avgTagsPerCard = allTags.length / variantResults.length
    const categories = analyzeLexicalCategories(allTags)
    const reuseRate = ((1 - uniqueTags.size / allTags.length) * 100).toFixed(1)

    analysisReport.push(
      `| ${variantName} | ${allTags.length} | ${uniqueTags.size} | ${avgTagsPerCard.toFixed(1)} | ${categories.adjectives} | ${reuseRate}% |`
    )
  }

  analysisReport.push('\n---\n')

  analysisReport.push('\n## Recommendations\n')
  analysisReport.push('**TODO: Fill in after manual quality review**\n')
  analysisReport.push('1. **Best Performing Variant:** TBD')
  analysisReport.push('2. **Strengths:** TBD')
  analysisReport.push('3. **Weaknesses:** TBD')
  analysisReport.push('4. **Suggested Improvements:** TBD')
  analysisReport.push('5. **Production Integration Plan:** TBD\n')

  // Write analysis
  const analysisPath = path.join(import.meta.dir, '..', 'ANALYSIS.md')
  writeFileSync(analysisPath, analysisReport.join('\n'))

  console.log(analysisReport.join('\n'))
  console.log(`\nAnalysis saved to ANALYSIS.md`)
}

if (import.meta.main) {
  analyzeResults()
}

export { analyzeResults }
