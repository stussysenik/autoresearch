# UI/UX Testing Patterns — Web Research Summary (2026-03-22)

## 7 Layers of UI/UX Testing (Objective → Subjective)

### Layer 1: Core Web Vitals (Fully Automatable)
- LCP < 2.5s, INP < 200ms, CLS < 0.1
- Only 48% of mobile pages pass all three in 2026
- Tools: Lighthouse CI, Playwright + Lighthouse integration

### Layer 2: Accessibility (Fully Automatable)
- axe-core via @axe-core/playwright: `new AxeBuilder({ page }).analyze()`
- Returns structured violation arrays with severity (critical/serious/moderate/minor)
- Color contrast computable: `(L1 + 0.05) / (L2 + 0.05)`
- Zero tolerance for critical/serious violations as CI gate

### Layer 3: Design System Compliance (Automatable with Config)
- @lapidist/design-lint: reads DTIF design tokens, validates 16 token rules + 8 design system rules
- Playwright CSS assertions: `toHaveCSS('font-size', '14px')` + `window.getComputedStyle()`
- Verify spacing on 4px grid, colors from approved palette, typography from type scale
- Touch targets >= 44x44px on mobile

### Layer 4: Animation & Motion Quality (Partially Automatable)
- Emil Kowalski's 43 rules are largely codifiable
- Key numbers: micro-interactions 150-250ms, standard transitions 200-350ms, never exceed 1s
- Only animate `transform` and `opacity` (GPU-friendly)
- Hover: instant on, 150ms off. Active: scale(0.97-0.98)
- Playwright: verify opacity transitions, transform matrices, timing durations, class application
- Reduced motion: `page.emulateMedia({ reducedMotion: 'reduce' })` — all animations should be instant
- Claude Code skill exists: `npx add-skill kylezantos/design-motion-principles`

### Layer 5: Visual Regression (Baseline-Dependent)
- **Open source**: Playwright built-in (`toHaveScreenshot()`), Lost Pixel, Argos CI
- **AI-powered commercial**: Applitools Visual AI (trained on 4B screens), Percy (OCR), Chromatic (by Storybook)
- **Meticulous.ai**: Records real user sessions, replays on every PR, diffs into PR comments. Zero test writing.
- Pixel diffs too noisy for autoresearch fitness functions — test behavior not pixels

### Layer 6: LLM-as-Visual-Judge (The Frontier)
- Multimodal LLMs reliably detect: layout problems, spacing inconsistencies, responsive failures, contrast issues, typography hierarchy
- Miss: animation bugs (static screenshots), performance jank, interaction-specific states
- Production pattern (Grizzly Peak Software): Puppeteer screenshots → Claude API with context → GitHub Actions flags
- Cost: $0.15-0.30 per full audit
- LLM-as-judge rubric: criteria + scoring scale (0.0-1.0) → `{ reason, score, pass }`
- 80-90% agreement with human evaluators when rubrics well-designed
- **Chrome DevTools MCP** (Addy Osmani): 26 tools for AI browser control — DOM inspection, screenshots, user simulation
- **TestSprite MCP**: DOM-aware snapshots across states/themes/viewports, parses PRDs. 42% → 93% pass rate after one iteration.

### Layer 7: Subjective "Feel" (NOT Automatable)
- Requires human feedback: SUS, SEQ, AttrakDiff2 questionnaires
- Automatable proxy metrics: task completion rate, time-on-task, error rate, conversion, bounce rate
- Google HEART framework: Happiness, Engagement, Adoption, Retention, Task Success

## Composite Fitness Function for Autoresearch
```
Hard gates (binary): Build + 0 critical a11y + Lighthouse > 80 + Core Web Vitals + Design lint
Scored (60%): Visual regression match rate, animation compliance, CSS compliance, component tests
LLM judge (40%): Screenshot rubric across viewports (hierarchy, spacing, color, typography, polish) 0-10
Cost per cycle: ~$0.15-0.30
```

## Storybook v9 (July 2025)
- Unified three test types (interaction, accessibility, visual) in one UI
- Applitools Eyes 10.22: Storybook Addon + Figma Plugin comparing production vs Figma designs

## Sources
- web.dev (Core Web Vitals)
- deque.com (axe-core)
- github.com/nicholasgriffintn/lapidist-design-lint
- emilkowalski.github.io (motion principles)
- applitools.com, percy.io, chromatic.com
- grizzlypeaksoftware.com (LLM visual audit)
- addy-osmani.com (Chrome DevTools MCP)
- testsprite.com (TestSprite MCP)
