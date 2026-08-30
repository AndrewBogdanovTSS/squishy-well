export default defineNuxtConfig({
  compatibilityDate: '2025-08-01',
  modules: ['@tresjs/nuxt', '@pinia/nuxt'],
  devtools: { enabled: false },

  routeRules: {
    // the game is a pure client-side app: WebGPU init is async and there is
    // no navigator.gpu on the server, so SSR would only cause hydration pain
    '/play': { ssr: false },
    '/debug': { ssr: false },
    '/': { prerender: true },
  },

  app: {
    head: {
      title: 'NEON WELL',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'A WebGPU tetris built with Nuxt, TresJS and TSL.' },
        { name: 'color-scheme', content: 'dark' },
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
