import { collides } from '../src/board'
import { cellsOf } from '../src/pieces'
import type { TetrisEngine } from '../src/engine'
import type { Command, Key, PieceType, Rot } from '../src/types'
import { STEP_MS } from '../src/replay'
import type { GameEvent } from '../src/events'

/** Places a piece at the given column/rotation and drops it to its resting row. */
export function place(engine: TetrisEngine, type: PieceType, rot: Rot, x: number, y = 25): void {
  const cells = cellsOf(type, rot)
  let ry = y
  while (!collides(engine.board, cells, x, ry - 1)) ry--
  engine.active = { type, rot, x, y: ry }
  engine.phase = 'FALLING'
}

export function run(
  engine: TetrisEngine,
  ticks: number,
  script: Record<number, Command[]> = {},
): GameEvent[] {
  const out: GameEvent[] = []
  for (let t = 0; t < ticks; t++) out.push(...engine.tick(STEP_MS, script[t] ?? []))
  return out
}

export const tap = (k: Key): Command[] => [
  { t: 'PRESS', k },
  { t: 'RELEASE', k },
]

export const hold = (k: Key): Command[] => [{ t: 'PRESS', k }]
export const release = (k: Key): Command[] => [{ t: 'RELEASE', k }]

export function firstOf<K extends GameEvent['t']>(
  events: GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }> | undefined {
  return events.find((e) => e.t === t) as Extract<GameEvent, { t: K }> | undefined
}

export function countOf(events: GameEvent[], t: GameEvent['t']): number {
  return events.filter((e) => e.t === t).length
}
