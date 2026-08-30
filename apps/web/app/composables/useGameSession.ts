import { markRaw, reactive, ref, shallowRef, type InjectionKey } from 'vue'
import {
  BotPlayer,
  STEP_MS,
  TetrisEngine,
  ReplayRecorder,
  type Cell,
  type Command,
  type GameEvent,
  type HudSnapshot,
  type PieceType,
  type Replay,
} from '@tetris/core'
import { liveFeel } from '~/config/feel'
import { createEventBus } from './useEventBus'
import { createInput, type Binding } from './useInput'
import { createImpactBus } from './useImpactBus'
import { createAudio } from './useAudio'
import { useQualityTier } from './useQualityTier'

export interface ClearAnimation {
  rows: number[]
  cells: Cell[]
  /** performance.now() when the clear started */
  startedAt: number
  durationMs: number
  removed: boolean
}

export interface SessionOptions {
  seed?: number
  startLevel?: number
  bindings?: Binding
  record?: boolean
  /** let the heuristic bot play: attract mode on the menu, and a test harness */
  bot?: boolean
}

/**
 * Owns the engine, the fixed-timestep loop and every presentation service.
 * Created once per play screen and handed to the scene through provide/inject.
 *
 * Reactivity policy (this is the part that keeps the frame budget):
 *  - the board is a raw Uint8Array; renderers resync on `boardVersion`
 *  - the active piece is read raw, every frame, by the renderer
 *  - only HUD-shaped data (score, level, next, hold) is reactive
 */
