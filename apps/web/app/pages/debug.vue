<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from 'vue'
import { boardToStrings, hashBoard } from '@tetris/core'
import { createGameSession, GameSessionKey } from '~/composables/useGameSession'
import Board2D from '~/components/debug/Board2D.vue'
import GameHud from '~/components/hud/GameHud.vue'

/**
 * M0 deliverable: the game is fully playable here, in 2D, with zero 3D code.
 * It stays in the project forever as the reference renderer — when the 3D
 * scene looks wrong, this page tells you whether the engine agrees.
 */
const route = useRoute()
const session = createGameSession({ record: true, bot: route.query.bot === '1' })
provide(GameSessionKey, session)

const showState = ref(false)
const tick = ref(0)
let timer = 0

const boardHash = computed(() => {
  void tick.value
  return hashBoard(session.board)
})
const rows = computed(() => {
  void tick.value
  return boardToStrings(session.board)
})

onMounted(() => {
  session.start()
  // audio may only be created from a real gesture, never on mount
  window.addEventListener('pointerdown', unlockAudio, { once: true })
  window.addEventListener('keydown', unlockAudio, { once: true })
  timer = window.setInterval(() => tick.value++, 100)
})
function unlockAudio(): void {
  session.audio.unlock()
}

onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('pointerdown', unlockAudio)
  window.removeEventListener('keydown', unlockAudio)
  session.dispose()
})

function downloadReplay(): void {
  const replay = session.getReplay()
  if (!replay) return
  const blob = new Blob([JSON.stringify(replay)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `replay-${replay.seed}.json`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <main class="debug">
    <header>
      <h1>DEBUG · 2D REFERENCE</h1>
      <nav>
        <NuxtLink to="/play">3D</NuxtLink>
        <NuxtLink to="/">MENU</NuxtLink>
      </nav>
    </header>

    <div class="stage">
      <Board2D :cell="26" />

      <aside class="tools panel">
        <div class="row">
          <button @click="session.togglePause()">{{ session.paused.value ? 'RESUME' : 'PAUSE' }}</button>
          <button @click="session.restart()">RESTART</button>
        </div>
        <div class="row">
          <button :disabled="!session.paused.value" @click="session.step(1)">STEP 1</button>
          <button :disabled="!session.paused.value" @click="session.step(6)">STEP 6</button>
        </div>
        <div class="row">
          <button @click="session.bot.value = !session.bot.value">
            BOT {{ session.bot.value ? 'ON' : 'OFF' }}
          </button>
          <button @click="downloadReplay()">SAVE REPLAY</button>
          <button @click="showState = !showState">{{ showState ? 'HIDE' : 'SHOW' }} STATE</button>
        </div>

        <dl>
          <dt>seed</dt><dd>{{ session.currentSeed.value }}</dd>
          <dt>phase</dt><dd>{{ session.hud.phase }}</dd>
          <dt>hash</dt><dd>{{ boardHash }}</dd>
          <dt>frame</dt><dd>{{ session.quality.frameMs.value.toFixed(1) }} ms</dd>
          <dt>tier</dt><dd>{{ session.quality.tier.value }}</dd>
        </dl>

        <pre v-if="showState" class="dump">{{ rows.join('\n') }}</pre>
      </aside>

      <div class="hud-host"><GameHud /></div>
    </div>

    <footer>
      ← → move · ↓ soft · space hard · Z/X rotate · A flip · C hold · P pause · R restart
    </footer>
  </main>
</template>

<style scoped>
.debug { height: 100dvh; display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem; }
header { display: flex; justify-content: space-between; align-items: center; }
h1 { margin: 0; font-size: 0.78rem; letter-spacing: 0.28em; color: var(--muted); font-weight: 600; }
nav { display: flex; gap: 1rem; font-size: 0.75rem; letter-spacing: 0.18em; }
.stage { flex: 1; display: flex; gap: 1.25rem; align-items: flex-start; position: relative; overflow: auto; }
.tools { min-width: 16rem; display: flex; flex-direction: column; gap: 0.5rem; }
.row { display: flex; gap: 0.5rem; }
.row button { flex: 1; font-size: 0.7rem; letter-spacing: 0.1em; }
dl { display: grid; grid-template-columns: auto 1fr; gap: 0.1rem 0.75rem; margin: 0.5rem 0 0; font-size: 0.72rem; }
dt { color: var(--muted); }
dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.dump { font-size: 0.62rem; line-height: 1.15; color: var(--muted); margin: 0.5rem 0 0; }
.hud-host { position: relative; flex: 1; min-height: 20rem; }
footer { font-size: 0.68rem; color: var(--muted); letter-spacing: 0.08em; }
</style>
