/**
 * Every magic number that shapes how the game FEELS lives here.
 * Rules-affecting values (DAS, lock delay, clear delay) are forwarded into
 * the engine tuning so replays stay honest; the rest is pure presentation.
 * In dev this object is bound to a Tweakpane panel.
 */
export const feel = {
  input: {
    dasMs: 133,
    arrMs: 33,
    softDropRate: 20,
  },
  rules: {
    lockDelayMs: 500,
    maxLockResets: 15,
    /** must match the clear animation length below, they are the same pause */
    clearDelayMs: 400,
    previewCount: 5,
  },
  clear: {
    /** 0 -> flash, then shatter, then collapse. Fractions of clearDelayMs. */
    flashEnd: 0.3,
    shatterEnd: 0.62,
    collapseEase: 2.2,
  },
  hitstop: {
    single: 0,
    double: 20,
    triple: 35,
    tetris: 80,
    tspin: 70,
  },
  impact: {
    /** exponential decay rate per second for every impact channel */
    decay: 6,
    shakePerClear: 0.55,
    shakeTetris: 1.0,
    aberrationPerClear: 0.35,
    aberrationTetris: 0.9,
    bloomPerClear: 0.35,
    bloomTetris: 0.9,
    hardDropShake: 0.12,
    maxShake: 1.4,
    /** WCAG 2.3.1: never more than 3 flashes per second */
    minFlashIntervalMs: 340,
  },
  piece: {
    /** how fast the rendered piece chases the logical position (per second) */
    followRate: 34,
    squashOnLand: 0.34,
    squashRecoverMs: 170,
    kickNudge: 0.16,
  },
  camera: {
    fov: 35,
    /** fraction of the viewport height the well should occupy */
    fitMargin: 1.22,
    parallax: 0.35,
    levelUpTilt: 0.05,
  },
  bloom: {
    strength: 0.9,
    radius: 0.45,
    threshold: 0.7,
  },
  particles: {
    perCellHigh: 256,
    perCellMedium: 64,
    perCellLow: 24,
    poolHigh: 32768,
    poolMedium: 16384,
    poolCpu: 2000,
    // Tuned as spilled liquid rather than debris: heavy, quick to fall, and
    // barely bouncing. Water leaving a burst container goes sideways and then
    // straight down - it does not arc.
    gravity: -38,
    drag: 1.6,
    bounce: 0.12,
    lifeMin: 0.5,
    lifeMax: 1.15,
    speed: 6,
  },
  audio: {
    master: 0.5,
    sfx: 0.9,
  },
} as const

export type Feel = typeof feel

/** Mutable copy used by the dev tweak panel. */
export const liveFeel: DeepMutable<Feel> = structuredClone(feel) as DeepMutable<Feel>

export type DeepMutable<T> = {
  -readonly [K in keyof T]: T[K] extends object ? DeepMutable<T[K]> : T[K]
}
