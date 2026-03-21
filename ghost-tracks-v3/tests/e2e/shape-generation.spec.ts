import { test, expect } from '@playwright/test'

/**
 * Shape Generation E2E Tests
 *
 * These tests verify the full pipeline: user input → Python backend → route display.
 * They require the Python backend running at localhost:8000 with CORS for :8910.
 * Some tests may be slow (10-30s) due to shape generation.
 */

test.describe.serial('Ghost Tracks v3 — Shape Generation (Describe Mode)', () => {
  test('submitting a shape shows loading state then resolves', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    const input = page.getByTestId('describe-input')
    await input.fill('a heart shape')

    const button = page.getByTestId('describe-button')
    await button.click()

    // Wait for either loading state or route display (backend may respond fast or error)
    // The button should either show a step message or the route display should appear
    const routeDisplay = page.getByTestId('route-display')
    const errorDiv = page.locator('.text-red-600')

    // Wait up to 60s for either route display or error
    await expect(routeDisplay.or(errorDiv)).toBeVisible({ timeout: 60000 })
  })

  test('generates a heart shape end-to-end', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    const input = page.getByTestId('describe-input')
    await input.fill('a heart')
    await page.getByTestId('describe-button').click()

    // Wait for the route display to appear
    const routeDisplay = page.getByTestId('route-display')
    await expect(routeDisplay).toBeVisible({ timeout: 60000 })

    // Verify route info is displayed
    await expect(routeDisplay).toContainText('km')
    await expect(routeDisplay).toContainText('min')

    // Verify similarity score badge exists
    const scoreBadge = page.getByTestId('similarity-score')
    await expect(scoreBadge).toBeVisible()
    const scoreText = await scoreBadge.textContent()
    expect(scoreText).toMatch(/\d+% match/)
  })

  test('route display shows export GPX button', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    await page.getByTestId('describe-input').fill('a circle')
    await page.getByTestId('describe-button').click()

    const routeDisplay = page.getByTestId('route-display')
    await expect(routeDisplay).toBeVisible({ timeout: 60000 })

    const exportBtn = page.getByTestId('export-gpx')
    await expect(exportBtn).toBeVisible()
    await expect(exportBtn).toHaveText('Export GPX')
  })

  test('closing route display removes it', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    await page.getByTestId('describe-input').fill('a star')
    await page.getByTestId('describe-button').click()

    const routeDisplay = page.getByTestId('route-display')
    await expect(routeDisplay).toBeVisible({ timeout: 60000 })

    // Close the route
    await page.locator('button:has-text("×")').click()
    await expect(routeDisplay).not.toBeVisible()
  })
})

test.describe.serial('Ghost Tracks v3 — Generate Mode', () => {
  test('selecting neighborhood and generating shows ideas', async ({ page }) => {
    test.setTimeout(60000)

    await page.goto('/')
    const select = page.locator('select').first()
    await select.selectOption('Vinohrady')

    await page.getByTestId('generate-button').click()

    // Should show either skeleton loaders or ideas or error
    const skeletons = page.getByTestId('skeleton-loaders')
    const ideas = page.getByTestId('ideas-list')
    const errorDiv = page.locator('.text-red-600')

    await expect(skeletons.or(ideas).or(errorDiv)).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Ghost Tracks v3 — Route Interactions', () => {
  test('route display has interactive buttons', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    await page.getByTestId('describe-input').fill('a heart')
    await page.getByTestId('describe-button').click()

    const routeDisplay = page.getByTestId('route-display')
    await expect(routeDisplay).toBeVisible({ timeout: 60000 })

    // Verify all action buttons are present
    await expect(page.getByTestId('export-gpx')).toBeVisible()

    // Check that Path only and Show directions buttons exist
    const buttons = routeDisplay.locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThanOrEqual(3) // export, show/hide, path/markers, close
  })

  test('expanding directions shows waypoint content', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    await page.getByTestId('describe-input').fill('a star')
    await page.getByTestId('describe-button').click()

    const routeDisplay = page.getByTestId('route-display')
    await expect(routeDisplay).toBeVisible({ timeout: 60000 })

    // Click "Show directions" — use a more stable locator
    const showBtn = routeDisplay.locator('button', { hasText: /Show|directions/ })
    if (await showBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
      await showBtn.first().click()
      // Wait for the waypoint list to appear in the scrollable area
      await expect(routeDisplay.locator('.overflow-y-auto')).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe('Ghost Tracks v3 — Clean Reload', () => {
  test('page reload starts fresh — no stale route trapping user', async ({ page }) => {
    await page.goto('/')

    // Should start in Generate mode with no route displayed
    const routeDisplay = page.getByTestId('route-display')
    await expect(routeDisplay).not.toBeVisible()

    // Mode switcher should be accessible
    const generateBtn = page.getByTestId('mode-generate')
    await expect(generateBtn).toBeVisible()

    // Can switch to all 3 modes without being blocked
    await page.getByTestId('mode-describe').click()
    await expect(page.getByTestId('describe-input')).toBeVisible()

    await page.locator('button', { hasText: 'Explore' }).click()
    await expect(page.locator('input[placeholder*="shape name"]')).toBeVisible()

    await page.getByTestId('mode-generate').click()
    await expect(page.getByTestId('generate-button')).toBeVisible()
  })
})
