import { liveFeel } from '~/config/feel'

/**
 * Procedural Web Audio SFX — no asset files, no <audio> latency.
 * Sound is the cheapest juice in the whole project: it costs a few hundred
 * lines and does more for feel than any post-processing pass.
 */
type Voice = 'sine' | 'square' | 'triangle' | 'sawtooth'

export function createAudio() {
  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let noiseBuffer: AudioBuffer | null = null
  let muted = false
  /**
   * Nothing touches AudioContext until a real user gesture has happened.
   * Creating or resuming it earlier does not fail loudly — it just logs an
   * autoplay warning on every single sound effect.
   */
  let unlocked = false

  function ensure(): AudioContext | null {
    if (typeof window === 'undefined' || !unlocked) return null
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      ctx = new Ctor()
      master = ctx.createGain()
      master.gain.value = liveFeel.audio.master
      master.connect(ctx.destination)

      const len = Math.floor(ctx.sampleRate * 0.4)
      noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate)
      const data = noiseBuffer.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    }
    return ctx
  }

  /** Call from a real user gesture (pointerdown / keydown), once. */
  function unlock(): void {
    if (typeof window === 'undefined') return
    unlocked = true
    const c = ensure()
    if (c && c.state === 'suspended') void c.resume()
  }

  function tone(
    freq: number,
    duration: number,
    opts: { type?: Voice; gain?: number; sweep?: number; delay?: number } = {},
  ): void {
    const c = ensure()
    if (!c || !master || muted) return
    const t0 = c.currentTime + (opts.delay ?? 0)
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = opts.type ?? 'square'
    osc.frequency.setValueAtTime(freq, t0)
    if (opts.sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.sweep), t0 + duration)
    const peak = (opts.gain ?? 0.25) * liveFeel.audio.sfx
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    osc.connect(gain).connect(master)
    osc.start(t0)
    osc.stop(t0 + duration + 0.02)
  }

  function noise(duration: number, opts: { gain?: number; freq?: number; q?: number; delay?: number } = {}): void {
    const c = ensure()
    if (!c || !master || !noiseBuffer || muted) return
    const t0 = c.currentTime + (opts.delay ?? 0)
    const src = c.createBufferSource()
    src.buffer = noiseBuffer
    const filter = c.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = opts.freq ?? 900
    filter.Q.value = opts.q ?? 1.1
    const gain = c.createGain()
    const peak = (opts.gain ?? 0.2) * liveFeel.audio.sfx
    gain.gain.setValueAtTime(peak, t0)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
    src.connect(filter).connect(gain).connect(master)
    src.start(t0)
    src.stop(t0 + duration + 0.02)
  }

  const SCALE = [0, 3, 5, 7, 10, 12, 15, 17] // minor pentatonic, hard to make ugly
  const note = (semitones: number) => 220 * Math.pow(2, semitones / 12)

  const sfx = {
    move: () => tone(320, 0.035, { type: 'square', gain: 0.06 }),
    rotate: () => tone(480, 0.05, { type: 'triangle', gain: 0.09, sweep: 560 }),
    rotateFail: () => tone(120, 0.06, { type: 'square', gain: 0.05, sweep: 90 }),
    hold: () => tone(300, 0.09, { type: 'triangle', gain: 0.12, sweep: 420 }),
    lock: () => {
      tone(150, 0.07, { type: 'square', gain: 0.1, sweep: 90 })
      noise(0.05, { gain: 0.08, freq: 400 })
    },
    hardDrop: (distance: number) => {
      const d = Math.min(1, distance / 20)
      noise(0.12, { gain: 0.16 + d * 0.12, freq: 220 + d * 260, q: 0.7 })
      tone(90, 0.1, { type: 'sine', gain: 0.2, sweep: 45 })
    },
    softDrop: () => tone(200, 0.02, { type: 'sine', gain: 0.03 }),
    /** pitch rises with combo — the single most satisfying trick in the file */
    clear: (lines: number, combo: number, b2b: boolean, spin: boolean) => {
      const base = 4 + Math.min(combo, 8) * 2 + (b2b ? 3 : 0)
      const count = spin ? 4 : lines
      for (let i = 0; i < count; i++) {
        tone(note(SCALE[Math.min(i + (spin ? 2 : 0), SCALE.length - 1)]! + base + 12), 0.16, {
          type: 'triangle',
          gain: 0.16,
          delay: i * 0.045,
        })
      }
      if (lines === 4 || spin) noise(0.35, { gain: 0.18, freq: 1500, q: 0.6 })
    },
    levelUp: () => {
      for (let i = 0; i < 4; i++) {
        tone(note(SCALE[i]! + 24), 0.14, { type: 'square', gain: 0.1, delay: i * 0.06 })
      }
    },
    topOut: () => {
      tone(220, 0.9, { type: 'sawtooth', gain: 0.18, sweep: 45 })
      noise(0.7, { gain: 0.12, freq: 300, q: 0.4 })
    },
  }

  function bind(bus: EventBus): () => void {
    const off = [
      bus.on('MOVE', (e) => {
        if (!e.wall) sfx.move()
      }),
      bus.on('ROTATE', () => sfx.rotate()),
      bus.on('ROTATE_FAILED', () => sfx.rotateFail()),
      bus.on('HOLD', () => sfx.hold()),
      bus.on('HARD_DROP', (e) => sfx.hardDrop(e.distance)),
      bus.on('LOCK', (e) => {
        if (!e.hard) sfx.lock()
      }),
      bus.on('LINE_CLEAR', (e) => sfx.clear(e.lines, e.combo, e.b2b, e.spin !== 'none')),
      bus.on('LEVEL_UP', () => sfx.levelUp()),
      bus.on('TOP_OUT', () => sfx.topOut()),
    ]
    return () => off.forEach((fn) => fn())
  }

  return {
    unlock,
    bind,
    sfx,
    setMuted(value: boolean) {
      muted = value
    },
    setVolume(value: number) {
      if (master) master.gain.value = value
    },
    dispose() {
      void ctx?.close()
      ctx = null
      master = null
    },
  }
}

export type AudioEngine = ReturnType<typeof createAudio>
