<script setup lang="ts">
import { computed } from 'vue'
import { cellsOf, type PieceType } from '@tetris/core'
import { PALETTE } from '~/config/palette'

const props = withDefaults(defineProps<{ piece: PieceType | null; size?: number; dim?: boolean }>(), {
  size: 18,
  dim: false,
})

/** Normalised 0..3 cell coordinates so every piece is centred in the box. */
const layout = computed(() => {
  if (!props.piece) return { cells: [] as Array<{ x: number; y: number }>, w: 4, h: 2 }
  const cells = cellsOf(props.piece, 0).map(([x, y]) => ({ x, y }))
  const minX = Math.min(...cells.map((c) => c.x))
  const maxX = Math.max(...cells.map((c) => c.x))
  const minY = Math.min(...cells.map((c) => c.y))
  const maxY = Math.max(...cells.map((c) => c.y))
  return {
    cells: cells.map((c) => ({ x: c.x - minX, y: maxY - c.y })),
    w: maxX - minX + 1,
    h: maxY - minY + 1,
  }
})
</script>

<template>
  <div
    class="preview"
    :style="{
      width: `${layout.w * size}px`,
      height: `${layout.h * size}px`,
      opacity: dim ? 0.35 : 1,
    }"
  >
    <span
      v-for="(c, i) in layout.cells"
      :key="i"
      class="cell"
      :style="{
        left: `${c.x * size}px`,
        top: `${c.y * size}px`,
        width: `${size - 2}px`,
        height: `${size - 2}px`,
        background: piece ? PALETTE[piece] : 'transparent',
      }"
    />
  </div>
</template>

<style scoped>
.preview { position: relative; }
.cell {
  position: absolute;
  border-radius: 3px;
  box-shadow: 0 0 8px currentColor;
}
</style>
