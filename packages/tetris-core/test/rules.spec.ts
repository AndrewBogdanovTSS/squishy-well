import { describe, expect, it } from 'vitest'
import { clearKind, detectSpin, gravityInterval, isB2BEligible, levelForLines, scoreClear } from '../src/rules'
import { boardFromStrings, createBoard, idx } from '../src/board'

describe('gravity', () => {
  // Canonical guideline values, seconds per row.
  const table: [number, number][] = [
    [1, 1.0],
    [2, 0.793],
    [3, 0.6178],
    [4, 0.47273],
    [5, 0.3552],
    [10, 0.06415],
    [15, 0.00706],
    [20, 0.00046],
  ]
  it.each(table)('level %i falls one row per %f s', (level, expected) => {
    expect(gravityInterval(level)).toBeCloseTo(expected, 4)
  })

  it('is monotonically faster with level', () => {
    for (let l = 1; l < 30; l++) {
      expect(gravityInterval(l + 1)).toBeLessThan(gravityInterval(l))
    }
  })

  it('never returns a non-positive interval', () => {
    for (let l = 1; l < 500; l++) expect(gravityInterval(l)).toBeGreaterThan(0)
  })
})

describe('levels', () => {
  it('advances every 10 lines', () => {
    expect(levelForLines(0)).toBe(1)
    expect(levelForLines(9)).toBe(1)
    expect(levelForLines(10)).toBe(2)
    expect(levelForLines(45)).toBe(5)
    expect(levelForLines(10, 5)).toBe(6)
  })
})

describe('scoring', () => {
  const base = { level: 1, combo: -1, b2bActive: false, perfectClear: false } as const

  it('scores plain clears from the guideline table', () => {
    expect(scoreClear({ ...base, lines: 1, spin: 'none' }).points).toBe(100)
    expect(scoreClear({ ...base, lines: 2, spin: 'none' }).points).toBe(300)
    expect(scoreClear({ ...base, lines: 3, spin: 'none' }).points).toBe(500)
    expect(scoreClear({ ...base, lines: 4, spin: 'none' }).points).toBe(800)
  })

  it('scales with level', () => {
    expect(scoreClear({ ...base, level: 7, lines: 4, spin: 'none' }).points).toBe(5600)
  })

  it('scores T-spins', () => {
    expect(scoreClear({ ...base, lines: 0, spin: 'full' }).points).toBe(400)
    expect(scoreClear({ ...base, lines: 1, spin: 'full' }).points).toBe(800)
    expect(scoreClear({ ...base, lines: 2, spin: 'full' }).points).toBe(1200)
    expect(scoreClear({ ...base, lines: 3, spin: 'full' }).points).toBe(1600)
    expect(scoreClear({ ...base, lines: 0, spin: 'mini' }).points).toBe(100)
    expect(scoreClear({ ...base, lines: 1, spin: 'mini' }).points).toBe(200)
  })

  it('applies the 1.5x back-to-back bonus only to eligible clears', () => {
    expect(scoreClear({ ...base, lines: 4, spin: 'none', b2bActive: true }).points).toBe(1200)
    expect(scoreClear({ ...base, lines: 2, spin: 'full', b2bActive: true }).points).toBe(1800)
    // a plain double breaks the chain instead of being multiplied
    expect(scoreClear({ ...base, lines: 2, spin: 'none', b2bActive: true }).points).toBe(300)
  })

  it('adds the combo bonus', () => {
    expect(scoreClear({ ...base, lines: 1, spin: 'none', combo: 3, level: 2 }).points).toBe(200 + 300)
  })

  it('marks b2b eligibility correctly', () => {
    expect(isB2BEligible(4, 'none')).toBe(true)
    expect(isB2BEligible(1, 'full')).toBe(true)
    expect(isB2BEligible(1, 'mini')).toBe(true)
    expect(isB2BEligible(3, 'none')).toBe(false)
    expect(isB2BEligible(0, 'full')).toBe(false)
  })

  it('labels clears', () => {
    expect(clearKind(4, 'none')).toBe('tetris')
    expect(clearKind(1, 'full')).toBe('tspin')
    expect(clearKind(1, 'mini')).toBe('tspin-mini')
  })

  it('adds a perfect clear bonus', () => {
    const pc = scoreClear({ ...base, lines: 4, spin: 'none', perfectClear: true }).points
    expect(pc).toBe(800 + 2000)
  })
})

describe('T-spin detection (three corner rule)', () => {
  it('requires the last action to be a rotation', () => {
    const board = boardFromStrings(['X.X.......', '.X........', 'X.X.......'])
    expect(detectSpin(board, { type: 'T', rot: 0, x: 0, y: 0 }, false, 0)).toBe('none')
  })

  it('ignores non-T pieces', () => {
    const board = createBoard()
    expect(detectSpin(board, { type: 'L', rot: 0, x: 3, y: 3 }, true, 0)).toBe('none')
  })

  it('reports a full spin when both front corners are filled', () => {
    // T pointing down (rot 2): front corners are the two bottom diagonals
    const board = createBoard()
    const cx = 4
    const cy = 5
    board[idx(cx - 1, cy - 1)] = 1
    board[idx(cx + 1, cy - 1)] = 1
    board[idx(cx - 1, cy + 1)] = 1
    expect(detectSpin(board, { type: 'T', rot: 2, x: cx - 1, y: cy - 1 }, true, 0)).toBe('full')
  })

  it('reports a mini when only one front corner is filled', () => {
    const board = createBoard()
    const cx = 4
    const cy = 5
    board[idx(cx - 1, cy + 1)] = 1 // one front corner (rot 0 faces up)
    board[idx(cx - 1, cy - 1)] = 1
    board[idx(cx + 1, cy - 1)] = 1
    expect(detectSpin(board, { type: 'T', rot: 0, x: cx - 1, y: cy - 1 }, true, 0)).toBe('mini')
  })

  it('upgrades a mini to a full spin when the last kick offset was used', () => {
    const board = createBoard()
    const cx = 4
    const cy = 5
    board[idx(cx - 1, cy + 1)] = 1
    board[idx(cx - 1, cy - 1)] = 1
    board[idx(cx + 1, cy - 1)] = 1
    expect(detectSpin(board, { type: 'T', rot: 0, x: cx - 1, y: cy - 1 }, true, 4)).toBe('full')
  })

  it('needs at least three occupied corners', () => {
    const board = createBoard()
    board[idx(3, 4)] = 1
    board[idx(5, 4)] = 1
    expect(detectSpin(board, { type: 'T', rot: 2, x: 3, y: 4 }, true, 0)).toBe('none')
  })
})
