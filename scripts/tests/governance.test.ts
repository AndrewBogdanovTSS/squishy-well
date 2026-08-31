import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkReachability, readInvariants, reachableCommands } from '../governance'

let repo: string

/** A throwaway repository shaped like this one, with only what the check reads. */
function makeRepo(opts: {
  scripts?: Record<string, string>
  hook?: string
  workflow?: string
  invariants?: string[]
  scriptFiles?: Record<string, string>
}): void {
  writeFileSync(join(repo, 'package.json'), JSON.stringify({ scripts: opts.scripts ?? {} }))

  if (opts.hook) {
    mkdirSync(join(repo, '.githooks'), { recursive: true })
    writeFileSync(join(repo, '.githooks', 'pre-push'), opts.hook)
  }
  if (opts.workflow) {
    mkdirSync(join(repo, '.github', 'workflows'), { recursive: true })
    writeFileSync(join(repo, '.github', 'workflows', 'ci.yml'), opts.workflow)
  }
  for (const [path, body] of Object.entries(opts.scriptFiles ?? {})) {
    mkdirSync(join(repo, 'scripts'), { recursive: true })
    writeFileSync(join(repo, path), body)
  }
  if (opts.invariants) {
    mkdirSync(join(repo, 'docs', 'decisions'), { recursive: true })
    writeFileSync(
      join(repo, 'docs', 'decisions', '0001-x.md'),
      ['---', 'invariants:', ...opts.invariants.map((i) => '  - ' + i), '---', '', '# X'].join('\n'),
    )
  }
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'gov-'))
})
afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe('readInvariants', () => {
  it('reads the command out of an "enforced by" clause', () => {
    makeRepo({ invariants: ['Claims are backed; enforced by `pnpm check:claims`.'] })
    expect(readInvariants(join(repo, 'docs', 'decisions'))[0]!.command).toBe('pnpm check:claims')
  })

  it('keeps an invariant that names no command, rather than dropping it', () => {
    makeRepo({ invariants: ['Reviewers think carefully; enforced by a reviewer.'] })
    const [inv] = readInvariants(join(repo, 'docs', 'decisions'))
    expect(inv?.command).toBeUndefined()
  })

  it('ignores an invariant making no enforcement claim', () => {
    makeRepo({ invariants: ['The engine is deterministic.'] })
    expect(readInvariants(join(repo, 'docs', 'decisions'))).toHaveLength(0)
  })
})

describe('reachableCommands', () => {
  it('finds a script a git hook runs', () => {
    makeRepo({ scripts: { 'check:all': 'tsx scripts/governance.ts' }, hook: 'pnpm check:all\n' })
    expect(reachableCommands(repo).has('check:all')).toBe(true)
  })

  it('finds a script a workflow runs', () => {
    makeRepo({ scripts: { test: 'vitest run' }, workflow: 'jobs:\n  a:\n    steps:\n      - run: pnpm test\n' })
    expect(reachableCommands(repo).has('test')).toBe(true)
  })

  it('follows a script file to the commands it runs in turn', () => {
    // `check:all` is `tsx scripts/governance.ts`, and that file runs
    // `pnpm check:docs`. Without following the file, check:docs looks orphaned
    // while something is in fact running it every build.
    makeRepo({
      scripts: { 'check:all': 'tsx scripts/gov.ts', 'check:docs': 'tsx scripts/docs.ts' },
      scriptFiles: { 'scripts/gov.ts': 'run("pnpm check:docs")' },
      hook: 'pnpm check:all',
    })
    expect(reachableCommands(repo).has('check:docs')).toBe(true)
  })

  it('reaches nothing when no trigger exists', () => {
    makeRepo({ scripts: { 'check:docs': 'tsx scripts/docs.ts' } })
    expect(reachableCommands(repo).size).toBe(0)
  })
})

describe('checkReachability', () => {
  it('fails an invariant naming a command no trigger reaches', () => {
    makeRepo({
      scripts: { 'check:docs': 'tsx scripts/docs.ts' },
      invariants: ['README claims hold; enforced by `pnpm check:docs`.'],
    })
    const [finding] = checkReachability(repo)
    expect(finding?.level).toBe('error')
    expect(finding?.detail).toContain('documented, not enforced')
  })

  it('fails an invariant naming a command that does not exist', () => {
    makeRepo({ invariants: ['Spelling is checked; enforced by `pnpm check:spelling`.'] })
    expect(checkReachability(repo)[0]!.detail).toContain('not a script in package.json')
  })

  it('warns, rather than fails, when enforcement is a person', () => {
    // Plenty of real rules are enforced by people. Failing those would push
    // authors into naming a fake command to get a green check.
    makeRepo({ invariants: ['Accessibility is considered; enforced by a reviewer.'] })
    expect(checkReachability(repo)[0]!.level).toBe('warning')
  })

  it('passes once a trigger reaches the command', () => {
    makeRepo({
      scripts: { 'check:docs': 'tsx scripts/docs.ts' },
      hook: 'pnpm check:docs',
      invariants: ['README claims hold; enforced by `pnpm check:docs`.'],
    })
    expect(checkReachability(repo)[0]!.level).toBe('pass')
  })
})
