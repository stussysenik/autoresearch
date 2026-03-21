/**
 * Phase 1: Generate geometric scales for all 6 ratio variants.
 * No external data — pure mathematics.
 *
 * Output: data/scales.json
 */

import { generateScale, type FullScale } from './math.js'
import { variants } from './variants.js'
import { mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')

function main() {
  console.log('⏳ Generating geometric scales for 6 ratio variants...\n')

  const scales: Record<string, FullScale> = {}

  for (const variant of variants) {
    const scale = generateScale({ base: 1, ratio: variant.ratio })
    scales[variant.name] = scale

    console.log(`── ${variant.name} (y=${variant.ratio.toFixed(4)}) ──`)
    console.log(`   ${variant.origin}`)
    console.log(`   Steps: ${scale.steps.length} (${scale.steps[0].label} → ${scale.steps[scale.steps.length - 1].label})`)
    console.log(`   Range: ${scale.steps[0].value.toFixed(3)}em → ${scale.steps[scale.steps.length - 1].value.toFixed(3)}em`)
    console.log(`   Derived: v-pad=${scale.derived.verticalPadding.toFixed(3)} h-pad=${scale.derived.horizontalPadding.toFixed(3)} radius=${scale.derived.borderRadius.toFixed(3)}`)
    console.log(`   Quality: coverage=${scale.quality.coverage.toFixed(0)}x density=${scale.quality.density} maxGap=${scale.quality.maxGapPercent.toFixed(1)}% alignment=${scale.quality.namedValueAlignment.toFixed(3)}\n`)
  }

  mkdirSync(dataDir, { recursive: true })
  const outPath = join(dataDir, 'scales.json')
  writeFileSync(outPath, JSON.stringify(scales, null, 2))
  console.log(`✅ Saved ${outPath}`)
}

main()
