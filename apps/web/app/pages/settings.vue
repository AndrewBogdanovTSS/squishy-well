<template>
  <main class="h-dvh grid place-items-center p-8 relative overflow-hidden">
    <div
      class="absolute w-[60vmax] h-[60vmax] bg-[radial-gradient(circle,rgb(var(--accent-rgb)/16%),transparent_62%)] blur-[30px]"
      aria-hidden="true"
    />
    <section class="relative max-w-136 w-full text-center">
      <p class="text-xs tracking-hero c-$muted m-0 mb-4">SETTINGS</p>

      <div class="panel panel-pad f-col gap-2.4 text-left">
        <label class="flex items-center gap-2">
          <input v-model="settings.accessiblePalette" type="checkbox" >
          High-contrast palette
        </label>
        <label class="flex items-center gap-2">
          <input v-model="settings.forceReducedMotion" type="checkbox" >
          Reduce motion &amp; flashes
        </label>
        <label class="flex items-center gap-2">
          <input v-model="settings.muted" type="checkbox" >
          Mute
        </label>
        <label class="flex items-center gap-2 justify-between">
          Volume
          <input v-model.number="settings.volume" type="range" min="0" max="1" step="0.05" >
        </label>
        <label class="flex items-center gap-2 justify-between">
          Quality
          <select v-model="settings.quality">
            <option value="auto">auto</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
            <option value="minimal">minimal</option>
          </select>
        </label>
      </div>

      <div class="f-col gap-3 items-center mt-8">
        <nuxt-link
          to="/debug"
          class="no-underline text-center w-56 b b-$border rounded-full py-2.8 px-8 tracking-title text-md c-$muted"
        >
          2D DEBUG
        </nuxt-link>
        <nuxt-link
          to="/"
          class="no-underline text-center w-56 b b-$accent c-$accent rounded-full py-2.8 px-8 tracking-title text-md bg-[rgb(var(--accent-rgb)/12%)]"
        >
          ← MENU
        </nuxt-link>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
/**
 * The main-menu entry point for the same settings play.vue's in-game overlay
 * edits - identical controls, bound to the identical `useSettings` store, so
 * a change made here is already in effect the next time /play starts a
 * session (and a change made mid-game there is already reflected here on next
 * visit). Nothing session-specific lives on this page: every control here is
 * a direct read/write of persisted state, never routed through an active
 * game session the way play.vue's own copies of these watchers are.
 */
useHead({ title: 'SQUISHY WELL — settings' })

const settings = useSettings()
settings.load()

onBeforeUnmount(() => {
  settings.persist()
})
</script>
