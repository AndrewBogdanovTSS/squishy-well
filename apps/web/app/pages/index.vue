<template>
  <main class="landing">
    <div class="glow" aria-hidden="true" />
    <section>
      <p class="kicker">NUXT · TRESJS · WEBGPU · TSL</p>
      <h1>NEON<span>WELL</span></h1>
      <p class="lede">
        A guideline tetris with SRS kicks, lock delay and DAS/ARR, rendered on a WebGPU
        pipeline with compute-shader debris.
      </p>
      <div class="actions">
        <nuxt-link to="/play" class="cta">PLAY</nuxt-link>
        <nuxt-link to="/debug" class="ghost">2D DEBUG</nuxt-link>
      </div>
      <ul class="notes">
        <li>Falls back to WebGL2 automatically; particles switch to a CPU pool.</li>
        <li>Respects <code>prefers-reduced-motion</code> and rate-limits flashes.</li>
      </ul>
    </section>
  </main>
</template>

<script setup lang="ts">
useHead({ title: 'NEON WELL — a WebGPU tetris' })
</script>

<style scoped>
.landing {
  height: 100dvh;
  display: grid;
  place-items: center;
  padding: 2rem;
  position: relative;
  overflow: hidden;
}
.glow {
  position: absolute;
  width: 60vmax; height: 60vmax;
  background: radial-gradient(circle, rgba(34, 211, 238, 0.16), transparent 62%);
  filter: blur(30px);
}
section { position: relative; max-width: 34rem; text-align: center; }
.kicker { font-size: 0.66rem; letter-spacing: 0.42em; color: var(--muted); margin: 0 0 1rem; }
h1 {
  margin: 0;
  font-size: clamp(3rem, 12vw, 6rem);
  letter-spacing: 0.06em;
  line-height: 0.9;
  color: var(--accent);
  text-shadow: 0 0 32px rgba(34, 211, 238, 0.55);
}
h1 span { display: block; color: var(--accent-2); text-shadow: 0 0 32px rgba(192, 132, 252, 0.5); }
.lede { color: var(--muted); line-height: 1.6; margin: 1.5rem 0 2rem; font-size: 0.9rem; }
.actions { display: flex; gap: 0.75rem; justify-content: center; }
.cta, .ghost {
  text-decoration: none;
  border: 1px solid var(--accent);
  border-radius: 10px;
  padding: 0.7rem 2rem;
  letter-spacing: 0.24em;
  font-size: 0.78rem;
}
.cta { background: rgba(34, 211, 238, 0.12); }
.ghost { border-color: var(--border); color: var(--muted); }
.notes { list-style: none; padding: 0; margin: 2.5rem 0 0; color: var(--muted); font-size: 0.7rem; line-height: 1.9; }
code { color: var(--accent); }
</style>
