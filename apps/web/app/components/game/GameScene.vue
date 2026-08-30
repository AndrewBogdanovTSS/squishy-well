<script setup lang="ts">
import { inject, onBeforeUnmount, onMounted, watch } from 'vue'
import * as THREE from 'three/webgpu'
import { useLoop, useTresContext } from '@tresjs/core'
import { GameSessionKey } from '~/composables/useGameSession'
import { liveFeel } from '~/config/feel'
import { fitCamera } from '~/lib/three'
import Well from './Well.vue'
import BoardBlocks from './BoardBlocks.vue'
import ActivePiece from './ActivePiece.vue'
import GhostPiece from './GhostPiece.vue'
import ShatterVFX from './ShatterVFX.vue'
import PostFX from './PostFX.vue'

const props = withDefaults(defineProps<{ accessible?: boolean }>(), { accessible: false })
const session = inject(GameSessionKey)!
const { renderer, camera, sizes, scene } = useTresContext()

/**
 * The camera and the key light are built imperatively and handed to the scene
 * as raw objects. Declaring them as Tres components and then writing to them
 * every frame through a template ref means mutating a reactive proxy 60 times
 * a second, which Vue eventually reports as "maximum recursive updates".
 */
const rig = new THREE.Group()

const cam = new THREE.PerspectiveCamera(liveFeel.camera.fov, 1, 0.1, 400)
cam.position.set(0, 0, 30)

const keyLight = new THREE.DirectionalLight('#e2e8f0', 1.5)
keyLight.position.set(7, 14, 12)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(1024, 1024)
keyLight.shadow.camera.near = 1
keyLight.shadow.camera.far = 60
keyLight.shadow.camera.left = -14
keyLight.shadow.camera.right = 14
keyLight.shadow.camera.top = 18
keyLight.shadow.camera.bottom = -18
keyLight.shadow.bias = -0.0008

const ambient = new THREE.AmbientLight('#8ea2c4', 0.55)
const hemi = new THREE.HemisphereLight('#38bdf8', '#0b1020', 0.5)
rig.add(cam, keyLight, keyLight.target, ambient, hemi)

/** the renderer's shadowMap is typed without the manual-refresh flags */
type ShadowMapFlags = { autoUpdate: boolean; needsUpdate: boolean }
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
  // the scene is static in 99% of frames, so shadows are refreshed by hand
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

  keyLight.intensity = 1.5 + impact.flash * 2.5
})

onBeforeUnmount(() => {
  offLevel()
  camera.deregisterCamera(cam)
  keyLight.dispose()
  if (typeof window !== 'undefined') window.removeEventListener('pointermove', onPointerMove)
  void scene
})
</script>

<template>
  <primitive :object="rig" />

  <Well />
  <BoardBlocks :accessible="props.accessible" />
  <GhostPiece />
  <ActivePiece :accessible="props.accessible" />
  <ShatterVFX />
  <PostFX />
</template>
