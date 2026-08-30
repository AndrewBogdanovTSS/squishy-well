import { liveFeel } from '~/config/feel'
import type { EventBus } from './useEventBus'

/**
 * One source of truth for "the picture got hit": screen shake, chromatic
 * aberration, bloom boost and hitstop all live on the same decaying channels.
 * Effects read the channels; nothing else decides how hard to shake.
 */
export interface ImpactState {
  shake: number
  aberration: number
  bloomBoost: number
  flash: number
  /** milliseconds of frozen simulation still owed */
  hitstop: number
}

export function createImpactBus(bus: EventBus, opts: { reducedMotion: () => boolean }) {
  const state: ImpactState = { shake: 0, aberration: 0, bloomBoost: 0, flash: 0, hitstop: 0 }
  let lastFlashAt = -Infinity

  /** WCAG 2.3.1: at most three flashes per second, no exceptions. */
  function requestFlash(amount: number): void {
    const now = performance.now()
    if (now - lastFlashAt < liveFeel.impact.minFlashIntervalMs) return
    lastFlashAt = now
    state.flash = Math.min(1, state.flash + amount)
  }

  const off: Array<() => void> = []

  off.push(
    bus.on('LINE_CLEAR', (e) => {
      const f = liveFeel.impact
      const tetris = e.lines === 4 || e.spin !== 'none'
      const k = tetris ? 1 : e.lines / 4
      if (opts.reducedMotion()) {
        state.hitstop = 0
        requestFlash(0.25 * k)
        return
      }
      state.shake = Math.min(f.maxShake, state.shake + (tetris ? f.shakeTetris : f.shakePerClear * k))
      state.aberration += tetris ? f.aberrationTetris : f.aberrationPerClear * k
      state.bloomBoost += tetris ? f.bloomTetris : f.bloomPerClear * k
      requestFlash(tetris ? 1 : 0.55 * k)

      const h = liveFeel.hitstop
      const ms =
        e.spin !== 'none' ? h.tspin : ([0, h.single, h.double, h.triple, h.tetris][e.lines] ?? 0)
      state.hitstop = Math.max(state.hitstop, ms)
    }),
  )

  off.push(
    bus.on('HARD_DROP', (e) => {
      if (opts.reducedMotion()) return
      state.shake = Math.min(
        liveFeel.impact.maxShake,
        state.shake + liveFeel.impact.hardDropShake * Math.min(1, e.distance / 18),
      )
    }),
  )

  off.push(
    bus.on('TOP_OUT', () => {
      if (opts.reducedMotion()) return
      state.shake = Math.min(liveFeel.impact.maxShake, state.shake + 1.2)
      state.aberration += 1.4
    }),
  )

  /** Exponential decay, framerate independent. */
  function update(dtMs: number): void {
    const k = Math.exp((-dtMs / 1000) * liveFeel.impact.decay)
    state.shake *= k
    state.aberration *= k
    state.bloomBoost *= k
    state.flash *= Math.exp((-dtMs / 1000) * 12)
    if (state.shake < 1e-4) state.shake = 0
    if (state.aberration < 1e-4) state.aberration = 0
    if (state.bloomBoost < 1e-4) state.bloomBoost = 0
    if (state.flash < 1e-4) state.flash = 0
  }

  /** Consumes up to dt milliseconds of hitstop, returns the frozen amount. */
  function consumeHitstop(dtMs: number): number {
    if (state.hitstop <= 0) return 0
    const used = Math.min(state.hitstop, dtMs)
    state.hitstop -= used
    return used
  }

  function dispose(): void {
    for (const fn of off) fn()
  }

  return { state, update, consumeHitstop, requestFlash, dispose }
}

export type ImpactBus = ReturnType<typeof createImpactBus>
