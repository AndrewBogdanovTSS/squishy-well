<template>
  <primitive :object="mesh" />
</template>

<script setup lang="ts">
import * as THREE from 'three/webgpu'
import { instancedBufferAttribute } from 'three/tsl'
import { cellsOf, collides } from '@tetris/core'
import { PALETTE, PALETTE_ACCESSIBLE } from '~/config/palette'
import { liveFeel } from '~/config/feel'
import { asFloat, asVec3 } from '~/lib/tsl'
import { blockGeometry, blockMaterial, clamp01, easeOutBack, worldX, worldY } from '~/lib/three'

const { accessible = false } = defineProps<{ accessible?: boolean }>()
const session = inject(GameSessionKey)!

/**
 * Separate from the stack because it updates on a completely different
 * schedule: the stack changes when a piece locks, this changes every frame.
 */
const colorArray = new Float32Array(4 * 3)
const colorAttr = new THREE.InstancedBufferAttribute(colorArray, 3)
colorAttr.setUsage(THREE.DynamicDrawUsage)

// seeded by slot within the piece, so the four cells differ from each other but
// none of them churns while the piece is falling
const seedAttr = new THREE.InstancedBufferAttribute(new Float32Array([0.4, 2.9, 5.6, 8.1]), 1)

const colorNode = asVec3(instancedBufferAttribute(colorAttr))
// brighter than the stack: the piece you are steering should hold the eye
const material = blockMaterial(colorNode, 0.4, asFloat(instancedBufferAttribute(seedAttr)))

const mesh = new THREE.InstancedMesh(blockGeometry(), material, 4)
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
mesh.castShadow = true
mesh.frustumCulled = false
mesh.count = 0

const _m = new THREE.Matrix4()
const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3(1, 1, 1)
const _c = new THREE.Color()

/** rendered position, chases the logical one so movement is not a teleport */
let renderX = 0
let renderY = 0
let primed = false
/** decaying visual nudge when a rotation only fit thanks to a wall kick */
let nudgeX = 0
let nudgeY = 0

/**
 * Squash on contact, not on lock.
 *
 * The LOCK event is the obvious hook and it is the wrong one: the engine holds
 * a grounded piece for the whole lock delay before it locks, so hanging the
 * impact off LOCK plays the wobble half a second after the piece visibly
 * touches down. Lock delay is a rules mechanic and stays exactly as it is -
 * this is a view concern, so the view decides for itself when contact happened.
 *
 * Two conditions, both needed. Grounded is the logical test: nothing below, so
 * the piece cannot fall further. Settled is the visual one: the rendered
 * position chases the logical one, so at the instant the engine calls it
 * grounded the piece can still be a few hundredths above the surface, and
 * squashing then reads as a wobble in mid-air.
 */
const CONTACT_EPSILON = 0.06
let squashStart = -1
let squashAmount = 0
let touching = false

const offRotate = session.bus.on('ROTATE', (e) => {
  if (e.kickIndex === 0 || session.quality.reducedMotion.value) return
  const n = liveFeel.piece.kickNudge * Math.min(2, e.kickIndex)
  nudgeX = -Math.sign(e.kick[0]) * n
  nudgeY = -Math.sign(e.kick[1]) * n
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const p = session.engine.active
  if (!p || session.gameOver.value) {
    mesh.count = 0
    primed = false
    return
  }

  const targetX = worldX(p.x)
  const targetY = worldY(p.y)
  if (!primed) {
    renderX = targetX
    renderY = targetY
    primed = true
  } else {
    const k = 1 - Math.exp(-liveFeel.piece.followRate * delta)
    renderX += (targetX - renderX) * k
    renderY += (targetY - renderY) * k
  }
  nudgeX *= Math.exp(-delta * 14)
  nudgeY *= Math.exp(-delta * 14)

  const grounded = collides(session.board, cellsOf(p.type, p.rot), p.x, p.y - 1)
  const landed = grounded && Math.abs(renderY - targetY) < CONTACT_EPSILON
  if (landed && !touching && !session.quality.reducedMotion.value) {
    squashStart = performance.now()
    squashAmount = liveFeel.piece.squashOnLand * 0.35
  }
  // clears when the piece is nudged off its ledge during lock delay, so landing
  // again on a lower row wobbles again - which is what actually happened
  touching = landed

  let sy = 1
  let sxz = 1
  if (squashStart >= 0) {
    const t = (performance.now() - squashStart) / liveFeel.piece.squashRecoverMs
    if (t >= 1) {
      squashStart = -1
    } else {
      const k = 1 - easeOutBack(clamp01(t))
      sy = 1 - squashAmount * k
      sxz = 1 + squashAmount * k * 0.6
    }
  }
  // each cube compresses onto its own base, matching how the stack squashes
  const sink = (1 - sy) * 0.5
  _s.set(sxz, sy, sxz)

  const colors = accessible ? PALETTE_ACCESSIBLE : PALETTE
  _c.set(colors[p.type])
  const cells = cellsOf(p.type, p.rot)
  for (let i = 0; i < 4; i++) {
    const cell = cells[i]!
    _v.set(renderX + cell[0] + nudgeX, renderY + cell[1] + nudgeY - sink, 0)
    mesh.setMatrixAt(i, _m.compose(_v, _q, _s))
    colorArray[i * 3] = _c.r
    colorArray[i * 3 + 1] = _c.g
    colorArray[i * 3 + 2] = _c.b
  }
  mesh.count = 4
  mesh.instanceMatrix.needsUpdate = true
  colorAttr.needsUpdate = true
})
onBeforeUnmount(() => {
  offRotate()
  material.dispose()
  mesh.dispose()
})
</script>
