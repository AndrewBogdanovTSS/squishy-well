import type { Cell, ClearKind, PieceType, Rot, SpinKind, TopOutReason } from './types'

/**
 * Domain events. Each event carries everything a presentation layer needs
 * to react — the VFX/audio layers must never read engine state directly.
 */
export type GameEvent =
  | { t: 'SPAWN'; piece: PieceType; x: number; y: number }
  | { t: 'MOVE'; dx: number; x: number; y: number; wall: boolean }
  | { t: 'ROTATE'; piece: PieceType; from: Rot; to: Rot; kickIndex: number; kick: readonly [number, number] }
  | { t: 'ROTATE_FAILED'; piece: PieceType; from: Rot; to: Rot }
  | { t: 'SOFT_DROP'; cells: number }
  | { t: 'HARD_DROP'; distance: number; x: number; y: number }
  | { t: 'LOCK'; piece: PieceType; cells: Cell[]; hard: boolean; dropDistance: number; spin: SpinKind }
  | {
      t: 'LINE_CLEAR'
      rows: number[]
      cells: Cell[]
      lines: number
      kind: ClearKind
      spin: SpinKind
      b2b: boolean
      combo: number
      perfectClear: boolean
      points: number
    }
  | { t: 'ROWS_REMOVED'; rows: number[] }
  | { t: 'SPIN'; piece: PieceType; spin: SpinKind; lines: number }
  | { t: 'COMBO'; count: number }
  | { t: 'LEVEL_UP'; level: number }
  | { t: 'HOLD'; piece: PieceType; swapped: PieceType | null }
  | { t: 'HOLD_DENIED' }
  | { t: 'TOP_OUT'; reason: TopOutReason }
  | { t: 'RESET' }

export type GameEventType = GameEvent['t']

export type EventOf<K extends GameEventType> = Extract<GameEvent, { t: K }>
