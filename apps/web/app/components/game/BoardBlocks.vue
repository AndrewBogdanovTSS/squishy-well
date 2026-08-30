<script setup lang="ts">
import { inject, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three/webgpu'
import { instancedBufferAttribute, uniform } from 'three/tsl'
import { useLoop } from '@tresjs/core'
import { COLS, VISIBLE_ROWS, codeToType, idx } from '@tetris/core'
import { GameSessionKey } from '~/composables/useGameSession'
import { PALETTE, PALETTE_ACCESSIBLE } from '~/config/palette'
import { liveFeel } from '~/config/feel'
import { asVec3 } from '~/utils/tsl'
import { blockGeometry, clamp01, easeOutBack, easeOutCubic, worldX, worldY } from '~/utils/three'

const props = withDefaults(defineProps<{ accessible?: boolean }>(), { accessible: false })
const session = inject(GameSessionKey)!

const MAX = COLS * VISIBLE_ROWS

/**
 * A single InstancedMesh for the whole stack. The win here is not instancing
 * (200 cubes would survive anything) but that matrices are rebuilt only when
 * the board actually changes — a few dozen times a game, not 60 times a second.
 */
const geometry = blockGeometry()
const colorArray = new Float32Array(MAX * 3)
const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3)
colorAttr.setUsage(THREE.DynamicDrawUsage)

const emissive = uniform(0.5)
const colorNode = asVec3(instancedBufferAttribute(colorAttr))

const material = new THREE.MeshStandardNodeMaterial({ roughness: 0.34, metalness: 0.04 })
material.colorNode = colorNode
material.emissiveNode = colorNode.mul(emissive)

const mesh = new THREE.InstancedMesh(geometry, material, MAX)
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
mesh.castShadow = true
mesh.receiveShadow = true
mesh.frustumCulled = false
mesh.count = 0

// module-scope scratch: `new Matrix4()` inside a render loop is the classic
// source of GC sawtooth in three.js projects
const _m = new THREE.Matrix4()
const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3(1, 1, 1)
const _c = new THREE.Color()

const instanceRow = new Int16Array(MAX)
const instanceCol = new Int16Array(MAX)

/** cells that just landed, for squash & stretch */
let squashCells: Array<{ x: number; y: number }> = []
let squashStart = -1
let squashAmount = 0

function palette() {
  return props.accessible ? PALETTE_ACCESSIBLE : PALETTE
}

function syncBoard(): void {
  const board = session.board
  const colors = palette()
  let n = 0
  for (let y = 0; y < VISIBLE_ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const v = board[idx(x, y)]
      if (!v) continue
      _v.set(worldX(x), worldY(y), 0)
      _s.set(1, 1, 1)
      _m.compose(_v, _q, _s)
      mesh.setMatrixAt(n, _m)
      _c.set(colors[codeToType(v)])
      colorArray[n * 3] = _c.r
      colorArray[n * 3 + 1] = _c.g
      colorArray[n * 3 + 2] = _c.b
      instanceRow[n] = y
      instanceCol[n] = x
      n++
    }
  }
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
  colorAttr.needsUpdate = true
}

watch(() => session.boardVersion.value, syncBoard, { immediate: true })
watch(() => props.accessible, syncBoard)

const offLock = session.bus.on('LOCK', (e) => {
  if (session.quality.reducedMotion.value) return
  squashCells = e.cells.map((c) => ({ x: c.x, y: c.y }))
  squashStart = performance.now()
  squashAmount = liveFeel.piece.squashOnLand * (e.hard ? Math.min(1, e.dropDistance / 16) : 0.35)
})

function applySquash(now: number): boolean {
  if (squashStart < 0) return false
  const t = (now - squashStart) / liveFeel.piece.squashRecoverMs
  if (t >= 1) {
    squashStart = -1
    for (let i = 0; i < mesh.count; i++) {
      if (!squashCells.some((c) => c.x === instanceCol[i] && c.y === instanceRow[i])) continue
      mesh.getMatrixAt(i, _m)
      _m.decompose(_v, _q, _s)
      _v.y = worldY(instanceRow[i]!)
      _s.set(1, 1, 1)
      mesh.setMatrixAt(i, _m.compose(_v, _q, _s))
    }
    squashCells = []
    return true
  }
  // squash on impact, recover with a little overshoot
  const k = 1 - easeOutBack(clamp01(t))
  const sy = 1 - squashAmount * k
  const sxz = 1 + squashAmount * k * 0.6
  let dirty = false
  for (let i = 0; i < mesh.count; i++) {
    const cx = instanceCol[i]!
    const cy = instanceRow[i]!
    if (!squashCells.some((c) => c.x === cx && c.y === cy)) continue
    _v.set(worldX(cx), worldY(cy) - (1 - sy) * 0.5, 0)
    _s.set(sxz, sy, sxz)
    mesh.setMatrixAt(i, _m.compose(_v, _q, _s))
    dirty = true
  }
  return dirty
}

/**
 * The collapse. While the engine holds its CLEARING pause, rows above the
 * cleared ones slide down; both durations come from the same constant, so the
 * animation can never disagree with the simulation.
 */
function applyCollapse(now: number): boolean {
  const anim = session.clearAnim.value
  if (!anim || anim.removed) return false
  const t = (now - anim.startedAt) / anim.durationMs
  const start = liveFeel.clear.shatterEnd
  if (t < start) return false

  const k = easeOutCubic(clamp01((t - start) / (1 - start)))
  let dirty = false
  for (let i = 0; i < mesh.count; i++) {
    const row = instanceRow[i]!
    if (anim.rows.includes(row)) {
      // cleared blocks shrink away as the debris takes over
      _v.set(worldX(instanceCol[i]!), worldY(row), 0)
      _s.setScalar(Math.max(0.001, 1 - k))
      mesh.setMatrixAt(i, _m.compose(_v, _q, _s))
      dirty = true
      continue
    }
    let below = 0
    for (const r of anim.rows) if (r < row) below++
    if (below === 0) continue
    _v.set(worldX(instanceCol[i]!), worldY(row) - below * k, 0)
    _s.set(1, 1, 1)
    mesh.setMatrixAt(i, _m.compose(_v, _q, _s))
    dirty = true
  }
  return dirty
}

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  const now = performance.now()
  let dirty = applyCollapse(now)
  dirty = applySquash(now) || dirty
  if (dirty) mesh.instanceMatrix.needsUpdate = true
})

onBeforeUnmount(() => {
  offLock()
  material.dispose()
  mesh.dispose()
})
</script>

<template>
  <primitive :object="mesh" />
</template>
