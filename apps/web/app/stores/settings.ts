export interface HighScore {
  score: number
  lines: number
  level: number
  seed: number
  at: number
}

interface State {
  bindings: Binding
  volume: number
  muted: boolean
  /** high-contrast, luminance-separated palette plus block glyphs */
  accessiblePalette: boolean
  forceReducedMotion: boolean
  quality: 'auto' | 'high' | 'medium' | 'low' | 'minimal'
  startLevel: number
  scores: HighScore[]
}

const STORAGE_KEY = 'squishywell:settings:v1'

/** Ordinary application state — this is what Pinia is actually good at. */
export const useSettings = defineStore('settings', {
  state: (): State => ({
    bindings: { ...DEFAULT_BINDINGS },
    volume: 0.5,
    muted: false,
    accessiblePalette: false,
    forceReducedMotion: false,
    quality: 'auto',
    startLevel: 1,
    scores: [],
  }),

  getters: {
    best: (s): number => (s.scores.length ? Math.max(...s.scores.map((x) => x.score)) : 0),
  },

  actions: {
    load(): void {
      if (typeof localStorage === 'undefined') return
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) this.$patch(JSON.parse(raw) as Partial<State>)
      } catch {
        // corrupt storage should never stop the game from starting
      }
    },
    persist(): void {
      if (typeof localStorage === 'undefined') return
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
      } catch {
        // quota or private mode — not worth surfacing
      }
    },
    record(entry: HighScore): void {
      this.scores.push(entry)
      this.scores.sort((a, b) => b.score - a.score)
      this.scores = this.scores.slice(0, 10)
      this.persist()
    },
    reset(): void {
      this.bindings = { ...DEFAULT_BINDINGS }
      this.persist()
    },
  },
})
