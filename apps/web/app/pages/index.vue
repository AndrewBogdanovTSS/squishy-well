<template>
  <main class="h-dvh grid place-items-center p-8 relative overflow-hidden">
    <div
      class="absolute w-[60vmax] h-[60vmax] bg-[radial-gradient(circle,rgb(var(--accent-rgb)/16%),transparent_62%)] blur-[30px]"
      aria-hidden="true"
    />
    <section class="relative max-w-136 text-center">
      <p class="text-micro tracking-hero c-$muted m-0 mb-4">NUXT · TRESJS · WEBGPU · TSL</p>
      <h1 class="m-0 text-display tracking-tight leading-[0.9] c-$accent text-shadow-[0_0_32px_rgb(var(--accent-rgb)/55%)]">
        SQUISHY<span class="block c-$accent-2 text-shadow-[0_0_32px_rgb(var(--accent-2-rgb)/50%)]">WELL</span>
      </h1>
      <p class="c-$muted leading-[1.6] mt-6 mx-0 mb-8 text-lead">
        A guideline tetris with SRS kicks, lock delay and DAS/ARR, rendered on a WebGPU
        pipeline with compute-shader debris.
      </p>
      <div class="flex gap-3 justify-center">
        <nuxt-link
          to="/play"
          class="no-underline b b-$accent c-$accent rounded-full py-2.8 px-8 tracking-title text-body bg-[rgb(var(--accent-rgb)/12%)]"
        >
          PLAY
        </nuxt-link>
        <nuxt-link
          to="/debug"
          class="no-underline b b-$border rounded-full py-2.8 px-8 tracking-title text-body c-$muted"
        >
          2D DEBUG
        </nuxt-link>
      </div>
      <ul class="list-none p-0 m-0 mt-10 c-$muted text-label leading-[1.9]">
        <li>Falls back to WebGL2 automatically; particles switch to a CPU pool.</li>
        <li>Respects <code class="c-$accent">prefers-reduced-motion</code> and rate-limits flashes.</li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
useHead({ title: 'SQUISHY WELL — a WebGPU tetris' })
</script>
