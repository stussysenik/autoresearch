/**
 * Fidelity Scorer
 *
 * Computes a composite fidelity score comparing a built UI against the original design.
 * This is the dependent variable in the ablation study.
 *
 * Formula:
 *   FidelityScore = 0.3 * CPR + 0.4 * VDS + 0.3 * SSIM
 *
 * Three sub-scores:
 *   CPR (Constraint Pass Rate): passed assertions / total assertions
 *     - Binary, objective. Did the test pass or fail?
 *
 *   VDS (Visual Diff Score): 1 - diffPixelRatio
 *     - Pixel-level comparison. How many pixels differ?
 *
 *   SSIM (Structural Similarity): perceptual similarity metric
 *     - Structural comparison via pixelmatch. Captures luminance, contrast, structure.
 *
 * The 0.4 weight on VDS reflects that visual appearance is the ultimate ground truth.
 * CPR and SSIM provide complementary objective and perceptual signals.
 */

import fs from 'fs/promises'
import path from 'path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'

export interface FidelityScore {
  /** Composite fidelity score (0-1, higher is better) */
  composite: number
  /** Constraint Pass Rate: passed / total */
  cpr: number
  /** Visual Diff Score: 1 - diffPixelRatio */
  vds: number
  /** Structural Similarity via pixelmatch */
  ssim: number
  /** Raw data for analysis */
  details: {
    passedAssertions: number
    totalAssertions: number
    diffPixels: number
    totalPixels: number
    matchThreshold: number
  }
}

/** Weights for the composite score formula */
const WEIGHTS = { cpr: 0.3, vds: 0.4, ssim: 0.3 }

/**
 * Compute the Constraint Pass Rate from Playwright test results.
 *
 * @param testResultsPath - Path to Playwright's JSON reporter output
 * @returns CPR between 0 and 1
 */
export async function computeCPR(testResultsPath: string): Promise<{ cpr: number; passed: number; total: number }> {
  const raw = JSON.parse(await fs.readFile(testResultsPath, 'utf-8'))

  let passed = 0
  let total = 0

  // Playwright JSON reporter format
  for (const suite of raw.suites || []) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        total++
        if (test.status === 'expected' || test.status === 'passed') {
          passed++
        }
      }
    }
  }

  // Handle nested suites
  function walkSuites(suites: any[]) {
    for (const suite of suites) {
      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          total++
          if (test.status === 'expected' || test.status === 'passed') {
            passed++
          }
        }
      }
      if (suite.suites) walkSuites(suite.suites)
    }
  }

  // Reset and use recursive walk
  passed = 0
  total = 0
  walkSuites(raw.suites || [])

  return { cpr: total > 0 ? passed / total : 0, passed, total }
}

/**
 * Compute Visual Diff Score and SSIM between two screenshots.
 *
 * @param originalPath - Path to the original design screenshot (PNG)
 * @param builtPath - Path to the screenshot of the built UI (PNG)
 * @param diffOutputPath - Optional path to save the diff image
 * @returns VDS and SSIM scores
 */
export async function computeVisualScores(
  originalPath: string,
  builtPath: string,
  diffOutputPath?: string,
): Promise<{ vds: number; ssim: number; diffPixels: number; totalPixels: number }> {
  const originalBuffer = await fs.readFile(originalPath)
  const builtBuffer = await fs.readFile(builtPath)

  const original = PNG.sync.read(originalBuffer)
  const built = PNG.sync.read(builtBuffer)

  // Ensure same dimensions (resize built to match original if needed)
  const width = Math.min(original.width, built.width)
  const height = Math.min(original.height, built.height)
  const totalPixels = width * height

  // Create output diff image
  const diff = new PNG({ width, height })

  // pixelmatch returns the number of mismatched pixels
  // threshold: 0.1 is a good default (higher = more tolerant)
  const diffPixels = pixelmatch(
    original.data,
    built.data,
    diff.data,
    width,
    height,
    { threshold: 0.1, includeAA: false },
  )

  // VDS: 1 - diffRatio (1.0 = perfect match, 0.0 = completely different)
  const vds = 1 - (diffPixels / totalPixels)

  // SSIM approximation via pixelmatch with stricter threshold
  // Using a tighter threshold gives us a structural similarity proxy
  const ssimDiffPixels = pixelmatch(
    original.data,
    built.data,
    null,
    width,
    height,
    { threshold: 0.05, includeAA: false },
  )
  const ssim = 1 - (ssimDiffPixels / totalPixels)

  // Save diff image if requested
  if (diffOutputPath) {
    await fs.mkdir(path.dirname(diffOutputPath), { recursive: true })
    await fs.writeFile(diffOutputPath, PNG.sync.write(diff))
  }

  return { vds, ssim, diffPixels, totalPixels }
}

/**
 * Compute the full composite fidelity score.
 *
 * @param testResultsPath - Playwright JSON test results
 * @param originalScreenshot - Original design screenshot
 * @param builtScreenshot - Screenshot of the built UI
 * @param diffOutputPath - Optional diff image output
 */
export async function computeFidelityScore(
  testResultsPath: string,
  originalScreenshot: string,
  builtScreenshot: string,
  diffOutputPath?: string,
): Promise<FidelityScore> {
  const { cpr, passed, total } = await computeCPR(testResultsPath)
  const { vds, ssim, diffPixels, totalPixels } = await computeVisualScores(
    originalScreenshot,
    builtScreenshot,
    diffOutputPath,
  )

  const composite = WEIGHTS.cpr * cpr + WEIGHTS.vds * vds + WEIGHTS.ssim * ssim

  return {
    composite: parseFloat(composite.toFixed(4)),
    cpr: parseFloat(cpr.toFixed(4)),
    vds: parseFloat(vds.toFixed(4)),
    ssim: parseFloat(ssim.toFixed(4)),
    details: {
      passedAssertions: passed,
      totalAssertions: total,
      diffPixels,
      totalPixels,
      matchThreshold: 0.1,
    },
  }
}

/**
 * Save fidelity scores to a JSON file.
 * Accepts either raw FidelityScore records or enriched variant score objects.
 */
export async function saveScores(
  scores: Record<string, unknown>,
  outputPath: string,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, JSON.stringify(scores, null, 2))
  console.log(`  Saved scores to ${outputPath}`)
}
