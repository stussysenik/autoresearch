/**
 * Image / HTML Analyzer
 *
 * Extracts a DesignBlueprint from either a screenshot or an HTML source file.
 * Supports multiple providers:
 *   - "claude": Uses `claude -p` headless mode (default, zero API key needed)
 *   - "openai": Uses OpenAI vision API (requires OPENAI_API_KEY)
 *
 * For HTML source input, Claude reads the CSS directly — more accurate than vision.
 * For screenshot input, falls back to OpenAI vision or Claude with base64.
 *
 * Environment variables:
 *   ANALYZER_PROVIDER - "claude" (default) or "openai"
 *   ANALYZER_MODEL    - Model for openai provider (default: gpt-4o)
 */

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { validateBlueprint, type DesignBlueprint, DIMENSION_NAMES } from '../types/blueprint.js'

const ANALYZER_PROVIDER = process.env.ANALYZER_PROVIDER || 'claude'

/**
 * System prompt for the vision/analysis model.
 * Instructs it to extract structured Blueprint JSON.
 */
const SYSTEM_PROMPT = `You are a design systems expert. You analyze UI designs and extract precise, machine-readable design specifications.

Given a UI design (either as HTML source or a screenshot), produce a DesignBlueprint JSON that captures:

1. **Design Tokens**: Extract the global design language:
   - Colors: primary, secondary, background, surface, text, textSecondary, border, error, success
   - Typography: font family, type scale (h1, h2, body, caption sizes)
   - Spacing: base unit (usually 4px or 8px)
   - Radii: small, medium, large, full
   - Shadows: small, medium, large

2. **Components**: Identify every distinct UI element as a component:
   - Give each a descriptive name (e.g., "login-card", "email-input", "submit-button")
   - Assign a CSS selector using data-testid (e.g., '[data-testid="submit-btn"]')
   - Set semanticRole (button, textbox, heading, form, img, link, etc.)
   - Include textContent if the element has visible text
   - Nest children components properly

3. **Dimensions**: For each component, fill in as many of these 16 dimensions as you can observe:
   - **layout**: display, flexDirection, flexWrap, gridTemplate*, position, zIndex, overflow
   - **spacing**: padding (each side), margin (each side), gap
   - **sizing**: width, height, min/max, aspectRatio
   - **typography**: fontSize, fontWeight, lineHeight, fontFamily, letterSpacing, textAlign, textTransform
   - **color**: color (text), backgroundColor, opacity
   - **borders**: border shorthand or individual sides, borderWidth, borderStyle, borderColor
   - **shape**: borderRadius (shorthand or per-corner), clipPath
   - **shadows**: boxShadow (full CSS value), elevationLevel (0-5)
   - **alignment**: justifyContent, alignItems, isCenteredHorizontally, isCenteredVertically
   - **hierarchy**: fontSizeRatio, prominenceRank
   - **composition**: isContainedWithinParent, noOverlapWith
   - **density**: whitespaceRatio, itemsPerRow
   - **state**: hover/focus/active/disabled CSS changes (if inferable)
   - **responsive**: breakpoint changes (if inferable)
   - **accessibility**: contrastRatio, minTargetSize, ariaRole
   - **micro-interactions**: transition, cursor

4. **Relationships**: For each component, define spatial relationships:
   - containedWithin: parent selector
   - spacedFrom: sibling selector + gap in px
   - noOverlap: sibling selectors

CRITICAL RULES:
- Use RGB format for all colors: rgb(r, g, b) or rgba(r, g, b, a)
- Use px units for all measurements
- Use exact CSS property values that Playwright's toHaveCSS would match
- Be precise: "16px" not "about 16px"
- Only include dimensions you can actually observe — omit uncertain ones
- Font weights must be numeric strings: "400", "500", "600", "700"
- The schemaVersion must be "1.0.0"

Return ONLY valid JSON matching the DesignBlueprint schema. No markdown, no explanation.`

/**
 * Analyze a screenshot and extract a DesignBlueprint.
 *
 * @param imagePath - Path to the screenshot file (PNG/JPG)
 * @param options - Configuration overrides
 * @returns Validated DesignBlueprint
 */
export async function analyzeImage(
  imagePath: string,
  options: {
    model?: string
    viewport?: { width: number; height: number }
    designContext?: string
  } = {},
): Promise<DesignBlueprint> {
  const viewport = options.viewport || { width: 1280, height: 720 }

  console.log(`  Analyzing ${path.basename(imagePath)} (provider=${ANALYZER_PROVIDER})...`)

  let content: string

  if (ANALYZER_PROVIDER === 'claude') {
    content = await analyzeWithClaude(imagePath, viewport, options.designContext)
  } else {
    content = await analyzeWithOpenAI(imagePath, viewport, options)
  }

  return parseAndValidate(content, imagePath, viewport)
}

