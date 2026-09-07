<template>
  <primitive :object="rig" />
  <well />
  <board-blocks :accessible />
  <active-piece :accessible />
  <shatter-v-f-x />
  <post-f-x />
</template>

<script setup lang="ts">
import * as THREE from 'three/webgpu'
import { COLS } from '@tetris/core'
import { liveFeel } from '~/config/feel'
import { CEILING_Y, FLOOR_Y, fitCamera } from '~/lib/three'
import Well from './Well.vue'
import BoardBlocks from './BoardBlocks.vue'
import ActivePiece from './ActivePiece.vue'
import ShatterVFX from './ShatterVFX.vue'
import PostFX from './PostFX.vue'

const { accessible = false } = defineProps<{ accessible?: boolean }>()
const session = inject(GameSessionKey)!
const { renderer, camera, sizes, scene } = useTresContext()

/**
 * The camera and the lights are built imperatively and handed to the scene
 * as raw objects. Declaring them as Tres components and then writing to them
 * every frame through a template ref means mutating a reactive proxy 60 times
 * a second, which Vue eventually reports as "maximum recursive updates".
 */
const rig = new THREE.Group()

const cam = new THREE.PerspectiveCamera(liveFeel.camera.fov, 1, 0.1, 400)
cam.position.set(0, 0, 30)

/**
 * The monitor light: straight down the well, and the only thing in the scene
 * that casts. The shadow it drops under the falling piece is the only landing
 * cue there is now - the ghost piece is gone, and reading the drop off a real
 * shadow is meant to be harder than reading it off an outline.
 *
 * Directly overhead with no lateral offset at all, because the moment this
 * light leans the shadow slides off the columns the piece will actually land
 * in and starts lying about the landing position.
 */
const MONITOR_Y = CEILING_Y + 6
const monitor = new THREE.DirectionalLight('#dbeafe', 5.4)
// A hair off true vertical, so the light direction is never exactly parallel to
// the shadow camera's up vector and lookAt never has to fall back to a nudged,
// arbitrary basis. Far too small to shift which column the shadow lands in.
monitor.position.set(0, MONITOR_Y, 0.35)
monitor.target.position.set(0, FLOOR_Y, 0)
monitor.castShadow = true
const monitorShadow = monitor.shadow
monitorShadow.mapSize.set(2048, 2048)
Object.assign(monitorShadow.camera, {
  near: 0.5,
  far: MONITOR_Y - FLOOR_Y + 2,
  left: -(COLS / 2 + 1),
  right: COLS / 2 + 1,
  top: 3.5,
  bottom: -3.5,
})
// normalBias, not a negative depth bias: this renderer can run reversed-Z, and
// a negative bias there pushes the comparison the wrong way - which shows up as
// an inverted shadow, lit exactly where it should be dark
monitorShadow.bias = 0
monitorShadow.normalBias = 0.02
monitorShadow.blurSamples = 8
// three never recomputes this for you: every bound set above is inert until the
// projection matrix is rebuilt, and the camera quietly keeps its default +-5 box
monitorShadow.camera.updateProjectionMatrix()

// Deliberately low. Fill light is the enemy here: every unit of it lands
// inside the shadow as well as outside it, and the contrast between those two
// is the whole signal the player reads the landing position from.
const ambient = new THREE.AmbientLight('#8ea2c4', 0.22)
const hemi = new THREE.HemisphereLight('#38bdf8', '#0b1020', 0.24)
rig.add(cam, monitor, monitor.target, ambient, hemi)

/** the renderer's shadowMap is typed without the manual-refresh flags */
type ShadowMapFlags = { autoUpdate: boolean; needsUpdate: boolean; type: number }
const shadowMapOf = (r: THREE.Renderer): ShadowMapFlags =>
  (r as unknown as { shadowMap: ShadowMapFlags }).shadowMap

onMounted(() => {
  camera.registerCamera(cam, true)
})

/**
 * Detect the real backend — navigator.gpu says nothing about what we got.
 * This watches `isInitialized` rather than using onReady, because onReady can
 * fire before this component mounts and the hook does not replay.
 */
watch(
  () => renderer.isInitialized.value,
  (ok) => {
    if (ok) configureRenderer(renderer.instance as THREE.Renderer)
  },
  { immediate: true },
)

