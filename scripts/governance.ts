/**
 * `pnpm check:all` - does anything actually run the checks?
 *
 * The claim it makes falsifiable: **"this is enforced."**
 *
 * Every other script here checks something about the code or a review. This one
 * checks the checks. It exists because of the least interesting and most common
 * failure in this whole area: the rule was written, the tool was built, the
 * documentation said it was enforced, and nothing ever ran it. A rule with no
 * trigger is decoration, and nothing in an ordinary repository can tell a
 * decorative rule from a live one.
 *
 * So: a decision record may declare an invariant and name the command that
 * enforces it. This script resolves that command against the package scripts and
 * follows the trigger graph - git hooks and CI workflows, expanded through the
 * scripts they call - to find out whether anything reaches it. An invariant no
 * trigger reaches is a finding.
 *
 * It prints a machine-readable block on every run, **including a clean one**,
 * because an absent report is the only signal a reader has for "never ran", and
 * telling that apart from "checked, found nothing" is the entire discipline.
 *
 * Exit codes: 0 - 1 only with --enforce and at least one error - 2 bad usage.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXIT, parseArgs, report, summarise, usage } from './lib/cli'
import type { Finding } from './lib/cli'
import { run } from './lib/proc'

const HELP = `
pnpm check:all [--enforce] [--fast] [--only <check>] [--repo <path>] [--no-json]

Runs every check in this folder, then verifies that something actually runs them.

  --enforce  exit 1 when any finding is an error (default: warn only)
  --fast     skip the slow checks (the test suite, the build measurement)
  --only        run one check: docs, fingerprint, reachability
  --decisions   directory of decision records (default docs/decisions)
  --no-json     suppress the machine-readable report block

exit 0 = warn-only or clean, 1 = --enforce and at least one error, 2 = bad usage
`

const JSON_BEGIN = '---GOVERNANCE-JSON-BEGIN---'
const JSON_END = '---GOVERNANCE-JSON-END---'

/** Runs another script in this folder and folds its exit code into one finding. */
function runCheck(name: string, command: string, repo: string): Finding[] {
  const res = run(command, { cwd: repo, timeoutMs: 600_000 })
  console.log(res.output)
  return [
    {
      level: res.exitCode === 0 ? 'pass' : 'error',
      claim: name,
      detail: '`' + command + '` exited ' + res.exitCode,
    },
  ]
}

// ---------------------------------------------------------------------------
// Invariant reachability
// ---------------------------------------------------------------------------

export interface Invariant {
  text: string
  /** The command named after "enforced by", if any. */
  command?: string
  file: string
}

