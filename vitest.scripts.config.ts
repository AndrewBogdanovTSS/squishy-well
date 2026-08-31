import { defineConfig } from 'vitest/config'

/**
 * Tests for the evidence-layer scripts, kept separate from the engine suite.
 *
 * `pnpm test` stays what it always was - the game engine. `pnpm test:scripts`
 * covers the checkers. Folding them together would make the engine's test count
 * depend on the tooling around it, and the README makes a claim about that
 * number which `pnpm check:docs` checks.
 */
export default defineConfig({
  test: {
    include: ['scripts/tests/**/*.test.ts'],
    environment: 'node',
  },
})
