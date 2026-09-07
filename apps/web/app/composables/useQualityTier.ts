export type QualityTier = 'high' | 'medium' | 'low' | 'minimal'
export type Backend = 'webgpu' | 'webgl' | 'unknown'

const ORDER: QualityTier[] = ['minimal', 'low', 'medium', 'high']

/**
 * Quality is decided from three inputs: what the GPU backend can actually do,
 * what the user asked for (reduced motion is not a suggestion), and what the
 * frame timing says at runtime. Adaptive changes are slow on the way up to
 * avoid oscillating between tiers.
 */
export function useQualityTier() {
  const reducedMotion = ref(false)
  const backend = ref<Backend>('unknown')
  const manual = ref<QualityTier | null>(null)
  const adaptive = ref<QualityTier>('high')

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotion.value = mq.matches
    const onChange = (e: MediaQueryListEvent) => {
      reducedMotion.value = e.matches
    }
    mq.addEventListener('change', onChange)
    onScopeDispose(() => mq.removeEventListener('change', onChange))
  }

  const ceiling = computed<QualityTier>(() => {
    if (reducedMotion.value) return 'minimal'
    // WebGL2 renders the same TSL materials and post pipeline perfectly well;
    // the only thing it cannot do is compute, and the particle layer already
    // falls back to a CPU pool for that
    if (backend.value === 'webgl') return 'medium'
    return 'high'
  })

  const tier = computed<QualityTier>(() => {
    if (manual.value) return manual.value
    const cap = ORDER.indexOf(ceiling.value)
    const auto = ORDER.indexOf(adaptive.value)
    return ORDER[Math.min(cap, auto)]!
  })

  // ---- adaptive frame timing -------------------------------------------
  const SAMPLES = 30
  const times: number[] = []
  let stableFrames = 0
  const frameMs = ref(16.7)

  function sample(dtMs: number): void {
    times.push(dtMs)
    if (times.length > SAMPLES) times.shift()
    if (times.length < SAMPLES) return
    let sum = 0
    for (const t of times) sum += t
    const avg = sum / times.length
    frameMs.value = avg

    if (avg > 20) {
      stableFrames = 0
      const i = ORDER.indexOf(adaptive.value)
      // 'minimal' is a user choice, never something adaptive quality picks
      if (i > 1) {
        adaptive.value = ORDER[i - 1]!
        times.length = 0
      }
    } else if (avg < 15) {
      stableFrames++
      if (stableFrames > 300) {
        stableFrames = 0
        const i = ORDER.indexOf(adaptive.value)
        if (i < ORDER.length - 1) {
          adaptive.value = ORDER[i + 1]!
          times.length = 0
        }
      }
    }
  }

  const particlesPerCell = computed(() => {
    switch (tier.value) {
      case 'high':
        return 256
      case 'medium':
        return 64
      case 'low':
        return 24
      default:
        return 0
    }
  })

  const usePostFx = computed(() => tier.value === 'high' || tier.value === 'medium')
  const useShadows = computed(() => tier.value === 'high')
  const useShake = computed(() => tier.value !== 'minimal')

  return {
    tier,
    backend,
    reducedMotion,
    manual,
    frameMs,
    sample,
    particlesPerCell,
    usePostFx,
    useShadows,
    useShake,
    setBackend: (value: Backend) => {
      backend.value = value
    },
  }
}

export type QualityController = ReturnType<typeof useQualityTier>
