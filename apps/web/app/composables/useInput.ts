import type { Command, Key } from '@tetris/core'

export type Binding = Record<string, Key>

/**
 * Default bindings. Everything is remappable; nothing in the game reads
 * `event.key` outside this file.
 */
export const DEFAULT_BINDINGS: Binding = {
  ArrowLeft: 'LEFT',
  ArrowRight: 'RIGHT',
  ArrowDown: 'SOFT',
  ArrowUp: 'CW',
  KeyZ: 'CCW',
  KeyX: 'CW',
  KeyA: 'FLIP',
  Space: 'HARD',
  ShiftLeft: 'HOLD',
  KeyC: 'HOLD',
}

const GAMEPAD_MAP: Record<number, Key> = {
  0: 'CW', // A / cross
  1: 'CCW', // B / circle
  2: 'HOLD', // X / square
  3: 'FLIP', // Y / triangle
  4: 'HOLD',
  5: 'HOLD',
  12: 'HARD', // dpad up
  13: 'SOFT', // dpad down
  14: 'LEFT',
  15: 'RIGHT',
}

/**
 * Buffers input into a command queue drained by the simulation tick.
 * Auto-repeat is NOT taken from the browser: OS key repeat differs per
 * machine and would make the game non-deterministic. The engine owns DAS/ARR.
 */
export function createInput(bindings: Binding = { ...DEFAULT_BINDINGS }) {
  let queue: Command[] = []
  const down = new Set<Key>()
  let enabled = true
  let onPause: (() => void) | null = null
  let onRestart: (() => void) | null = null

  function press(k: Key): void {
    if (down.has(k)) return
    down.add(k)
    queue.push({ t: 'PRESS', k })
  }

  function release(k: Key): void {
    if (!down.has(k)) return
    down.delete(k)
    queue.push({ t: 'RELEASE', k })
  }

  function releaseAll(): void {
    down.clear()
    queue.push({ t: 'RELEASE_ALL' })
  }

  function handleKeyDown(e: KeyboardEvent): void {
    if (e.repeat) return
    if (e.code === 'Escape' || e.code === 'KeyP') {
      onPause?.()
      return
    }
    if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
      onRestart?.()
      return
    }
    const k = bindings[e.code]
    if (!k || !enabled) return
    e.preventDefault()
    press(k)
  }

  function handleKeyUp(e: KeyboardEvent): void {
    const k = bindings[e.code]
    if (!k) return
    e.preventDefault()
    release(k)
  }

  function handleBlur(): void {
    releaseAll()
    onPause?.()
  }

  function handleVisibility(): void {
    if (document.visibilityState === 'hidden') handleBlur()
  }

  /** Poll gamepads once per frame and translate them into the same commands. */
  function pollGamepads(): void {
    if (!enabled || typeof navigator === 'undefined' || !navigator.getGamepads) return
    for (const pad of navigator.getGamepads()) {
      if (!pad) continue
      for (const [index, key] of Object.entries(GAMEPAD_MAP)) {
        const button = pad.buttons[Number(index)]
        if (!button) continue
        if (button.pressed) press(key)
        else release(key)
      }
      const [ax = 0] = pad.axes
      if (ax < -0.5) press('LEFT')
      else release('LEFT')
      if (ax > 0.5) press('RIGHT')
      else release('RIGHT')
    }
  }

  function attach(): () => void {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }

  function drain(): Command[] {
    if (queue.length === 0) return []
    const out = queue
    queue = []
    return out
  }

  return {
    attach,
    drain,
    press,
    release,
    releaseAll,
    pollGamepads,
    get bindings() {
      return bindings
    },
    setBinding(code: string, key: Key) {
      bindings[code] = key
    },
    setEnabled(value: boolean) {
      enabled = value
      if (!value) releaseAll()
    },
    onPause(fn: () => void) {
      onPause = fn
    },
    onRestart(fn: () => void) {
      onRestart = fn
    },
    isDown: (k: Key) => down.has(k),
  }
}

export type InputController = ReturnType<typeof createInput>

/** Touch/swipe controls for phones. */
export function attachTouchControls(
  el: HTMLElement,
  input: InputController,
  opts: { cell?: number } = {},
): () => void {
  const cell = opts.cell ?? 32
  let startX = 0
  let startY = 0
  let lastX = 0
  let startTime = 0
  let moved = false
  let softing = false

  const onStart = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    startX = lastX = t.clientX
    startY = t.clientY
    startTime = performance.now()
    moved = false
  }

  const onMove = (e: TouchEvent) => {
    const t = e.touches[0]
    if (!t) return
    const dx = t.clientX - lastX
    const dy = t.clientY - startY
    while (Math.abs(dx) >= cell) {
      input.press(dx > 0 ? 'RIGHT' : 'LEFT')
      input.release(dx > 0 ? 'RIGHT' : 'LEFT')
      lastX += Math.sign(dx) * cell
      moved = true
      break
    }
    if (dy > cell * 2 && !softing) {
      softing = true
      input.press('SOFT')
      moved = true
    }
  }

  const onEnd = (e: TouchEvent) => {
    if (softing) {
      input.release('SOFT')
      softing = false
    }
    const t = e.changedTouches[0]
    if (!t) return
    const dt = performance.now() - startTime
    const dx = t.clientX - startX
    const dy = t.clientY - startY
    if (!moved && dt < 250 && Math.abs(dx) < cell && Math.abs(dy) < cell) {
      input.press('CW')
      input.release('CW')
    } else if (dy > cell * 4 && dt < 300) {
      input.press('HARD')
      input.release('HARD')
    }
  }

  el.addEventListener('touchstart', onStart, { passive: true })
  el.addEventListener('touchmove', onMove, { passive: true })
  el.addEventListener('touchend', onEnd, { passive: true })
  return () => {
    el.removeEventListener('touchstart', onStart)
    el.removeEventListener('touchmove', onMove)
    el.removeEventListener('touchend', onEnd)
  }
}
