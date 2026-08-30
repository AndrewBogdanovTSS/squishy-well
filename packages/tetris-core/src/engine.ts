import type { ActivePiece, Cell, Command, Key, PieceType, Phase, Rot, SpinKind } from './types'
import type { Board } from './board'
import type { GameEvent } from './events'
import type { Tuning } from './rules'
import {
  COLS,
  VISIBLE_ROWS,
  collides,
  createBoard,
  fullRows,
  hashBoard,
  isEmpty,
  removeRows,
  rowCells,
  typeToCode,
  writeCells,
} from './board'
import { BagRandomizer, fillQueue } from './randomizer'
import { cellsOf, kickTable, minCellY, SPAWN_X } from './pieces'
import {
  DEFAULT_TUNING,
  HARD_DROP_POINTS_PER_CELL,
  SOFT_DROP_POINTS_PER_CELL,
  clearKind,
  detectSpin,
  gravityInterval,
  isB2BEligible,
  levelForLines,
  scoreClear,
} from './rules'
import { mulberry32 } from './rng'

export interface EngineOptions {
  seed?: number
  startLevel?: number
  tuning?: Partial<Tuning>
}

export interface HudSnapshot {
  score: number
  lines: number
  level: number
  combo: number
  b2b: boolean
  next: PieceType[]
  hold: PieceType | null
  canHold: boolean
  phase: Phase
  pieces: number
  timeMs: number
}

const KEYS: Key[] = ['LEFT', 'RIGHT', 'SOFT', 'HARD', 'CW', 'CCW', 'FLIP', 'HOLD']

/** Row above which a locked piece counts as a lock-out. */
const SPAWN_ROW = VISIBLE_ROWS

export class TetrisEngine {
  readonly board: Board = createBoard()
  readonly tuning: Tuning
  readonly seed: number
  readonly startLevel: number

  active: ActivePiece | null = null
  hold: PieceType | null = null
  canHold = true
  queue: PieceType[] = []
  phase: Phase = 'READY'

  score = 0
  lines = 0
  level = 1
  /** consecutive line clears minus one; -1 means no combo running */
  combo = -1
  b2b = false
  pieces = 0
  timeMs = 0

  private rand: BagRandomizer
  private rng: ReturnType<typeof mulberry32>
  private events: GameEvent[] = []

  private held: Record<Key, boolean> = Object.fromEntries(KEYS.map((k) => [k, false])) as Record<Key, boolean>
  private dir: -1 | 0 | 1 = 0
  private dasTimer = 0
  private dasCharged = false
  private arrAcc = 0

  private gravityAcc = 0
  private lockTimer = 0
  private lockResets = 0
  private lowestY = Number.POSITIVE_INFINITY

  private lastRotation = false
  private lastKickIndex = 0

  private clearTimer = 0
  private pendingRows: number[] = []

  /** initial rotation / hold, buffered while the clear animation plays */
  private bufferedRot: 1 | 2 | 3 | 0 = 0
  private bufferedHold = false

  private scratch: Board = createBoard()

  constructor(opts: EngineOptions = {}) {
    this.seed = opts.seed ?? 1
    this.startLevel = Math.max(1, opts.startLevel ?? 1)
    this.tuning = { ...DEFAULT_TUNING, ...opts.tuning }
    this.rng = mulberry32(this.seed)
    this.rand = new BagRandomizer(this.rng)
    this.level = this.startLevel
    fillQueue(this.queue, this.rand, this.tuning.previewCount + 1)
    this.spawnNext()
  }

  // ---------------------------------------------------------------- lifecycle

  reset(seed = this.seed): void {
    this.board.fill(0)
    this.rng = mulberry32(seed)
    this.rand = new BagRandomizer(this.rng)
    this.queue = []
    this.hold = null
    this.canHold = true
    this.score = 0
    this.lines = 0
    this.level = this.startLevel
    this.combo = -1
    this.b2b = false
    this.pieces = 0
    this.timeMs = 0
    this.phase = 'READY'
    this.releaseAll()
    fillQueue(this.queue, this.rand, this.tuning.previewCount + 1)
    this.events = []
    this.spawnNext()
  }

  /**
   * Advances the simulation by a FIXED dt. The engine never reads a clock
   * and never schedules anything — that is what makes it testable.
   * Returns every event produced during this step.
   */
  tick(dtMs: number, cmds: readonly Command[] = []): GameEvent[] {
    this.events = []
    this.processCommands(cmds)

    if (this.phase === 'GAME_OVER') return this.events

    this.timeMs += dtMs

    if (this.phase === 'CLEARING') {
      this.clearTimer -= dtMs
      if (this.clearTimer <= 0) {
        if (this.pendingRows.length > 0) {
          removeRows(this.board, this.pendingRows)
          this.emit({ t: 'ROWS_REMOVED', rows: this.pendingRows })
          this.pendingRows = []
        }
        this.spawnNext()
      }
      return this.events
    }

    if (this.active) this.updateActive(dtMs)
    return this.events
  }

