export default defineNuxtConfig({
  compatibilityDate: '2025-08-01',
  modules: ['@tresjs/nuxt', '@pinia/nuxt', '@unocss/nuxt', '@vite-pwa/nuxt'],
  devtools: { enabled: false },

  /**
   * Installable + the foundation for offline-first: `generateSW` precaches
   * the built JS/CSS (including /play's and /debug's own chunks - they're
   * ssr:false already, so the service worker serving the same static shell
   * offline that Nuxt already serves them online is not a new code path,
   * just the existing one reachable without a network). Icons came from
   * `pwa-assets.config.ts` + `pnpm exec pwa-assets-generator`, run once and
   * committed - see that file and public/logo.svg.
   *
   * `registerType: 'autoUpdate'` over `'prompt'` on purpose: a `'prompt'`
   * strategy needs its own update-available UI to actually prompt with,
   * which is exactly the kind of "future feature" this is a foundation
   * for, not a thing to stub out half-built today.
   */
  pwa: {
    registerType: 'autoUpdate',
    includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png'],
    manifest: {
      name: 'SQUISHY WELL',
      short_name: 'Squishy Well',
      description: 'A WebGPU tetris built with Nuxt, TresJS and TSL.',
      theme_color: '#05070c',
      background_color: '#05070c',
      display: 'standalone',
      orientation: 'portrait',
      start_url: '/',
      icons: [
        { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      // the 3D build (three/webgpu, TSL, compute shaders) produces some large
      // chunks - default is 2MB, which the WebGPU bundle can clear
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      // `/` is the only route with a real prerendered document in the build
      // output - /play and /debug are ssr:false, so there is no /play/index.html
      // to fall back to. This is the same shell Nuxt already hands those two
      // routes online; offline, the service worker serves the identical cached
      // document and the already-precached client router takes it from there.
      navigateFallback: '/',
    },
    devOptions: {
      // service worker under `nuxt dev` too, not just a production build -
      // otherwise the very first thing anyone would check ("is this
      // actually working") needs a full build to answer
      enabled: true,
      type: 'module',
    },
    client: {
      installPrompt: true,
      // The module's own default `client.registerPlugin: true` - restated
      // explicitly, not left to a merge, because specifying `client` at all
      // (for `installPrompt` here) replaces the whole object rather than
      // merging into its defaults; the service worker registration plugin
      // only gets added when this is true, so an implicit merge silently
      // disabling it is exactly what happened on the first pass here - the
      // manifest and sw.js built correctly but nothing on the page ever
      // linked to or registered either.
      registerPlugin: true,
    },
  },

  // @unocss/nuxt defaults preflight to false regardless of what presetWind3
  // itself is told - this is the actual switch. Pulls in Tailwind's base
  // reset layer (border-style:solid by default, among other things) - see
  // uno.config.ts for what that layer changes against this project's own
  // hand-written reset in app.css.
  unocss: { preflight: true },

  routeRules: {
    // the game is a pure client-side app: WebGPU init is async and there is
    // no navigator.gpu on the server, so SSR would only cause hydration pain
    '/play': { ssr: false },
    '/debug': { ssr: false },
    // different reason, same conclusion: settings.ts's `load()`/`persist()`
    // are both localStorage-backed and guard themselves out on the server, so
    // an SSR (or prerendered) pass would render every control at its default
    // value and then visibly snap to the real, persisted one on hydration
    '/settings': { ssr: false },
    '/': { prerender: true },
  },

  app: {
    head: {
      title: 'SQUISHY WELL',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'A WebGPU tetris built with Nuxt, TresJS and TSL.' },
        { name: 'color-scheme', content: 'dark' },
      ],
      // `pnpm exec pwa-assets-generator` prints these three exact tags after
      // generating the PNGs/ico they point at - it does not wire them in on
      // its own, only the manifest's own icons array (a separate list) gets
      // that automatically. Copied verbatim from that command's output.
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
        { rel: 'icon', href: '/logo.svg', sizes: 'any', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
      ],
    },
  },

  css: ['~/assets/app.css'],

  vite: {
    optimizeDeps: {
      // three ships webgpu/tsl as separate entry points; pre-bundling them
      // keeps the dev server from re-optimising on first navigation to /play
      include: ['three', 'three/webgpu', 'three/tsl'],
    },
    build: {
      target: 'esnext',
    },
  },

  typescript: {
    typeCheck: false,
    strict: true,
  },

  experimental: {
    payloadExtraction: false,
  },
})