/** Reads `enforced by \`<command>\`` clauses out of every decision record. */
export function readInvariants(decisionsDir: string): Invariant[] {
  if (!existsSync(decisionsDir)) return []
  const invariants: Invariant[] = []
  for (const file of readdirSync(decisionsDir).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(join(decisionsDir, file), 'utf8')
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
    if (!front) continue
    for (const line of front[1]!.split(/\r?\n/)) {
      const item = /^\s*-\s+(.*\S)\s*$/.exec(line)
      if (!item || !/enforced by/i.test(item[1]!)) continue
      const command = /enforced by\s+`([^`]+)`/i.exec(item[1]!)?.[1]
      invariants.push({ text: item[1]!, command, file: join(decisionsDir, file) })
    }
  }
  return invariants
}

/**
 * Every command a wired trigger can reach.
 *
 * Triggers are the git hooks in `.githooks/` and the `run:` steps of the GitHub
 * workflows - the two places in this repository where something executes without
 * a human choosing to. Those are then expanded through `package.json` scripts,
 * because a hook that runs `pnpm check:all` also reaches everything that script
 * runs.
 */
export function reachableCommands(repo: string): Set<string> {
  const scripts = (JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }).scripts ?? {}

  const seeds: string[] = []
  const hooksDir = join(repo, '.githooks')
  if (existsSync(hooksDir)) {
    for (const f of readdirSync(hooksDir)) seeds.push(readFileSync(join(hooksDir, f), 'utf8'))
  }
  const wfDir = join(repo, '.github', 'workflows')
  if (existsSync(wfDir)) {
    for (const f of readdirSync(wfDir).filter((n) => /\.ya?ml$/.test(n))) {
      seeds.push(readFileSync(join(wfDir, f), 'utf8'))
    }
  }

  const reached = new Set<string>()
  const queue = [...seeds]
  while (queue.length > 0) {
    const text = queue.pop()!
    for (const [name, body] of Object.entries(scripts)) {
      const invoked = new RegExp('(?:pnpm|npm run|yarn)\\s+(?:run\\s+)?' + name.replace(/[:*]/g, '\\$&') + '\\b')
      if (!invoked.test(text) || reached.has(name)) continue
      reached.add(name)
      queue.push(body)
      // A script body is often just `tsx scripts/x.ts`, and that file may run
      // further commands of its own - `check:all` reaches `check:docs` that way.
      // So follow it and scan its source too.
      const script = /tsx\s+([\w./-]+\.ts)/.exec(body)?.[1]
      const scriptPath = script ? join(repo, script) : undefined
      if (scriptPath && existsSync(scriptPath)) queue.push(readFileSync(scriptPath, 'utf8'))
    }
  }
  return reached
}

/**
 * Commands built at runtime are invisible to the scan above, so reachability is
 * an under-approximation: it can say "nothing reaches this" when something does.
 * That limit is stated rather than hidden, because a checker whose blind spots
 * are undocumented is a checker nobody can calibrate against.
 */
export const REACHABILITY_CAVEAT =
  'reachability is computed from literal command strings; a command assembled at runtime will not be seen'

export function checkReachability(repo: string, decisionsDir?: string): Finding[] {
  const invariants = readInvariants(decisionsDir ?? join(repo, 'docs', 'decisions'))
  if (invariants.length === 0) {
    return [
      {
        level: 'warning',
        claim: 'decision records declare enforceable invariants',
        detail: 'no decision records with invariants found - nothing to resolve',
      },
    ]
  }

  const reached = reachableCommands(repo)
  const scripts = (JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>
  }).scripts ?? {}

  return invariants.map((inv): Finding => {
    const claim = inv.text.length > 90 ? inv.text.slice(0, 90) + '...' : inv.text
    // Repo-relative, so the output is the same on every machine and can be
    // pasted into a review without leaking someone's home directory.
    inv = { ...inv, file: relative(repo, inv.file).replace(/\\/g, '/') }
    if (!inv.command) {
      return {
        level: 'warning',
        claim,
        detail: 'names no runnable command, so its enforcement cannot be checked',
        file: inv.file,
      }
    }
    // `pnpm check:claims demo/x.md` -> the script name is `check:claims`.
    const scriptName = inv.command.replace(/^pnpm\s+/, '').split(/\s+/)[0]!
    if (!(scriptName in scripts)) {
      return {
        level: 'error',
        claim: claim,
        detail: '"' + inv.command + '" is not a script in package.json',
        file: inv.file,
      }
    }
    if (!reached.has(scriptName)) {
      return {
        level: 'error',
        claim: claim,
        detail:
          '`' +
          scriptName +
          '` exists but no trigger reaches it. It is documented, not enforced.',
        file: inv.file,
      }
    }
    return { level: 'pass', claim, detail: '`' + scriptName + '` is reachable from a wired trigger', file: inv.file }
  })
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const here = fileURLToPath(new URL('.', import.meta.url))
  const repo = typeof args.repo === 'string' ? args.repo : join(here, '..')
  const only = typeof args.only === 'string' ? args.only : undefined
  const fast = args.fast === true
  const enforce = args.enforce === true

  const findings: Finding[] = []
  if (!only || only === 'fingerprint') findings.push(...runCheck('engine fingerprints', 'pnpm fingerprint', repo))
  if (!only || only === 'docs') {
    findings.push(...runCheck('README claims', 'pnpm check:docs' + (fast ? ' --skip test,build' : ''), repo))
  }
  const decisions = typeof args.decisions === 'string' ? args.decisions : undefined
  if (!only || only === 'reachability') findings.push(...checkReachability(repo, decisions))

  report('Governance (' + (enforce ? 'enforcing' : 'warn-only') + ')', findings)

  if (args.json !== false && args['no-json'] !== true) {
    console.log(JSON_BEGIN)
    console.log(
      JSON.stringify({
        schema: 1,
        mode: enforce ? 'enforce' : 'warn',
        generatedAt: new Date().toISOString(),
        summary: summarise(findings),
        findings: findings.map((f) => ({ level: f.level, claim: f.claim, detail: f.detail, file: f.file })),
      }),
    )
    console.log(JSON_END)
  }

  const failed = findings.some((f) => f.level === 'error')
  if (failed && !enforce) {
    console.log('\nWarn-only: the above would fail the build once enforcement is on.\n')
  }
  process.exit(enforce && failed ? EXIT.failed : EXIT.ok)
}

if (process.argv[1]?.includes('governance')) main()
