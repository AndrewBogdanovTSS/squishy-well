<template>
  <TresGroup />
</template>

<script setup lang="ts">
import * as THREE from 'three/webgpu'
import { float, pass, uniform, vec2 } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { chromaticAberration } from 'three/addons/tsl/display/ChromaticAberrationNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { liveFeel } from '~/config/feel'

const session = inject(GameSessionKey)!
const { renderer, scene, camera } = useTresContext()

/**
 * With post-processing on, the PIPELINE renders, not TresJS. useLoop().render()
 * replaces the default render function, and it runs after every scene update
 * for the frame, which is exactly where a post pass has to sit.
 */
const pipeline = shallowRef<THREE.RenderPipeline | null>(null)
const uBloom = uniform(liveFeel.bloom.strength)
const uAberration = uniform(0)

function build(): void {
  const r = renderer.instance as THREE.Renderer | undefined
  const cam = camera.activeCamera.value
  if (!r || !cam || !session.quality.usePostFx.value) return

  dispose()
  const p = new THREE.RenderPipeline(r)
  // pass() captures THESE scene and camera objects; if either is replaced the
  // pipeline has to be rebuilt, which is why this lives behind onReady.
  const scenePass = pass(scene.value, cam)
  const bloomPass = bloom(scenePass, uBloom, liveFeel.bloom.radius, liveFeel.bloom.threshold)
  const combined = scenePass.add(bloomPass)
  const aberrated = chromaticAberration(combined, uAberration, vec2(0.5, 0.5), float(1.06))
  p.outputNode = fxaa(aberrated)
  pipeline.value = p
}

function dispose(): void {
  pipeline.value?.dispose?.()
  pipeline.value = null
}

// `isInitialized` instead of onReady: the ready hook can fire before this
// component mounts, and it does not replay for late subscribers
watch(
  () => [renderer.isInitialized.value, session.quality.usePostFx.value] as const,
  ([ready, on]) => {
    if (ready && on) build()
    else dispose()
  },
  { immediate: true },
)

const { render } = useLoop()
render((notifySuccess) => {
  const r = renderer.instance as THREE.Renderer | undefined
  const cam = camera.activeCamera.value
  if (!r || !cam) return

  const impact = session.impact.state
  uBloom.value = liveFeel.bloom.strength * (1 + impact.bloomBoost * 1.6) + impact.flash * 0.8
  uAberration.value = impact.aberration * 0.006

  if (pipeline.value) pipeline.value.render()
  else r.render(scene.value, cam)
  notifySuccess()
})

onBeforeUnmount(dispose)
</script>