  // ------------------------------------------------------------------- input

  private processCommands(cmds: readonly Command[]): void {
    for (const cmd of cmds) {
      if (cmd.t === 'RELEASE_ALL') {
        this.releaseAll()
        continue
      }
      if (cmd.t === 'RELEASE') {
        this.onRelease(cmd.k)
        continue
      }
      this.onPress(cmd.k)
    }
  }

  private onPress(k: Key): void {
    if (this.phase === 'GAME_OVER') return
    this.held[k] = true

    if (k === 'LEFT' || k === 'RIGHT') {
      this.dir = k === 'LEFT' ? -1 : 1
      this.dasTimer = this.tuning.dasMs
      this.dasCharged = false
      this.arrAcc = 0
      if (this.phase !== 'CLEARING') this.tryMove(this.dir)
      return
    }

    // Buffered during the line-clear pause: initial rotation / initial hold.
    if (this.phase === 'CLEARING') {
      if (k === 'CW') this.bufferedRot = 1
      else if (k === 'CCW') this.bufferedRot = 3
      else if (k === 'FLIP') this.bufferedRot = 2
      else if (k === 'HOLD') this.bufferedHold = true
      return
    }

    switch (k) {
      case 'CW':
        this.tryRotate(1)
        break
      case 'CCW':
        this.tryRotate(3)
        break
      case 'FLIP':
        this.tryRotate(2)
        break
      case 'HOLD':
        this.doHold()
        break
      case 'HARD':
        this.hardDrop()
        break
      default:
        break
    }
  }

  private onRelease(k: Key): void {
    this.held[k] = false
    if (k === 'LEFT' || k === 'RIGHT') {
      const other: Key = k === 'LEFT' ? 'RIGHT' : 'LEFT'
      if (this.held[other]) {
        this.dir = other === 'LEFT' ? -1 : 1
        this.dasTimer = this.tuning.dasMs
        this.dasCharged = false
        this.arrAcc = 0
      } else {
        this.dir = 0
        this.dasCharged = false
      }
    }
  }

  private releaseAll(): void {
    for (const k of KEYS) this.held[k] = false
    this.dir = 0
    this.dasCharged = false
    this.arrAcc = 0
  }

  // ------------------------------------------------------------------ update

  private updateActive(dt: number): void {
    // 1. horizontal auto-repeat (DAS / ARR), driven by the tick, never by the OS
    if (this.dir !== 0) {
      if (!this.dasCharged) {
        this.dasTimer -= dt
        if (this.dasTimer <= 0) {
          this.dasCharged = true
          this.arrAcc = this.tuning.arrMs
        }
      }
      if (this.dasCharged) {
        if (this.tuning.arrMs === 0) {
          let guard = 0
          while (this.tryMove(this.dir) && guard++ < COLS) { /* slide to the wall */ }
        } else {
          this.arrAcc += dt
          let guard = 0
          while (this.arrAcc >= this.tuning.arrMs && guard++ < COLS) {
            this.arrAcc -= this.tuning.arrMs
            if (!this.tryMove(this.dir)) break
          }
        }
      }
    }

    // 2. gravity (soft drop is just a much shorter interval)
    const gravityMs = gravityInterval(this.level) * 1000
    const soft = this.held.SOFT
    const interval = soft ? Math.min(gravityMs, 1000 / this.tuning.softDropRate) : gravityMs
    this.gravityAcc += dt
    let dropped = 0
    let guard = 0
    while (this.gravityAcc >= interval && guard++ < 64) {
      this.gravityAcc -= interval
      if (!this.stepDown()) {
        this.gravityAcc = 0
        break
      }
      dropped++
    }
    if (soft && dropped > 0) {
      this.score += dropped * SOFT_DROP_POINTS_PER_CELL
      this.emit({ t: 'SOFT_DROP', cells: dropped })
    }

    // 3. lock delay
    const p = this.active!
    const grounded = collides(this.board, cellsOf(p.type, p.rot), p.x, p.y - 1)
    if (grounded) {
      if (this.phase !== 'LOCKING') {
        this.phase = 'LOCKING'
        this.lockTimer = this.tuning.lockDelayMs
      }
      this.lockTimer -= dt
      if (this.lockTimer <= 0) this.lockPiece(false, 0)
    } else {
      this.phase = 'FALLING'
    }
  }

