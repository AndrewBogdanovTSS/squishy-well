import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { TetrisEngine } from '../src/engine'
import { ReplayRecorder, STEP_MS, playReplay } from '../src/replay'
import type { Replay } from '../src/replay'
import { mulberry32 } from '../src/rng'
import type { Command, Key } from '../src/types'

const here = dirname(fileURLToPath(import.meta.url))
const KEYS: Key[] = ['LEFT', 'RIGHT', 'SOFT', 'HARD', 'CW', 'CCW', 'HOLD']

function scriptedRun(seed: number, ticks: number): Replay {
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

describe('replay', () => {
  it('reproduces the exact same final state', () => {
    const replay = scriptedRun(2024, 3000)
    const a = playReplay(replay)
    const b = playReplay(replay)
    expect(a.fingerprint).toBe(b.fingerprint)
    expect(a.fingerprint).toBe(replay.fingerprint)
    expect(a.engine.score).toBe(replay.score)
  })

  it('produces different outcomes for different seeds', () => {
    const a = scriptedRun(1, 1500)
    const b = scriptedRun(2, 1500)
    expect(a.fingerprint).not.toBe(b.fingerprint)
  })

  it('records only the ticks that carry input', () => {
    const replay = scriptedRun(11, 600)
    expect(replay.ticks).toBe(600)
    expect(replay.frames.length).toBeLessThan(600)
    for (const f of replay.frames) expect(f.cmds.length).toBeGreaterThan(0)
  })

  const fixtures = ['baseline.replay.json', 'bot-game.replay.json', 'tspin-double.replay.json']
  for (const name of fixtures) {
    const file = join(here, 'fixtures', name)
    it.skipIf(!existsSync(file))(`matches the committed fixture ${name}`, () => {
      const replay = JSON.parse(readFileSync(file, 'utf8')) as Replay
      const result = playReplay(replay)
      expect(result.fingerprint).toBe(replay.fingerprint)
      expect(result.engine.score).toBe(replay.score)
    })
  }
})
