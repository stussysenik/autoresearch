import fs from 'fs/promises'
import { variants, fillTemplate } from './variants.js'
import OpenAI from 'openai'
import 'dotenv/config'

/**
 * Experiment Runner for LM Studio / Gemma 4
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
    model: string
  }
}

async function runExperiment() {
  console.log('🔬 Running experiment with LM Studio / Gemma 4...\n')

  // Configure OpenAI client for LM Studio
  // Try to use environment variable or empty string if not provided
  const apiKey = process.env.LM_STUDIO_API_KEY || 'lm-studio' 
  
  const client = new OpenAI({
    baseURL: 'http://localhost:1234/v1',
    apiKey: apiKey,
  })

  // Load input data
  let inputData: InputData[]
  try {
    const raw = await fs.readFile('data/input.json', 'utf-8')
    inputData = JSON.parse(raw)
    console.log(`✅ Loaded ${inputData.length} items from data/input.json\n`)
  } catch (error) {
    console.error('❌ Error loading input data:', error)
    process.exit(1)
  }

  // Initialize results
  const results: ExperimentResult[] = []

  // Process each variant
  for (const variant of variants) {
    console.log(`\n=== Variant: ${variant.name} ===`)
    console.log(`Description: ${variant.description}\n`)

    for (const item of inputData) {
      console.log(`\n--- Processing item ${item.id} ---`)

      if (variant.prompt) {
        // Fill template with data
        const filledPrompt = fillTemplate(variant.prompt, {
          content: item.content || '',
          context: item.context || '',
          title: item.title || '',
        })

        console.log(`Calling LM Studio API for ${variant.name}...`)

        try {
          const response = await client.chat.completions.create({
            model: variant.model || 'gemma-4',
            messages: [
              { role: 'user', content: filledPrompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          })

          const outputContent = response.choices[0]?.message?.content || 'NO_OUTPUT'
          console.log(`✅ Received output for ${variant.name} (${outputContent.length} chars)`)

          results.push({
            variant: variant.name,
            inputId: item.id,
            input: {
              id: item.id,
              contentSnippet: item.content?.substring(0, 100) + '...',
              title: item.title,
            },
            output: outputContent,
            metadata: {
              timestamp: new Date().toISOString(),
              processingNote: 'Automated processing via LM Studio API',
              model: variant.model || 'gemma-4',
            },
          })
        } catch (error: any) {
          console.error(`❌ Error calling LM Studio API for ${variant.name}:`, error.message)
          
          if (error.status === 401) {
            console.log('⚠️ Authentication Error: Check your LM Studio API Key.')
            console.log('Ensure LM Studio > Local Server > API Key is set and matches.')
          }

          results.push({
            variant: variant.name,
            inputId: item.id,
            input: item,
            output: `ERROR: ${error.message}`,
            metadata: {
              timestamp: new Date().toISOString(),
              processingNote: 'API Error',
              model: variant.model || 'gemma-4',
            },
          })
        }
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
}

runExperiment().catch(console.error)
