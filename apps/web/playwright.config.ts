import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke only. Visual regression of a 3D scene is not attempted on purpose:
 * pixel output differs between drivers, GPUs and three releases, so those
 * snapshots fail for reasons that have nothing to do with the game.
 * The deterministic checks live in the core's vitest suite instead.
 */
export default defineConfig({
  testDir: './test',
  timeout: 90_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium-webgpu',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--enable-unsafe-webgpu',
            '--enable-features=Vulkan',
            '--ignore-gpu-blocklist',
          ],
        },
      },
    },
    {
      // forces the fallback path: same scene, WebGL2 backend, CPU particles
      name: 'chromium-webgl',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--disable-features=WebGPU', '--enable-unsafe-swiftshader'],
        },
      },
    },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
