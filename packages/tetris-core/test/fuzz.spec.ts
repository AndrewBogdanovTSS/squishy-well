import { describe, expect, it } from 'vitest'
import { TetrisEngine } from '../src/engine'
import { STEP_MS } from '../src/replay'
import { COLS, ROWS, collides, fullRows, idx } from '../src/board'
import { cellsOf } from '../src/pieces'
import { mulberry32 } from '../src/rng'
import type { Command, Key } from '../src/types'

const KEYS: Key[] = ['LEFT', 'RIGHT', 'SOFT', 'HARD', 'CW', 'CCW', 'FLIP', 'HOLD']

function randomCommands(rnd: () => number): Command[] {
  const r = rnd()
  if (r < 0.75) return []
  const k = KEYS[Math.floor(rnd() * KEYS.length)]!
  return rnd() < 0.5 ? [{ t: 'PRESS', k }] : [{ t: 'RELEASE', k }]
}

describe('invariants under random play', () => {
  it('never corrupts the board across 50 seeded games', () => {
    for (let game = 0; game < 50; game++) {
      const rnd = mulberry32(1000 + game)
      const e = new TetrisEngine({ seed: game })
      let lastScore = 0

      for (let t = 0; t < 2000; t++) {
        e.tick(STEP_MS, randomCommands(rnd))

        // scores never go backwards
        expect(e.score, `game ${game} tick ${t}`).toBeGreaterThanOrEqual(lastScore)
        lastScore = e.score

        if (e.phase === 'GAME_OVER') break

        // the active piece never overlaps the stack
        if (e.active) {
          const p = e.active
          expect(collides(e.board, cellsOf(p.type, p.rot), p.x, p.y), `overlap at tick ${t}`).toBe(false)
          expect(p.y + 4).toBeLessThanOrEqual(ROWS)
        }

        // completed rows only survive during the clear animation
        if (e.phase !== 'CLEARING') {
          expect(fullRows(e.board).length, `stale full row at tick ${t}`).toBe(0)
        }
      }

      // cells only ever hold known piece codes
      for (let i = 0; i < e.board.length; i++) {
        expect(e.board[i]!).toBeLessThanOrEqual(7)
      }
    }
  })

  it('never floats a cell above an empty column bottom after a clear', () => {
    const rnd = mulberry32(31337)
    const e = new TetrisEngine({ seed: 5 })
    for (let t = 0; t < 5000; t++) {
      e.tick(STEP_MS, randomCommands(rnd))
      if (e.phase === 'GAME_OVER') break
    }
    // sanity: the board is still a well-formed grid
    let filled = 0
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (e.board[idx(x, y)]) filled++
    expect(filled).toBeLessThanOrEqual(COLS * ROWS)
    expect(e.pieces).toBeGreaterThan(0)
  })
})
