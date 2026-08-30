<script setup lang="ts">
import { computed, inject } from 'vue'
import { GameSessionKey } from '~/composables/useGameSession'
import PiecePreview from './PiecePreview.vue'

const session = inject(GameSessionKey)!
const hud = session.hud

const timeLabel = computed(() => {
  const s = Math.floor(hud.timeMs / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
})
const pps = computed(() => (hud.timeMs > 0 ? (hud.pieces / (hud.timeMs / 1000)).toFixed(2) : '0.00'))
</script>

<template>
  <div class="hud">
    <section class="panel side left" aria-label="Hold piece">
      <h2>HOLD</h2>
      <div class="slot">
        <PiecePreview :piece="hud.hold" :dim="!hud.canHold" />
      </div>

      <dl class="stats">
        <dt>TIME</dt>
        <dd>{{ timeLabel }}</dd>
        <dt>PIECES</dt>
        <dd>{{ hud.pieces }}</dd>
        <dt>PPS</dt>
        <dd>{{ pps }}</dd>
      </dl>
    </section>

    <section class="panel side right" aria-label="Score and next pieces">
      <dl class="stats big">
        <dt>SCORE</dt>
        <dd aria-live="polite">{{ hud.score.toLocaleString('en-US') }}</dd>
        <dt>LEVEL</dt>
        <dd role="status">{{ hud.level }}</dd>
        <dt>LINES</dt>
        <dd>{{ hud.lines }}</dd>
      </dl>

      <div v-if="hud.combo > 0 || hud.b2b" class="badges" aria-live="polite">
        <span v-if="hud.combo > 0" class="badge combo">{{ hud.combo }}× COMBO</span>
        <span v-if="hud.b2b" class="badge b2b">B2B</span>
      </div>

      <h2>NEXT</h2>
      <ol class="next">
        <li v-for="(p, i) in hud.next" :key="`${p}-${i}`">
          <PiecePreview :piece="p" :size="i === 0 ? 18 : 13" />
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  pointer-events: none;
}
.side { pointer-events: auto; min-width: 8.5rem; }
h2 {
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
  color: var(--muted);
  font-weight: 600;
}
.slot {
  min-height: 3rem;
  display: grid;
  place-items: center;
  margin-bottom: 0.9rem;
}
.stats { display: grid; grid-template-columns: 1fr auto; gap: 0.15rem 0.75rem; margin: 0; }
.stats dt { color: var(--muted); font-size: 0.65rem; letter-spacing: 0.14em; align-self: center; }
.stats dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.stats.big dd { font-size: 1.15rem; font-weight: 600; }
.badges { display: flex; gap: 0.35rem; margin: 0.6rem 0; flex-wrap: wrap; }
.badge {
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  padding: 0.15rem 0.4rem;
  border-radius: 999px;
  border: 1px solid currentColor;
}
.combo { color: var(--accent); }
.b2b { color: var(--accent-2); }
.next { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.55rem; align-items: flex-start; }
@media (max-width: 640px) {
  .hud { padding: 0.5rem; }
  .side { min-width: 6rem; font-size: 0.85rem; }
}
</style>
