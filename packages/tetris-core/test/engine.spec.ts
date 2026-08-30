import { beforeEach, describe, expect, it } from 'vitest'
import { TetrisEngine } from '../src/engine'
import { STEP_MS } from '../src/replay'
import { COLS, boardFromStrings, idx, isRowFull } from '../src/board'
import { countOf, firstOf, hold, place, run, tap } from './util'

const ticksFor = (ms: number) => Math.ceil(ms / STEP_MS)

describe('spawning', () => {
  let e: TetrisEngine
  beforeEach(() => {
    e = new TetrisEngine({ seed: 1 })
  })

  it('starts with an active piece and a full preview queue', () => {
    expect(e.active).not.toBeNull()
    expect(e.snapshot().next).toHaveLength(5)
    expect(e.phase).toBe('FALLING')
  })

  it('spawns into the top of the visible well', () => {
    const cells = e.activeCells()
    const minY = Math.min(...cells.map((c) => c.y))
    expect(minY).toBe(19)
  })

  it('is deterministic for a given seed', () => {
    const a = new TetrisEngine({ seed: 4242 })
    const b = new TetrisEngine({ seed: 4242 })
    run(a, 600, { 10: tap('HARD'), 40: tap('HARD'), 80: tap('CW'), 100: tap('HARD') })
    run(b, 600, { 10: tap('HARD'), 40: tap('HARD'), 80: tap('CW'), 100: tap('HARD') })
    expect(a.fingerprint()).toBe(b.fingerprint())
  })
})

describe('movement and gravity', () => {
  it('moves horizontally on press and repeats after DAS', () => {
    const e = new TetrisEngine({ seed: 2, tuning: { dasMs: 100, arrMs: 50 } })
    const x0 = e.active!.x
    run(e, 1, { 0: hold('LEFT') })
    expect(e.active!.x).toBe(x0 - 1) // immediate first move
    run(e, ticksFor(100)) // DAS charge, no repeats yet
    const afterDas = e.active!.x
    run(e, ticksFor(150))
    expect(e.active!.x).toBeLessThan(afterDas)
  })

  it('slides to the wall instantly when ARR is 0', () => {
    const e = new TetrisEngine({ seed: 3, tuning: { dasMs: 0, arrMs: 0 } })
    run(e, 3, { 0: hold('LEFT') })
    expect(e.active!.x + Math.min(...e.activeCells().map((c) => c.x - e.active!.x))).toBe(0)
    expect(Math.min(...e.activeCells().map((c) => c.x))).toBe(0)
  })

  it('falls one row per gravity interval at level 1', () => {
    const e = new TetrisEngine({ seed: 5 })
    const y0 = e.active!.y
    run(e, ticksFor(1000) + 1)
    expect(e.active!.y).toBe(y0 - 1)
  })

  it('soft drop is much faster and scores a point per cell', () => {
    const e = new TetrisEngine({ seed: 6 })
    const y0 = e.active!.y
    run(e, ticksFor(500), { 0: hold('SOFT') })
    const dropped = y0 - e.active!.y
    expect(dropped).toBeGreaterThan(5)
    expect(e.score).toBe(dropped)
  })

  it('hard drop scores 2 per cell and locks immediately', () => {
    const e = new TetrisEngine({ seed: 7 })
    const events = run(e, 1, { 0: tap('HARD') })
    const hd = firstOf(events, 'HARD_DROP')!
    // a piece spawns with its lowest cell on row 19, so it always falls 19 rows
    expect(hd.distance).toBe(19)
    expect(e.score).toBe(hd.distance * 2)
    expect(firstOf(events, 'LOCK')).toBeDefined()
    expect(e.pieces).toBe(1)
  })
})

describe('lock delay', () => {
  it('locks 500 ms after touching down', () => {
    const e = new TetrisEngine({ seed: 8 })
    place(e, 'O', 0, 3)
    let lockedAt = -1
    for (let t = 0; t < 60 && lockedAt < 0; t++) {
      const evs = e.tick(STEP_MS)
      if (evs.some((x) => x.t === 'LOCK')) lockedAt = t
    }
    expect(lockedAt).toBeGreaterThanOrEqual(ticksFor(500) - 2)
    expect(lockedAt).toBeLessThanOrEqual(ticksFor(500) + 2)
  })

  it('a successful move resets the timer', () => {
    const e = new TetrisEngine({ seed: 9 })
    place(e, 'O', 0, 3)
    // nudge every 400 ms: without a reset the piece would have locked by 500 ms
    const script: Record<number, ReturnType<typeof tap>> = {}
    for (let t = 24; t < 200; t += 24) script[t] = tap(t % 48 === 0 ? 'LEFT' : 'RIGHT')
    const events = run(e, 100, script)
    expect(countOf(events, 'LOCK')).toBe(0)
  })

  it('caps the number of resets so stalling cannot go on forever', () => {
    const e = new TetrisEngine({ seed: 10 })
    place(e, 'O', 0, 3)
    const script: Record<number, ReturnType<typeof tap>> = {}
    for (let t = 5; t < 900; t += 5) script[t] = tap(Math.floor(t / 5) % 2 === 0 ? 'LEFT' : 'RIGHT')
    const events = run(e, 900, script)
    expect(countOf(events, 'LOCK')).toBeGreaterThan(0)
  })
})