  // ------------------------------------------------------------- piece moves

  private tryMove(dx: number): boolean {
    const p = this.active
    if (!p) return false
    const cells = cellsOf(p.type, p.rot)
    if (collides(this.board, cells, p.x + dx, p.y)) {
      this.emit({ t: 'MOVE', dx, x: p.x, y: p.y, wall: true })
      return false
    }
    p.x += dx
    this.lastRotation = false
    this.resetLockTimer()
    this.emit({ t: 'MOVE', dx, x: p.x, y: p.y, wall: false })
    return true
  }

  private stepDown(): boolean {
    const p = this.active
    if (!p) return false
    const cells = cellsOf(p.type, p.rot)
    if (collides(this.board, cells, p.x, p.y - 1)) return false
    p.y -= 1
    this.noteDescent()
    return true
  }

  /** Falling below the lowest row reached so far refills the lock-reset budget. */
  private noteDescent(): void {
    const p = this.active!
    if (p.y < this.lowestY) {
      this.lowestY = p.y
      this.lockResets = 0
    }
  }

  private tryRotate(delta: 1 | 2 | 3): boolean {
    const p = this.active
    if (!p) return false
    const from = p.rot
    const to = ((from + delta) % 4) as Rot
    const cells = cellsOf(p.type, to)
    const kicks = kickTable(p.type, from, to)
    for (let i = 0; i < kicks.length; i++) {
      const [kx, ky] = kicks[i]!
      if (!collides(this.board, cells, p.x + kx, p.y + ky)) {
        p.x += kx
        p.y += ky
        p.rot = to
        this.lastRotation = true
        this.lastKickIndex = i
        this.noteDescent()
        this.resetLockTimer()
        this.emit({ t: 'ROTATE', piece: p.type, from, to, kickIndex: i, kick: [kx, ky] })
        return true
      }
    }
    this.emit({ t: 'ROTATE_FAILED', piece: p.type, from, to })
    return false
  }

  private resetLockTimer(): void {
    if (this.phase === 'LOCKING' && this.lockResets < this.tuning.maxLockResets) {
      this.lockTimer = this.tuning.lockDelayMs
      this.lockResets++
    }
  }

  private hardDrop(): void {
    const p = this.active
    if (!p) return
    let distance = 0
    while (this.stepDown()) distance++
    this.score += distance * HARD_DROP_POINTS_PER_CELL
    this.emit({ t: 'HARD_DROP', distance, x: p.x, y: p.y })
    if (distance > 0) this.lastRotation = false
    this.lockPiece(true, distance)
  }

  private doHold(): void {
    const p = this.active
    if (!p) return
    if (!this.canHold) {
      this.emit({ t: 'HOLD_DENIED' })
      return
    }
    const swapped = this.hold
    this.hold = p.type
    this.canHold = false
    this.emit({ t: 'HOLD', piece: p.type, swapped })
    if (swapped) this.spawnPiece(swapped, false)
    else this.spawnNext(false)
  }

  // ------------------------------------------------------------------- lock

  private lockPiece(hard: boolean, dropDistance: number): void {
    const p = this.active!
    const cells = cellsOf(p.type, p.rot)
    const spin: SpinKind = detectSpin(this.board, p, this.lastRotation, this.lastKickIndex)
    const code = typeToCode(p.type)

    const locked: Cell[] = []
    let topMost = -1
    for (const c of cells) {
      const x = p.x + c[0]
      const y = p.y + c[1]
      locked.push({ x, y, type: p.type })
      if (y > topMost) topMost = y
    }
    writeCells(this.board, cells, p.x, p.y, code)
    this.pieces++
    this.active = null
    this.emit({ t: 'LOCK', piece: p.type, cells: locked, hard, dropDistance, spin })

    // lock-out: the whole piece came to rest above the visible well
    const allAboveWell = locked.every((c) => c.y >= SPAWN_ROW)

    const rows = fullRows(this.board)
    if (rows.length > 0) {
      this.scoreLineClear(rows, spin)
      this.phase = 'CLEARING'
      this.pendingRows = rows
      this.clearTimer = this.tuning.clearDelayMs
      return
    }

    if (spin !== 'none') this.emit({ t: 'SPIN', piece: p.type, spin, lines: 0 })
    if (spin !== 'none') {
      const { points } = scoreClear({
        lines: 0,
        spin,
        level: this.level,
        combo: -1,
        b2bActive: this.b2b,
        perfectClear: false,
      })
      this.score += points
    }

    this.combo = -1

    if (allAboveWell) {
      this.gameOver('lock-out')
      return
    }

    if (this.tuning.spawnDelayMs > 0) {
      this.phase = 'CLEARING'
      this.pendingRows = []
      this.clearTimer = this.tuning.spawnDelayMs
      return
    }
    this.spawnNext()
  }

