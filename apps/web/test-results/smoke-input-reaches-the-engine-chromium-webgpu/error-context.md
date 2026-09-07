# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> input reaches the engine
- Location: test\smoke.spec.ts:39:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/WEBGPU|WEBGL/)
Expected: visible
Timeout: 30000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 30000ms
  - waiting for getByText(/WEBGPU|WEBGL/)

```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test'
  2  | 
  3  | const IGNORED = [
  4  |   /\[vite\]/,
  5  |   /Suspense.*experimental/i,
  6  |   /WebGPU is experimental/i,
  7  |   /WebGPU is not available/i,
  8  |   /Failed to create WebGPU Context Provider/i,
  9  |   /Download the Vue Devtools/i,
  10 | ]
  11 | 
  12 | function collectErrors(page: import('@playwright/test').Page): string[] {
  13 |   const errors: string[] = []
  14 |   page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  15 |   page.on('console', (m) => {
  16 |     if (m.type() !== 'error') return
  17 |     const text = m.text()
  18 |     if (IGNORED.some((re) => re.test(text))) return
  19 |     errors.push(`console: ${text}`)
  20 |   })
  21 |   return errors
  22 | }
  23 | 
  24 | test('the well mounts and the renderer reports a backend', async ({ page }) => {
  25 |   const errors = collectErrors(page)
  26 |   await page.goto('/play')
  27 | 
  28 |   const canvas = page.locator('canvas')
  29 |   await expect(canvas).toBeVisible()
  30 |   const box = await canvas.boundingBox()
  31 |   expect(box?.width ?? 0).toBeGreaterThan(200)
  32 |   expect(box?.height ?? 0).toBeGreaterThan(200)
  33 | 
  34 |   // the badge only leaves "starting…" once the renderer finished init()
  35 |   await expect(page.getByText(/WEBGPU|WEBGL/)).toBeVisible({ timeout: 30_000 })
  36 |   expect(errors, errors.join('\n')).toEqual([])
  37 | })
  38 | 
  39 | test('input reaches the engine', async ({ page }) => {
  40 |   await page.goto('/play')
> 41 |   await expect(page.getByText(/WEBGPU|WEBGL/)).toBeVisible({ timeout: 30_000 })
     |                                                ^ Error: expect(locator).toBeVisible() failed
  42 | 
  43 |   const score = page.getByText('SCORE').locator('xpath=following-sibling::dd[1]')
  44 |   await expect(score).toHaveText('0')
  45 |   await page.keyboard.press('Space') // hard drop scores 2 per row
  46 |   await expect(score).not.toHaveText('0')
  47 | })
  48 | 
  49 | test('the bot clears lines without a console error', async ({ page }) => {
  50 |   const errors = collectErrors(page)
  51 |   await page.goto('/play?bot=1')
  52 |   await expect(page.getByText(/WEBGPU|WEBGL/)).toBeVisible({ timeout: 30_000 })
  53 | 
  54 |   const lines = page.getByText('LINES').locator('xpath=following-sibling::dd[1]')
  55 |   await expect(lines).not.toHaveText('0', { timeout: 60_000 })
  56 |   expect(errors, errors.join('\n')).toEqual([])
  57 | })
  58 | 
  59 | test('the 2D reference renderer plays the same game', async ({ page }) => {
  60 |   const errors = collectErrors(page)
  61 |   await page.goto('/debug?bot=1')
  62 |   await expect(page.locator('canvas.board2d')).toBeVisible()
  63 |   await page.waitForTimeout(8000)
  64 |   await expect(page.getByText(/phase/)).toBeVisible()
  65 |   expect(errors, errors.join('\n')).toEqual([])
  66 | })
  67 | 
```