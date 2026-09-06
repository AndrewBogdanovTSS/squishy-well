import { describe, expect, it } from 'vitest'
import { tetrisLintCommand, tetrisTestGate } from '../gather-evidence'

describe('tetrisTestGate - this project\'s test-gate config', () => {
  it('gates the test step on files under packages/tetris-core/', () => {
    expect(tetrisTestGate(['README.md'])).toBe(false)
    expect(tetrisTestGate(['packages/tetris-core/src/engine.ts'])).toBe(true)
  })
})

describe('tetrisLintCommand - this project\'s scoped-lint config', () => {
  it('scopes lint to the files that changed', () => {
    expect(tetrisLintCommand(['apps/web/app/pages/play.vue', 'README.md'])).toContain('play.vue')
    expect(tetrisLintCommand(['apps/web/app/pages/play.vue', 'README.md'])).not.toContain('README.md')
  })

  it('falls back to an unscoped lint when nothing in the diff is a code file', () => {
    expect(tetrisLintCommand(['README.md'])).toBe('pnpm lint')
  })
})
