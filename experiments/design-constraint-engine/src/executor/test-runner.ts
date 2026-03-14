/**
 * Test Runner
 *
 * Spawns Playwright tests as a child process and collects JSON results.
 * Non-zero exit codes are expected — test failures are data, not errors.
 *
 * The runner:
 *   1. Spawns `bunx playwright test <file> --reporter=json`
 *   2. Captures stdout (JSON test results)
 *   3. Parses pass/fail counts
 *   4. Saves JSON results to the results directory
 *
 * Why a child process? Playwright test runner expects to own the process.
 * Spawning it lets us capture structured output without fighting the test harness.
 */

import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

export interface TestRunResult {
  passed: number
  failed: number
  total: number
  /** Path to the saved JSON results file */
  resultsPath: string
}

/**
 * Run Playwright tests against the currently running test server.
 *
 * @param testFile - Path to the .spec.ts file to run
 * @param resultsDir - Directory to save JSON results in
 * @returns Test results with pass/fail counts and path to JSON output
 */
export async function runPlaywrightTests(
  testFile: string,
  resultsDir: string,
): Promise<TestRunResult> {
  await fs.mkdir(resultsDir, { recursive: true })

  const baseName = path.basename(testFile, '.spec.ts')
  const resultsPath = path.join(resultsDir, `${baseName}.test-results.json`)

  console.log(`  Running Playwright tests: ${path.basename(testFile)}`)

  const stdout = await new Promise<string>((resolve, reject) => {
    let output = ''
    let stderr = ''

    const proc = spawn('bunx', [
      'playwright', 'test',
      testFile,
      '--reporter=json',
    ], {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on('close', (code) => {
      // Non-zero exit is expected when tests fail — that's data, not an error
      if (output.trim()) {
        resolve(output)
      } else if (code !== 0) {
        // Playwright sometimes outputs JSON to stderr on failure
        if (stderr.includes('"suites"')) {
          resolve(stderr)
        }
        // No JSON output at all — something went wrong
        reject(new Error(`Playwright exited with code ${code}. stderr: ${stderr.slice(0, 500)}`))
      } else {
        resolve(output)
      }
    })

    proc.on('error', reject)
  })

  // Save raw JSON output
  await fs.writeFile(resultsPath, stdout)

  // Parse results to extract pass/fail counts
  let passed = 0
  let failed = 0

  try {
    const results = JSON.parse(stdout)
    walkSuites(results.suites || [], (status) => {
      if (status === 'expected' || status === 'passed') passed++
      else failed++
    })
  } catch {
    console.log(`  Warning: Could not parse test results JSON, raw output saved to ${resultsPath}`)
  }

  const total = passed + failed
  console.log(`  Test results: ${passed}/${total} passed (${failed} failed)`)

  return { passed, failed, total, resultsPath }
}

/** Walk nested Playwright suite structure to count test statuses */
function walkSuites(suites: any[], callback: (status: string) => void) {
  for (const suite of suites) {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        callback(test.status)
      }
    }
    if (suite.suites) walkSuites(suite.suites, callback)
  }
}
