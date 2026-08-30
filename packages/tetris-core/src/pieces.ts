import type { Cells, PieceType, Rot, Vec2 } from './types'

/**
 * Shapes are authored as text grids (row 0 = top) because that is how every
 * SRS reference draws them, then converted once at module load into
 * (x, y) offsets with y pointing UP, relative to the bottom-left of the
 * piece bounding box. Storing four explicit rotation states avoids the
 * classic "rotate a 4x4 matrix and hope the centre is right" bug class.
 */
type Grid = readonly [readonly string[], readonly string[], readonly string[], readonly string[]]

const GRIDS: Record<PieceType, Grid> = {
  I: [
    ['....', 'XXXX', '....', '....'],
    ['..X.', '..X.', '..X.', '..X.'],
    ['....', '....', 'XXXX', '....'],
    ['.X..', '.X..', '.X..', '.X..'],
  ],
  J: [
    ['X..', 'XXX', '...'],
    ['.XX', '.X.', '.X.'],
    ['...', 'XXX', '..X'],
    ['.X.', '.X.', 'XX.'],
  ],
  L: [
    ['..X', 'XXX', '...'],
    ['.X.', '.X.', '.XX'],
    ['...', 'XXX', 'X..'],
    ['XX.', '.X.', '.X.'],
  ],
  O: [
    ['.XX.', '.XX.', '....', '....'],
    ['.XX.', '.XX.', '....', '....'],
    ['.XX.', '.XX.', '....', '....'],
    ['.XX.', '.XX.', '....', '....'],
  ],
  S: [
    ['.XX', 'XX.', '...'],
    ['.X.', '.XX', '..X'],
    ['...', '.XX', 'XX.'],
    ['X..', 'XX.', '.X.'],
  ],
  T: [
    ['.X.', 'XXX', '...'],
    ['.X.', '.XX', '.X.'],
    ['...', 'XXX', '.X.'],
    ['.X.', 'XX.', '.X.'],
  ],
  Z: [
    ['XX.', '.XX', '...'],
    ['..X', '.XX', '.X.'],
    ['...', 'XX.', '.XX'],
    ['.X.', 'XX.', 'X..'],
  ],
}

function gridToCells(rows: readonly string[]): Cells {
  const h = rows.length
  const out: Vec2[] = []
  for (let r = 0; r < h; r++) {
    const line = rows[r]!
    for (let x = 0; x < line.length; x++) {
      if (line[x] === 'X') out.push([x, h - 1 - r] as const)
    }
  }
  if (out.length !== 4) throw new Error(`piece grid must contain exactly 4 cells, got ${out.length}`)
  return out as unknown as Cells
}

export const SHAPES: Record<PieceType, readonly [Cells, Cells, Cells, Cells]> = Object.fromEntries(
  (Object.keys(GRIDS) as PieceType[]).map((t) => [
    t,
    GRIDS[t].map(gridToCells) as unknown as readonly [Cells, Cells, Cells, Cells],
  ]),
) as Record<PieceType, readonly [Cells, Cells, Cells, Cells]>

export const BOX_SIZE: Record<PieceType, number> = {
  I: 4,
  J: 3,
  L: 3,
  O: 4,
  S: 3,
  T: 3,
  Z: 3,
}

export function cellsOf(type: PieceType, rot: Rot): Cells {
  return SHAPES[type][rot]
}

/**
 * SRS wall kicks. Y points up, so a +1 kick moves the piece UP.
 * Offsets are tried in order; the first collision-free one wins.
 */
export const KICKS_JLSTZ: Record<string, readonly Vec2[]> = {
  '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
}

export const KICKS_I: Record<string, readonly Vec2[]> = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
}

/**
 * 180 rotation is not part of the original SRS. This is the common
 * "house rule" table (same one TETR.IO-likes use): try in place, then
 * nudge vertically, then horizontally.
 */
export const KICKS_180: readonly Vec2[] = [
  [0, 0], [0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1], [0, 2], [0, -2],
]

const NO_KICK: readonly Vec2[] = [[0, 0]]

export function kickTable(type: PieceType, from: Rot, to: Rot): readonly Vec2[] {
  if (type === 'O') return NO_KICK
  const delta = (to - from + 4) % 4
  if (delta === 2) return KICKS_180
  const key = `${from}>${to}`
  const table = type === 'I' ? KICKS_I[key] : KICKS_JLSTZ[key]
  return table ?? NO_KICK
}

/** Spawn column: 3-wide boxes land on columns 3..5, 4-wide on 3..6. */
export const SPAWN_X = 3

/** Lowest occupied row of a shape inside its bounding box. */
export function minCellY(cells: Cells): number {
  let m = Infinity
  for (const c of cells) if (c[1] < m) m = c[1]
  return m
}

export function maxCellY(cells: Cells): number {
  let m = -Infinity
  for (const c of cells) if (c[1] > m) m = c[1]
  return m
}
