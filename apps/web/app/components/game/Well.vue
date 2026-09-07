<template>
  <primitive :object="group" />
</template>

<script setup lang="ts">
import * as THREE from 'three/webgpu'
import { RectAreaLightNode } from 'three/webgpu'
import { RectAreaLightTexturesLib } from 'three/addons/lights/RectAreaLightTexturesLib.js'
import { COLS, VISIBLE_ROWS } from '@tetris/core'
import { GRID_COLOR, WELL_COLOR } from '~/config/palette'
import { NEON_TUBES, tubeMaterial, updateTubeColors, worldX, worldY } from '~/lib/three'

/** The container: back wall, floor, side rails and a faint cell grid. */
const group = new THREE.Group()

const left = worldX(0) - 0.5
const right = worldX(COLS - 1) + 0.5
const bottom = worldY(0) - 0.5
const wellBottomY = bottom
const top = worldY(VISIBLE_ROWS - 1) + 0.5

// Sized to the rail footprint rather than the playfield. Cut to the field, the
// wall stopped short of the frame and the overhead wash ended on a hard line
// part way up, with bare rail standing above it.
const back = new THREE.Mesh(
  new THREE.PlaneGeometry(COLS + 0.7, VISIBLE_ROWS + 0.7),
  new THREE.MeshStandardNodeMaterial({ color: WELL_COLOR, roughness: 0.95, metalness: 0 }),
)
// Deep enough for the neon tubes to sit behind the stack rather than level with
// it - see NEON_TUBES. It also gives their light somewhere to pool, which is
// what reads as glow falling down the inside of the well.
const BACK_Z = -2.6
back.position.z = BACK_Z
back.receiveShadow = true
group.add(back)

// Near black and barely emissive. The frame lighting itself up was competing
// with the tubes for attention; unlit, it reads as a dark housing and the only
// colour in the scene comes from the neon and the blocks.
const railMaterial = new THREE.MeshStandardNodeMaterial({
  color: '#04060a',
  roughness: 0.62,
  metalness: 0.2,
  emissive: new THREE.Color('#0ea5e9').multiplyScalar(0.03),
})
const railGeometry = new THREE.BoxGeometry(0.35, VISIBLE_ROWS + 0.7, 3.4)
for (const x of [left - 0.18, right + 0.18]) {
  const rail = new THREE.Mesh(railGeometry, railMaterial)
  rail.position.set(x, (top + bottom) / 2, BACK_Z / 2 + 0.35)
  rail.castShadow = true
  group.add(rail)
}
const floor = new THREE.Mesh(new THREE.BoxGeometry(COLS + 0.7, 0.35, 3.4), railMaterial)
floor.position.set(0, bottom - 0.18, BACK_Z / 2 + 0.35)
floor.receiveShadow = true
group.add(floor)

// faint grid, drawn as one LineSegments so it costs a single draw call
const points: number[] = []
for (let x = 0; x <= COLS; x++) {
  points.push(worldX(x) - 0.5, bottom, BACK_Z + 0.02, worldX(x) - 0.5, top, BACK_Z + 0.02)
}
for (let y = 0; y <= VISIBLE_ROWS; y++) {
  points.push(left, worldY(y) - 0.5, BACK_Z + 0.02, right, worldY(y) - 0.5, BACK_Z + 0.02)
}
const gridGeometry = new THREE.BufferGeometry()
gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
const grid = new THREE.LineSegments(
  gridGeometry,
  new THREE.LineBasicNodeMaterial({ color: GRID_COLOR, transparent: true, opacity: 0.22 }),
)
group.add(grid)

/**
 * The neon tubes: a visible fixture for every tube, and for the wall pair a
 * real light, all built from the same NEON_TUBES definition the block material
 * scatters against.
 *
 * The walls are RectAreaLights rather than the point lights that used to be
 * here. A point light is a bulb: it has one position, so it lands a hot spot
 * wherever it happens to sit and falls off hard on either side, and no amount
 * of spacing them out hides that. A rect area light *is* the strip - one soft
 * source the length of the wall, which is what the fixture looks like anyway.
 * They also cast nothing, deliberately: the monitor light in GameScene owns the
 * shadow, and a second caster from the side would cross it and read as a bug.
 */
RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())

const tubeMaterials: THREE.Material[] = []
const panels: THREE.RectAreaLight[] = []

for (const tube of NEON_TUBES) {
  const a = new THREE.Vector3(...tube.a)
  const b = new THREE.Vector3(...tube.b)
  const length = a.distanceTo(b)
  const middle = a.clone().lerp(b, 0.5)

  if (tube.kind === 'monitor') {
    // No fixture, only the wash. Aimed down and back so the light rakes the
    // upper wall on its way in - a lamp you can see reads as a lamp, but light
    // arriving from somewhere above the frame reads as the room being lit.
    const overhead = new THREE.RectAreaLight(new THREE.Color(tube.color), 3.6 * tube.intensity, COLS, 2.4)
    overhead.position.copy(middle)
    overhead.lookAt(0, wellBottomY, BACK_Z + 0.4)
    panels.push(overhead)
    group.add(overhead)
    continue
  }

  const material = tubeMaterial(tube)
  const fixture = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, length, 8, 1), material)
  // CylinderGeometry runs along +Y, so aim it down the segment
  fixture.position.copy(middle)
  fixture.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  tubeMaterials.push(material)
  group.add(fixture)

  const panel = new THREE.RectAreaLight(new THREE.Color(tube.color), 2.2 * tube.intensity, 1.1, length)
  panel.position.copy(middle)
  // lights aim their -Z at the target, so this turns the panel in to face the
  // middle of the well instead of washing the wall behind it
  panel.lookAt(0, middle.y, 0)
  panels.push(panel)
  group.add(panel)
}

// The fixture animates itself off `time` in the shader; the lamps and the
// block scattering cannot, so they are pushed here from the same cycle.
const { onBeforeRender } = useLoop()
onBeforeRender(({ elapsed }) => {
  const colors = updateTubeColors(elapsed)
  NEON_TUBES.forEach((tube, i) => {
    panels[i]!.color.copy(colors[i]!)
  })
})

onBeforeUnmount(() => {
  for (const m of tubeMaterials) m.dispose()
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    mesh.geometry?.dispose?.()
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(m)) m.forEach((x) => x.dispose())
    else m?.dispose?.()
  })
})
</script>
