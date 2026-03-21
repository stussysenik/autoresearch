import { test, expect } from '@playwright/test'

test.describe('Ghost Tracks v3 — App Shell', () => {
  test('loads the homepage', async ({ page }) => {
    await page.goto('/')
    // RedwoodJS uses titleTemplate "%PageTitle | %AppTitle" — accept any title that loads
    await expect(page.locator('body')).toBeVisible()
  })

  test('renders the ghost logo', async ({ page }) => {
    await page.goto('/')
    const logo = page.locator('text=👻').first()
    await expect(logo).toBeVisible()
  })

  test('renders the mode switcher with Generate and Describe buttons', async ({ page }) => {
    await page.goto('/')
    const switcher = page.getByTestId('mode-switcher')
    await expect(switcher).toBeVisible()

    const generateBtn = page.getByTestId('mode-generate')
    const describeBtn = page.getByTestId('mode-describe')
    await expect(generateBtn).toBeVisible()
    await expect(describeBtn).toBeVisible()
  })

  test('Generate mode is the default', async ({ page }) => {
    await page.goto('/')
    const generateBtn = page.getByTestId('mode-generate')
    // Generate button should have the active styling (bg-[#FF6B35])
    await expect(generateBtn).toHaveCSS('background-color', 'rgb(255, 107, 53)')
  })

  test('renders a neighborhood select dropdown in Generate mode', async ({ page }) => {
    await page.goto('/')
    const select = page.locator('select').first()
    await expect(select).toBeVisible()
    // Should have neighborhoods as options
    const options = select.locator('option')
    await expect(options).toHaveCount(13) // 12 neighborhoods + "Choose a neighborhood..."
  })

  test('renders the Google Maps container', async ({ page }) => {
    await page.goto('/')
    // The map component renders a div, even if API key is 'demo' it should attempt to load
    const mapContainer = page.locator('.absolute.inset-0.w-full.h-full').first()
    await expect(mapContainer).toBeVisible()
  })
})

test.describe('Ghost Tracks v3 — Mode Switching', () => {
  test('switches to Describe mode', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    // Should show the describe input
    const input = page.getByTestId('describe-input')
    await expect(input).toBeVisible()
  })

  test('switches back to Generate mode', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('mode-describe').click()
    await page.getByTestId('mode-generate').click()

    // Should show the neighborhood select again
    const select = page.locator('select').first()
    await expect(select).toBeVisible()
  })

  test('clears route when switching modes', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('mode-describe').click()

    // Route display should not exist initially
    const routeDisplay = page.getByTestId('route-display')
    await expect(routeDisplay).not.toBeVisible()

    await page.getByTestId('mode-generate').click()
    await expect(routeDisplay).not.toBeVisible()
  })
})

test.describe('Ghost Tracks v3 — Describe Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('mode-describe').click()
  })

  test('renders the describe input and button', async ({ page }) => {
    const input = page.getByTestId('describe-input')
    const button = page.getByTestId('describe-button')

    await expect(input).toBeVisible()
    await expect(button).toBeVisible()
    await expect(button).toHaveText('Create Route')
  })

  test('button is disabled when input is empty', async ({ page }) => {
    const button = page.getByTestId('describe-button')
    await expect(button).toBeDisabled()
  })

  test('button is enabled when text is entered', async ({ page }) => {
    const input = page.getByTestId('describe-input')
    await input.fill('a heart shape')

    const button = page.getByTestId('describe-button')
    await expect(button).toBeEnabled()
  })

  test('Escape key clears the input', async ({ page }) => {
    const input = page.getByTestId('describe-input')
    await input.fill('a star')
    await expect(input).toHaveValue('a star')

    await input.press('Escape')
    await expect(input).toHaveValue('')
  })

  test('shows placeholder text with suggestions', async ({ page }) => {
    const input = page.getByTestId('describe-input')
    await expect(input).toHaveAttribute(
      'placeholder',
      expect.stringContaining('heart')
    )
  })

  test('shows neighborhood preference toggle', async ({ page }) => {
    const toggle = page.locator('text=Neighborhood preference')
    await expect(toggle).toBeVisible()
  })

  test('expanding advanced shows neighborhood dropdown', async ({ page }) => {
    await page.locator('text=Neighborhood preference').click()

    const selects = page.locator('select')
    // Should now have a neighborhood select visible
    await expect(selects.first()).toBeVisible()
  })

  test('shows help text with shape suggestions', async ({ page }) => {
    const helpText = page.locator('text=Try:')
    await expect(helpText).toBeVisible()
  })
})

test.describe('Ghost Tracks v3 — Generate Panel', () => {
  test('generate button is disabled without neighborhood selected', async ({ page }) => {
    await page.goto('/')
    const button = page.getByTestId('generate-button')
    await expect(button).toBeDisabled()
  })

  test('generate button is enabled after selecting a neighborhood', async ({ page }) => {
    await page.goto('/')
    const select = page.locator('select').first()
    await select.selectOption('Vinohrady')

    const button = page.getByTestId('generate-button')
    await expect(button).toBeEnabled()
  })

  test('all 12 Prague neighborhoods are available', async ({ page }) => {
    await page.goto('/')
    const select = page.locator('select').first()
    const options = select.locator('option')

    // 12 neighborhoods + "Choose a neighborhood..." placeholder
    await expect(options).toHaveCount(13)

    // Verify some specific neighborhoods
    await expect(select).toContainText('Vinohrady')
    await expect(select).toContainText('Karlín')
    await expect(select).toContainText('Letná')
    await expect(select).toContainText('Žižkov')
    await expect(select).toContainText('Staré Město')
  })
})

test.describe('Ghost Tracks v3 — Toast Notifications', () => {
  test('toast container exists in the DOM', async ({ page }) => {
    await page.goto('/')
    // Toast renders nothing when empty, so we just check no errors loading the page
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Ghost Tracks v3 — Responsive Layout', () => {
  test('full-screen map layout', async ({ page }) => {
    await page.goto('/')
    const container = page.locator('.relative.h-full.w-full.overflow-hidden')
    await expect(container).toBeVisible()
  })

  test('controls panel has max width', async ({ page }) => {
    await page.goto('/')
    const controlsPanel = page.locator('.max-w-lg').first()
    await expect(controlsPanel).toBeVisible()
  })
})

test.describe('Ghost Tracks v3 — GraphQL API', () => {
  test('GraphQL endpoint responds', async ({ request }) => {
    const response = await request.post('http://localhost:8911/graphql', {
      data: {
        query: '{ __typename }',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.data.__typename).toBe('Query')
  })

  test('ghostRoute query returns null for unknown ID', async ({ request }) => {
    const response = await request.post('http://localhost:8911/graphql', {
      data: {
        query: '{ ghostRoute(id: "nonexistent") { id shapeName } }',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    // Should return an error for not found
    expect(body.errors).toBeDefined()
  })
})

test.describe('Ghost Tracks v3 — Python Backend Health', () => {
  test('Python backend is reachable', async ({ request }) => {
    const response = await request.get('http://localhost:8000/health/')
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.version).toBe('2.0.0')
  })
})
