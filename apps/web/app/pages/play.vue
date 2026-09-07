<template>
  <main ref="stage" class="relative w-screen h-dvh overflow-hidden">
    <client-only>
      <game-canvas :accessible="settings.accessiblePalette" />
      <template #fallback>
        <div class="absolute inset-0 grid place-items-center c-$muted text-body tracking-caps">
          initialising renderer…
        </div>
      </template>
    </client-only>

    <game-hud />

    <div
      class="absolute top-0 left-0 right-0 flex justify-center items-center gap-4 p-3 text-label tracking-caps"
    >
      <nuxt-link to="/" class="c-$muted no-underline b-none py-0.8 px-1.6 hover:c-$accent">
        ← MENU
      </nuxt-link>
      <span class="c-$accent opacity-75"
        >{{ backendLabel }} · {{ session.quality.tier.value }}<template v-if="session.bot.value"> · BOT</template></span
      >
      <button
        class="c-$muted no-underline b-none py-0.8 px-1.6 hover:c-$accent"
        @click="showSettings = !showSettings"
      >
        SETTINGS
      </button>
    </div>

    <transition name="fade">
      <div
        v-if="session.paused.value && !session.gameOver.value"
        class="absolute inset-0 grid place-items-center bg-[rgb(var(--bg-rgb)/72%)] [backdrop-filter:blur(6px)]"
      >
        <div class="panel p-6 f-col gap-2.4 min-w-60 text-center">
          <h2 class="m-0 mb-2 tracking-title text-lead c-$accent">PAUSED</h2>
          <game-button @click="session.togglePause(false)">RESUME</game-button>
          <game-button @click="session.restart()">RESTART</game-button>
          <game-button to="/" variant="quiet">QUIT</game-button>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div
        v-if="session.gameOver.value"
        class="absolute inset-0 grid place-items-center bg-[rgb(var(--bg-rgb)/72%)] [backdrop-filter:blur(6px)]"
      >
        <div class="panel p-6 f-col gap-2.4 min-w-60 text-center">
          <h2 class="m-0 mb-2 tracking-title text-lead c-$accent">GAME OVER</h2>
          <dl class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.8 m-0 mb-3 text-body">
            <template v-for="s in gameOverStats" :key="s.label">
              <dt class="c-$muted text-left">{{ s.label }}</dt>
              <dd class="m-0 tabular-nums">{{ s.value }}</dd>
            </template>
          </dl>
          <game-button @click="session.restart()">AGAIN</game-button>
          <game-button to="/" variant="quiet">MENU</game-button>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <aside v-if="showSettings" class="panel panel-pad absolute top-12 right-4 f-col gap-2.4 w-68 text-xs">
        <h2 class="m-0 text-label tracking-caps c-$muted">SETTINGS</h2>
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
        <p class="c-$muted leading-[1.7] text-micro m-0 mt-1">
          ← → move · ↓ soft drop · space hard drop · Z/X rotate · A flip · C hold · P pause · R restart
        </p>
        <game-button @click="showSettings = false">CLOSE</game-button>
      </aside>
    </transition>

    <debug-tweak-panel v-if="isDev" />
  </main>
</template>

<script setup lang="ts">
import GameHud from '~/components/hud/GameHud.vue'
import GameButton from '~/components/hud/GameButton.vue'

// GameCanvas and DebugTweakPanel are deliberately NOT imported here: they are
// `.client.vue` files, and Nuxt only wraps them as client-only components when
// they come from auto-import. A direct import returns the bare component and
// silently defeats the suffix.

useHead({ title: 'SQUISHY WELL — play' })

const settings = useSettings()
settings.load()

const route = useRoute()
const session = createGameSession({
  bindings: settings.bindings,
  startLevel: settings.startLevel,
  // ?bot=1 hands the game to the heuristic player: attract mode, and the
  // only sane way to drive a browser smoke test through real line clears
  bot: route.query.bot === '1',
})
provide(GameSessionKey, session)

const stage = ref<HTMLElement | null>(null)
let detachTouch: (() => void) | null = null
const showSettings = ref(false)
const isDev = import.meta.dev

const backendLabel = computed(() => {
  const b = session.quality.backend.value
  return b === 'unknown' ? 'starting…' : b.toUpperCase()
})

/** One row shape, four rows - see docs/design-system.md's Tier 3a. */
const gameOverStats = computed(() => [
  { label: 'SCORE', value: session.hud.score.toLocaleString('en-US') },
  { label: 'LINES', value: session.hud.lines },
  { label: 'LEVEL', value: session.hud.level },
  { label: 'BEST', value: settings.best.toLocaleString('en-US') },
])

onMounted(() => {
  session.audio.setVolume(settings.muted ? 0 : settings.volume)
  session.audio.setMuted(settings.muted)
  session.start()
  if (stage.value) detachTouch = attachTouchControls(stage.value, session.input)
  window.addEventListener('pointerdown', unlockAudio, { once: true })
  window.addEventListener('keydown', unlockAudio, { once: true })
})

function unlockAudio(): void {
  session.audio.unlock()
}

watch(
  () => session.gameOver.value,
  (over) => {
    if (!over) return
    settings.record({
      score: session.hud.score,
      lines: session.hud.lines,
      level: session.hud.level,
      seed: session.currentSeed.value,
      at: Date.now(),
    })
  },
)

watch(
  () => [settings.volume, settings.muted] as const,
  ([v, m]) => {
    session.audio.setMuted(m)
    session.audio.setVolume(m ? 0 : v)
  },
)

watch(
  () => settings.quality,
  (q) => {
    session.quality.manual.value = q === 'auto' ? null : q
  },
  { immediate: true },
)

watch(
  () => settings.forceReducedMotion,
  (on) => {
    // Drives the same effect the OS `prefers-reduced-motion` media query
    // gets in app.css, for people who found this checkbox instead - without
    // this the checkbox only ever reached the 3D quality tier and left every
    // CSS transition (GameButton's hover, the fade-* shortcuts) unaffected.
    // Reachability is scoped to what this checkbox already has today: it
    // only exists on this page, so this is the only place that sets it.
    document.documentElement.classList.toggle('reduce-motion', on)
    if (on) session.quality.reducedMotion.value = true
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  detachTouch?.()
  session.dispose()
  settings.persist()
})
</script>
