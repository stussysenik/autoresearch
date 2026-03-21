/**
 * Phase 3: Compare ratio variants, generate ANALYSIS.md + dashboard.html
 *
 * Reads:  data/results.json
 * Outputs: ANALYSIS.md, dashboard.html
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const dataDir = join(rootDir, 'data')

interface Result {
  variant: string
  ratio: number
  origin: string
  scale: { label: string; value: number }[]
  derived: {
    verticalPadding: number
    horizontalPadding: number
    base: number
    borderRadius: number
    sqrtRatio: number
  }
  quality: {
    coverage: number
    density: number
    maxGapPercent: number
    namedValueAlignment: number
    totalSteps: number
  }
  htmlPath: string
  screenshotPath: string | null
}

function main() {
  const results: Result[] = JSON.parse(readFileSync(join(dataDir, 'results.json'), 'utf-8'))

  // Rank by composite score: density (40%) + alignment (30%) + inverse gap (30%)
  const scored = results.map(r => {
    const maxDensity = Math.max(...results.map(x => x.quality.density))
    const minGap = Math.min(...results.map(x => x.quality.maxGapPercent))
    const maxGap = Math.max(...results.map(x => x.quality.maxGapPercent))

    const densityScore = r.quality.density / maxDensity
    const alignmentScore = r.quality.namedValueAlignment
    const gapScore = 1 - (r.quality.maxGapPercent - minGap) / (maxGap - minGap || 1)

    const composite = densityScore * 0.4 + alignmentScore * 0.3 + gapScore * 0.3

    return { ...r, composite }
  }).sort((a, b) => b.composite - a.composite)

  const winner = scored[0]

  // ─── ANALYSIS.md ──────────────────────────────────────────────────────────

  const analysis = `# Proportional Math — Experiment Results

## Winner: \`${winner.variant}\` (y = ${winner.ratio})

${winner.origin} — composite score **${(winner.composite * 100).toFixed(1)}%**

## Ranking

| # | Variant | Ratio | Density | Max Gap | Alignment | Composite |
|---|---------|-------|---------|---------|-----------|-----------|
${scored.map((r, i) => `| ${i + 1} | ${r.variant} | ${r.ratio.toFixed(4)} | ${r.quality.density} steps | ${r.quality.maxGapPercent.toFixed(1)}% | ${(r.quality.namedValueAlignment * 100).toFixed(1)}% | **${(r.composite * 100).toFixed(1)}%** |`).join('\n')}

## Scale Comparison (values in em)

| Step | ${scored.map(r => r.variant).join(' | ')} |
|------|${scored.map(() => '-----').join(' | ')} |
${scored[0].scale.map((_, i) => {
  const label = scored[0].scale[i].label
  const values = scored.map(r => r.scale[i].value.toFixed(3))
  return `| ${label} | ${values.join(' | ')} |`
}).join('\n')}

## Derived Values

| Value | Formula | ${scored.map(r => r.variant).join(' | ')} |
|-------|---------|${scored.map(() => '-----').join(' | ')} |
| v-pad | √y/y² | ${scored.map(r => r.derived.verticalPadding.toFixed(3)).join(' | ')} |
| h-pad | x/y | ${scored.map(r => r.derived.horizontalPadding.toFixed(3)).join(' | ')} |
| radius | x·√y | ${scored.map(r => r.derived.borderRadius.toFixed(3)).join(' | ')} |

## Quality Metrics

- **Density**: Steps in usable range (0.25–64em). More = finer control. Winner: ${results.reduce((a, b) => a.quality.density > b.quality.density ? a : b).variant}
- **Max Gap**: Largest jump between consecutive steps. Smaller = smoother. Winner: ${results.reduce((a, b) => a.quality.maxGapPercent < b.quality.maxGapPercent ? a : b).variant}
- **Alignment**: How close derived values (v-pad, h-pad, radius) land to scale steps. Higher = more internally consistent. Winner: ${results.reduce((a, b) => a.quality.namedValueAlignment > b.quality.namedValueAlignment ? a : b).variant}

## Visual Comparison

Open \`data/results/{variant}.html\` in a browser to see components rendered with each ratio.

---
*Generated ${new Date().toISOString()}*
`

  writeFileSync(join(rootDir, 'ANALYSIS.md'), analysis)
  console.log('✅ Generated ANALYSIS.md')

  // ─── Dashboard ────────────────────────────────────────────────────────────

  const dashboard = generateDashboard(scored, winner)
  writeFileSync(join(rootDir, 'dashboard.html'), dashboard)
  console.log('✅ Generated dashboard.html')
  console.log(`\n🏆 Winner: ${winner.variant} (y=${winner.ratio}) — ${(winner.composite * 100).toFixed(1)}% composite score`)
}

function generateDashboard(results: (Result & { composite: number })[], winner: Result & { composite: number }): string {
  const maxStepVal = Math.max(...results[0].scale.map(s => s.value))

  const variantCards = results.map((r, i) => {
    const isWinner = r.variant === winner.variant
    return `
    <div class="variant-card ${isWinner ? 'winner' : ''}">
      <div class="variant-header">
        <span class="rank">#${i + 1}</span>
        <h3>${r.variant}${isWinner ? '<span class="badge">BEST</span>' : ''}</h3>
        <span class="ratio-value">y = ${r.ratio.toFixed(4)}</span>
      </div>
      <div class="origin">${r.origin}</div>

      <div class="metrics-grid">
        <div class="metric-item">
          <span class="metric-label">DENSITY</span>
          <span class="metric-val">${r.quality.density}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">MAX GAP</span>
          <span class="metric-val">${r.quality.maxGapPercent.toFixed(1)}%</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">ALIGNMENT</span>
          <span class="metric-val">${(r.quality.namedValueAlignment * 100).toFixed(0)}%</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">COMPOSITE</span>
          <span class="metric-val highlight">${(r.composite * 100).toFixed(1)}%</span>
        </div>
      </div>

      <div class="scale-viz">
        <div class="scale-bars">
          ${r.scale.filter(s => s.value >= 0.1 && s.value <= 80).map(s => {
            const h = Math.max(4, (Math.log(s.value + 0.5) / Math.log(maxStepVal + 0.5)) * 80)
            return `<div class="bar" style="height:${h}px" title="${s.label}: ${s.value.toFixed(3)}em"></div>`
          }).join('')}
        </div>
      </div>

      <div class="derived-row">
        <span>v-pad: <strong>${r.derived.verticalPadding.toFixed(3)}</strong></span>
        <span>h-pad: <strong>${r.derived.horizontalPadding.toFixed(3)}</strong></span>
        <span>radius: <strong>${r.derived.borderRadius.toFixed(3)}</strong></span>
      </div>

      ${r.screenshotPath ? `<a href="data/results/${r.variant}.html" class="preview-link">Open preview →</a>` : `<a href="data/results/${r.variant}.html" class="preview-link">Open preview →</a>`}
    </div>`
  }).join('\n')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proportional Math — Ratio Comparison</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=DM+Sans:wght@400;500;700&display=swap');

  :root {
    --bg: #0a0a0b;
    --surface: #111113;
    --surface-2: #1a1a1e;
    --border: #2a2a30;
    --text: #e4e4e7;
    --dim: #71717a;
    --gold: #d4a017;
    --gold-glow: #f5c842;
    --cyan: #22d3ee;
    --green: #4ade80;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    min-height: 100vh;
  }

  body::after {
    content: '';
    position: fixed;
    inset: 0;
    background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px);
    pointer-events: none;
    z-index: 999;
  }

  .container { max-width: 1100px; margin: 0 auto; padding: 48px 24px; }

  header {
    text-align: center;
    margin-bottom: 48px;
    position: relative;
  }

  header::before {
    content: 'φ √2 π';
    position: absolute;
    top: -16px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 100px;
    font-weight: 700;
    color: var(--gold);
    opacity: 0.04;
    letter-spacing: 8px;
    pointer-events: none;
  }

  .tag {
    display: inline-block;
    padding: 4px 12px;
    background: var(--gold);
    color: #000;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-bottom: 12px;
  }

  h1 {
    font-family: 'DM Sans', sans-serif;
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.5px;
    margin-bottom: 6px;
  }

  .subtitle { color: var(--dim); font-size: 13px; font-weight: 300; }

  .formula-bar {
    display: flex;
    justify-content: center;
    gap: 32px;
    margin: 24px 0 48px;
    padding: 16px;
    background: var(--surface);
    border: 1px solid var(--border);
  }

  .formula-item {
    text-align: center;
  }

  .formula-item .f { font-size: 16px; color: var(--gold); }
  .formula-item .desc { font-size: 10px; color: var(--dim); margin-top: 4px; letter-spacing: 1px; }

  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }

  .variant-card {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 20px;
    transition: border-color 0.2s;
  }

  .variant-card:hover { border-color: var(--dim); }

  .variant-card.winner {
    border-color: var(--gold);
    box-shadow: 0 0 40px -10px rgba(212, 160, 23, 0.25);
    grid-column: 1 / -1;
  }

  .variant-card.winner::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--gold), var(--gold-glow), var(--gold));
  }

  .variant-card { position: relative; }

  .variant-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
  }

  .rank { font-size: 11px; color: var(--dim); }

  .variant-header h3 {
    font-family: 'DM Sans', sans-serif;
    font-size: 18px;
    font-weight: 700;
    flex: 1;
  }

  .badge {
    padding: 2px 8px;
    background: var(--gold);
    color: #000;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-left: 6px;
    font-family: 'JetBrains Mono', monospace;
  }

  .ratio-value { font-size: 12px; color: var(--cyan); }
  .origin { font-size: 11px; color: var(--dim); margin-bottom: 16px; }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 16px;
  }

  .metric-item {
    background: var(--surface-2);
    padding: 8px;
    text-align: center;
  }

  .metric-label {
    display: block;
    font-size: 8px;
    color: var(--dim);
    letter-spacing: 1.5px;
    margin-bottom: 4px;
  }

  .metric-val {
    font-size: 16px;
    font-weight: 500;
  }

  .metric-val.highlight { color: var(--gold); }

  .scale-viz { margin-bottom: 12px; }

  .scale-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 80px;
  }

  .bar {
    flex: 1;
    background: var(--cyan);
    opacity: 0.6;
    border-radius: 1px 1px 0 0;
    min-width: 4px;
    transition: opacity 0.2s;
  }

  .bar:hover { opacity: 1; }

  .winner .bar { background: var(--gold); }

  .derived-row {
    display: flex;
    gap: 16px;
    font-size: 11px;
    color: var(--dim);
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }

  .derived-row strong { color: var(--text); }

  .preview-link {
    display: block;
    margin-top: 12px;
    font-size: 11px;
    color: var(--cyan);
    text-decoration: none;
  }

  .preview-link:hover { text-decoration: underline; }

  footer {
    margin-top: 48px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    text-align: center;
    font-size: 11px;
    color: var(--dim);
  }
</style>
</head>
<body>
<div class="container">
  <header>
    <div class="tag">EXPERIMENT</div>
    <h1>Proportional Math — Ratio Comparison</h1>
    <p class="subtitle">6 geometric ratios × 14 scale steps × 4 components</p>
  </header>

  <div class="formula-bar">
    <div class="formula-item"><div class="f">step(n) = x · y<sup>n</sup></div><div class="desc">GEOMETRIC SCALE</div></div>
    <div class="formula-item"><div class="f">√y / y²</div><div class="desc">VERTICAL PAD</div></div>
    <div class="formula-item"><div class="f">x / y</div><div class="desc">HORIZONTAL PAD</div></div>
    <div class="formula-item"><div class="f">x · √y</div><div class="desc">BORDER RADIUS</div></div>
  </div>

  <div class="grid">
    ${variantCards}
  </div>

  <footer>
    Proportional Math Experiment — ratio.css — Generated ${new Date().toISOString().split('T')[0]}
  </footer>
</div>
</body>
</html>`
}

main()
