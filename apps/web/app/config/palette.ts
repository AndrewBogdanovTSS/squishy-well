import type { PieceType } from '@tetris/core'

/**
 * Guideline hues, pushed towards neon. Values above 1.0 on the emissive
 * side are what makes bloom pick a block up; the base colours stay in range.
 */
export const PALETTE: Record<PieceType, string> = {
  I: '#22d3ee',
  J: '#3b82f6',
  L: '#fb923c',
  O: '#facc15',
  S: '#4ade80',
  T: '#c084fc',
  Z: '#f87171',
}

/**
 * Deuteranopia-safe alternative: hues are still distinct where possible but
 * the real signal is LUMINANCE, which survives every kind of colour blindness.
 * Paired with the glyph overlay it means no information is carried by hue alone.
 */
export const PALETTE_ACCESSIBLE: Record<PieceType, string> = {
  I: '#ffffff',
  J: '#2563eb',
  L: '#f59e0b',
  O: '#fde68a',
  S: '#0891b2',
  T: '#7c3aed',
  Z: '#9f1239',
}

/** A small glyph per piece, drawn on the block face in accessible mode. */
export const GLYPHS: Record<PieceType, string> = {
  I: '|',
  J: 'J',
  L: 'L',
  O: 'O',
  S: 'S',
  T: 'T',
  Z: 'Z',
}

export const GHOST_COLOR = '#94a3b8'
export const WELL_COLOR = '#05070c'
export const GRID_COLOR = '#334155'

/** Mirrors app.css's `--text` - the one DOM colour Board2D's canvas also needs. A `<canvas>` 2D context cannot read a CSS custom property, so this is the closest thing to one source that boundary allows: change both together. */
export const TEXT_COLOR = '#e2e8f0'

/**
 * `ctx.fillStyle`/`strokeStyle` take a CSS colour string, not a custom
 * property, so a canvas that wants an alpha variant of one of the hex
 * constants above can't reach for `rgb(var(--x-rgb)/N%)` the way a Uno class
 * can (see app.css). This keeps the hex the single source anyway - convert
 * at the call site instead of hand-typing a second `rgba(...)` spelling of
 * the same colour that can drift from it.
 */
export function withAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
