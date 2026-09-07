<template>
  <main class="h-dvh f-col gap-3 p-4">
    <header class="flex justify-between items-center">
      <h1 class="m-0 text-md tracking-title c-$muted font-semibold">DEBUG · 2D REFERENCE</h1>
      <nav class="flex gap-4 text-xs tracking-caps">
        <nuxt-link to="/play" class="c-$accent">3D</nuxt-link>
        <nuxt-link to="/" class="c-$accent">MENU</nuxt-link>
      </nav>
    </header>

    <div class="flex-1 flex gap-5 items-start relative overflow-auto">
      <board2-d :cell="26" />

      <aside class="panel px-3.6 py-3 min-w-64 f-col gap-2">
        <div class="flex gap-2">
          <game-button class="flex-1" size="sm" @click="session.togglePause()">
            {{ session.paused.value ? 'RESUME' : 'PAUSE' }}
          </game-button>
          <game-button class="flex-1" size="sm" @click="session.restart()">RESTART</game-button>
        </div>
        <div class="flex gap-2">
          <game-button
            class="flex-1"
            size="sm"
            :disabled="!session.paused.value"
            @click="session.step(1)"
          >
            STEP 1
          </game-button>
          <game-button
            class="flex-1"
            size="sm"
            :disabled="!session.paused.value"
            @click="session.step(6)"
          >
            STEP 6
          </game-button>
        </div>
        <div class="flex gap-2">
          <game-button class="flex-1" size="sm" @click="session.bot.value = !session.bot.value">
            BOT {{ session.bot.value ? 'ON' : 'OFF' }}
          </game-button>
          <game-button class="flex-1" size="sm" @click="downloadReplay()">SAVE REPLAY</game-button>
          <game-button class="flex-1" size="sm" @click="showState = !showState">
            {{ showState ? 'HIDE' : 'SHOW' }} STATE
          </game-button>
        </div>

        <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.4 m-0 mt-2 text-sm">
          <template v-for="s in debugStats" :key="s.label">
            <dt class="c-$muted">{{ s.label }}</dt>
            <dd class="m-0 text-right tabular-nums">{{ s.value }}</dd>
          </template>
        </dl>

        <pre v-if="showState" class="text-xs leading-[1.15] c-$muted m-0 mt-2">
          {{ rows.join('\n') }}
        </pre>
      </aside>

      <div class="relative flex-1 min-h-80"><game-hud /></div>
    </div>

    <footer class="text-sm c-$muted tracking-wide">
      ← → move · ↓ soft · space hard · Z/X rotate · A flip · C hold · P pause · R restart
    </footer>
  </main>
</template>

<script setup lang="ts">
import { boardToStrings, hashBoard } from '@tetris/core'
import Board2D from '~/components/debug/Board2D.vue'
import GameHud from '~/components/hud/GameHud.vue'
import GameButton from '~/components/hud/GameButton.vue'

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

/** One row shape, five rows - see docs/design-system.md's Tier 3a. */
const debugStats = computed(() => [
  { label: 'seed', value: session.currentSeed.value },
  { label: 'phase', value: session.hud.phase },
  { label: 'hash', value: boardHash.value },
  { label: 'frame', value: `${session.quality.frameMs.value.toFixed(1)} ms` },
  { label: 'tier', value: session.quality.tier.value },
])

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
