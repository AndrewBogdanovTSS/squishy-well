/**
 * `pnpm evidence --base <ref> --head <ref>` - gather the proof before writing.
 *
 * Thin wrapper: the orchestration (working-tree guard, diff, running each
 * step, addressing every artifact, writing the skeleton) lives in
 * `evidence-layer`'s `gatherEvidence` - see
 * `packages/evidence-layer/src/core/gather.ts` for why the skeleton is
 * mandatory, not a nicety. This file supplies the two things only this project
 * knows: which changed files make the engine suite worth running, and how to
 * scope lint to just the files that changed.
 *
 * Exit codes: 0 bundle written - 1 refs unresolvable or the guard failed - 2 bad usage.
 */
import { EXIT, gatherEvidence, parseArgs, usage } from 'evidence-layer'

const HELP = `
pnpm evidence --base <ref> --head <ref> [--out <file>] [--skip <steps>] [--repo <path>]

Runs lint, typecheck, tests and the diff summary for a change, and writes them
as addressed artifact blocks plus a ready-to-paste claim skeleton.

  --base   the baseline ref (use origin/<branch>, not a bare local branch name)
  --head   the commit under review (default HEAD)
  --out    output file (default evidence.local.md, which is gitignored)
  --skip   comma-separated: diff, lint, typecheck, test
  --repo   repository root (default: current directory)

exit 0 = bundle written, 1 = could not gather, 2 = bad usage
`

/** Only the engine suite proves anything about a change to `packages/tetris-core`. */
export function tetrisTestGate(changedFiles: string[]): boolean {
  return changedFiles.some((f) => f.startsWith('packages/tetris-core/'))
}

/** Scopes lint to the files that actually changed, when there are any code files among them. */
export function tetrisLintCommand(changedFiles: string[]): string {
  const code = changedFiles.filter((f) => /\.(ts|vue|js)$/.test(f))
  return code.length > 0 ? 'pnpm eslint ' + code.map((f) => '"' + f + '"').join(' ') : 'pnpm lint'
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const repo = typeof args.repo === 'string' ? args.repo : process.cwd()
  const base = typeof args.base === 'string' ? args.base : undefined
  const head = typeof args.head === 'string' ? args.head : undefined
  const out = typeof args.out === 'string' ? args.out : undefined
  const skip = typeof args.skip === 'string' ? args.skip.split(',').map((s) => s.trim()) : []
  if (!base) usage(HELP)

  try {
    gatherEvidence({
      repo,
      base,
      head,
      out,
      skip,
      plan: { testGate: tetrisTestGate, lintCommand: tetrisLintCommand },
    })
  } catch (err) {
    console.error((err as Error).message)
    process.exit(EXIT.failed)
  }
  process.exit(EXIT.ok)
}

if (process.argv[1]?.includes('gather-evidence')) main()
