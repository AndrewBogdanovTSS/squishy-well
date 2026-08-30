import type { GameEvent, GameEventType } from '@tetris/core'

type Handler<E extends GameEvent = GameEvent> = (event: E) => void

/**
 * A deliberately tiny, non-reactive event bus. Domain events go one way:
 * engine -> presentation. Nothing here ever writes back into the engine.
 */
export function createEventBus() {
  const handlers = new Map<GameEventType | '*', Set<Handler>>()

  function on<K extends GameEventType>(
    type: K,
    fn: (event: Extract<GameEvent, { t: K }>) => void,
  ): () => void
  function on(type: '*', fn: Handler): () => void
  function on(type: GameEventType | '*', fn: Handler): () => void {
    let set = handlers.get(type)
    if (!set) {
      set = new Set()
      handlers.set(type, set)
    }
    set.add(fn)
    return () => set!.delete(fn)
  }

  function emit(event: GameEvent): void {
    const specific = handlers.get(event.t)
    if (specific) for (const fn of specific) fn(event)
    const all = handlers.get('*')
    if (all) for (const fn of all) fn(event)
  }

  function clear(): void {
    handlers.clear()
  }

  return { on, emit, clear }
}

export type EventBus = ReturnType<typeof createEventBus>
