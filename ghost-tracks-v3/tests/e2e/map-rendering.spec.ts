import { test, expect } from '@playwright/test'

test.describe('Ghost Tracks v3 — Map Rendering (Leaflet/OSM)', () => {
  test('map container is present and visible', async ({ page }) => {
    await page.goto('/')
    const mapContainer = page.getByTestId('leaflet-map')
    await expect(mapContainer).toBeVisible()
  })

  test('map tiles load from CartoDB CDN', async ({ page }) => {
    const tileRequests: string[] = []
    page.on('response', (response) => {
      if (response.url().includes('basemaps.cartocdn.com')) {
        tileRequests.push(response.url())
      }
    })

    await page.goto('/')
    // Wait for tiles to load
    await page.waitForTimeout(3000)

    expect(tileRequests.length).toBeGreaterThan(0)
  })

  test('no JavaScript errors on page load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => {
      errors.push(err.message)
    })

    await page.goto('/')
    await page.waitForTimeout(2000)

    // Filter out known non-critical errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('Google Maps') && !e.includes('ResizeObserver')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('no "This page can\'t load Google Maps" error visible', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)

    const errorText = page.locator("text=This page can't load Google Maps")
    await expect(errorText).not.toBeVisible()
  })

  test('map has attribution from OpenStreetMap/CARTO', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)

    const attribution = page.locator('.leaflet-control-attribution')
    await expect(attribution).toBeVisible()
    const text = await attribution.textContent()
    expect(text).toContain('OSM')
  })

  test('map is interactive — can zoom', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(2000)

    // Leaflet zoom controls should be present
    const zoomIn = page.locator('.leaflet-control-zoom-in')
    await expect(zoomIn).toBeVisible()

    // Click zoom in
    await zoomIn.click()
    // No crash = success
    await page.waitForTimeout(500)
    await expect(page.getByTestId('leaflet-map')).toBeVisible()
  })
})

test.describe('Ghost Tracks v3 — Map + Route Integration', () => {
  test('generating a shape shows a polyline on the map', async ({ page }) => {
    test.setTimeout(90000)

    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    await page.getByTestId('describe-input').fill('a heart')
    await page.getByTestId('describe-button').click()

    // Wait for route display
    const routeDisplay = page.getByTestId('route-display')
    await expect(routeDisplay).toBeVisible({ timeout: 60000 })

    // Check that a Leaflet polyline SVG path was added to the map
    const polylinePath = page.locator('.leaflet-overlay-pane path')
    await expect(polylinePath.first()).toBeVisible({ timeout: 5000 })

    // Verify the polyline has the right color
    const stroke = await polylinePath.first().getAttribute('stroke')
    expect(stroke).toBe('#3B82F6')
  })

  test('Explore mode — clicking map in explore mode works', async ({ page }) => {
    await page.goto('/')

    // Switch to Explore mode
    const exploreBtn = page.locator('button', { hasText: 'Explore' })
    await expect(exploreBtn).toBeVisible()
    await exploreBtn.click()

    // Enter a shape name
    const input = page.locator('input[placeholder*="shape name"]')
    await expect(input).toBeVisible()
    await input.fill('a heart')

    // The pin drop instruction should appear
    const instruction = page.locator('text=Tap the map')
    await expect(instruction).toBeVisible()

    // Click on the map
    const mapContainer = page.getByTestId('leaflet-map')
    await mapContainer.click({ position: { x: 400, y: 300 } })

    // Should show either feasibility result or loading indicator
    const loading = page.locator('text=Checking feasibility')
    const result = page.locator('text=Yes! This works here').or(page.locator('text=Not quite right here'))

    await expect(loading.or(result)).toBeVisible({ timeout: 30000 })
  })
})

test.describe('Ghost Tracks v3 — Console Error Monitoring', () => {
  test('no uncaught errors during describe flow', async ({ page }) => {
    test.setTimeout(90000)
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/')
    await page.getByTestId('mode-describe').click()
    await page.getByTestId('describe-input').fill('a circle')
    await page.getByTestId('describe-button').click()

    // Wait for result or error
    const routeDisplay = page.getByTestId('route-display')
    const errorDiv = page.locator('.text-red-600')
    await expect(routeDisplay.or(errorDiv)).toBeVisible({ timeout: 60000 })

    // Filter non-critical
    const critical = errors.filter(
      (e) => !e.includes('Google Maps') && !e.includes('ResizeObserver') && !e.includes('net::ERR')
    )
    expect(critical).toHaveLength(0)
  })
})
