/**
 * Phase 1: Data Collection
 *
 * Captures screenshots of source designs and extracts Blueprint JSONs
 * using the AI vision analyzer. This is the input preparation phase.
 *
 * Workflow:
 *   1. Read source screenshots from data/input/
 *      - Or auto-capture from --url or --html inputs
 *   2. Run each through the image analyzer (LLM vision API)
 *   3. Save validated Blueprint JSONs to data/blueprints/
 *
 * Usage:
 *   bun run fetch
 *   bun run fetch -- --image path/to/screenshot.png
 *   bun run fetch -- --url https://example.com
 *   bun run fetch -- --html path/to/design.html
 */

import fs from 'fs/promises'
import path from 'path'
import { analyzeImage, analyzeHTML, saveBlueprint } from './analyzer/image-analyzer.js'
import { captureScreenshot, closeBrowser } from './utils/screenshot.js'

const DATA_DIR = 'data'
const INPUT_DIR = path.join(DATA_DIR, 'input')
const BLUEPRINTS_DIR = path.join(DATA_DIR, 'blueprints')

/** Parse a named CLI arg: --flag value */
function getArg(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag)
  return idx !== -1 ? args[idx + 1] ?? null : null
}

async function fetchData() {
  console.log('Phase 1: Design Analysis\n')

  const args = process.argv.slice(2)
  const singleImage = getArg(args, '--image')
  const urlInput = getArg(args, '--url')
  const htmlInput = getArg(args, '--html')

  // Ensure directories exist
  await fs.mkdir(INPUT_DIR, { recursive: true })
  await fs.mkdir(BLUEPRINTS_DIR, { recursive: true })

  // Build image paths list, auto-capturing screenshots when needed
  let imagePaths: string[]

  if (urlInput) {
    // --url: capture screenshot from a live URL
    const name = new URL(urlInput).hostname.replace(/\./g, '-')
    const outputPng = path.join(INPUT_DIR, `${name}.png`)
    console.log(`Capturing screenshot from URL: ${urlInput}`)
    await captureScreenshot(urlInput, outputPng)
    imagePaths = [outputPng]
  } else if (htmlInput) {
    // --html: analyze HTML source directly (more accurate than screenshot)
    // Also capture a screenshot for later visual comparison scoring
    const name = path.basename(htmlInput, path.extname(htmlInput))
    const outputPng = path.join(INPUT_DIR, `${name}.png`)
    console.log(`Analyzing HTML source directly: ${htmlInput}`)
    console.log(`Also capturing screenshot for visual comparison...`)
    await captureScreenshot(htmlInput, outputPng)

    try {
      const blueprint = await analyzeHTML(htmlInput, {
        designContext: 'UI component HTML source for design constraint extraction',
      })
      const outputPath = path.join(BLUEPRINTS_DIR, `${name}.blueprint.json`)
      await saveBlueprint(blueprint, outputPath)
      console.log(`  Components: ${blueprint.components.length}`)
      console.log(`  Specificity: ${blueprint.specificityScore}`)
      console.log(`  Tokens: ${Object.keys(blueprint.tokens.colors).length} colors`)
    } catch (error) {
      console.error(`  Failed to analyze ${htmlInput}:`, error)
    }

    await closeBrowser()
    console.log('\nPhase 1 complete!')
    console.log(`Blueprints saved to ${BLUEPRINTS_DIR}/`)
    console.log('Next: bun run run')
    return
  } else if (singleImage) {
    imagePaths = [singleImage]
  } else {
    const files = await fs.readdir(INPUT_DIR)
    imagePaths = files
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map(f => path.join(INPUT_DIR, f))

    // If no images but HTML files exist, auto-analyze them
    if (imagePaths.length === 0) {
      const htmlFiles = files
        .filter(f => /\.html$/i.test(f))
        .map(f => path.join(INPUT_DIR, f))

      if (htmlFiles.length > 0) {
        console.log(`No screenshots found, but found ${htmlFiles.length} HTML file(s). Analyzing directly...\n`)
        for (const htmlFile of htmlFiles) {
          const name = path.basename(htmlFile, '.html')
          const outputPng = path.join(INPUT_DIR, `${name}.png`)
          console.log(`\nProcessing: ${path.basename(htmlFile)}`)
          console.log('─'.repeat(40))
          await captureScreenshot(htmlFile, outputPng)
          try {
            const blueprint = await analyzeHTML(htmlFile, {
              designContext: 'UI component HTML source for design constraint extraction',
            })
            const outputPath = path.join(BLUEPRINTS_DIR, `${name}.blueprint.json`)
            await saveBlueprint(blueprint, outputPath)
            console.log(`  Components: ${blueprint.components.length}`)
            console.log(`  Specificity: ${blueprint.specificityScore}`)
            console.log(`  Tokens: ${Object.keys(blueprint.tokens.colors).length} colors`)
          } catch (error) {
            console.error(`  Failed to analyze ${htmlFile}:`, error)
          }
        }
        await closeBrowser()
        console.log('\nPhase 1 complete!')
        console.log(`Blueprints saved to ${BLUEPRINTS_DIR}/`)
        console.log('Next: bun run run')
        return
      }
    }
  }

  if (imagePaths.length === 0) {
    console.log('No input images or HTML files found.')
    console.log(`Place screenshot files (.png, .jpg) or HTML files in ${INPUT_DIR}/`)
    console.log('Or run with:')
    console.log('  bun run fetch -- --image path/to/screenshot.png')
    console.log('  bun run fetch -- --url https://example.com')
    console.log('  bun run fetch -- --html path/to/design.html')

    // Create a sample login card HTML for testing
    console.log('\nCreating sample login card for testing...')
    await createSampleDesign()
    return
  }

  console.log(`Found ${imagePaths.length} input image(s)\n`)

  // Analyze each image
  for (const imagePath of imagePaths) {
    console.log(`\nAnalyzing: ${path.basename(imagePath)}`)
    console.log('─'.repeat(40))

    try {
      const blueprint = await analyzeImage(imagePath, {
        designContext: 'UI component screenshot for design constraint extraction',
      })

      const outputPath = path.join(
        BLUEPRINTS_DIR,
        path.basename(imagePath, path.extname(imagePath)) + '.blueprint.json',
      )
      await saveBlueprint(blueprint, outputPath)

      console.log(`  Components: ${blueprint.components.length}`)
      console.log(`  Specificity: ${blueprint.specificityScore}`)
      console.log(`  Tokens: ${Object.keys(blueprint.tokens.colors).length} colors`)
    } catch (error) {
      console.error(`  Failed to analyze ${imagePath}:`, error)
    }
  }

  // Clean up browser if we launched one
  await closeBrowser()

  console.log('\nPhase 1 complete!')
  console.log(`Blueprints saved to ${BLUEPRINTS_DIR}/`)
  console.log('Next: bun run run')
}

