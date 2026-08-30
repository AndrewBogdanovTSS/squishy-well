/**
 * Regenerates the replay fixtures used by the regression tests.
 *   pnpm --filter @tetris/core fixtures
 * Run this only when a rule change is intentional — a fixture that changes
 * by accident is exactly the signal these tests exist to give you.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TetrisEngine } from '../src/engine'
import { ReplayRecorder, STEP_MS } from '../src/replay'
import type { Replay } from '../src/replay'
import { mulberry32 } from '../src/rng'
import { boardFromStrings, encodeBoard } from '../src/board'
import type { Command, Key } from '../src/types'
import { BotPlayer } from '../src/bot'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'test', 'fixtures')
mkdirSync(outDir, { recursive: true })

const KEYS: Key[] = ['LEFT', 'RIGHT', 'SOFT', 'HARD', 'CW', 'CCW', 'HOLD']

function randomGame(seed: number, ticks: number): Replay {
  const rnd = mulberry32(seed * 7919)
  const engine = new TetrisEngine({ seed })
  const rec = new ReplayRecorder(seed, 1, engine.tuning)
  for (let t = 0; t < ticks; t++) {
    const cmds: Command[] = []
    if (rnd() < 0.22) {
      const k = KEYS[Math.floor(rnd() * KEYS.length)]!
      cmds.push(rnd() < 0.55 ? { t: 'PRESS', k } : { t: 'RELEASE', k })
    }
    rec.record(cmds)
    engine.tick(STEP_MS, cmds)
  }
  return rec.finish(engine)
}

/** A hand-built T-spin double: rotate a T into the notch, then drop it. */
function tspinDouble(): Replay {
  const seed = 777
  const engine = new TetrisEngine({ seed })
  const preset = encodeBoard(boardFromStrings(['....X.....', 'XX...XXXXX', 'XXX.XXXXXX']))
  engine.board.set(boardFromStrings(['....X.....', 'XX...XXXXX', 'XXX.XXXXXX']))
  engine.active = { type: 'T', rot: 3, x: 2, y: 0 }
  engine.phase = 'FALLING'

  const rec = new ReplayRecorder(seed, 1, engine.tuning)
  const script: Record<number, Command[]> = {
    2: [{ t: 'PRESS', k: 'CCW' }],
    3: [{ t: 'RELEASE', k: 'CCW' }],
    5: [{ t: 'PRESS', k: 'HARD' }],
    6: [{ t: 'RELEASE', k: 'HARD' }],
  }
  const ticks = 60
  for (let t = 0; t < ticks; t++) {
    const cmds = script[t] ?? []
    rec.record(cmds)
    engine.tick(STEP_MS, cmds)
  }
  return rec.finish(engine, { board: preset, piece: { type: 'T', rot: 3, x: 2, y: 0 } })
}

/** A heuristic bot game: long, full of real line clears, level ups and combos. */
function botGame(seed: number, maxTicks: number): Replay {
  const engine = new TetrisEngine({ seed })
  const bot = new BotPlayer()
  const rec = new ReplayRecorder(seed, 1, engine.tuning)
  for (let t = 0; t < maxTicks; t++) {
    const cmds = engine.phase === 'GAME_OVER' ? [] : bot.next(engine)
    rec.record(cmds)
    engine.tick(STEP_MS, cmds)
  }
  return rec.finish(engine)
}

const files: [string, Replay][] = [
  ['baseline.replay.json', randomGame(2024, 4000)],
  ['bot-game.replay.json', botGame(31337, 30000)],
  ['tspin-double.replay.json', tspinDouble()],
]

for (const [name, replay] of files) {
  writeFileSync(join(outDir, name), `${JSON.stringify(replay, null, 0)}\n`)
  console.log(`${name}: ticks=${replay.ticks} frames=${replay.frames.length} score=${replay.score} fp=${replay.fingerprint}`)
}
