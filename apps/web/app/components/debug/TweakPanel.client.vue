<template>
  <div ref="container" class="fixed bottom-2 left-2 w-60 z-40 opacity-90" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'
import { liveFeel } from '~/config/feel'

/**
 * Dev-only tuning panel. Every constant that shapes the feel is bound here,
 * because tuning by editing source and reloading is how projects end up
 * with numbers nobody ever revisits.
 */
const container = shallowRef<HTMLElement | null>(null)
let pane: { dispose: () => void } | null = null

onMounted(async () => {
  if (!import.meta.dev || !container.value) return
  const { Pane } = await import('tweakpane')
  // the published types do not surface addFolder/addBinding on Pane itself
  type Folder = {
    addBinding: (target: object, key: string, opts?: Record<string, unknown>) => unknown
    addFolder: (opts: { title: string; expanded?: boolean }) => Folder
  }
  const p = new Pane({ container: container.value, title: 'feel' }) as unknown as Folder & {
    dispose: () => void
  }

  const input = p.addFolder({ title: 'input', expanded: false })
  input.addBinding(liveFeel.input, 'dasMs', { min: 0, max: 300, step: 1 })
  input.addBinding(liveFeel.input, 'arrMs', { min: 0, max: 120, step: 1 })
  input.addBinding(liveFeel.input, 'softDropRate', { min: 1, max: 60, step: 1 })

  const piece = p.addFolder({ title: 'piece', expanded: false })
  piece.addBinding(liveFeel.piece, 'followRate', { min: 4, max: 90, step: 1 })
  piece.addBinding(liveFeel.piece, 'squashOnLand', { min: 0, max: 0.8, step: 0.01 })
  piece.addBinding(liveFeel.piece, 'kickNudge', { min: 0, max: 0.6, step: 0.01 })

  const impact = p.addFolder({ title: 'impact', expanded: true })
  impact.addBinding(liveFeel.impact, 'decay', { min: 1, max: 20, step: 0.1 })
  impact.addBinding(liveFeel.impact, 'shakeTetris', { min: 0, max: 2, step: 0.05 })
  impact.addBinding(liveFeel.impact, 'aberrationTetris', { min: 0, max: 2, step: 0.05 })
  impact.addBinding(liveFeel.hitstop, 'tetris', { min: 0, max: 250, step: 5 })

  const bloomFolder = p.addFolder({ title: 'bloom', expanded: false })
  bloomFolder.addBinding(liveFeel.bloom, 'strength', { min: 0, max: 3, step: 0.05 })
  bloomFolder.addBinding(liveFeel.bloom, 'threshold', { min: 0, max: 1.5, step: 0.01 })

  const audio = p.addFolder({ title: 'audio', expanded: false })
  audio.addBinding(liveFeel.audio, 'sfx', { min: 0, max: 1, step: 0.05 })

  pane = p as unknown as { dispose: () => void }
})

onBeforeUnmount(() => pane?.dispose())
</script>
