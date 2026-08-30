import { expect, test } from '@playwright/test'

const IGNORED = [
  /\[vite\]/,
  /Suspense.*experimental/i,
  /WebGPU is experimental/i,
  /WebGPU is not available/i,
  /Failed to create WebGPU Context Provider/i,
  /Download the Vue Devtools/i,
]

function collectErrors(page: import('@playwright/test').Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    if (IGNORED.some((re) => re.test(text))) return
    errors.push(`console: ${text}`)
  })
  return errors
}

test('the well mounts and the renderer reports a backend', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/play')

  const canvas = page.locator('canvas')
  await expect(canvas).toBeVisible()
  const box = await canvas.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(200)
  expect(box?.height ?? 0).toBeGreaterThan(200)

  // the badge only leaves "starting…" once the renderer finished init()
  await expect(page.getByText(/WEBGPU|WEBGL/)).toBeVisible({ timeout: 30_000 })
  expect(errors, errors.join('\n')).toEqual([])
})

test('input reaches the engine', async ({ page }) => {
  await page.goto('/play')
  await expect(page.getByText(/WEBGPU|WEBGL/)).toBeVisible({ timeout: 30_000 })

  const score = page.getByText('SCORE').locator('xpath=following-sibling::dd[1]')
  await expect(score).toHaveText('0')
  await page.keyboard.press('Space') // hard drop scores 2 per row
  await expect(score).not.toHaveText('0')
})

test('the bot clears lines without a console error', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/play?bot=1')
  await expect(page.getByText(/WEBGPU|WEBGL/)).toBeVisible({ timeout: 30_000 })

  const lines = page.getByText('LINES').locator('xpath=following-sibling::dd[1]')
  await expect(lines).not.toHaveText('0', { timeout: 60_000 })
  expect(errors, errors.join('\n')).toEqual([])
})

test('the 2D reference renderer plays the same game', async ({ page }) => {
  const errors = collectErrors(page)
  await page.goto('/debug?bot=1')
  await expect(page.locator('canvas.board2d')).toBeVisible()
  await page.waitForTimeout(8000)
  await expect(page.getByText(/phase/)).toBeVisible()
  expect(errors, errors.join('\n')).toEqual([])
})
