/**
 * Phase 2: Run — Benchmark all 4 scraping variants against the same course sample.
 *
 * Reads:  data/sitemap_index.json
 * Outputs: data/results.json, data/catalog.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { variants, variantDescriptions } from './variants.js'
import type { CourseSitemapEntry, VariantResult } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')

async function main() {
  const inputPath = join(dataDir, 'sitemap_index.json')
  const input = JSON.parse(readFileSync(inputPath, 'utf-8'))
  const courses: CourseSitemapEntry[] = input.courses

  console.log(`\n🔬 Running OCW Video Scraper Experiment`)
  console.log(`   Courses: ${courses.length}`)
  console.log(`   Variants: ${Object.keys(variants).join(', ')}\n`)

  const results: VariantResult[] = []

  // Run only the variants specified, or all
  const selectedVariants = process.env.VARIANT
    ? [process.env.VARIANT]
    : Object.keys(variants)

  for (const name of selectedVariants) {
    const runner = variants[name]
    if (!runner) {
      console.log(`   ⚠ Unknown variant: ${name}`)
      continue
    }

    console.log(`── ${name} ──────────────────────────────────────`)
    console.log(`   ${variantDescriptions[name]}`)

    const result = await runner(courses)
    results.push(result)

    const m = result.metrics
    console.log(`   ✅ ${m.videosFound} videos in ${(m.wallClockMs / 1000).toFixed(1)}s`)
    console.log(`      ${m.requestCount} requests, ${(m.bytesDownloaded / 1024).toFixed(0)} KB`)
    console.log(`      ${m.throughput.toFixed(2)} videos/sec, ${m.errorsCount} errors\n`)
  }

  // Save results
  writeFileSync(join(dataDir, 'results.json'), JSON.stringify(results, null, 2))

  // Save combined catalog from the best variant (highest throughput with actual results)
  const withResults = results.filter(r => r.metrics.videosFound > 0)
  const best = withResults.length > 0
    ? withResults.reduce((a, b) => a.metrics.throughput > b.metrics.throughput ? a : b)
    : results[0]
  writeFileSync(
    join(dataDir, 'catalog.json'),
    JSON.stringify({ lectures: best.lectures }, null, 2)
  )

  console.log(`🏆 Winner: ${best.variant} (${best.metrics.throughput.toFixed(2)} videos/sec)`)
  console.log(`   Saved ${best.lectures.length} lectures to data/catalog.json`)
}

main().catch(err => {
  console.error('❌ Run failed:', err.message)
  process.exit(1)
})
