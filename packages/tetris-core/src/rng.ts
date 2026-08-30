/**
 * Deterministic PRNG. Seeded, tiny, fast, and — most importantly —
 * reproducible across machines so replays and bug reports work.
 */
export interface Rng {
  (): number
  /** current internal state, so a replay can resume mid-game */
  state(): number
}

export function mulberry32(seed: number): Rng {
  let s = seed | 0
  const rng = (() => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }) as Rng
  rng.state = () => s
  return rng
}

/** In-place Fisher-Yates using the supplied rng. */
export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}
