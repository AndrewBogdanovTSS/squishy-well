<template>
  <div class="absolute inset-0 flex justify-between items-start p-2 md:p-4 pointer-events-none">
    <section
      class="panel panel-pad pointer-events-auto min-w-24 text-lead md:(min-w-34 text-base)"
      aria-label="Hold piece"
    >
      <h2 class="m-0 mb-2 text-label tracking-caps c-$muted font-semibold">HOLD</h2>
      <div class="min-h-12 grid place-items-center mb-3.6">
        <piece-preview :piece="hud.hold" :dim="!hud.canHold" />
      </div>

      <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.6 m-0">
        <template v-for="s in holdStats" :key="s.label">
          <dt class="c-$muted text-micro tracking-wider self-center">{{ s.label }}</dt>
          <dd class="m-0 text-right tabular-nums">{{ s.value }}</dd>
        </template>
      </dl>
    </section>

    <section
      class="panel panel-pad pointer-events-auto min-w-24 text-lead md:(min-w-34 text-base)"
      aria-label="Score and next pieces"
    >
      <dl class="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.6 m-0">
        <template v-for="s in scoreStats" :key="s.label">
          <dt class="c-$muted text-micro tracking-wider self-center">{{ s.label }}</dt>
          <dd
            class="m-0 text-right tabular-nums text-stat font-semibold"
            :aria-live="s.live"
            :role="s.status ? 'status' : undefined"
          >
            {{ s.value }}
          </dd>
        </template>
      </dl>

      <div v-if="hud.combo > 0 || hud.b2b" class="flex gap-1.4 my-2.4 flex-wrap" aria-live="polite">
        <span
          v-if="hud.combo > 0"
          class="text-micro tracking-wide py-0.6 px-1.6 rounded-full b b-current c-$accent"
        >
          {{ hud.combo }}× COMBO
        </span>
        <span
          v-if="hud.b2b"
          class="text-micro tracking-wide py-0.6 px-1.6 rounded-full b b-current c-$accent-2"
        >
          B2B
        </span>
      </div>

      <h2 class="m-0 mb-2 text-label tracking-caps c-$muted font-semibold">NEXT</h2>
      <ol class="list-none m-0 p-0 f-col gap-2.2 items-start">
        <li v-for="(p, i) in hud.next" :key="`${p}-${i}`">
          <piece-preview :piece="p" :size="i === 0 ? 18 : 13" />
        </li>
      </ol>
    </section>
  </div>
</template>

<script setup lang="ts">
import PiecePreview from './PiecePreview.vue'

const session = inject(GameSessionKey)!
const hud = session.hud

const timeLabel = computed(() => {
  const s = Math.floor(hud.timeMs / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
const pps = computed(() => (hud.timeMs > 0 ? (hud.pieces / (hud.timeMs / 1000)).toFixed(2) : '0.00'))

/** One row shape, three rows - see docs/design-system.md's Tier 3a. */
const holdStats = computed(() => [
  { label: 'TIME', value: timeLabel.value },
  { label: 'PIECES', value: hud.pieces },
  { label: 'PPS', value: pps.value },
])

// `live`/`status` carry the same per-row aria semantics the three hand-written
// <dd>s had (SCORE was aria-live="polite", LEVEL was role="status", LINES was
// neither) - collapsing the markup must not collapse the accessibility, so
// that variation travels in the data instead of being dropped.
const scoreStats = computed((): Array<{ label: string; value: string | number; live?: 'polite'; status?: boolean }> => [
  { label: 'SCORE', value: hud.score.toLocaleString('en-US'), live: 'polite' },
  { label: 'LEVEL', value: hud.level, status: true },
  { label: 'LINES', value: hud.lines },
])
</script>
