<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import * as THREE from 'three/webgpu'
import { COLS, VISIBLE_ROWS } from '@tetris/core'
import { GRID_COLOR, WELL_COLOR } from '~/config/palette'
import { worldX, worldY } from '~/utils/three'

/** The container: back wall, floor, side rails and a faint cell grid. */
const group = new THREE.Group()

const left = worldX(0) - 0.5
const right = worldX(COLS - 1) + 0.5
const bottom = worldY(0) - 0.5
const top = worldY(VISIBLE_ROWS - 1) + 0.5

const back = new THREE.Mesh(
  new THREE.PlaneGeometry(COLS, VISIBLE_ROWS),
  new THREE.MeshStandardNodeMaterial({ color: WELL_COLOR, roughness: 0.95, metalness: 0 }),
)
back.position.z = -0.62
back.receiveShadow = true
group.add(back)

const railMaterial = new THREE.MeshStandardNodeMaterial({
  color: '#0f172a',
  roughness: 0.5,
  metalness: 0.25,
  emissive: new THREE.Color('#0ea5e9').multiplyScalar(0.25),
})
const railGeometry = new THREE.BoxGeometry(0.35, VISIBLE_ROWS + 0.7, 1.1)
for (const x of [left - 0.18, right + 0.18]) {
  const rail = new THREE.Mesh(railGeometry, railMaterial)
  rail.position.set(x, (top + bottom) / 2, -0.1)
  rail.castShadow = true
  group.add(rail)
}
const floor = new THREE.Mesh(new THREE.BoxGeometry(COLS + 0.7, 0.35, 1.1), railMaterial)
floor.position.set(0, bottom - 0.18, -0.1)
floor.receiveShadow = true
group.add(floor)

// faint grid, drawn as one LineSegments so it costs a single draw call
const points: number[] = []
for (let x = 0; x <= COLS; x++) {
  points.push(worldX(x) - 0.5, bottom, -0.6, worldX(x) - 0.5, top, -0.6)
}
for (let y = 0; y <= VISIBLE_ROWS; y++) {
  points.push(left, worldY(y) - 0.5, -0.6, right, worldY(y) - 0.5, -0.6)
}
const gridGeometry = new THREE.BufferGeometry()
gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
const grid = new THREE.LineSegments(
  gridGeometry,
  new THREE.LineBasicNodeMaterial({ color: GRID_COLOR, transparent: true, opacity: 0.22 }),
)
group.add(grid)

onBeforeUnmount(() => {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    mesh.geometry?.dispose?.()
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(m)) m.forEach((x) => x.dispose())
    else m?.dispose?.()
  })
})
</script>

<template>
  <primitive :object="group" />
</template>
