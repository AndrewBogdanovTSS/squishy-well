import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

/**
 * Generates the full PWA icon set (favicon, apple-touch-icon, maskable and
 * plain 192/512 manifest icons) from the one source SVG - `pwa-assets-generator`
 * run manually (`pnpm dlx @vite-pwa/assets-generator`) rather than automatically
 * so the generated PNGs are committed, ordinary static files, not something the
 * build regenerates - see the comment in public/logo.svg for why the source
 * looks the way it does.
 */
export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset,
  images: ['public/logo.svg'],
})
