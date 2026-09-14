<template>
  <!--
    @vite-pwa/nuxt's actual manifest-link injection: `VitePwaManifest` is a
    real, auto-registered component (not a plugin) whose entire job is one
    `useHead({link:[{rel:'manifest',...}]})` call in its setup() - it does
    nothing unless something renders it. Not mentioned in the module's own
    Nuxt guide as of this writing; found by reading
    node_modules/@vite-pwa/nuxt's actual runtime/components source after the
    manifest link never appeared despite manifest.webmanifest and sw.js both
    building correctly.
  -->
  <VitePwaManifest />
  <nuxt-page />
</template>
