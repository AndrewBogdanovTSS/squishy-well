/**
 * `pnpm evidence --base <ref> --head <ref>` - gather the proof before writing.
 *
 * The claim it makes falsifiable: every "I checked that" a review is about to
 * make.
 *
 * The problem this solves is not dishonesty. It is that anyone writing a review
 * - person or model - reliably *uses* evidence that is already in front of them
 * and unreliably *chooses* to go and gather it halfway through composing a
 * sentence. Gathering is off the path they are on. So the fix is not a better
 * instruction; it is to run the expensive commands first, with something that is
 * not the reviewer, and hand the results over.
 *
 * The output is a file of artifact blocks that `check-claims` can already read.
 *
 * Two details carry more weight than they look like they do:
 *   - the working-tree guard, because evidence gathered at the wrong commit
 *     describes a different codebase than the review does;
 *   - a timeout recorded as `exit: 124` rather than a crash, because a command
 *     that failed is evidence and a command that never ran is not.
 *
 * Exit codes: 0 bundle written - 1 refs unresolvable or the guard failed - 2 bad usage.
 */
import { writeFileSync } from 'node:fs'
import { EXIT, parseArgs, usage } from './lib/cli'
import { formatArtifact } from './lib/artifact'
import { capture, run } from './lib/proc'

const HELP = `
pnpm evidence --base <ref> --head <ref> [--out <file>] [--skip <steps>] [--repo <path>]

Runs lint, typecheck, tests and the diff summary for a change, and writes them
as artifact blocks that a review can cite.

  --base   the baseline ref (use origin/<branch>, not a bare local branch name)
  --head   the commit under review (default HEAD)
  --out    output file (default evidence.local.md, which is gitignored)
  --skip   comma-separated: diff, lint, typecheck, test
  --repo   repository root (default: current directory)

exit 0 = bundle written, 1 = could not gather, 2 = bad usage
`

export interface Step {
  name: string
  command: string
  /** Skipped steps are recorded as skipped. Silence is not evidence. */
  skipReason?: string
}

/** Which steps are worth running for this diff, and why. */
export function planSteps(changedFiles: string[], skip: string[]): Step[] {
  const code = changedFiles.filter((f) => /\.(ts|vue|js)$/.test(f))
  const touchesCore = changedFiles.some((f) => f.startsWith('packages/tetris-core/'))

  const steps: Step[] = []
  steps.push({
    name: 'lint',
    command: code.length > 0 ? 'pnpm eslint ' + code.map((f) => '"' + f + '"').join(' ') : 'pnpm lint',
    skipReason: skip.includes('lint') ? 'skipped by --skip' : undefined,
  })
  steps.push({
    name: 'typecheck',
    command: 'pnpm typecheck',
    skipReason: skip.includes('typecheck') ? 'skipped by --skip' : undefined,
  })
  steps.push({
    name: 'test',
    command: 'pnpm test',
    skipReason: skip.includes('test')
      ? 'skipped by --skip'
      : touchesCore
        ? undefined
        : 'no engine files changed, so the engine suite proves nothing about this diff',
  })
  return steps
}

/**
 * The guard. Lint, typecheck and tests read the working tree, not git objects,
 * so a bundle generated while checked out somewhere else is evidence about a
 * different codebase - stated confidently, and wrong.
 */
export function assertWorkingTreeAt(head: string, repo: string): string {
  const actual = capture('git rev-parse HEAD', repo)
  const wanted = capture('git rev-parse ' + head, repo)
  if (!actual || !wanted) throw new Error('could not resolve HEAD or ' + head)
  if (actual !== wanted) {
    throw new Error(
      'the working tree is at ' +
        actual.slice(0, 10) +
        ' but evidence was requested for ' +
        wanted.slice(0, 10) +
        '.\nCheck out the right commit first:  git checkout ' +
        wanted,
    )
  }
  return wanted
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const repo = typeof args.repo === 'string' ? args.repo : process.cwd()
  const base = typeof args.base === 'string' ? args.base : undefined
  const head = typeof args.head === 'string' ? args.head : 'HEAD'
  const out = typeof args.out === 'string' ? args.out : 'evidence.local.md'
  const skip = typeof args.skip === 'string' ? args.skip.split(',').map((s) => s.trim()) : []
  if (!base) usage(HELP)

  let headSha: string
  try {
    headSha = assertWorkingTreeAt(head, repo)
  } catch (err) {
    console.error((err as Error).message)
    process.exit(EXIT.failed)
  }

  const baseSha = capture('git rev-parse ' + base, repo)
  if (!baseSha) {
    console.error('could not resolve --base ' + base)
    process.exit(EXIT.failed)
  }

  // Three dots: the diff since the branches diverged, which is the change under
  // review. Two dots would also fold in whatever the baseline did since.
  const range = baseSha + '...' + headSha
  const names = capture('git diff --name-only ' + range, repo) ?? ''
  const changedFiles = names.split('\n').filter(Boolean)

  const parts: string[] = [
    '# Evidence bundle',
    '',
    '- Base: `' + baseSha + '` (' + base + ')',
    '- Head: `' + headSha + '`',
    '- Files in diff: ' + changedFiles.length,
    '',
    'Generated by `pnpm evidence`. Every block below is a command anyone can re-run.',
    '',
  ]

  if (!skip.includes('diff')) {
    const stat = run('git diff --stat ' + range, { cwd: repo, timeoutMs: 60_000 })
    parts.push('## Diff', '', formatArtifact(stat.command, stat.output, stat.exitCode), '')
  }

  for (const step of planSteps(changedFiles, skip)) {
    parts.push('## ' + step.name, '')
    if (step.skipReason) {
      parts.push('_Not run: ' + step.skipReason + '._', '')
      continue
    }
    const res = run(step.command, { cwd: repo, timeoutMs: 300_000 })
    parts.push(formatArtifact(res.command, res.output, res.exitCode), '')
    console.log('  ' + step.name + ': exit ' + res.exitCode + (res.timedOut ? ' (timed out)' : ''))
  }

  writeFileSync(out, parts.join('\n'), 'utf8')
  console.log('\nwrote ' + out + ' - cite these blocks instead of asserting what they would have said\n')
  process.exit(EXIT.ok)
}

if (process.argv[1]?.includes('gather-evidence')) main()