  private scoreLineClear(rows: number[], spin: SpinKind): void {
    const cells = rowCells(this.board, rows)
    this.combo++

    // perfect clear = board empty once these rows go away
    this.scratch.set(this.board)
    removeRows(this.scratch, rows)
    const perfectClear = isEmpty(this.scratch)

    const eligible = isB2BEligible(rows.length, spin)
    const { points, b2bApplied } = scoreClear({
      lines: rows.length,
      spin,
      level: this.level,
      combo: this.combo,
      b2bActive: this.b2b,
      perfectClear,
    })
    this.score += points
    this.b2b = eligible

    const kind = clearKind(rows.length, spin)
    this.emit({
      t: 'LINE_CLEAR',
      rows,
      cells,
      lines: rows.length,
      kind,
      spin,
      b2b: b2bApplied,
      combo: this.combo,
      perfectClear,
      points,
    })
    if (spin !== 'none') this.emit({ t: 'SPIN', piece: 'T', spin, lines: rows.length })
    if (this.combo > 0) this.emit({ t: 'COMBO', count: this.combo })

    const before = this.level
    this.lines += rows.length
    this.level = levelForLines(this.lines, this.startLevel)
    if (this.level !== before) this.emit({ t: 'LEVEL_UP', level: this.level })
  }

  // ------------------------------------------------------------------ spawn

  private spawnNext(resetHold = true): void {
    const type = this.queue.shift()!
    fillQueue(this.queue, this.rand, this.tuning.previewCount + 1)
    this.spawnPiece(type, resetHold)
  }

  private spawnPiece(type: PieceType, resetHold = true): void {
    if (resetHold) this.canHold = true
    const cells = cellsOf(type, 0)
    const x = SPAWN_X
    const y = SPAWN_ROW - minCellY(cells)

    if (collides(this.board, cells, x, y)) {
      this.active = { type, rot: 0, x, y }
      this.gameOver('block-out')
      return
    }

    const piece: ActivePiece = { type, rot: 0, x, y }
    // Guideline: the piece drops one row immediately if that space is free,
    // which is what brings it into the visible well.
    if (!collides(this.board, cells, x, y - 1)) piece.y -= 1

    this.active = piece
    this.phase = 'FALLING'
    this.gravityAcc = 0
    this.lockTimer = this.tuning.lockDelayMs
    this.lockResets = 0
    this.lowestY = piece.y
    this.lastRotation = false
    this.lastKickIndex = 0
    this.emit({ t: 'SPAWN', piece: type, x: piece.x, y: piece.y })

    // initial rotation / initial hold, buffered during the clear pause
    if (this.bufferedRot !== 0) {
      const d = this.bufferedRot
      this.bufferedRot = 0
      this.tryRotate(d as 1 | 2 | 3)
    }
    if (this.bufferedHold) {
      this.bufferedHold = false
      this.doHold()
    }
  }

  private gameOver(reason: 'block-out' | 'lock-out'): void {
    this.phase = 'GAME_OVER'
    this.emit({ t: 'TOP_OUT', reason })
  }

  // ---------------------------------------------------------------- queries

  /** Board y the active piece would land on if hard dropped. */
  ghostY(): number {
    const p = this.active
    if (!p) return 0
    const cells = cellsOf(p.type, p.rot)
    let y = p.y
    while (!collides(this.board, cells, p.x, y - 1)) y--
    return y
  }

  activeCells(): Cell[] {
    const p = this.active
    if (!p) return []
    return cellsOf(p.type, p.rot).map((c) => ({ x: p.x + c[0], y: p.y + c[1], type: p.type }))
  }

  ghostCells(): Cell[] {
    const p = this.active
    if (!p) return []
    const gy = this.ghostY()
    return cellsOf(p.type, p.rot).map((c) => ({ x: p.x + c[0], y: gy + c[1], type: p.type }))
  }

  snapshot(): HudSnapshot {
    return {
      score: this.score,
      lines: this.lines,
      level: this.level,
      combo: this.combo,
      b2b: this.b2b,
      next: this.queue.slice(0, this.tuning.previewCount),
      hold: this.hold,
      canHold: this.canHold,
      phase: this.phase,
      pieces: this.pieces,
      timeMs: this.timeMs,
    }
  }

  /** Stable fingerprint of the whole run — used by replay regression tests. */
  fingerprint(): string {
    return `${hashBoard(this.board)}:${this.score}:${this.lines}:${this.level}:${this.pieces}:${this.phase}`
  }

  private emit(e: GameEvent): void {
    this.events.push(e)
  }
}
