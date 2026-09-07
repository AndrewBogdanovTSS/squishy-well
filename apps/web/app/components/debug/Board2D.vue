<template>
  <canvas ref="canvas" class="board2d block b b-$border rounded-md [image-rendering:pixelated]" aria-hidden="true" />
</template>

<script setup lang="ts">
import { COLS, VISIBLE_ROWS, codeToType, idx } from '@tetris/core'
import { GHOST_COLOR, GRID_COLOR, PALETTE, TEXT_COLOR, WELL_COLOR, withAlpha } from '~/config/palette'

/**
 * The 2D debug renderer. It draws exactly the same state the 3D scene does,
 * which makes it the fastest way to tell "is this a logic bug or a render bug".
 * It is also fully deterministic, so it is what visual snapshots are taken of.
 */
const { cell = 24, showGrid = true } = defineProps<{ cell?: number; showGrid?: boolean }>()

const session = inject(GameSessionKey)!
const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0

function draw(): void {
  raf = requestAnimationFrame(draw)
  const el = canvas.value
  if (!el) return
  const ctx = el.getContext('2d')
  if (!ctx) return

  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = COLS * cell
  const h = VISIBLE_ROWS * cell
  if (el.width !== w * dpr || el.height !== h * dpr) {
    el.width = w * dpr
    el.height = h * dpr
    el.style.width = `${w}px`
    el.style.height = `${h}px`
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  ctx.fillStyle = WELL_COLOR
  ctx.fillRect(0, 0, w, h)

  if (showGrid) {
    // Same hex and the same opacity Well.vue's 3D grid material uses -
    // this canvas is the reference renderer, comparing it against the 3D
    // scene by eye is the whole point, so its chrome sources the same
    // constants the 3D scene does rather than its own approximation.
    ctx.strokeStyle = withAlpha(GRID_COLOR, 0.22)
    ctx.lineWidth = 1
    for (let x = 1; x < COLS; x++) {
      ctx.beginPath()
      ctx.moveTo(x * cell + 0.5, 0)
      ctx.lineTo(x * cell + 0.5, h)
      ctx.stroke()
    }
    for (let y = 1; y < VISIBLE_ROWS; y++) {
      ctx.beginPath()
      ctx.moveTo(0, y * cell + 0.5)
      ctx.lineTo(w, y * cell + 0.5)
      ctx.stroke()
    }
  }

  const px = (bx: number) => bx * cell
  const py = (by: number) => (VISIBLE_ROWS - 1 - by) * cell

  const board = session.board
  const clearing = session.clearAnim.value
  const flashRows = clearing && !clearing.removed ? new Set(clearing.rows) : null
  const flashPhase = clearing ? (performance.now() - clearing.startedAt) / clearing.durationMs : 0

  for (let y = 0; y < VISIBLE_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = board[idx(x, y)]
      if (!v) continue
      const isFlashing = flashRows?.has(y)
      ctx.fillStyle = isFlashing
        ? flashPhase < 0.3
          ? '#ffffff'
          : `rgba(255,255,255,${Math.max(0, 1 - flashPhase * 1.6)})`
        : PALETTE[codeToType(v)]
      ctx.fillRect(px(x) + 1, py(y) + 1, cell - 2, cell - 2)
    }
  }

  // ghost
  ctx.save()
  ctx.globalAlpha = 0.28
  for (const c of session.engine.ghostCells()) {
    if (c.y >= VISIBLE_ROWS) continue
    ctx.fillStyle = GHOST_COLOR
    ctx.fillRect(px(c.x) + 2, py(c.y) + 2, cell - 4, cell - 4)
  }
  ctx.restore()

  // active piece
  for (const c of session.engine.activeCells()) {
    if (c.y >= VISIBLE_ROWS) continue
    ctx.fillStyle = PALETTE[c.type]
    ctx.fillRect(px(c.x) + 1, py(c.y) + 1, cell - 2, cell - 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'
    ctx.strokeRect(px(c.x) + 1.5, py(c.y) + 1.5, cell - 3, cell - 3)
  }

  if (session.paused.value || session.gameOver.value) {
    ctx.fillStyle = withAlpha(WELL_COLOR, 0.72)
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = TEXT_COLOR
    ctx.font = '600 20px ui-monospace, monospace'
    ctx.textAlign = 'center'
    ctx.fillText(session.gameOver.value ? 'GAME OVER' : 'PAUSED', w / 2, h / 2)
  }
}

onMounted(() => {
  raf = requestAnimationFrame(draw)
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>
