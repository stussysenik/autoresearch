/**
 * Fetch Test Cards from Supabase
 *
 * Queries the database for a diverse sample of cards
 * to use in tag optimization experiments.
 */

import { createClient } from '@supabase/supabase-js'
import { writeFile } from 'fs/promises'
import path from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL environment variable!')
  console.error('Copy .env.example to .env and fill in your values.')
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_SERVICE_KEY environment variable!')
  console.error('Copy .env.example to .env and fill in your values.')
  process.exit(1)
}

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

async function fetchData() {
  console.log('Connecting to Supabase...')

  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!)

  console.log('Fetching diverse card sample...')

  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, type, title, content, url, image_url, metadata, tags, created_at')
    .is('deleted_at', null)
    .not('content', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching cards:', error)
    process.exit(1)
  }

  if (!cards || cards.length === 0) {
    console.error('No cards found in database')
    process.exit(1)
  }

  console.log(`Fetched ${cards.length} cards from database`)

  // Filter for platform diversity
  const platformCounts: Record<string, number> = {}
  const selectedCards: Card[] = []

  for (const card of cards) {
    const platform = (card.metadata?.platform || 'unknown').toLowerCase()

    if (!platformCounts[platform]) {
      platformCounts[platform] = 0
    }

    if (platformCounts[platform] < 5) {
      selectedCards.push(card)
      platformCounts[platform]++
    }

    if (selectedCards.length >= 30) break
  }

  // Pad if we don't have enough
  if (selectedCards.length < 20) {
    for (const card of cards) {
      if (!selectedCards.find(c => c.id === card.id)) {
        selectedCards.push(card)
        if (selectedCards.length >= 25) break
      }
    }
  }

  console.log('\nPlatform distribution:')
  for (const [platform, count] of Object.entries(platformCounts)) {
    console.log(`  - ${platform}: ${count} cards`)
  }

  console.log(`\nSelected ${selectedCards.length} cards for testing`)

  const outputPath = path.join(import.meta.dir, '..', 'data', 'input.json')
  await writeFile(outputPath, JSON.stringify(selectedCards, null, 2))

  console.log(`Saved to ${outputPath}`)
}

if (import.meta.main) {
  fetchData().catch(console.error)
}

export { fetchData }
