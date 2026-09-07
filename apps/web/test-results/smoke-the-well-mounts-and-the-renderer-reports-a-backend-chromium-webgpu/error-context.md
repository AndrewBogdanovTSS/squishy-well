# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> the well mounts and the renderer reports a backend
- Location: test\smoke.spec.ts:24:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('canvas')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('canvas')

```

```yaml
- text: "[plugin:vite:import-analysis] Failed to resolve import \"#app-manifest\" from \"../../node_modules/.pnpm/nuxt@4.5.2_@babel+plugin-sy_ecdd9141a2f6d0ef6761f478dd65b733/node_modules/nuxt/dist/app/composables/manifest.js?v=8eac79b2\". Does the file exist? Z:/study/squishy-well/node_modules/.pnpm/nuxt@4.5.2_@babel+plugin-sy_ecdd9141a2f6d0ef6761f478dd65b733/node_modules/nuxt/dist/app/composables/manifest.js:17:2 15 | /* webpackIgnore: true */ 16 | /* @vite-ignore */ 17 | \"#app-manifest\" | ^ 18 | ); 19 | else _manifest = $fetch$1(buildAssetsURL(`builds/meta/${(/* @__PURE__ */ useRuntimeConfig()).app.buildId}.json`), { ... at TransformPluginContext._formatLog (file:///Z:/study/squishy-well/node_modules/.pnpm/vite@8.2.2_@types+node@22.2_38a8829c3a7b28a42655cab30236f763/node_modules/vite/dist/node/chunks/node.js:31147:39) at TransformPluginContext.error (file:///Z:/study/squishy-well/node_modules/.pnpm/vite@8.2.2_@types+node@22.2_38a8829c3a7b28a42655cab30236f763/node_modules/vite/dist/node/chunks/node.js:31144:14) at normalizeUrl (file:///Z:/study/squishy-well/node_modules/.pnpm/vite@8.2.2_@types+node@22.2_38a8829c3a7b28a42655cab30236f763/node_modules/vite/dist/node/chunks/node.js:28083:18) at async file:///Z:/study/squishy-well/node_modules/.pnpm/vite@8.2.2_@types+node@22.2_38a8829c3a7b28a42655cab30236f763/node_modules/vite/dist/node/chunks/node.js:28153:30 at async Promise.all (index 6) at async TransformPluginContext.transform (file:///Z:/study/squishy-well/node_modules/.pnpm/vite@8.2.2_@types+node@22.2_38a8829c3a7b28a42655cab30236f763/node_modules/vite/dist/node/chunks/node.js:28119:4) at async EnvironmentPluginContainer.transform (file:///Z:/study/squishy-well/node_modules/.pnpm/vite@8.2.2_@types+node@22.2_38a8829c3a7b28a42655cab30236f763/node_modules/vite/dist/node/chunks/node.js:30932:14) at async loadAndTransform (file:///Z:/study/squishy-well/node_modules/.pnpm/vite@8.2.2_@types+node@22.2_38a8829c3a7b28a42655cab30236f763/node_modules/vite/dist/node/chunks/node.js:20671:26) Click outside, press Esc key, or fix the code to dismiss. You can also disable this overlay by setting"
- code: server.hmr.overlay
- text: to
- code: "false"
- text: in
- code: vite.config.js
- text: .
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
> 29 |   await expect(canvas).toBeVisible()
     |                        ^ Error: expect(locator).toBeVisible() failed
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
  41 |   await expect(page.getByText(/WEBGPU|WEBGL/)).toBeVisible({ timeout: 30_000 })
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