<script setup lang="ts">
import { inject, onBeforeUnmount, shallowRef, watch } from 'vue'
import * as THREE from 'three/webgpu'
import { useLoop, useTresContext } from '@tresjs/core'
import { GameSessionKey } from '~/composables/useGameSession'
import { createShatterVFX, type ShatterVFX } from '~/composables/useShatterVFX'

const session = inject(GameSessionKey)!
const { renderer } = useTresContext()

const group = new THREE.Group()
const vfx = shallowRef<ShatterVFX | null>(null)

function build(): void {
  vfx.value?.dispose()
  if (vfx.value) group.remove(vfx.value.object)
  const created = createShatterVFX({
    backend: session.quality.backend.value,
    perCell: session.quality.particlesPerCell.value,
  })
  group.add(created.object)
  vfx.value = created
}

watch(
  () => [session.quality.backend.value, session.quality.particlesPerCell.value] as const,
  build,
  { immediate: true },
)

/**
 * Debris is spawned from the LINE_CLEAR event, which carries the exact cells
 * and colours that were destroyed. The VFX layer never reads engine state.
 */
const offClear = session.bus.on('LINE_CLEAR', (e) => {
  vfx.value?.emit(e.cells)
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  vfx.value?.update((renderer.instance as THREE.Renderer) ?? null, delta)
})

onBeforeUnmount(() => {
  offClear()
  vfx.value?.dispose()
})

defineExpose({ mode: () => vfx.value?.mode ?? 'off' })
</script>

<template>
  <primitive :object="group" />
</template>
