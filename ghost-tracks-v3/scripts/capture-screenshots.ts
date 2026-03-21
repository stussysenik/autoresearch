import { chromium } from 'playwright'

const SCREENSHOTS_DIR = './docs/screenshots'

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  })

  // 1. Hero shot — Generate mode (default) with UI visible
  console.log('1/4 Capturing hero shot (Generate mode)...')
  const heroPage = await context.newPage()
  await heroPage.goto('http://localhost:8910', { waitUntil: 'networkidle' })
  await heroPage.waitForTimeout(4000)
  // Clip to show just the top-left portion with controls + map
  await heroPage.screenshot({
    path: `${SCREENSHOTS_DIR}/hero-generate-mode.png`,
    clip: { x: 0, y: 0, width: 1280, height: 800 },
  })
  await heroPage.close()

  // 2. Describe mode — with input filled
  console.log('2/4 Capturing Describe mode...')
  const describePage = await context.newPage()
  await describePage.goto('http://localhost:8910', { waitUntil: 'networkidle' })
  await describePage.waitForTimeout(3000)
  await describePage.getByTestId('mode-describe').click()
  await describePage.waitForTimeout(800)
  const input = describePage.getByTestId('describe-input')
  await input.fill('a heart shape in Vinohrady')
  await describePage.waitForTimeout(500)
  await describePage.screenshot({
    path: `${SCREENSHOTS_DIR}/describe-mode.png`,
    clip: { x: 0, y: 0, width: 640, height: 400 },
  })
  await describePage.close()

  // 3. Explore mode — pin drop overlay
  console.log('3/4 Capturing Explore mode...')
  const explorePage = await context.newPage()
  await explorePage.goto('http://localhost:8910', { waitUntil: 'networkidle' })
  await explorePage.waitForTimeout(3000)
  await explorePage.locator('button', { hasText: 'Explore' }).click()
  await explorePage.waitForTimeout(800)
  const shapeInput = explorePage.locator('input[placeholder*="shape name"]')
  await shapeInput.fill('a star')
  await explorePage.waitForTimeout(1500)
  await explorePage.screenshot({
    path: `${SCREENSHOTS_DIR}/explore-mode.png`,
    clip: { x: 0, y: 0, width: 640, height: 400 },
  })
  await explorePage.close()

  // 4. Route result — generate a real heart shape
  console.log('4/4 Capturing route result (this may take 30-60s)...')
  const routePage = await context.newPage()
  await routePage.goto('http://localhost:8910', { waitUntil: 'networkidle' })
  await routePage.waitForTimeout(3000)
  await routePage.getByTestId('mode-describe').click()
  await routePage.getByTestId('describe-input').fill('a heart')
  await routePage.getByTestId('describe-button').click()

  try {
    const routeDisplay = routePage.getByTestId('route-display')
    await routeDisplay.waitFor({ state: 'visible', timeout: 60000 })
    await routePage.waitForTimeout(3000) // Let map settle + zoom
    await routePage.screenshot({ path: `${SCREENSHOTS_DIR}/route-result.png` })
    console.log('Route result captured!')
  } catch {
    console.log('Route generation timed out — skipping route screenshot')
  }
  await routePage.close()

  await browser.close()
  console.log('Done! Screenshots saved to docs/screenshots/')
}

main().catch(console.error)
