<template>
  <primitive :object="mesh" />
</template>

<script setup lang="ts">
import * as THREE from 'three/webgpu'
import { instancedBufferAttribute } from 'three/tsl'
import { COLS, VISIBLE_ROWS, codeToType, idx } from '@tetris/core'
import { PALETTE, PALETTE_ACCESSIBLE } from '~/config/palette'
import { liveFeel } from '~/config/feel'
import { asFloat, asVec3 } from '~/lib/tsl'
import { blockGeometry, blockMaterial, clamp01, easeOutBack, easeOutCubic, worldX, worldY } from '~/lib/three'

const { accessible = false } = defineProps<{ accessible?: boolean }>()
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

// Seeded off the board cell, not the instance slot: slots are reassigned every
// time the stack changes, so seeding from those would reshuffle every block's
// insides on each lock.
const seedArray = new Float32Array(MAX)
const seedAttr = new THREE.InstancedBufferAttribute(seedArray, 1)
seedAttr.setUsage(THREE.DynamicDrawUsage)

const colorNode = asVec3(instancedBufferAttribute(colorAttr))
const material = blockMaterial(colorNode, 0.24, asFloat(instancedBufferAttribute(seedAttr)))

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
  return accessible ? PALETTE_ACCESSIBLE : PALETTE
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
      seedArray[n] = (x * 7.31 + y * 3.17) % 9.7
      n++
    }
  }
  mesh.count = n
  mesh.instanceMatrix.needsUpdate = true
  colorAttr.needsUpdate = true
  seedAttr.needsUpdate = true
}

watch(() => session.boardVersion.value, syncBoard, { immediate: true })
watch(() => accessible, syncBoard)

const offLock = session.bus.on('LOCK', (e) => {
  if (session.quality.reducedMotion.value) return
  // Hard drops only. A soft landing already squashed on the active piece at the
  // moment it touched down; repeating it here would fire a second wobble when
  // the lock delay finally expires, which is the delay this was meant to fix.
  // A hard drop locks in the same call that moves the piece, so the piece never
  // renders grounded and the stack is the only thing that can carry the impact.
  if (!e.hard) return
  squashCells = e.cells.map((c) => ({ x: c.x, y: c.y }))
  squashStart = performance.now()
  squashAmount = liveFeel.piece.squashOnLand * Math.min(1, e.dropDistance / 16)
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
