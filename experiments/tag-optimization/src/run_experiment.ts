/**
 * Tag Optimization Experiment Runner
 *
 * Processes test cards through 4 prompt variants to determine
 * which produces the best quality tags for cross-disciplinary discovery.
 */

import { readFileSync, writeFileSync } from 'fs'
import path from 'path'
import { variants, fillTemplate, type Variant } from './variants'

interface Card {
  id: string
  type: string
  title: string | null
  content: string | null
  url: string | null
  image_url: string | null
  metadata: any
  tags: string[]
  created_at: string
}

interface TagResult {
  cardId: string
  cardTitle: string | null
  platform: string
  currentTags: string[]
  promptVariant: string
  generatedTags: string[]
  reasoning?: string
  rawResponse?: string
  error?: string
  categories?: {
    entity?: string
    concepts?: string[]
    quality?: string
    action?: string | null
  }
  step1_essence?: string
  step2_fields?: string
  step3_quality?: string
  confidence?: number
  platform_context?: string
}

async function runExperiment() {
  console.log('Starting Tag Optimization Experiment\n')

  const inputPath = path.join(import.meta.dir, '..', 'data', 'input.json')

  let testCards: Card[]
  try {
    testCards = JSON.parse(readFileSync(inputPath, 'utf-8'))
  } catch {
    console.error('data/input.json not found. Run `bun run fetch` first.')
    process.exit(1)
  }

  console.log(`Loaded ${testCards.length} test cards\n`)

  // Limit to first 5 cards per prompt for quick iteration
  const CARDS_PER_PROMPT = 5
  const sampleCards = testCards.slice(0, CARDS_PER_PROMPT)

  console.log(`Testing with ${sampleCards.length} cards per prompt variant\n`)
  console.log('Sample cards:')
  sampleCards.forEach((card, i) => {
    const platform = card.metadata?.platform || 'unknown'
    console.log(`  ${i + 1}. [${platform}] ${card.title || 'Untitled'} (${card.id})`)
  })
  console.log('\n' + '='.repeat(80) + '\n')

  const results: TagResult[] = []

  for (const variant of variants) {
    console.log(`\nTesting variant: ${variant.name.toUpperCase()}`)
    console.log(`  ${variant.description}`)
    console.log('-'.repeat(80))

    for (let i = 0; i < sampleCards.length; i++) {
      const card = sampleCards[i]
      const platform = card.metadata?.platform || 'unknown'

      console.log(`\nCard ${i + 1}/${sampleCards.length}: ${card.title || 'Untitled'}`)
      console.log(`  Platform: ${platform}`)
      console.log(`  Current tags: [${card.tags.join(', ')}]`)
      console.log(`  Content preview: ${(card.content || '').slice(0, 100)}...`)

      const filledPrompt = fillTemplate(variant, {
        platform,
        title: card.title || 'Untitled',
        content: card.content || '',
        url: card.url || ''
      })

      console.log(`\n  Prompt (${variant.name}):`)
      console.log(`  ${filledPrompt.slice(0, 200)}...\n`)

      console.log(`  Awaiting tag generation for card ${card.id}...`)
      console.log(`  (This will be filled in during manual execution)\n`)

      const result: TagResult = {
        cardId: card.id,
        cardTitle: card.title,
        platform,
        currentTags: card.tags,
        promptVariant: variant.name,
        generatedTags: [],
        reasoning: '',
        rawResponse: ''
      }

      results.push(result)
    }

    console.log('\n' + '='.repeat(80))
  }

  const resultsPath = path.join(import.meta.dir, '..', 'data', 'results.json')
  writeFileSync(resultsPath, JSON.stringify(results, null, 2))

  console.log(`\nSaved results structure to ${resultsPath}`)
  console.log(`\nExperiment structure ready!`)
  console.log(`\nNext steps:`)
  console.log(`  1. For each card x prompt combination, use Claude Code to generate tags`)
  console.log(`  2. Fill in the generatedTags and reasoning fields in data/results.json`)
  console.log(`  3. Run \`bun run analyze\` to compare variants\n`)

  return results
}

if (import.meta.main) {
  runExperiment().catch(console.error)
}

export { runExperiment }