/**
 * Analyze an HTML source file directly — more accurate than screenshot analysis
 * because Claude can read exact CSS values from the source code.
 *
 * @param htmlPath - Path to the HTML file
 * @param options - Configuration overrides
 * @returns Validated DesignBlueprint
 */
export async function analyzeHTML(
  htmlPath: string,
  options: {
    viewport?: { width: number; height: number }
    designContext?: string
  } = {},
): Promise<DesignBlueprint> {
  const viewport = options.viewport || { width: 1280, height: 720 }
  const htmlContent = await fs.readFile(htmlPath, 'utf-8')

  console.log(`  Analyzing HTML source: ${path.basename(htmlPath)} (provider=claude)...`)

  const prompt = `${SYSTEM_PROMPT}

Here is the HTML source of a UI component. Extract the DesignBlueprint JSON by reading the CSS values directly from the source code. This gives you EXACT values — no guessing needed.

Viewport: ${viewport.width}x${viewport.height}px
${options.designContext ? `Context: ${options.designContext}` : ''}

HTML Source:
\`\`\`html
${htmlContent}
\`\`\`

Return ONLY the JSON. No markdown wrapping, no explanation.`

  const content = await spawnClaude(prompt)

  // Extract JSON from possible markdown wrapping
  const jsonStr = extractJSON(content)
  return parseAndValidate(jsonStr, htmlPath, viewport)
}

/**
 * Use `claude -p` to analyze an image by referencing the file path.
 */
async function analyzeWithClaude(
  imagePath: string,
  viewport: { width: number; height: number },
  designContext?: string,
): Promise<string> {
  // Read image as base64 and include in the prompt
  const imageBuffer = await fs.readFile(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'

  const prompt = `${SYSTEM_PROMPT}

Analyze this UI screenshot (provided as base64-encoded ${mimeType}).
Viewport: ${viewport.width}x${viewport.height}px
${designContext ? `Context: ${designContext}` : ''}

Image (base64): data:${mimeType};base64,${base64Image}

Return ONLY the JSON. No markdown wrapping, no explanation.`

  return await spawnClaude(prompt)
}

/**
 * Use OpenAI vision API to analyze an image.
 */
async function analyzeWithOpenAI(
  imagePath: string,
  viewport: { width: number; height: number },
  options: { model?: string; designContext?: string },
): Promise<string> {
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI()
  const model = options.model || process.env.ANALYZER_MODEL || 'gpt-4o'

  const imageBuffer = await fs.readFile(imagePath)
  const base64Image = imageBuffer.toString('base64')
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg'

  const userPrompt = options.designContext
    ? `Analyze this UI screenshot. Context: ${options.designContext}\n\nViewport: ${viewport.width}x${viewport.height}px`
    : `Analyze this UI screenshot.\n\nViewport: ${viewport.width}x${viewport.height}px`

  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          {
            type: 'image_url',
            image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
          },
        ],
      },
    ],
    max_tokens: 8000,
    temperature: 0.1,
    response_format: { type: 'json_object' },
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Vision model returned empty response')
  return content
}

/**
 * Parse raw JSON response and inject metadata.
 * Includes a fixup step to handle common LLM output quirks before Zod validation.
 */
function parseAndValidate(
  content: string,
  sourcePath: string,
  viewport: { width: number; height: number },
): DesignBlueprint {
  const raw = JSON.parse(content)

  // Inject metadata
  raw.source = {
    imagePath: sourcePath,
    viewport,
    analyzerModel: ANALYZER_PROVIDER,
  }
  if (!raw.id) raw.id = path.basename(sourcePath, path.extname(sourcePath))
  if (!raw.name) raw.name = raw.id
  if (!raw.schemaVersion) raw.schemaVersion = '1.0.0'

  // Ensure tokens exists with defaults
  if (!raw.tokens) raw.tokens = {}
  if (!raw.tokens.colors) raw.tokens.colors = {}
  if (!raw.tokens.typography) raw.tokens.typography = {}
  if (!raw.tokens.spacing) raw.tokens.spacing = {}

  // Fix up components recursively
  if (raw.components) {
    fixupComponents(raw.components)
  }

  // Compute specificity score
  if (raw.components) {
    let filled = 0
    let total = 0
    function walk(comps: any[]) {
      for (const c of comps) {
        if (c.dimensions) {
          for (const dim of DIMENSION_NAMES) {
            total++
            if (c.dimensions[dim]) filled++
          }
        }
        if (c.children) walk(c.children)
      }
    }
    walk(raw.components)
    raw.specificityScore = total > 0 ? parseFloat((filled / total).toFixed(3)) : 0
  }

  const blueprint = validateBlueprint(raw)
  console.log(`  Extracted ${blueprint.components.length} components, specificity: ${blueprint.specificityScore}`)
  return blueprint
}