function configureRenderer(r: THREE.Renderer): void {
  const three = r as THREE.Renderer
  const backend = three.backend as unknown as { isWebGPUBackend?: boolean }
  session.quality.setBackend(backend?.isWebGPUBackend ? 'webgpu' : 'webgl')

  three.toneMapping = THREE.ACESFilmicToneMapping
  three.toneMappingExposure = 1.05
  three.outputColorSpace = THREE.SRGBColorSpace
  // VSM, and not by preference: with this straight-down light PCF renders the
  // shadow inverted, lit exactly where it should be dark. Confirmed by turning
  // castShadow off and watching the bright patches vanish with it. VSM also
  // keeps radius and darkness as live uniforms, which the render loop drives.
  shadowMapOf(three).type = THREE.VSMShadowMap
  // still refreshed by hand, but now every frame a piece is moving - see the
  // render loop. Only a settled board goes back to costing nothing.
  shadowMapOf(three).autoUpdate = false
  shadowMapOf(three).needsUpdate = true
}

/**
 * Keep the well at a constant share of the viewport on every aspect ratio.
 * A plain `watch` on the sizes, not watchEffect: the callback writes to the
 * camera, and watchEffect would re-collect that as a dependency.
 */
let baseZ = 30
watch(
  [sizes.width, sizes.height],
  ([w, h]) => {
    if (!w || !h) return
    cam.fov = liveFeel.camera.fov
    cam.aspect = w / h
    fitCamera(cam, w / h, liveFeel.camera.fitMargin)
    baseZ = cam.position.z
  },
  { immediate: true },
)

let tilt = 0
const pointer = { x: 0, y: 0 }

function onPointerMove(e: PointerEvent): void {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1
  pointer.y = (e.clientY / window.innerHeight) * 2 - 1
}
if (typeof window !== 'undefined') window.addEventListener('pointermove', onPointerMove)

const offLevel = session.bus.on('LEVEL_UP', () => {
  tilt = liveFeel.camera.levelUpTilt
})

// shadows only need refreshing when the stack actually changed
watch(
  () => session.boardVersion.value,
  () => {
    const r = renderer.instance as THREE.Renderer | undefined
    if (r) shadowMapOf(r).needsUpdate = true
  },
)

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const impact = session.impact.state
  const shake = session.quality.useShake.value ? impact.shake : 0

  // screen shake is a CAMERA offset, not a post effect: the projection stays
  // honest and the UI never smears
  const sx = (Math.random() - 0.5) * shake * 0.55
  const sy = (Math.random() - 0.5) * shake * 0.55
  const reduced = session.quality.reducedMotion.value
  const px = reduced ? 0 : pointer.x * liveFeel.camera.parallax
  const py = reduced ? 0 : -pointer.y * liveFeel.camera.parallax

  tilt *= Math.exp(-delta * 3)
  cam.position.set(sx + px, sy + py + tilt * 4, baseZ)
  cam.lookAt(px * 0.4, py * 0.4 + tilt * 2, 0)
  cam.rotation.z += tilt * 0.4 + sx * 0.02

  monitor.intensity = 5.4 + impact.flash * 3.4
  updateShadow()
})

/**
 * An area source throws a shadow that tightens as the occluder approaches the
 * surface; a directional light throws the same shadow at every height. So the
 * penumbra is driven by hand off the one number that matters - how far the
 * piece still has to fall - which is also exactly the reading the ghost piece
 * used to give: wide and faint high up, tight and dark on contact.
 */
function updateShadow(): void {
  const r = renderer.instance as THREE.Renderer | undefined
  if (!r) return

  const active = session.engine.activeCells()
  const landing = session.engine.ghostCells()
  if (active.length > 0 && landing.length > 0) {
    // both lists come from the same cell order, so any pair gives the drop
    const drop = active[0]!.y - landing[0]!.y
    const t = Math.min(1, Math.max(0, drop / 16))
    // Radius is counted in texels. Kept to a narrow band on purpose: blur this
    // wide enough to be physically right for a 19-cell drop and the shadow
    // stops being a shape you can line a piece up against, which is the entire
    // job it took over from the ghost.
    monitor.shadow.radius = 1.5 + t * 9
    // and it darkens on the way down, so arriving reads as arriving
    monitor.shadow.intensity = 1 - t * 0.3
    // the piece moves every frame, so the map has to be rebuilt every frame -
    // a settled board still costs nothing, which is the point of doing it here
    // rather than turning autoUpdate back on
    shadowMapOf(r).needsUpdate = true
  }
}

onBeforeUnmount(() => {
  offLevel()
  camera.deregisterCamera(cam)
  monitor.dispose()
  if (typeof window !== 'undefined') window.removeEventListener('pointermove', onPointerMove)
  void scene
})
</script>
