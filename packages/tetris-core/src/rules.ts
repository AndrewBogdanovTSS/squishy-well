import type { ActivePiece, ClearKind, SpinKind } from './types'
import type { Board } from './board'
import { getCell } from './board'

/**
 * Tunables that must live in the engine, because they change the *rules*
 * and therefore must be recorded in a replay. Purely cosmetic timings
 * live in the app's feel.ts instead.
 */
export interface Tuning {
  /** delayed auto shift: ms before a held direction starts repeating */
  dasMs: number
  /** auto repeat rate: ms between repeats. 0 = instant slide to the wall */
  arrMs: number
  /** soft drop speed in cells per second */
  softDropRate: number
  /** ms on the ground before the piece locks */
  lockDelayMs: number
  /** how many times a move/rotate may reset the lock timer */
  maxLockResets: number
  /** how long the engine pauses while a line clear plays out */
  clearDelayMs: number
  /** entry delay between lock and the next spawn */
  spawnDelayMs: number
  /** how many upcoming pieces are visible */
  previewCount: number
  /** hard drop locks the piece immediately */
  hardDropLocks: boolean
}

export const DEFAULT_TUNING: Tuning = {
  dasMs: 133,
  arrMs: 33,
  softDropRate: 20,
  lockDelayMs: 500,
  maxLockResets: 15,
  clearDelayMs: 400,
  spawnDelayMs: 0,
  previewCount: 5,
  hardDropLocks: true,
}

/** Guideline gravity: seconds per row at a given level. */
export function gravityInterval(level: number): number {
  const l = Math.max(1, level)
  const base = 0.8 - (l - 1) * 0.007
  if (base <= 0) return 1 / 1000 // beyond level ~115 the formula degenerates
  return Math.pow(base, l - 1)
}

export function levelForLines(lines: number, startLevel = 1): number {
  return startLevel + Math.floor(lines / 10)
}

const LINE_POINTS = [0, 100, 300, 500, 800] as const
const TSPIN_POINTS = [400, 800, 1200, 1600] as const
const TSPIN_MINI_POINTS = [100, 200, 400, 400] as const
const PERFECT_CLEAR_POINTS = [0, 800, 1200, 1800, 2000] as const

export function clearKind(lines: number, spin: SpinKind): ClearKind {
  if (spin === 'full') return 'tspin'
  if (spin === 'mini') return 'tspin-mini'
  return (['single', 'double', 'triple', 'tetris'] as const)[lines - 1] ?? 'single'
}

/** A clear is back-to-back eligible when it is a tetris or any spin clear. */
export function isB2BEligible(lines: number, spin: SpinKind): boolean {
  return lines > 0 && (lines === 4 || spin !== 'none')
}

export interface ScoreInput {
  lines: number
  spin: SpinKind
  level: number
  /** consecutive clears BEFORE this one; 0 means this is the first */
  combo: number
  /** whether the previous scoring clear was b2b eligible */
  b2bActive: boolean
  perfectClear: boolean
}

export interface ScoreResult {
  points: number
  b2bApplied: boolean
}

export function scoreClear(input: ScoreInput): ScoreResult {
  const { lines, spin, level, combo, b2bActive, perfectClear } = input
  let base: number
  if (spin === 'full') base = TSPIN_POINTS[Math.min(lines, 3)]!
  else if (spin === 'mini') base = TSPIN_MINI_POINTS[Math.min(lines, 3)]!
  else base = LINE_POINTS[Math.min(lines, 4)]!

  const eligible = isB2BEligible(lines, spin)
  const b2bApplied = eligible && b2bActive
  if (b2bApplied) base = Math.floor(base * 1.5)

  let points = base * level
  if (lines > 0 && combo > 0) points += 50 * combo * level
  if (perfectClear && lines > 0) {
    const pc = PERFECT_CLEAR_POINTS[Math.min(lines, 4)]!
    points += (b2bApplied && lines === 4 ? 3200 : pc) * level
  }
  return { points, b2bApplied }
}

export const SOFT_DROP_POINTS_PER_CELL = 1
export const HARD_DROP_POINTS_PER_CELL = 2

/**
 * T-spin detection, three-corner rule:
 *  - the last successful action was a rotation, and
 *  - at least 3 of the 4 diagonals around the T centre are occupied.
 * Both "front" corners occupied => full T-spin, otherwise mini.
 * The last kick offset (index 4) always upgrades a mini to a full spin —
 * that is the canonical TST / fin exception.
 */
const FRONT_CORNERS: Record<number, readonly [readonly [number, number], readonly [number, number]]> = {
  0: [[-1, 1], [1, 1]],
  1: [[1, 1], [1, -1]],
  2: [[-1, -1], [1, -1]],
  3: [[-1, 1], [-1, -1]],
}

const ALL_CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const

export function detectSpin(
  board: Board,
  piece: ActivePiece,
  lastActionWasRotation: boolean,
  kickIndex: number,
): SpinKind {
  if (!lastActionWasRotation || piece.type !== 'T') return 'none'
  // T's rotation centre sits at bounding-box local (1, 1) in every state.
  const cx = piece.x + 1
  const cy = piece.y + 1

  let filled = 0
  for (const [dx, dy] of ALL_CORNERS) {
    if (getCell(board, cx + dx, cy + dy) !== 0) filled++
  }
  if (filled < 3) return 'none'

  const front = FRONT_CORNERS[piece.rot]!
  const frontFilled =
    (getCell(board, cx + front[0][0], cy + front[0][1]) !== 0 ? 1 : 0) +
    (getCell(board, cx + front[1][0], cy + front[1][1]) !== 0 ? 1 : 0)

  if (frontFilled === 2) return 'full'
  // the final kick of the table is the "impossible" one — always a full spin
  return kickIndex === 4 ? 'full' : 'mini'
}