/**
 * Create a sample login card HTML file for testing the pipeline.
 * This serves as a known-good input for development and verification.
 */
async function createSampleDesign() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Card</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: rgb(243, 244, 246);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    [data-testid="login-card"] {
      background-color: rgb(255, 255, 255);
      border-radius: 12px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);
      padding: 32px;
      width: 400px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    [data-testid="login-title"] {
      font-size: 24px;
      font-weight: 700;
      color: rgb(17, 24, 39);
      text-align: center;
      line-height: 1.2;
    }
    [data-testid="login-subtitle"] {
      font-size: 14px;
      font-weight: 400;
      color: rgb(107, 114, 128);
      text-align: center;
      margin-top: -16px;
    }
    [data-testid="email-input"],
    [data-testid="password-input"] {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid rgb(209, 213, 219);
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.5;
      color: rgb(17, 24, 39);
      background-color: rgb(255, 255, 255);
      outline: none;
      transition: border-color 0.2s ease;
    }
    [data-testid="email-input"]:focus,
    [data-testid="password-input"]:focus {
      border-color: rgb(59, 130, 246);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }
    [data-testid="submit-btn"] {
      width: 100%;
      padding: 12px 24px;
      background-color: rgb(59, 130, 246);
      color: rgb(255, 255, 255);
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    [data-testid="submit-btn"]:hover {
      background-color: rgb(37, 99, 235);
    }
    [data-testid="forgot-link"] {
      font-size: 14px;
      color: rgb(59, 130, 246);
      text-align: center;
      text-decoration: none;
      cursor: pointer;
    }
    [data-testid="forgot-link"]:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div data-testid="login-card">
    <h1 data-testid="login-title">Welcome back</h1>
    <p data-testid="login-subtitle">Sign in to your account</p>
    <input data-testid="email-input" type="email" placeholder="Email address" />
    <input data-testid="password-input" type="password" placeholder="Password" />
    <button data-testid="submit-btn">Sign in</button>
    <a data-testid="forgot-link" href="#">Forgot password?</a>
  </div>
</body>
</html>`

  await fs.writeFile(path.join(INPUT_DIR, 'login-card.html'), html)
  console.log(`Saved sample login card to ${INPUT_DIR}/login-card.html`)
  console.log('Take a screenshot of this file and save it as data/input/login-card.png')
  console.log('Then re-run: bun run fetch')
}

fetchData().catch(console.error)
