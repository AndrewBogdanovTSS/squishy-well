/**
 * Core domain types. This package is pure TypeScript:
 * no Vue, no Three.js, no DOM, no timers, no Math.random.
 */

export const PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'] as const
export type PieceType = (typeof PIECE_TYPES)[number]

/** 0 = spawn, 1 = R (one CW), 2 = 180, 3 = L (one CCW) */
export type Rot = 0 | 1 | 2 | 3

export type Vec2 = readonly [number, number]
export type Cells = readonly [Vec2, Vec2, Vec2, Vec2]

/** A concrete filled cell in board space, used by events / VFX. */
export interface Cell {
  x: number
  y: number
  type: PieceType
}

export interface ActivePiece {
  type: PieceType
  rot: Rot
  /** bottom-left corner of the piece bounding box, in board coordinates (y up) */
  x: number
  y: number
}

export type Key =
  | 'LEFT'
  | 'RIGHT'
  | 'SOFT'
  | 'HARD'
  | 'CW'
  | 'CCW'
  | 'FLIP'
  | 'HOLD'

export type Command =
  | { t: 'PRESS'; k: Key }
  | { t: 'RELEASE'; k: Key }
  | { t: 'RELEASE_ALL' }

export type Phase = 'READY' | 'FALLING' | 'LOCKING' | 'CLEARING' | 'GAME_OVER'

/** 'none' = not a spin, 'mini' = T-spin mini, 'full' = proper T-spin */
export type SpinKind = 'none' | 'mini' | 'full'

export type ClearKind =
  | 'single'
  | 'double'
  | 'triple'
  | 'tetris'
  | 'tspin-mini'
  | 'tspin'

export type TopOutReason = 'block-out' | 'lock-out'
