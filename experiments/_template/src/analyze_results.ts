import fs from 'fs/promises'

/**
 * Results Analyzer
 *
 * Analyzes experiment results and generates summary report
 */

interface ExperimentResult {
  variant: string
  inputId: string
  input: any
  output: any
  metadata: any
}

async function analyzeResults() {
  console.log('📊 Analyzing experiment results...\n')

  // Load results
  let results: ExperimentResult[]
  try {
    const raw = await fs.readFile('data/results.json', 'utf-8')
    results = JSON.parse(raw)
    console.log(`✅ Loaded ${results.length} results\n`)
  } catch (error) {
    console.error('❌ Error loading results:', error)
    console.error('Run "bun run run" first to generate data/results.json')
    process.exit(1)
  }

  // Group results by variant
  const byVariant = new Map<string, ExperimentResult[]>()
  for (const result of results) {
    if (!byVariant.has(result.variant)) {
      byVariant.set(result.variant, [])
    }
    byVariant.get(result.variant)!.push(result)
  }

  // Generate analysis
  let analysis = '# Experiment Analysis\n\n'
  analysis += `**Generated:** ${new Date().toISOString()}\n\n`
  analysis += `**Total Results:** ${results.length}\n`
  analysis += `**Variants Tested:** ${byVariant.size}\n\n`

  analysis += '---\n\n'

  // Analyze each variant
  for (const [variantName, variantResults] of byVariant.entries()) {
    analysis += `## Variant: ${variantName}\n\n`
    analysis += `**Count:** ${variantResults.length} results\n\n`

    // Customize metrics for your experiment
    // Example: Count outputs, unique values, etc.

    const outputs = variantResults.map(r => r.output)
    const uniqueOutputs = new Set(outputs.map(o => JSON.stringify(o))).size

    analysis += `**Metrics:**\n`
    analysis += `- Total outputs: ${outputs.length}\n`
    analysis += `- Unique outputs: ${uniqueOutputs}\n`
    analysis += `- Consistency: ${((uniqueOutputs / outputs.length) * 100).toFixed(1)}%\n\n`

    // Sample output
    analysis += `**Sample Output:**\n\`\`\`json\n${JSON.stringify(outputs[0], null, 2)}\n\`\`\`\n\n`

    analysis += '---\n\n'
  }

  // Add recommendations section
  analysis += '## Recommendations\n\n'
  analysis += '1. [Review results and identify best-performing variant]\n'
  analysis += '2. [Consider edge cases or outliers]\n'
  analysis += '3. [Propose next steps or production integration]\n\n'

  analysis += '---\n\n'
  analysis += '## Next Steps\n\n'
  analysis += '- [ ] Review full results in `data/results.json`\n'
  analysis += '- [ ] Manually inspect sample outputs for quality\n'
  analysis += '- [ ] Update recommendations based on findings\n'
  analysis += '- [ ] Create integration guide if applicable\n'

  // Save analysis
  await fs.writeFile('ANALYSIS.md', analysis)

  console.log('✅ Analysis complete!')
  console.log('📄 Saved to ANALYSIS.md')
  console.log('\nSummary:')
  console.log(`- ${byVariant.size} variants tested`)
  console.log(`- ${results.length} total results`)
  console.log('\nOpen ANALYSIS.md to review findings.')
}

analyzeResults().catch(console.error)
