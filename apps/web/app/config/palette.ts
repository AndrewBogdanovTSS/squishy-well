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
