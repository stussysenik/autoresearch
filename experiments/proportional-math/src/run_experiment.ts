/**
 * Phase 2: Render component pages per ratio variant and screenshot them.
 *
 * Reads:  data/scales.json
 * Outputs: data/results/{variant}.html, data/results/{variant}.png, data/results.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { generateComponentsPage } from './components.js'
import { variants } from './variants.js'
import type { FullScale } from './math.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
const resultsDir = join(dataDir, 'results')

async function main() {
  const scales: Record<string, FullScale> = JSON.parse(
    readFileSync(join(dataDir, 'scales.json'), 'utf-8')
  )

  mkdirSync(resultsDir, { recursive: true })

  console.log('\n🔬 Rendering components for each ratio variant...\n')

  const results: any[] = []
  let playwrightAvailable = false

  // Check if Playwright is available
  try {
    const { chromium } = await import('playwright')
    playwrightAvailable = true
    const browser = await chromium.launch()

    for (const variant of variants) {
      const scale = scales[variant.name]
      if (!scale) continue

      const html = generateComponentsPage(scale, variant.name)
      const htmlPath = join(resultsDir, `${variant.name}.html`)
      writeFileSync(htmlPath, html)

      // Screenshot
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
      await page.setContent(html, { waitUntil: 'networkidle' })
      const screenshotPath = join(resultsDir, `${variant.name}.png`)
      await page.screenshot({ path: screenshotPath, fullPage: true })
      await page.close()

      console.log(`   ✅ ${variant.name} → ${variant.name}.html + ${variant.name}.png`)

      results.push({
        variant: variant.name,
        ratio: variant.ratio,
        origin: variant.origin,
        scale: scale.steps.map(s => ({ label: s.label, value: s.value })),
        derived: scale.derived,
        quality: scale.quality,
        htmlPath,
        screenshotPath,
      })
    }

    await browser.close()
  } catch {
    // Playwright not available — generate HTML only
    console.log('   ⚠ Playwright not available — generating HTML only (no screenshots)\n')

    for (const variant of variants) {
      const scale = scales[variant.name]
      if (!scale) continue

      const html = generateComponentsPage(scale, variant.name)
      const htmlPath = join(resultsDir, `${variant.name}.html`)
      writeFileSync(htmlPath, html)

      console.log(`   ✅ ${variant.name} → ${variant.name}.html`)

      results.push({
        variant: variant.name,
        ratio: variant.ratio,
        origin: variant.origin,
        scale: scale.steps.map(s => ({ label: s.label, value: s.value })),
        derived: scale.derived,
        quality: scale.quality,
        htmlPath,
        screenshotPath: null,
      })
    }
  }

  writeFileSync(join(dataDir, 'results.json'), JSON.stringify(results, null, 2))
  console.log(`\n✅ Saved data/results.json (${results.length} variants)`)
  if (!playwrightAvailable) {
    console.log('   Open data/results/*.html in browser to compare visually')
  }
}

main().catch(err => {
  console.error('❌ Run failed:', err.message)
  process.exit(1)
})
