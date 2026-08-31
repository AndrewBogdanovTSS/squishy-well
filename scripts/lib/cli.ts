/**
 * Tiny argument parser and reporter shared by every script in this folder.
 *
 * The claim it makes falsifiable: none - this is plumbing. It exists so that
 * every script agrees on what `--help` prints and what an exit code means,
 * because a checker whose exit codes are inconsistent teaches the wrong lesson
 * on its very first run.
 */

/** Exit codes are a contract. `2` is bad usage, and bad usage is never a pass. */
export const EXIT = { ok: 0, failed: 1, usage: 2 } as const

export interface Args {
  /** Positional arguments, in order. */
  _: string[]
  /** `--flag value`, and bare `--flag` which becomes `true`. */
  [key: string]: string | boolean | string[]
}

export function parseArgs(argv: string[]): Args {
  const args: Args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!
    if (!token.startsWith('--')) {
      ;(args._ as string[]).push(token)
      continue
    }
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      args[key] = true
      continue
    }
    args[key] = next
    i++
  }
  return args
}

export type Level = 'pass' | 'warning' | 'error' | 'unverifiable'

export interface Finding {
  level: Level
  /** What was claimed, in the words of whoever claimed it. */
  claim: string
  /** What the repository says instead, or why nobody can tell. */
  detail: string
  /** Where the claim lives, when it has a location. */
  file?: string
  line?: number
}

const ICON: Record<Level, string> = {
  pass: ' ok ',
  warning: 'warn',
  error: 'FAIL',
  unverifiable: ' ?? ',
}

export function report(title: string, findings: Finding[]): void {
  console.log('')
  console.log(title)
  console.log('-'.repeat(title.length))
  for (const f of findings) {
    const where = f.file ? ' (' + f.file + (f.line ? ':' + f.line : '') + ')' : ''
    console.log('[' + ICON[f.level] + '] ' + f.claim + where)
    if (f.detail) console.log('        ' + f.detail)
  }
  console.log('')
  console.log(summarise(findings))
  console.log('')
}

export function summarise(findings: Finding[]): string {
  const n = (level: Level) => findings.filter((f) => f.level === level).length
  return (
    findings.length +
    ' checked - ' +
    n('error') +
    ' failed, ' +
    n('warning') +
    ' warnings, ' +
    n('unverifiable') +
    ' unverifiable'
  )
}

/**
 * `unverifiable` is deliberately not an error and deliberately not a pass.
 *
 * A checker that reports success when it could not run is worse than no checker
 * at all, because it manufactures confidence out of nothing. Three outcomes,
 * never two.
 */
export function exitCodeFor(findings: Finding[], strict = false): number {
  if (findings.some((f) => f.level === 'error')) return EXIT.failed
  if (strict && findings.some((f) => f.level === 'warning' || f.level === 'unverifiable')) {
    return EXIT.failed
  }
  return EXIT.ok
}

/** Prints usage text and exits `2`. Called when the arguments make no sense. */
export function usage(text: string): never {
  console.log(text.trim())
  process.exit(EXIT.usage)
}