/**
 * Fix common LLM output issues in component data before Zod validation.
 * - relationships: object → array
 * - minTargetSize: string → number
 * - zIndex: string → number
 * - numeric fields that come as strings
 */
function fixupComponents(components: any[]) {
  for (const c of components) {
    // Fix relationships: LLM returns various formats, normalize to array
    if (c.relationships && !Array.isArray(c.relationships)) {
      if (typeof c.relationships === 'object') {
        const arr: any[] = []
        for (const [key, val] of Object.entries(c.relationships)) {
          if (typeof val === 'string') {
            arr.push({ type: key, targetSelector: val })
          } else if (Array.isArray(val)) {
            // e.g., { noOverlap: ["sel1", "sel2"] }
            for (const item of val) {
              if (typeof item === 'string') arr.push({ type: key, targetSelector: item })
            }
          } else if (typeof val === 'object' && val !== null) {
            const obj = val as any
            arr.push({
              type: key,
              targetSelector: obj.targetSelector || obj.target || obj.selector || '',
              ...(obj.value != null ? { value: obj.value } : {}),
              ...(obj.gap != null ? { value: parseFloat(String(obj.gap)) } : {}),
            })
          }
        }
        c.relationships = arr
      }
    }

    // Filter out relationships that lack targetSelector (invalid after conversion)
    if (Array.isArray(c.relationships)) {
      c.relationships = c.relationships.filter((r: any) =>
        r && typeof r === 'object' && r.targetSelector
      )
      if (c.relationships.length === 0) delete c.relationships
    }

    // Fix accessibility.minTargetSize: string → number
    if (c.dimensions?.accessibility?.minTargetSize) {
      const val = c.dimensions.accessibility.minTargetSize
      if (typeof val === 'string') {
        c.dimensions.accessibility.minTargetSize = parseFloat(val) || 0
      }
    }

    // Fix layout.zIndex: string → number
    if (c.dimensions?.layout?.zIndex) {
      const val = c.dimensions.layout.zIndex
      if (typeof val === 'string') {
        c.dimensions.layout.zIndex = parseInt(val, 10) || 0
      }
    }

    // Fix hierarchy numeric fields
    if (c.dimensions?.hierarchy) {
      for (const key of ['fontSizeRatio', 'fontWeightRatio', 'prominenceRank', 'contrastRatio']) {
        if (typeof c.dimensions.hierarchy[key] === 'string') {
          c.dimensions.hierarchy[key] = parseFloat(c.dimensions.hierarchy[key]) || 0
        }
      }
    }

    // Fix density numeric fields
    if (c.dimensions?.density) {
      for (const key of ['whitespaceRatio', 'itemsPerRow', 'averageGap']) {
        if (typeof c.dimensions.density[key] === 'string') {
          c.dimensions.density[key] = parseFloat(c.dimensions.density[key]) || 0
        }
      }
    }

    // Fix shadows.elevationLevel
    if (c.dimensions?.shadows?.elevationLevel) {
      if (typeof c.dimensions.shadows.elevationLevel === 'string') {
        c.dimensions.shadows.elevationLevel = parseInt(c.dimensions.shadows.elevationLevel, 10) || 0
      }
    }

    // Recurse into children
    if (c.children && Array.isArray(c.children)) {
      fixupComponents(c.children)
    }
  }
}

/**
 * Spawn `claude -p` and capture stdout.
 */
function spawnClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    const proc = spawn('claude', ['-p', '--output-format', 'text', '--tools', '', '--model', 'sonnet'], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 180_000,
    })

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    proc.stdin.write(prompt)
    proc.stdin.end()

    proc.on('close', (code) => {
      if (code === 0 || stdout.trim()) {
        resolve(stdout.trim())
      } else {
        reject(new Error(`claude -p exited with code ${code}. stderr: ${stderr.slice(0, 500)}`))
      }
    })

    proc.on('error', reject)
  })
}

/**
 * Extract JSON from a response that might be wrapped in markdown code blocks.
 */
function extractJSON(content: string): string {
  // Try raw JSON first
  const trimmed = content.trim()
  if (trimmed.startsWith('{')) return trimmed

  // Try markdown code block
  const codeBlock = content.match(/```(?:json)?\n([\s\S]*?)\n```/)
  if (codeBlock) return codeBlock[1].trim()

  // Try finding the JSON object
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (jsonMatch) return jsonMatch[0]

  return trimmed
}

/**
 * Save a blueprint to JSON file.
 */
export async function saveBlueprint(blueprint: DesignBlueprint, outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(blueprint, null, 2))
  console.log(`  Saved blueprint to ${outputPath}`)
}

/**
 * Load a blueprint from JSON file with validation.
 */
export async function loadBlueprint(filePath: string): Promise<DesignBlueprint> {
  const raw = JSON.parse(await fs.readFile(filePath, 'utf-8'))
  return validateBlueprint(raw)
}
