import fs from 'fs/promises'

/**
 * Results Analysis for Pi-Config Experiment
 */

interface Result {
  variant: string
  inputId: string
  input: any
  output: string
  metadata: {
    timestamp: string
    processingNote: string
    model: string
  }
}

async function analyzeResults() {
  console.log('📊 Analyzing experiment results...\n')

  try {
    const raw = await fs.readFile('data/results.json', 'utf-8')
    const results: Result[] = JSON.parse(raw)

    let analysis = `# Gemma 4 Pi-Config Analysis Report\n\n`
    analysis += `**Total items processed:** ${results.length}\n`
    analysis += `**Timestamp:** ${new Date().toLocaleString()}\n\n`

    const variants = [...new Set(results.map(r => r.variant))]

    for (const variant of variants) {
      const variantResults = results.filter(r => r.variant === variant)
      analysis += `## Variant: ${variant}\n`
      analysis += `**Description:** ${variantResults[0]?.metadata.processingNote || variant}\n\n`

      for (const res of variantResults) {
        analysis += `### Analysis of Pi-Config Whitepaper\n`
        analysis += `${res.output}\n\n`
        analysis += `---\n\n`
      }
    }

    await fs.writeFile('ANALYSIS.md', analysis)
    console.log('✅ Analysis complete! Saved to ANALYSIS.md')

  } catch (error) {
    console.error('❌ Error analyzing results:', error)
  }
}

analyzeResults().catch(console.error)
