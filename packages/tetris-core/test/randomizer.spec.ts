import { describe, expect, it } from 'vitest'
import { BagRandomizer } from '../src/randomizer'
import { mulberry32 } from '../src/rng'
import { PIECE_TYPES } from '../src/types'
import type { PieceType } from '../src/types'

describe('7-bag randomizer', () => {
  const BAGS = 10_000

  it('deals every piece exactly once per bag', () => {
    const rand = new BagRandomizer(mulberry32(1234))
    const counts: Record<string, number> = {}
    const seq: PieceType[] = []
    for (let b = 0; b < BAGS; b++) {
      const bag = new Set<PieceType>()
      for (let i = 0; i < 7; i++) {
        const p = rand.next()
        bag.add(p)
        seq.push(p)
        counts[p] = (counts[p] ?? 0) + 1
      }
      expect(bag.size, `bag ${b} had a duplicate`).toBe(7)
    }
    for (const t of PIECE_TYPES) expect(counts[t]).toBe(BAGS)
    expect(seq).toHaveLength(BAGS * 7)
  })

  it('never puts more than 12 pieces between two copies of the same type', () => {
    const rand = new BagRandomizer(mulberry32(99))
    const last: Record<string, number> = {}
    let maxGap = 0
    for (let i = 0; i < BAGS * 7; i++) {
      const p = rand.next()
      if (last[p] !== undefined) maxGap = Math.max(maxGap, i - last[p]! - 1)
      last[p] = i
    }
    expect(maxGap).toBeLessThanOrEqual(12)
  })

  it('is deterministic for a given seed', () => {
    const a = new BagRandomizer(mulberry32(7))
    const b = new BagRandomizer(mulberry32(7))
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next())
  })

  it('produces different sequences for different seeds', () => {
    const a = new BagRandomizer(mulberry32(1))
    const b = new BagRandomizer(mulberry32(2))
    const sa = Array.from({ length: 50 }, () => a.next()).join('')
    const sb = Array.from({ length: 50 }, () => b.next()).join('')
    expect(sa).not.toBe(sb)
  })
})

describe('mulberry32', () => {
  it('stays inside [0, 1)', () => {
    const r = mulberry32(42)
    for (let i = 0; i < 100_000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})
