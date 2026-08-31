import { describe, expect, it } from 'vitest'
import { parseReceipt } from '../check-receipt'
import { planSteps } from '../gather-evidence'
import { exitCodeFor, parseArgs } from '../lib/cli'

const RECEIPT = [
  '**Repo path**: /somewhere',
  '**Branch**: master',
  '**HEAD SHA**: f8ae76a0cd2194fcef3e6c69cf9478c4a5bc07ab',
  '**Target branch**: demo-base',
  '**Base SHA**: ed53edc0ed94345a89de5e7cf2fb4edc93f7fe45',
  '**Diff stat**: 9 files changed, 15 insertions(+), 12 deletions(-)',
  '**Files in diff**: 9',
  '**Files opened during review**: 4',
  "**Sample integrity**: `apps/web/app/lib/three.ts` -> `import { COLS } from '@tetris/core'`",
].join('\n')

describe('parseReceipt', () => {
  it('reads every field', () => {
    const r = parseReceipt(RECEIPT)
    expect(r.branch).toBe('master')
    expect(r.targetBranch).toBe('demo-base')
    expect(r.headSha).toHaveLength(40)
    expect(r.filesInDiff).toBe(9)
    expect(r.filesOpened).toBe(4)
    expect(r.samplePath).toBe('apps/web/app/lib/three.ts')
    expect(r.sampleLine).toBe("import { COLS } from '@tetris/core'")
  })

  it('leaves a missing field undefined rather than guessing at it', () => {
    expect(parseReceipt('**Branch**: master').headSha).toBeUndefined()
  })
})

describe('planSteps', () => {
  it('scopes lint to the files that changed', () => {
    const [lint] = planSteps(['apps/web/app/pages/play.vue', 'README.md'], [])
    expect(lint!.command).toContain('play.vue')
    expect(lint!.command).not.toContain('README.md')
  })

  it('skips the engine suite when no engine file changed, and says why', () => {
    const test = planSteps(['README.md'], []).find((s) => s.name === 'test')
    expect(test!.skipReason).toContain('proves nothing about this diff')
  })

  it('runs the engine suite when the engine changed', () => {
    const test = planSteps(['packages/tetris-core/src/engine.ts'], []).find((s) => s.name === 'test')
    expect(test!.skipReason).toBeUndefined()
  })

  it('records a skip as a skip - silence is not evidence', () => {
    const test = planSteps(['packages/tetris-core/src/engine.ts'], ['test']).find((s) => s.name === 'test')
    expect(test!.skipReason).toBe('skipped by --skip')
  })
})

describe('the exit-code contract', () => {
  it('passes when nothing failed', () => {
    expect(exitCodeFor([{ level: 'pass', claim: 'a', detail: '' }])).toBe(0)
  })

  it('fails on any error', () => {
    expect(exitCodeFor([{ level: 'error', claim: 'a', detail: '' }])).toBe(1)
  })

  it('does not fail on unverifiable by default, and does under --strict', () => {
    // "Cannot check" is neither success nor failure. Which of the two it should
    // count as is the caller's decision, and the default is to say so out loud
    // rather than to pick silently.
    const findings = [{ level: 'unverifiable' as const, claim: 'a', detail: '' }]
    expect(exitCodeFor(findings)).toBe(0)
    expect(exitCodeFor(findings, true)).toBe(1)
  })
})

describe('parseArgs', () => {
  it('handles values, bare flags and positionals', () => {
    const args = parseArgs(['review.md', '--base', 'origin/master', '--strict'])
    expect(args._).toEqual(['review.md'])
    expect(args.base).toBe('origin/master')
    expect(args.strict).toBe(true)
  })
})
