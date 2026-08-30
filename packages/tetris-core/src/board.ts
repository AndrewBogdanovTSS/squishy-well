import type { Cell, PieceType } from './types'
import { PIECE_TYPES } from './types'

export const COLS = 10
export const VISIBLE_ROWS = 20
/** Spawn / buffer zone above the well, per the Tetris Guideline. */
export const BUFFER_ROWS = 20
export const ROWS = VISIBLE_ROWS + BUFFER_ROWS

/**
 * 0 = empty, 1..7 = piece type index + 1 (see PIECE_TYPES).
 * Flat Uint8Array: one allocation, cheap .set() copies, trivially hashable.
 * y grows upwards, y = 0 is the floor.
 */
export type Board = Uint8Array

export const idx = (x: number, y: number): number => y * COLS + x

export function createBoard(): Board {
  return new Uint8Array(COLS * ROWS)
}

export const typeToCode = (t: PieceType): number => PIECE_TYPES.indexOf(t) + 1
export const codeToType = (c: number): PieceType => PIECE_TYPES[c - 1]!

export function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS
}

export function getCell(board: Board, x: number, y: number): number {
  if (x < 0 || x >= COLS || y < 0) return 1 // walls and floor read as solid
  if (y >= ROWS) return 0 // above the buffer is empty air
  return board[idx(x, y)]!
}

/** True when any of the piece cells overlaps a wall, the floor or a filled cell. */
export function collides(
  board: Board,
  cells: readonly (readonly [number, number])[],
  ox: number,
  oy: number,
): boolean {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!
    const x = ox + c[0]
    const y = oy + c[1]
    if (x < 0 || x >= COLS || y < 0) return true
    if (y < ROWS && board[idx(x, y)] !== 0) return true
  }
  return false
}

export function writeCells(
  board: Board,
  cells: readonly (readonly [number, number])[],
  ox: number,
  oy: number,
  code: number,
): void {
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!
    const x = ox + c[0]
    const y = oy + c[1]
    if (x >= 0 && x < COLS && y >= 0 && y < ROWS) board[idx(x, y)] = code
  }
}

export function isRowFull(board: Board, y: number): boolean {
  const base = y * COLS
  for (let x = 0; x < COLS; x++) if (board[base + x] === 0) return false
  return true
}

/** Row indices (ascending) that are completely filled. */
export function fullRows(board: Board): number[] {
  const rows: number[] = []
  for (let y = 0; y < ROWS; y++) if (isRowFull(board, y)) rows.push(y)
  return rows
}

/** Snapshot of the given rows as concrete coloured cells (for VFX). */
export function rowCells(board: Board, rows: readonly number[]): Cell[] {
  const out: Cell[] = []
  for (const y of rows) {
    for (let x = 0; x < COLS; x++) {
      const v = board[idx(x, y)]!
      if (v) out.push({ x, y, type: codeToType(v) })
    }
  }
  return out
}

/** Removes the given rows and collapses everything above them down. */
export function removeRows(board: Board, rows: readonly number[]): void {
  if (rows.length === 0) return
  const drop = new Set(rows)
  let write = 0
  for (let y = 0; y < ROWS; y++) {
    if (drop.has(y)) continue
    if (write !== y) board.copyWithin(write * COLS, y * COLS, (y + 1) * COLS)
    write++
  }
  board.fill(0, write * COLS)
}

export function isEmpty(board: Board): boolean {
  for (let i = 0; i < board.length; i++) if (board[i] !== 0) return false
  return true
}

/** Highest occupied row + 1, i.e. the stack height. */
export function stackHeight(board: Board): number {
  for (let y = ROWS - 1; y >= 0; y--) {
    const base = y * COLS
    for (let x = 0; x < COLS; x++) if (board[base + x] !== 0) return y + 1
  }
  return 0
}

/** FNV-1a over the board bytes — used by replay regression tests. */
export function hashBoard(board: Board): string {
  let h = 0x811c9dc5
  for (let i = 0; i < board.length; i++) {
    h ^= board[i]!
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Compact lossless serialisation: one base-36 digit per cell, trailing empty
 * rows trimmed. Used by replay fixtures that start from a preset stack.
 */
export function encodeBoard(board: Board): string {
  const rows = stackHeight(board)
  let s = ''
  for (let i = 0; i < rows * COLS; i++) s += board[i]!.toString(36)
  return s
}

export function decodeBoard(s: string): Board {
  const b = createBoard()
  for (let i = 0; i < s.length && i < b.length; i++) b[i] = parseInt(s[i]!, 36)
  return b
}

/** Debug helper: renders the visible well as text rows, top row first. */
export function boardToStrings(board: Board, rows = VISIBLE_ROWS): string[] {
  const out: string[] = []
  for (let y = rows - 1; y >= 0; y--) {
    let line = ''
    for (let x = 0; x < COLS; x++) line += board[idx(x, y)] ? 'X' : '.'
    out.push(line)
  }
  return out
}

/** Inverse of boardToStrings — builds a board from a text fixture. */
export function boardFromStrings(lines: readonly string[], code = 1): Board {
  const b = createBoard()
  for (let i = 0; i < lines.length; i++) {
    const y = lines.length - 1 - i
    const line = lines[i]!
    for (let x = 0; x < COLS && x < line.length; x++) {
      if (line[x] !== '.' && line[x] !== ' ') b[idx(x, y)] = code
    }
  }
  return b
}
