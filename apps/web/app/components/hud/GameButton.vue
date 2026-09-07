<template>
  <component
    :is="to ? 'NuxtLink' : 'button'"
    :to="to"
    class="no-underline text-center bg-transparent b b-$border rounded-lg py-2 px-3.6 [transition:border-color_120ms_ease,background_120ms_ease,transform_80ms_ease] hover:(b-$accent bg-[rgb(var(--accent-rgb)/8%)]) active:translate-y-px focus-visible:(outline-2 outline-$accent outline-offset-2)"
    :class="[sizeClass, variant === 'quiet' && 'c-$muted']"
  >
    <slot />
  </component>
</template>

<script setup lang="ts">
/**
 * The one interactive-button look in the app: a bordered box that gains an
 * accent border and a tinted background on hover. `to` renders it as a
 * NuxtLink instead of a `<button>` - a page-exit action (QUIT, MENU) gets the
 * identical look and the identical hover/focus states this way, rather than
 * a hand-copied approximation of this class list that can drift from it (the
 * approximation it replaced had no hover or focus-visible state at all).
 * `size`/`variant` cover the other two repeated variations found across the
 * app (debug.vue's row of small buttons, the two quiet exit links) - see
 * docs/design-system.md's Tier 3b for why a prop, not a shortcut, is the fix
 * for "this component, but slightly different".
 */
const { to, size = 'md', variant = 'solid' } = defineProps<{
  to?: string
  size?: 'sm' | 'md'
  variant?: 'solid' | 'quiet'
}>()

const sizeClass = computed(() => (size === 'sm' ? 'text-label tracking-wide' : ''))
</script>
