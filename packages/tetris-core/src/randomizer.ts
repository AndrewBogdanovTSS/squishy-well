import type { PieceType } from './types'
import { PIECE_TYPES } from './types'
import { shuffle } from './rng'

/**
 * Guideline 7-bag: every permutation of the seven pieces is dealt before
 * the next bag is generated. Guarantees at most 12 pieces between two
 * copies of the same type, which is what makes the game learnable.
 */
export class BagRandomizer {
  private bag: PieceType[] = []

  constructor(private readonly rnd: () => number) {}

  next(): PieceType {
    if (this.bag.length === 0) this.refill()
    return this.bag.pop()!
  }

  private refill(): void {
    // popped from the end, so shuffle then reverse for a stable reading order
    this.bag = shuffle([...PIECE_TYPES], this.rnd).reverse()
  }

  /** Serialise for replay resume. */
  snapshot(): PieceType[] {
    return [...this.bag]
  }

  restore(bag: readonly PieceType[]): void {
    this.bag = [...bag]
  }
}

/** Fills the preview queue to `count` items. */
export function fillQueue(queue: PieceType[], rand: BagRandomizer, count: number): void {
  while (queue.length < count) queue.push(rand.next())
}
