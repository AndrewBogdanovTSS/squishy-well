import type { Board } from './board'
import { COLS, ROWS, collides, createBoard, idx, typeToCode, writeCells } from './board'
import { cellsOf } from './pieces'
import type { Command, Key, PieceType, Rot } from './types'
import type { TetrisEngine } from './engine'

/**
 * A small heuristic player. It exists for three reasons:
 *  - it generates rich replay fixtures (long games with real line clears),
 *  - it is an attract-mode / demo player for the menu screen,
 *  - it is a stress test: a bot playing for 10 minutes finds engine bugs
 *    that hand-written unit tests never reach.
 * Weights are the well-known El-Tetris set.
 */
export interface BotWeights {
  height: number
  lines: number
  holes: number
  bumpiness: number
}

export const DEFAULT_WEIGHTS: BotWeights = {
  height: -0.510066,
  lines: 0.760666,
  holes: -0.35663,
  bumpiness: -0.184483,
}

export interface Placement {
  rot: Rot
  x: number
  y: number
  score: number
}

const scratch: Board = createBoard()

function columnHeights(board: Board, out: number[]): void {
  for (let x = 0; x < COLS; x++) {
    let h = 0
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[idx(x, y)] !== 0) {
        h = y + 1
        break
      }
    }
    out[x] = h
  }
}

function evaluate(board: Board, weights: BotWeights, clearedLines: number): number {
  const heights: number[] = new Array(COLS).fill(0)
  columnHeights(board, heights)

  let aggregate = 0
  let holes = 0
  let bumpiness = 0
  for (let x = 0; x < COLS; x++) {
    const h = heights[x]!
    aggregate += h
    for (let y = 0; y < h - 1; y++) if (board[idx(x, y)] === 0) holes++
    if (x < COLS - 1) bumpiness += Math.abs(h - heights[x + 1]!)
  }
  return (
    weights.height * aggregate +
    weights.lines * clearedLines +
    weights.holes * holes +
    weights.bumpiness * bumpiness
  )
}

/** Best (rotation, column) for a piece dropped straight down onto the stack. */
export function bestPlacement(
  board: Board,
  type: PieceType,
  weights: BotWeights = DEFAULT_WEIGHTS,
): Placement | null {
  let best: Placement | null = null
  const code = typeToCode(type)

  for (const rot of [0, 1, 2, 3] as Rot[]) {
    const cells = cellsOf(type, rot)
    for (let x = -3; x <= COLS; x++) {
      // must be able to hover above the stack at this column
      if (collides(board, cells, x, ROWS - 4)) continue
      let y = ROWS - 4
      while (!collides(board, cells, x, y - 1)) y--

      scratch.set(board)
      writeCells(scratch, cells, x, y, code)

      let cleared = 0
      for (let row = 0; row < ROWS; row++) {
        let full = true
        for (let cx = 0; cx < COLS; cx++) {
          if (scratch[idx(cx, row)] === 0) {
            full = false
            break
          }
        }
        if (full) cleared++
      }

      const score = evaluate(scratch, weights, cleared)
      if (!best || score > best.score) best = { rot, x, y, score }
    }
  }
  return best
}

/**
 * Turns placements into engine commands, one action per simulation tick,
 * so a bot game records as a perfectly ordinary replay.
 */
export class BotPlayer {
  private plan: Command[][] = []
  private planningFor = -1

  constructor(private readonly weights: BotWeights = DEFAULT_WEIGHTS) {}

  /** Call once per tick, before engine.tick(), with the commands it returns. */
  next(engine: TetrisEngine): Command[] {
    const p = engine.active
    if (!p) return []
    if (engine.pieces !== this.planningFor || this.plan.length === 0) {
      if (engine.pieces !== this.planningFor) {
        this.planningFor = engine.pieces
        this.plan = this.buildPlan(engine)
      }
    }
    return this.plan.shift() ?? []
  }

  private buildPlan(engine: TetrisEngine): Command[][] {
    const p = engine.active!
    const target = bestPlacement(engine.board, p.type, this.weights)
    if (!target) return [[{ t: 'PRESS', k: 'HARD' }, { t: 'RELEASE', k: 'HARD' }]]

    const steps: Command[][] = []
    const tapKey = (k: Key): Command[] => [
      { t: 'PRESS', k },
      { t: 'RELEASE', k },
    ]

    const delta = (target.rot - p.rot + 4) % 4
    if (delta === 1) steps.push(tapKey('CW'))
    else if (delta === 3) steps.push(tapKey('CCW'))
    else if (delta === 2) steps.push(tapKey('FLIP'))

    const dx = target.x - p.x
    for (let i = 0; i < Math.abs(dx); i++) steps.push(tapKey(dx < 0 ? 'LEFT' : 'RIGHT'))

    steps.push(tapKey('HARD'))
    return steps
  }
}
