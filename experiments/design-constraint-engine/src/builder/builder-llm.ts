/**
 * Builder LLM
 *
 * Calls an LLM to generate HTML from a builder prompt. Supports multiple providers:
 *   - "claude": Uses `claude -p` (Claude Code headless mode) — zero API key needed
 *   - "codex": Uses `codex --full-auto` (OpenAI Codex CLI)
 *   - "openai": Uses OpenAI SDK directly (requires OPENAI_API_KEY)
 *
 * The Builder LLM receives:
 *   1. A Playwright test file (the spec it must satisfy)
 *   2. A constraint summary (supplementary context)
 *   3. Viewport dimensions
 *
 * It returns a single HTML file with inline CSS that should pass the tests.
 *
 * Environment variables:
 *   BUILDER_PROVIDER    - Which provider to use (default: claude)
 *   BUILDER_MODEL       - Model override for openai provider (default: gpt-4o)
 *   BUILDER_TEMPERATURE - Generation temperature for openai provider (default: 0.2)
 */

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

type Provider = 'claude' | 'codex' | 'openai'

/**
 * Call the Builder LLM to produce HTML that satisfies the given test constraints.
 *
 * @param testCode - The Playwright .spec.ts test file content
 * @param constraintSummary - Human-readable constraint summary
 * @param viewport - Target viewport dimensions
 * @returns The extracted HTML string (starting with <!DOCTYPE html>)
 */
export async function buildWithLLM(
  testCode: string,
  constraintSummary: string,
  viewport: { width: number; height: number },
): Promise<string> {
  const provider = (process.env.BUILDER_PROVIDER || 'claude') as Provider
  const prompt = generateBuilderPrompt(testCode, constraintSummary, viewport)

  console.log(`  Calling Builder LLM (provider=${provider})...`)

  let content: string

  switch (provider) {
    case 'claude':
      content = await callClaude(prompt)
      break
    case 'codex':
      content = await callCodex(prompt)
      break
    case 'openai':
      content = await callOpenAI(prompt)
      break
    default:
      throw new Error(`Unknown BUILDER_PROVIDER: ${provider}. Use claude, codex, or openai.`)
  }

  const html = extractHTML(content)
  console.log(`  Builder LLM produced ${html.length} chars of HTML`)
  return html
}

/**
 * Use `claude -p` (Claude Code headless mode) to generate HTML.
 * Zero API key configuration needed — uses the authenticated Claude CLI.
 */
async function callClaude(prompt: string): Promise<string> {
  // --tools "" disables all tools so Claude doesn't read files or add commentary
  // --output-format text gives raw response without JSON wrapping
  const output = await spawnCapture('claude', [
    '-p',
    '--output-format', 'text',
    '--tools', '',
    '--model', 'sonnet',
  ], {
    stdin: prompt,
    timeout: 300_000,
  })
  return output
}

/**
 * Use `codex --full-auto` (OpenAI Codex CLI) to generate HTML.
 * Uses Codex's authenticated session.
 */
async function callCodex(prompt: string): Promise<string> {
  // Codex works best with a direct prompt, writing result to a file
  const tmpDir = path.join(os.tmpdir(), `dce-codex-${Date.now()}`)
  const outputFile = path.join(tmpDir, 'output.html')
  await fs.mkdir(tmpDir, { recursive: true })

  const codexPrompt = `${prompt}\n\nWrite the complete HTML file to ${outputFile}. Do not explain, just write the file.`

  try {
    await spawnCapture('codex', ['--full-auto', codexPrompt], {
      cwd: tmpDir,
      timeout: 120_000,
    })
    return await fs.readFile(outputFile, 'utf-8')
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
  }
}

/**
 * Use OpenAI SDK directly. Requires OPENAI_API_KEY.
 */
async function callOpenAI(prompt: string): Promise<string> {
  // Dynamic import so the module doesn't fail if openai isn't installed
  const { default: OpenAI } = await import('openai')
  const openai = new OpenAI()
  const model = process.env.BUILDER_MODEL || 'gpt-4o'
  const temperature = parseFloat(process.env.BUILDER_TEMPERATURE || '0.2')

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    max_tokens: 8000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned empty response')
  return content
}

/**
 * Spawn a child process and capture its stdout.
 */
function spawnCapture(
  cmd: string,
  args: string[],
  opts: { stdin?: string; cwd?: string; timeout?: number } = {},
): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''

    const proc = spawn(cmd, args, {
      cwd: opts.cwd || process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: opts.timeout || 180_000,
    })

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    // Pipe prompt via stdin if provided
    if (opts.stdin) {
      proc.stdin.write(opts.stdin)
      proc.stdin.end()
    }

    proc.on('close', (code) => {
      if (code === 0 || stdout.trim()) {
        resolve(stdout)
      } else {
        reject(new Error(`${cmd} exited with code ${code}. stderr: ${stderr.slice(0, 500)}`))
      }
    })

    proc.on('error', reject)
  })
}

/**
 * Generate the prompt sent to the Builder LLM.
 * The test file IS the spec — the builder must produce HTML/CSS
 * that makes every assertion pass.
 */
function generateBuilderPrompt(
  testCode: string,
  constraintSummary: string,
  viewport: { width: number; height: number },
): string {
  return `# Build a UI that passes these Playwright tests

You are a frontend developer. Build a single HTML file (with inline CSS) that passes ALL of the following Playwright tests.

## Requirements
- Single HTML file with all CSS inline in a <style> tag
- Viewport: ${viewport.width}x${viewport.height}px
- Use data-testid attributes as specified in the test selectors
- Use exact CSS values that match the test expectations
- No external dependencies (fonts can be system fonts)

## Playwright Test File

\`\`\`typescript
${testCode}
\`\`\`

## Design Constraint Summary

${constraintSummary}

## Output Format

Return ONLY the complete HTML file. No explanation, no markdown wrapping.
Start with <!DOCTYPE html> and end with </html>.`
}

/**
 * Extract HTML from an LLM response.
 *
 * LLMs sometimes wrap their output in markdown code blocks or include
 * explanatory text. This function handles all common formats:
 *   1. Exact DOCTYPE match (cleanest case)
 *   2. Markdown code block extraction (```html ... ```)
 *   3. Fallback: return as-is if it contains <html
 *
 * @throws Error if no HTML can be extracted
 */
export function extractHTML(content: string): string {
  // Try exact DOCTYPE match first (ideal case: model followed instructions)
  const doctype = content.match(/<!DOCTYPE html>[\s\S]*<\/html>/i)
  if (doctype) return doctype[0]

  // Try markdown code block extraction (common with ChatGPT-style responses)
  const codeBlock = content.match(/```(?:html)?\n([\s\S]*?)\n```/)
  if (codeBlock) {
    const inner = codeBlock[1]
    // The code block might contain a full document
    const innerDoctype = inner.match(/<!DOCTYPE html>[\s\S]*<\/html>/i)
    if (innerDoctype) return innerDoctype[0]
    return inner
  }

  // Fallback: return as-is if it contains html tags
  if (content.includes('<html')) return content

  throw new Error('Could not extract HTML from Builder LLM response')
}
