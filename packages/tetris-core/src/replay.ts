import type { ActivePiece, Command, PieceType } from './types'
import { decodeBoard } from './board'
import type { Tuning } from './rules'
import { DEFAULT_TUNING } from './rules'
import { TetrisEngine } from './engine'
import type { GameEvent } from './events'

/** The one true simulation step. Everything downstream assumes it. */
export const STEP_MS = 1000 / 60

export interface ReplayFrame {
  /** simulation tick index at which these commands were applied */
  tick: number
  cmds: Command[]
}

export interface Replay {
  version: 1
  seed: number
  startLevel: number
  tuning: Tuning
  /** total number of simulated ticks */
  ticks: number
  frames: ReplayFrame[]
  /** engine fingerprint at the end of the run, for regression tests */
  fingerprint?: string
  score?: number
  /** optional preset scenario: the stack the run starts from */
  board?: string
  /** optional preset scenario: the piece in play at tick 0 */
  piece?: ActivePiece
}

export class ReplayRecorder {
  private frames: ReplayFrame[] = []
  private tick = 0

  constructor(
    readonly seed: number,
    readonly startLevel = 1,
    readonly tuning: Tuning = DEFAULT_TUNING,
  ) {}

  /** Call once per simulation step, with the commands applied in that step. */
  record(cmds: readonly Command[]): void {
    if (cmds.length > 0) this.frames.push({ tick: this.tick, cmds: [...cmds] })
    this.tick++
  }

  finish(engine?: TetrisEngine, preset?: { board?: string; piece?: ActivePiece }): Replay {
    return {
      version: 1,
      seed: this.seed,
      startLevel: this.startLevel,
      tuning: this.tuning,
      ticks: this.tick,
      frames: this.frames,
      fingerprint: engine?.fingerprint(),
      score: engine?.score,
      ...(preset?.board ? { board: preset.board } : {}),
      ...(preset?.piece ? { piece: preset.piece } : {}),
    }
  }
}

export interface ReplayResult {
  engine: TetrisEngine
  events: GameEvent[]
  fingerprint: string
}

/** Deterministically re-runs a replay and returns the final state. */
export function playReplay(replay: Replay, onEvent?: (e: GameEvent, tick: number) => void): ReplayResult {
  const engine = new TetrisEngine({
    seed: replay.seed,
    startLevel: replay.startLevel,
    tuning: replay.tuning,
  })
  if (replay.board) engine.board.set(decodeBoard(replay.board))
  if (replay.piece) {
    engine.active = { ...replay.piece }
    engine.phase = 'FALLING'
  }
  const byTick = new Map<number, Command[]>()
  for (const f of replay.frames) byTick.set(f.tick, f.cmds)

  const all: GameEvent[] = []
  for (let t = 0; t < replay.ticks; t++) {
    const events = engine.tick(STEP_MS, byTick.get(t) ?? [])
    for (const e of events) {
      all.push(e)
      onEvent?.(e, t)
    }
  }
  return { engine, events: all, fingerprint: engine.fingerprint() }
}

/** Convenience for tests: run N ticks with scripted input. */
export function simulate(
  engine: TetrisEngine,
  ticks: number,
  script: Record<number, Command[]> = {},
): GameEvent[] {
  const out: GameEvent[] = []
  for (let t = 0; t < ticks; t++) out.push(...engine.tick(STEP_MS, script[t] ?? []))
  return out
}

export type { PieceType }
