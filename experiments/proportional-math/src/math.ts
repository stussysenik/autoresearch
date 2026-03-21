/**
 * Core geometric scale engine.
 *
 * All UI dimensions derive from two inputs:
 *   x = base unit (default 1em)
 *   y = ratio (default φ = 1.618...)
 *
 * Geometric scale: step(n) = x · y^n
 * Named values: √y/y² (v-pad), x/y (h-pad), x·√y (radius)
 */

export interface ScaleConfig {
  base: number   // x in em
  ratio: number  // y
}

export interface ScaleStep {
  index: number
  formula: string
  value: number   // in em
  label: string   // e.g. "s-n2", "s-0", "s-3"
}

export interface DerivedValues {
  verticalPadding: number   // √y / y²
  horizontalPadding: number // x / y
  base: number              // x
  borderRadius: number      // x · √y
  sqrtRatio: number         // √y
}

export interface ScaleQuality {
  coverage: number           // max / min step value
  density: number            // usable steps in 0.25–64em
  maxGapPercent: number      // largest jump between steps as %
  namedValueAlignment: number // how close derived values are to nearest scale step (0–1)
  totalSteps: number
}

export interface FullScale {
  config: ScaleConfig
  steps: ScaleStep[]
  derived: DerivedValues
  quality: ScaleQuality
  cssVariables: string
}

// ─── Scale Generation ───────────────────────────────────────────────────────

const MIN_STEP = -4
const MAX_STEP = 9

export function generateScale(config: ScaleConfig): FullScale {
  const { base, ratio } = config

  // Generate geometric steps
  const steps: ScaleStep[] = []
  for (let n = MIN_STEP; n <= MAX_STEP; n++) {
    steps.push({
      index: n,
      formula: n === 0 ? 'x' : n > 0 ? `x·y^${n}` : `x·y^(${n})`,
      value: base * Math.pow(ratio, n),
      label: n < 0 ? `s-n${Math.abs(n)}` : `s-${n}`,
    })
  }

  // Derived values from the diagram
  const sqrtRatio = Math.sqrt(ratio)
  const derived: DerivedValues = {
    verticalPadding: sqrtRatio / (ratio * ratio),
    horizontalPadding: base / ratio,
    base,
    borderRadius: base * sqrtRatio,
    sqrtRatio,
  }

  // Quality metrics
  const quality = computeQuality(steps, derived)

  // CSS custom properties
  const cssVariables = generateCssVariables(config, steps, derived)

  return { config, steps, derived, quality, cssVariables }
}

// ─── Quality Metrics ────────────────────────────────────────────────────────

function computeQuality(steps: ScaleStep[], derived: DerivedValues): ScaleQuality {
  const values = steps.map(s => s.value)

  // Coverage: ratio of largest to smallest
  const coverage = values[values.length - 1] / values[0]

  // Density: usable steps in practical range (0.25em to 64em)
  const density = values.filter(v => v >= 0.25 && v <= 64).length

  // Max gap: largest percentage jump between consecutive steps
  let maxGapPercent = 0
  for (let i = 1; i < values.length; i++) {
    const gap = ((values[i] - values[i - 1]) / values[i - 1]) * 100
    maxGapPercent = Math.max(maxGapPercent, gap)
  }

  // Named value alignment: how close derived values land to scale steps
  const derivedVals = [derived.verticalPadding, derived.horizontalPadding, derived.borderRadius]
  let alignmentSum = 0
  for (const dv of derivedVals) {
    let minDist = Infinity
    for (const sv of values) {
      const dist = Math.abs(Math.log(dv / sv))
      minDist = Math.min(minDist, dist)
    }
    // Convert log-distance to 0-1 score (0 = perfectly aligned)
    alignmentSum += Math.exp(-minDist * 5)
  }
  const namedValueAlignment = alignmentSum / derivedVals.length

  return {
    coverage,
    density,
    maxGapPercent,
    namedValueAlignment,
    totalSteps: values.length,
  }
}

// ─── CSS Generation ─────────────────────────────────────────────────────────

function generateCssVariables(config: ScaleConfig, steps: ScaleStep[], derived: DerivedValues): string {
  const lines: string[] = [':root {']
  lines.push(`  --base: ${config.base}rem;`)
  lines.push(`  --ratio: ${config.ratio};`)
  lines.push(`  --sqrt-ratio: ${derived.sqrtRatio.toFixed(6)};`)
  lines.push('')

  // Scale steps as pre-computed values (for the experiment)
  for (const step of steps) {
    lines.push(`  --${step.label}: ${step.value.toFixed(4)}rem; /* ${step.formula} */`)
  }
  lines.push('')

  // Named derived
  lines.push(`  --v-pad: ${derived.verticalPadding.toFixed(4)}rem; /* √y / y² */`)
  lines.push(`  --h-pad: ${derived.horizontalPadding.toFixed(4)}rem; /* x / y */`)
  lines.push(`  --radius: ${derived.borderRadius.toFixed(4)}rem; /* x · √y */`)
  lines.push('}')

  return lines.join('\n')
}

// ─── Formatting ─────────────────────────────────────────────────────────────

export function formatValue(v: number): string {
  return v.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}