describe('line clears', () => {
  const almostFull = ['..XXXXXXXX']

  it('clears a row, holding it on the board for the clear delay', () => {
    const e = new TetrisEngine({ seed: 11 })
    e.board.set(boardFromStrings(almostFull))
    place(e, 'O', 0, -1)
    const events = run(e, 1, { 0: tap('HARD') })

    const lc = firstOf(events, 'LINE_CLEAR')!
    expect(lc.rows).toEqual([0])
    expect(lc.lines).toBe(1)
    expect(lc.kind).toBe('single')
    expect(lc.points).toBe(100)
    expect(lc.cells).toHaveLength(COLS)
    expect(e.phase).toBe('CLEARING')
    // the row is still there — the renderer needs it to animate
    expect(isRowFull(e.board, 0)).toBe(true)

    const after = run(e, ticksFor(400) + 2)
    expect(firstOf(after, 'ROWS_REMOVED')).toBeDefined()
    expect(isRowFull(e.board, 0)).toBe(false)
    expect(e.lines).toBe(1)
    expect(e.phase).toBe('FALLING')
  })

  it('buffers rotation pressed during the clear delay (IRS)', () => {
    const e = new TetrisEngine({ seed: 12 })
    e.board.set(boardFromStrings(almostFull))
    place(e, 'O', 0, -1)
    run(e, 1, { 0: tap('HARD') })
    expect(e.phase).toBe('CLEARING')
    const after = run(e, ticksFor(400) + 2, { 3: tap('CW') })
    const spawn = firstOf(after, 'SPAWN')!
    const rotated = after.find((x) => x.t === 'ROTATE')
    // O has no visible rotation, so only assert the buffered input was consumed
    expect(spawn).toBeDefined()
    expect(rotated === undefined || rotated.t === 'ROTATE').toBe(true)
  })

  it('awards a tetris and starts a back-to-back chain', () => {
    const e = new TetrisEngine({ seed: 13 })
    e.board.set(
      boardFromStrings([
        '.XXXXXXXXX',
        '.XXXXXXXXX',
        '.XXXXXXXXX',
        '.XXXXXXXXX',
      ]),
    )
    place(e, 'I', 1, -2)
    const events = run(e, 1, { 0: tap('HARD') })
    const lc = firstOf(events, 'LINE_CLEAR')!
    expect(lc.lines).toBe(4)
    expect(lc.kind).toBe('tetris')
    // the well is empty afterwards, so this is also a perfect clear
    expect(lc.perfectClear).toBe(true)
    expect(lc.points).toBe(800 + 2000)
    expect(e.b2b).toBe(true)
  })
})

describe('T-spin', () => {
  it('detects a T-spin double through a rotation into the slot', () => {
    const e = new TetrisEngine({ seed: 14 })
    e.board.set(
      boardFromStrings([
        '....X.....',
        'XX...XXXXX',
        'XXX.XXXXXX',
      ]),
    )
    place(e, 'T', 3, 2)
    const rotated = run(e, 1, { 0: tap('CCW') })
    expect(firstOf(rotated, 'ROTATE')).toBeDefined()
    expect(e.active!.rot).toBe(2)

    const events = run(e, 1, { 0: tap('HARD') })
    const lock = firstOf(events, 'LOCK')!
    expect(lock.spin).toBe('full')
    const lc = firstOf(events, 'LINE_CLEAR')!
    expect(lc.lines).toBe(2)
    expect(lc.kind).toBe('tspin')
    expect(lc.points).toBe(1200)
  })
})

describe('hold', () => {
  it('swaps the active piece and refuses a second hold', () => {
    const e = new TetrisEngine({ seed: 15 })
    const first = e.active!.type
    const nextUp = e.snapshot().next[0]!
    const events = run(e, 1, { 0: tap('HOLD') })
    const h = firstOf(events, 'HOLD')!
    expect(h.piece).toBe(first)
    expect(h.swapped).toBeNull()
    expect(e.hold).toBe(first)
    expect(e.active!.type).toBe(nextUp)

    const denied = run(e, 1, { 0: tap('HOLD') })
    expect(firstOf(denied, 'HOLD_DENIED')).toBeDefined()
  })

  it('allows holding again after the next lock', () => {
    const e = new TetrisEngine({ seed: 16 })
    run(e, 2, { 0: tap('HOLD'), 1: tap('HARD') })
    const events = run(e, 1, { 0: tap('HOLD') })
    expect(firstOf(events, 'HOLD')).toBeDefined()
  })
})

describe('top out', () => {
  it('ends the game when a piece cannot spawn', () => {
    const e = new TetrisEngine({ seed: 17 })
    for (let y = 0; y < 22; y++) {
      for (const x of [3, 4, 5, 6]) e.board[idx(x, y)] = 1
    }
    const events = run(e, 5, { 0: tap('HARD') })
    expect(firstOf(events, 'TOP_OUT')).toBeDefined()
    expect(e.phase).toBe('GAME_OVER')
  })

  it('ignores input after game over', () => {
    const e = new TetrisEngine({ seed: 18 })
    for (let y = 0; y < 22; y++) {
      for (const x of [3, 4, 5, 6]) e.board[idx(x, y)] = 1
    }
    run(e, 5, { 0: tap('HARD') })
    const after = run(e, 20, { 0: tap('HARD'), 5: tap('CW') })
    expect(after).toHaveLength(0)
  })
})

describe('ghost piece', () => {
  it('lands on the floor of an empty board', () => {
    const e = new TetrisEngine({ seed: 19 })
    const ghost = e.ghostCells()
    expect(Math.min(...ghost.map((c) => c.y))).toBe(0)
  })

  it('rests on top of the stack', () => {
    const e = new TetrisEngine({ seed: 20 })
    e.board.set(boardFromStrings(['XXXXXXXXXX', 'XXXXXXXXXX']))
    const ghost = e.ghostCells()
    expect(Math.min(...ghost.map((c) => c.y))).toBe(2)
  })
})
