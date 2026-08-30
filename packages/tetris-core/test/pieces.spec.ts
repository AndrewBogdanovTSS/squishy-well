import { describe, expect, it } from 'vitest'
import { KICKS_I, KICKS_JLSTZ, SHAPES, cellsOf, kickTable, minCellY } from '../src/pieces'
import { PIECE_TYPES } from '../src/types'
import type { Rot } from '../src/types'

describe('shapes', () => {
  it('every piece has 4 rotation states with exactly 4 cells', () => {
    for (const t of PIECE_TYPES) {
      expect(SHAPES[t]).toHaveLength(4)
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        expect(cellsOf(t, rot)).toHaveLength(4)
      }
    }
  })

  it('cells are unique within a rotation state', () => {
    for (const t of PIECE_TYPES) {
      for (const rot of [0, 1, 2, 3] as Rot[]) {
        const keys = new Set(cellsOf(t, rot).map(([x, y]) => `${x},${y}`))
        expect(keys.size, `${t} rot ${rot}`).toBe(4)
      }
    }
  })

  it('O is rotation invariant', () => {
    const base = JSON.stringify(cellsOf('O', 0))
    for (const rot of [1, 2, 3] as Rot[]) expect(JSON.stringify(cellsOf('O', rot))).toBe(base)
  })

  it('spawn states sit on the expected columns (guideline)', () => {
    // 3-wide pieces occupy columns 3..5, I occupies 3..6, O occupies 4..5
    const spawnCols = (t: (typeof PIECE_TYPES)[number]) =>
      [...new Set(cellsOf(t, 0).map(([x]) => x + 3))].sort((a, b) => a - b)
    expect(spawnCols('I')).toEqual([3, 4, 5, 6])
    expect(spawnCols('O')).toEqual([4, 5])
    for (const t of ['J', 'L', 'S', 'T', 'Z'] as const) {
      expect(spawnCols(t).every((c) => c >= 3 && c <= 5), t).toBe(true)
    }
  })

  it('T rotation centre is at box-local (1,1) in every state', () => {
    for (const rot of [0, 1, 2, 3] as Rot[]) {
      const has = cellsOf('T', rot).some(([x, y]) => x === 1 && y === 1)
      expect(has, `rot ${rot}`).toBe(true)
    }
  })

  it('minCellY matches the lowest occupied row', () => {
    expect(minCellY(cellsOf('I', 0))).toBe(2)
    expect(minCellY(cellsOf('I', 1))).toBe(0)
  })
})

describe('SRS kick tables', () => {
  const transitions = ['0>1', '1>0', '1>2', '2>1', '2>3', '3>2', '3>0', '0>3'] as const

  it('every transition has 5 offsets starting with the identity', () => {
    for (const key of transitions) {
      for (const table of [KICKS_JLSTZ, KICKS_I]) {
        expect(table[key], key).toBeDefined()
        expect(table[key]!).toHaveLength(5)
        expect(table[key]![0]).toEqual([0, 0])
      }
    }
  })

  // A -> B and B -> A must be exact negations. This is the property that
  // catches a flipped Y sign, which is the nastiest possible SRS bug.
  it('reverse transitions are exact negations', () => {
    const pairs: [string, string][] = [
      ['0>1', '1>0'],
      ['1>2', '2>1'],
      ['2>3', '3>2'],
      ['3>0', '0>3'],
    ]
    for (const table of [KICKS_JLSTZ, KICKS_I]) {
      for (const [a, b] of pairs) {
        const ta = table[a]!
        const tb = table[b]!
        for (let i = 0; i < ta.length; i++) {
          expect(tb[i]![0] + ta[i]![0], `${a}/${b}[${i}].x`).toBe(0)
          expect(tb[i]![1] + ta[i]![1], `${a}/${b}[${i}].y`).toBe(0)
        }
      }
    }
  })

  it('known JLSTZ values match the guideline table', () => {
    expect(KICKS_JLSTZ['0>1']).toEqual([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]])
    expect(KICKS_JLSTZ['2>3']).toEqual([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]])
  })

  it('known I values match the guideline table', () => {
    expect(KICKS_I['0>1']).toEqual([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]])
    expect(KICKS_I['1>2']).toEqual([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]])
  })

  it('O never kicks', () => {
    expect(kickTable('O', 0, 1)).toEqual([[0, 0]])
  })

  it('180 rotations use the house table and start in place', () => {
    expect(kickTable('T', 0, 2)[0]).toEqual([0, 0])
    expect(kickTable('I', 1, 3).length).toBeGreaterThan(1)
  })
})
