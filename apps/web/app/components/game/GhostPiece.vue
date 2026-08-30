<script setup lang="ts">
import { inject, onBeforeUnmount } from 'vue'
import * as THREE from 'three/webgpu'
import { useLoop } from '@tresjs/core'
import { GameSessionKey } from '~/composables/useGameSession'
import { PALETTE } from '~/config/palette'
import { worldX, worldY } from '~/utils/three'

const session = inject(GameSessionKey)!

/**
 * The landing preview. In a 3D well this is not a nicety — without it the
 * perspective makes it genuinely hard to tell which column you are over.
 */
const geometry = new THREE.BoxGeometry(0.94, 0.94, 0.94)
const material = new THREE.MeshBasicNodeMaterial({
  transparent: true,
  opacity: 0.22,
  depthWrite: false,
  wireframe: false,
})

const mesh = new THREE.InstancedMesh(geometry, material, 4)
mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
mesh.frustumCulled = false
mesh.renderOrder = -1
mesh.count = 0

const _m = new THREE.Matrix4()
const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3(1, 1, 1)
const _c = new THREE.Color()

const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  const p = session.engine.active
  if (!p || session.gameOver.value) {
    mesh.count = 0
    return
  }
  const cells = session.engine.ghostCells()
  // a slow pulse makes the ghost readable without stealing attention
  const pulse = 0.18 + Math.sin(elapsed * 4) * 0.05
  material.opacity = pulse
  _c.set(PALETTE[p.type])
  material.color.copy(_c)
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!
    _v.set(worldX(c.x), worldY(c.y), 0)
    mesh.setMatrixAt(i, _m.compose(_v, _q, _s))
  }
  mesh.count = cells.length
  mesh.instanceMatrix.needsUpdate = true
})

onBeforeUnmount(() => {
  geometry.dispose()
  material.dispose()
  mesh.dispose()
})
</script>

<template>
  <primitive :object="mesh" />
</template>