export function createGameSession(options: SessionOptions = {}) {
  const seed = options.seed ?? (Date.now() & 0x7fffffff)

  const engine = markRaw(
    new TetrisEngine({
      seed,
      startLevel: options.startLevel ?? 1,
      tuning: {
        dasMs: liveFeel.input.dasMs,
        arrMs: liveFeel.input.arrMs,
        softDropRate: liveFeel.input.softDropRate,
        lockDelayMs: liveFeel.rules.lockDelayMs,
        maxLockResets: liveFeel.rules.maxLockResets,
        clearDelayMs: liveFeel.rules.clearDelayMs,
        previewCount: liveFeel.rules.previewCount,
      },
    }),
  )

  const bus = createEventBus()
  const quality = useQualityTier()
  const impact = createImpactBus(bus, { reducedMotion: () => quality.reducedMotion.value })
  const audio = createAudio()
  const input = createInput(options.bindings)

  const boardVersion = ref(0)
  const hud = reactive<HudSnapshot>({ ...engine.snapshot() })
  const paused = ref(false)
  const running = ref(false)
  const gameOver = ref(false)
  const clearAnim = shallowRef<ClearAnimation | null>(null)
  /** interpolation factor between the last two simulation steps */
  const alpha = ref(0)
  const currentSeed = ref(seed)
  const bot = ref(options.bot ?? false)
  const botPlayer = markRaw(new BotPlayer())

  let recorder: ReplayRecorder | null = options.record
    ? new ReplayRecorder(seed, options.startLevel ?? 1, engine.tuning)
    : null
  let lastReplay: Replay | null = null

  let rafId = 0
  let last = 0
  let accumulator = 0
  let detachInput: (() => void) | null = null
  let unbindAudio: (() => void) | null = null

  function syncHud(): void {
    const s = engine.snapshot()
    hud.score = s.score
    hud.lines = s.lines
    hud.level = s.level
    hud.combo = s.combo
    hud.b2b = s.b2b
    hud.next = s.next
    hud.hold = s.hold
    hud.canHold = s.canHold
    hud.phase = s.phase
    hud.pieces = s.pieces
    hud.timeMs = s.timeMs
  }

  function dispatch(events: GameEvent[]): void {
    for (const e of events) {
      switch (e.t) {
        case 'LOCK':
          boardVersion.value++
          break
        case 'LINE_CLEAR':
          boardVersion.value++
          clearAnim.value = {
            rows: e.rows,
            cells: e.cells,
            startedAt: performance.now(),
            durationMs: engine.tuning.clearDelayMs,
            removed: false,
          }
          break
        case 'ROWS_REMOVED':
          boardVersion.value++
          if (clearAnim.value) clearAnim.value = { ...clearAnim.value, removed: true }
          break
        case 'TOP_OUT':
          gameOver.value = true
          running.value = false
          lastReplay = recorder?.finish(engine) ?? null
          break
        default:
          break
      }
      bus.emit(e)
    }
    if (events.length > 0) syncHud()
  }

  /**
   * Fixed timestep with an accumulator. The engine only ever sees STEP_MS,
   * which is what makes the simulation deterministic and replayable;
   * the renderer gets `alpha` to interpolate between steps.
   */
  function frame(now: number): void {
    rafId = requestAnimationFrame(frame)
    let delta = now - last
    last = now
    if (delta > 250) delta = 250 // came back from a background tab: do not fast-forward
    quality.sample(delta)
    impact.update(delta)

    if (paused.value || gameOver.value) {
      input.drain()
      return
    }

    input.pollGamepads()

    // hitstop freezes the simulation but not the picture
    const frozen = impact.consumeHitstop(delta)
    const simDelta = delta - frozen

    accumulator += simDelta
    let steps = 0
    while (accumulator >= STEP_MS && steps < 8) {
      const cmds: Command[] = bot.value ? botPlayer.next(engine) : input.drain()
      if (bot.value) input.drain()
      recorder?.record(cmds)
      dispatch(engine.tick(STEP_MS, cmds))
      accumulator -= STEP_MS
      steps++
    }
    if (steps === 8) accumulator = 0 // long stall: drop the backlog instead of spiralling
    alpha.value = accumulator / STEP_MS
  }

  function start(): void {
    if (running.value) return
    running.value = true
    paused.value = false
    last = performance.now()
    accumulator = 0
    if (!detachInput) detachInput = input.attach()
    if (!unbindAudio) unbindAudio = audio.bind(bus)
    input.onPause(() => togglePause())
    input.onRestart(() => restart())
    rafId = requestAnimationFrame(frame)
  }

  function stop(): void {
    running.value = false
    cancelAnimationFrame(rafId)
    rafId = 0
  }

  function togglePause(force?: boolean): void {
    if (gameOver.value) return
    paused.value = force ?? !paused.value
    if (paused.value) input.releaseAll()
    else last = performance.now()
  }

  function restart(newSeed = Date.now() & 0x7fffffff): void {
    engine.reset(newSeed)
    currentSeed.value = newSeed
    recorder = options.record ? new ReplayRecorder(newSeed, options.startLevel ?? 1, engine.tuning) : null
    gameOver.value = false
    paused.value = false
    clearAnim.value = null
    accumulator = 0
    last = performance.now()
    boardVersion.value++
    syncHud()
    bus.emit({ t: 'RESET' })
    if (!running.value) start()
  }

  function dispose(): void {
    stop()
    detachInput?.()
    unbindAudio?.()
    impact.dispose()
    audio.dispose()
    bus.clear()
    detachInput = null
    unbindAudio = null
  }

  /** Manual single step, for the debug panel. */
  function step(count = 1): void {
    for (let i = 0; i < count; i++) dispatch(engine.tick(STEP_MS, input.drain()))
  }

  return {
    engine,
    board: engine.board,
    boardVersion,
    hud,
    bus,
    input,
    audio,
    impact,
    quality,
    alpha,
    paused,
    running,
    gameOver,
    clearAnim,
    currentSeed,
    bot,
    start,
    stop,
    step,
    togglePause,
    restart,
    dispose,
    getReplay: (): Replay | null => lastReplay ?? recorder?.finish(engine) ?? null,
    nextPieces: (): PieceType[] => hud.next,
  }
}

export type GameSession = ReturnType<typeof createGameSession>

export const GameSessionKey: InjectionKey<GameSession> = Symbol('tetris:session')
