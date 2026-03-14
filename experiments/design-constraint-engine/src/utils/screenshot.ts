/**
 * Screenshot Capture Utility
 *
 * Uses Playwright headless browser to capture screenshots of URLs or local HTML files.
 * This closes two gaps in the pipeline:
 *   - Phase 1: Auto-capture source design screenshots from HTML/URL input
 *   - Phase 2: Capture screenshots of Builder LLM output for visual comparison
 *
 * Why Playwright? We already depend on @playwright/test for the constraint tests.
 * Headless Chromium gives pixel-identical rendering to the test environment.
 */

import { chromium, type Browser } from 'playwright'
import path from 'path'
import fs from 'fs/promises'

/** Shared browser instance — launching Chromium is expensive, reuse it */
let _browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    _browser = await chromium.launch({ headless: true })
  }
  return _browser
}

/**
 * Capture a screenshot of a URL or local HTML file.
 *
 * @param input - URL (https://...) or local file path (resolved to file://...)
 * @param outputPath - Where to save the PNG screenshot
 * @param viewport - Browser viewport dimensions (default: 1280x720)
 * @returns Absolute path to the saved screenshot
 *
 * @example
 *   // From a URL
 *   await captureScreenshot('https://example.com', 'screenshot.png')
 *
 *   // From a local HTML file
 *   await captureScreenshot('./data/input/login-card.html', 'screenshot.png')
 *
 *   // With file:// protocol already applied
 *   await captureScreenshot('file:///abs/path/to/file.html', 'screenshot.png')
 */
export async function captureScreenshot(
  input: string,
  outputPath: string,
  viewport: { width: number; height: number } = { width: 1280, height: 720 },
): Promise<string> {
  // Resolve input to a URL
  let url: string
  if (input.startsWith('http://') || input.startsWith('https://') || input.startsWith('file://')) {
    url = input
  } else {
    // Local file path — resolve to absolute and convert to file:// URL
    const absPath = path.resolve(input)
    url = `file://${absPath}`
  }

  // Ensure output directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true })

  const browser = await getBrowser()
  const page = await browser.newPage({ viewport })

  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    // Brief pause for any CSS transitions/animations to settle
    await page.waitForTimeout(500)
    await page.screenshot({ path: outputPath, fullPage: false })
    console.log(`  Screenshot saved: ${outputPath}`)
    return path.resolve(outputPath)
  } finally {
    await page.close()
  }
}

/**
 * Close the shared browser instance.
 * Call this at the end of a pipeline run to clean up.
 */
export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close()
    _browser = null
  }
}
