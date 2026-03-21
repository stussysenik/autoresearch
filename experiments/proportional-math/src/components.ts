/**
 * HTML generators for UI components.
 * Each component is styled exclusively with scale-derived CSS custom properties.
 */

import type { FullScale } from './math.js'
import { formatValue } from './math.js'

export function generateComponentsPage(scale: FullScale, variantName: string): string {
  const { derived, config } = scale
  const r = config.ratio
  const sq = derived.sqrtRatio

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${variantName} (ratio: ${config.ratio})</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

  ${scale.cssVariables}

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: #0d1117;
    color: #e6edf3;
    padding: var(--s-2);
  }

  .header {
    margin-bottom: var(--s-2);
    padding-bottom: var(--s-1);
    border-bottom: 1px solid #30363d;
  }

  .header h1 {
    font-size: var(--s-3);
    font-weight: 700;
    margin-bottom: var(--s-n2);
  }

  .header .meta {
    font-size: var(--s-n1);
    color: #8b949e;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--s-1);
  }

  .section {
    background: #161b22;
    border: 1px solid #30363d;
    border-radius: var(--radius);
    padding: var(--s-1);
  }

  .section-title {
    font-size: var(--s-n1);
    color: #8b949e;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: var(--s-0);
  }

  /* ── Button ── */
  .btn {
    display: inline-flex;
    align-items: center;
    gap: var(--s-n2);
    padding: var(--v-pad) var(--h-pad);
    font-size: var(--s-0);
    font-weight: 600;
    font-family: inherit;
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
    background: #238636;
    color: #fff;
    line-height: 1;
  }

  .btn-sm {
    font-size: var(--s-n1);
    padding: var(--s-n3) var(--s-n2);
  }

  .btn-lg {
    font-size: var(--s-1);
    padding: var(--s-0) var(--s-1);
  }

  .btn-outline {
    background: transparent;
    border: 1px solid #30363d;
    color: #e6edf3;
  }

  .btn-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-n1);
    align-items: center;
  }

  /* ── Input ── */
  .input {
    display: block;
    width: 100%;
    padding: var(--s-n2) var(--s-n1);
    font-size: var(--s-0);
    font-family: inherit;
    color: #e6edf3;
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: calc(var(--radius) * 0.5);
    outline: none;
    margin-bottom: var(--s-n1);
  }

  .input:focus {
    border-color: #58a6ff;
    box-shadow: 0 0 0 3px rgba(88, 166, 255, 0.15);
  }

  .input-label {
    display: block;
    font-size: var(--s-n1);
    color: #8b949e;
    margin-bottom: var(--s-n3);
  }

  /* ── Card ── */
  .card {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: var(--radius);
    padding: var(--s-1);
    display: flex;
    flex-direction: column;
    gap: var(--s-n1);
  }

  .card-title {
    font-size: var(--s-1);
    font-weight: 600;
  }

  .card-body {
    font-size: var(--s-0);
    color: #8b949e;
    line-height: calc(1em * ${r.toFixed(3)});
  }

  /* ── Badge ── */
  .badge {
    display: inline-flex;
    align-items: center;
    padding: var(--s-n4) var(--s-n2);
    font-size: var(--s-n2);
    font-weight: 600;
    border-radius: var(--s-2);
    background: #1f6feb33;
    color: #58a6ff;
  }

  .badge-green { background: #23863633; color: #3fb950; }
  .badge-yellow { background: #9e6a0333; color: #d29922; }
  .badge-red { background: #f8514933; color: #f85149; }

  .badge-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-n2);
  }

  /* ── Scale visualization ── */
  .scale-bar {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 120px;
    margin-top: var(--s-0);
  }

  .scale-step {
    flex: 1;
    background: #1f6feb;
    border-radius: 2px 2px 0 0;
    min-width: 20px;
    position: relative;
    transition: background 0.2s;
  }

  .scale-step:hover {
    background: #58a6ff;
  }

  .scale-step .tip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    font-size: 9px;
    color: #8b949e;
    white-space: nowrap;
    padding-bottom: 4px;
  }

  .scale-labels {
    display: flex;
    gap: 2px;
    margin-top: 4px;
  }

  .scale-labels span {
    flex: 1;
    text-align: center;
    font-size: 9px;
    color: #484f58;
    min-width: 20px;
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${variantName}</h1>
    <div class="meta">ratio: ${config.ratio.toFixed(6)} · base: ${config.base}rem · origin: ${getOrigin(variantName)}</div>
  </div>

  <div class="grid">
    <!-- Buttons -->
    <div class="section">
      <div class="section-title">Button</div>
      <div class="btn-group">
        <button class="btn btn-sm">Small</button>
        <button class="btn">Default</button>
        <button class="btn btn-lg">Large</button>
        <button class="btn btn-outline">Outline</button>
      </div>
    </div>

    <!-- Inputs -->
    <div class="section">
      <div class="section-title">Input</div>
      <label class="input-label">Email address</label>
      <input class="input" type="email" placeholder="you@example.com" />
      <label class="input-label">Password</label>
      <input class="input" type="password" placeholder="••••••••" />
    </div>

    <!-- Card -->
    <div class="section">
      <div class="section-title">Card</div>
      <div class="card">
        <div class="card-title">Proportional Design</div>
        <div class="card-body">Every dimension derives from x=${formatValue(config.base)}rem and y=${formatValue(config.ratio)}. No magic numbers.</div>
        <div class="btn-group">
          <button class="btn btn-sm">Action</button>
          <button class="btn btn-sm btn-outline">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Badges -->
    <div class="section">
      <div class="section-title">Badge</div>
      <div class="badge-group">
        <span class="badge">Default</span>
        <span class="badge badge-green">Success</span>
        <span class="badge badge-yellow">Warning</span>
        <span class="badge badge-red">Error</span>
      </div>
    </div>
  </div>

  <!-- Scale visualization -->
  <div class="section" style="margin-top: var(--s-1);">
    <div class="section-title">Scale: step(n) = ${formatValue(config.base)} × ${formatValue(config.ratio)}^n</div>
    <div class="scale-bar">
      ${scale.steps.map(s => {
        const maxVal = scale.steps[scale.steps.length - 1].value
        const pct = Math.min(100, (Math.log(s.value + 1) / Math.log(maxVal + 1)) * 100)
        return `<div class="scale-step" style="height: ${pct}%"><span class="tip">${formatValue(s.value)}</span></div>`
      }).join('\n      ')}
    </div>
    <div class="scale-labels">
      ${scale.steps.map(s => `<span>${s.label.replace('s-', '')}</span>`).join('\n      ')}
    </div>
  </div>
</body>
</html>`
}

function getOrigin(name: string): string {
  const origins: Record<string, string> = {
    phi: 'Golden ratio (1+√5)/2',
    sqrt2: '√2 — ISO paper sizes',
    minor_third: 'Musical minor third (6:5)',
    major_third: 'Musical major third (5:4)',
    perfect_fourth: 'Musical perfect fourth (4:3)',
    perfect_fifth: 'Musical perfect fifth (3:2)',
  }
  return origins[name] || name
}
