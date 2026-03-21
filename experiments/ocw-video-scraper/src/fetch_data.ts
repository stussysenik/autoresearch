/**
 * Phase 1: Fetch — Download sitemap index and cache course sitemap entries.
 *
 * Outputs: data/sitemap_index.json
 *
 * Usage:
 *   bun run fetch              # sample 10 courses
 *   SAMPLE_SIZE=50 bun run fetch  # sample 50 courses
 *   FULL=1 bun run fetch       # all ~1,863 courses
 */

import { fetchSitemapIndex } from './scraper.js'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')

async function main() {
  console.log('⏳ Fetching MIT OCW sitemap index...')
  const allCourses = await fetchSitemapIndex()
  console.log(`   Found ${allCourses.length} course sitemaps`)

  const full = process.env.FULL === '1'
  const sampleSize = full ? allCourses.length : parseInt(process.env.SAMPLE_SIZE || '100', 10)

  // Deterministic sample: pick evenly spaced courses across the catalog
  const step = Math.max(1, Math.floor(allCourses.length / sampleSize))
  const sample = full
    ? allCourses
    : allCourses.filter((_, i) => i % step === 0).slice(0, sampleSize)

  console.log(`   Sampling ${sample.length} courses for experiment`)
  console.log(`   Courses: ${sample.map(c => c.courseNumber).join(', ')}`)

  mkdirSync(dataDir, { recursive: true })

  const output = {
    fetchedAt: new Date().toISOString(),
    totalCourses: allCourses.length,
    sampleSize: sample.length,
    courses: sample,
  }

  const outPath = join(dataDir, 'sitemap_index.json')
  writeFileSync(outPath, JSON.stringify(output, null, 2))
  console.log(`\n✅ Saved ${outPath}`)
}

main().catch(err => {
  console.error('❌ Fetch failed:', err.message)
  process.exit(1)
})
