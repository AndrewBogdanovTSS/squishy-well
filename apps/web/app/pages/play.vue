<template>
  <main ref="stage" class="play">
    <client-only>
      <game-canvas :accessible="settings.accessiblePalette" />
      <template #fallback>
        <div class="boot">initialising renderer…</div>
      </template>
    </client-only>

    <game-hud />

    <div class="topbar">
      <nuxt-link to="/" class="link">← MENU</nuxt-link>
      <span class="badge">{{ backendLabel }} · {{ session.quality.tier.value }}<template v-if="session.bot.value"> · BOT</template></span>
      <button class="link" @click="showSettings = !showSettings">SETTINGS</button>
    </div>

    <transition name="fade">
      <div v-if="session.paused.value && !session.gameOver.value" class="overlay">
        <div class="panel card">
          <h2>PAUSED</h2>
          <button @click="session.togglePause(false)">RESUME</button>
          <button @click="session.restart()">RESTART</button>
          <nuxt-link to="/" class="btnlink">QUIT</nuxt-link>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <div v-if="session.gameOver.value" class="overlay">
        <div class="panel card">
          <h2>GAME OVER</h2>
          <dl>
            <dt>SCORE</dt><dd>{{ session.hud.score.toLocaleString('en-US') }}</dd>
            <dt>LINES</dt><dd>{{ session.hud.lines }}</dd>
            <dt>LEVEL</dt><dd>{{ session.hud.level }}</dd>
            <dt>BEST</dt><dd>{{ settings.best.toLocaleString('en-US') }}</dd>
          </dl>
          <button @click="session.restart()">AGAIN</button>
          <nuxt-link to="/" class="btnlink">MENU</nuxt-link>
        </div>
      </div>
    </transition>

    <transition name="fade">
      <aside v-if="showSettings" class="panel settings">
        <h2>SETTINGS</h2>
        <label>
          <input v-model="settings.accessiblePalette" type="checkbox" >
          High-contrast palette
        </label>
        <label>
          <input v-model="settings.forceReducedMotion" type="checkbox" >
          Reduce motion &amp; flashes
        </label>
        <label>
          <input v-model="settings.muted" type="checkbox" >
          Mute
        </label>
        <label class="range">
          Volume
          <input v-model.number="settings.volume" type="range" min="0" max="1" step="0.05" >
        </label>
        <label class="range">
          Quality
          <select v-model="settings.quality">
            <option value="auto">auto</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
            <option value="minimal">minimal</option>
          </select>
        </label>
        <p class="hint">
          ← → move · ↓ soft drop · space hard drop · Z/X rotate · A flip · C hold · P pause · R restart
        </p>
        <button @click="showSettings = false">CLOSE</button>
      </aside>
    </transition>

    <debug-tweak-panel v-if="isDev" />
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { createGameSession, GameSessionKey } from '~/composables/useGameSession'
import { attachTouchControls } from '~/composables/useInput'
import { useSettings } from '~/stores/settings'
import GameHud from '~/components/hud/GameHud.vue'

// GameCanvas and DebugTweakPanel are deliberately NOT imported here: they are
// `.client.vue` files, and Nuxt only wraps them as client-only components when
// they come from auto-import. A direct import returns the bare component and
// silently defeats the suffix.

useHead({ title: 'NEON WELL — play' })

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

<style scoped>
.play { position: relative; width: 100vw; height: 100dvh; overflow: hidden; }
.boot { position: absolute; inset: 0; display: grid; place-items: center; color: var(--muted); font-size: 0.8rem; letter-spacing: 0.2em; }
.topbar {
  position: absolute;
  top: 0; left: 0; right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  font-size: 0.68rem;
  letter-spacing: 0.2em;
}
.link { color: var(--muted); text-decoration: none; border: none; padding: 0.2rem 0.4rem; }
.link:hover { color: var(--accent); background: none; }
.badge { color: var(--accent); opacity: 0.75; }
.overlay {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  background: rgba(5, 7, 13, 0.72);
  backdrop-filter: blur(6px);
}
.card { display: flex; flex-direction: column; gap: 0.6rem; min-width: 15rem; text-align: center; padding: 1.5rem; }
.card h2 { margin: 0 0 0.5rem; letter-spacing: 0.3em; font-size: 0.9rem; color: var(--accent); }
.card dl { display: grid; grid-template-columns: 1fr auto; gap: 0.2rem 1rem; margin: 0 0 0.75rem; font-size: 0.78rem; }
.card dt { color: var(--muted); text-align: left; }
.card dd { margin: 0; font-variant-numeric: tabular-nums; }
.btnlink {
  text-decoration: none; text-align: center;
  border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.9rem;
  color: var(--muted); font-size: 0.8rem;
}
.settings {
  position: absolute; top: 3rem; right: 1rem;
  display: flex; flex-direction: column; gap: 0.6rem;
  width: 17rem; font-size: 0.75rem;
}
.settings h2 { margin: 0; font-size: 0.7rem; letter-spacing: 0.2em; color: var(--muted); }
.settings label { display: flex; align-items: center; gap: 0.5rem; }
.settings .range { justify-content: space-between; }
.hint { color: var(--muted); line-height: 1.7; font-size: 0.65rem; margin: 0.25rem 0 0; }
.fade-enter-active, .fade-leave-active { transition: opacity 140ms ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
