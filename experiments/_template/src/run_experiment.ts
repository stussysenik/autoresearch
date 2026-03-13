import fs from 'fs/promises'
import { variants, fillTemplate } from './variants.js'

/**
 * Experiment Runner
 *
 * Orchestrates the experiment by:
 * 1. Loading input data
 * 2. Processing each item with each variant
 * 3. Saving results to JSON
 */

interface InputData {
  id: string
  [key: string]: any
}

interface ExperimentResult {
  variant: string
  inputId: string
  input: any
  output: any
  metadata: {
    timestamp: string
    processingNote: string
  }
}

async function runExperiment() {
  console.log('🔬 Running experiment...\n')

  // Load input data
  let inputData: InputData[]
  try {
    const raw = await fs.readFile('data/input.json', 'utf-8')
    inputData = JSON.parse(raw)
    console.log(`✅ Loaded ${inputData.length} items from data/input.json\n`)
  } catch (error) {
    console.error('❌ Error loading input data:', error)
    console.error('Run "bun run fetch" first to generate data/input.json')
    process.exit(1)
  }

  // Initialize results
  const results: ExperimentResult[] = []

  // Process each variant
  for (const variant of variants) {
    console.log(`\n=== Variant: ${variant.name} ===`)
    console.log(`Description: ${variant.description}\n`)

    // Subsample data (start with first 5 items)
    const sample = inputData.slice(0, 5)

    for (const item of sample) {
      console.log(`\n--- Processing item ${item.id} ---`)

      if (variant.prompt) {
        // Fill template with data
        const filledPrompt = fillTemplate(variant.prompt, {
          content: item.content || '',
          title: item.title || '',
          // Add more fields as needed
        })

        console.log(`Prompt:\n${filledPrompt}\n`)
        console.log('⏸️  [Manual Step] Use Claude Code to:')
        console.log('   1. Process this prompt')
        console.log('   2. Generate output')
        console.log('   3. Continue to save results\n')

        // Placeholder for manual execution
        // In a real experiment, you would:
        // - Call an LLM API here
        // - Or pause for manual Claude Code execution
        // - Then collect the output

        const output = {
          // Placeholder - replace with actual output
          generated: 'OUTPUT_HERE',
          timestamp: new Date().toISOString(),
        }

        results.push({
          variant: variant.name,
          inputId: item.id,
          input: {
            id: item.id,
            content: item.content?.substring(0, 100) + '...',
            title: item.title,
          },
          output,
          metadata: {
            timestamp: new Date().toISOString(),
            processingNote: 'Manual processing via Claude Code',
          },
        })
      }
    }
  }

  // Save results
  await fs.mkdir('data', { recursive: true })
  await fs.writeFile(
    'data/results.json',
    JSON.stringify(results, null, 2)
  )

  console.log('\n✅ Experiment complete!')
  console.log(`📊 Saved ${results.length} results to data/results.json`)
  console.log('\nNext steps:')
  console.log('1. Review results in data/results.json')
  console.log('2. Run "bun run analyze" to generate analysis')
}

runExperiment().catch(console.error)
