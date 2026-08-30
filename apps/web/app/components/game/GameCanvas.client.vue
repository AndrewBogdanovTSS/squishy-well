<script setup lang="ts">
import { TresCanvas } from '@tresjs/core'
import type { TresRendererSetupContext } from '@tresjs/core'
import { WebGPURenderer } from 'three/webgpu'
import { toValue } from 'vue'
import GameScene from './GameScene.vue'

defineProps<{ accessible?: boolean }>()

const hasWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator

/**
 * The factory is SYNCHRONOUS on purpose: TresJS awaits `renderer.init()`
 * itself and only starts its loop afterwards. Returning a promise here would
 * hand it something that is not a renderer.
 *
 * `forceWebGL` gives a real WebGL2 fallback — the same TSL materials still
 * render, only compute shaders disappear (see useShatterVFX).
 */
function createRenderer(ctx: TresRendererSetupContext) {
  return new WebGPURenderer({
    canvas: toValue(ctx.canvas) as HTMLCanvasElement,
    antialias: false, // anti-aliasing happens in the post pipeline instead
    alpha: false,
    forceWebGL: !hasWebGPU,
    powerPreference: 'high-performance',
  })
}
</script>

<template>
  <TresCanvas
    :renderer="createRenderer"
    :dpr="[1, 2]"
    window-size
    shadows
    clear-color="#05070d"
    class="game-canvas"
  >
    <GameScene :accessible="accessible" />
  </TresCanvas>
</template>

<style scoped>
.game-canvas { display: block; }
</style>
