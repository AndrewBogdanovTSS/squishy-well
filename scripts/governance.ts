/**
 * `pnpm check:all` - does anything actually run the checks?
 *
 * Thin wrapper: reachability, exceptions and the report format all live in
 * `evidence-layer` - see `packages/evidence-layer/src/core/governance.ts`.
 * This file supplies which checks this project runs by default, and where its
 * decision records and exceptions file live.
 *
 * Also records new misses on every run (see `evidence-layer`'s `misses.ts`):
 * cheap, since it is idempotent and reads git history that is already local.
 *
 * Exit codes: 0 warn-only or clean - 1 --enforce and at least one error -
 * 3 a flaky finding survives (from a sub-check) with no error present - 2 bad usage.
 */
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import {
  EXIT,
  checkExceptions,
  checkReachability,
  parseArgs,
  recordNewMisses,
  report,
  run,
  summarise,
  usage,
} from 'evidence-layer'
import type { Finding } from 'evidence-layer'

const HELP = `
pnpm check:all [--enforce] [--fast] [--only <check>] [--repo <path>] [--no-json]

Runs every check in this repository, then verifies that something actually runs them.

  --enforce     exit 1 when any finding is an error (default: warn only)
  --fast        skip the slow checks (the test suite, the build measurement)
  --only        run one check: docs, fingerprint, reachability, exceptions
  --decisions   directory of decision records (default docs/decisions)
  --no-json     suppress the machine-readable report block

exit 0 = warn-only or clean, 1 = --enforce and at least one error,
3 = an unescalated flaky finding with no error present, 2 = bad usage
`

const JSON_BEGIN = '---GOVERNANCE-JSON-BEGIN---'
const JSON_END = '---GOVERNANCE-JSON-END---'

/** Runs another script in this repo and folds its exit code into one finding, including the flaky exit code. */
function runCheck(name: string, command: string, repo: string): Finding[] {
  const res = run(command, { cwd: repo, timeoutMs: 600_000 })
  console.log(res.output)
  const level = res.exitCode === 0 ? 'pass' : res.exitCode === EXIT.flaky ? 'flaky' : 'error'
  return [{ level, claim: name, detail: '`' + command + '` exited ' + res.exitCode }]
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const here = fileURLToPath(new URL('.', import.meta.url))
  const repo = typeof args.repo === 'string' ? args.repo : join(here, '..')
  const only = typeof args.only === 'string' ? args.only : undefined
  const fast = args.fast === true
  const enforce = args.enforce === true
  const decisions = typeof args.decisions === 'string' ? args.decisions : undefined

  const findings: Finding[] = []
  if (!only || only === 'fingerprint') findings.push(...runCheck('engine fingerprints', 'pnpm fingerprint', repo))
  if (!only || only === 'docs') {
    findings.push(...runCheck('README claims', 'pnpm check:docs' + (fast ? ' --skip test,build' : ''), repo))
  }
  if (!only || only === 'reachability') findings.push(...checkReachability(repo, decisions))
  if (!only || only === 'exceptions') findings.push(...checkExceptions(repo))

  const newMisses = recordNewMisses(repo, join(repo, 'journal.jsonl'))
  if (newMisses.length > 0) {
    findings.push({
      level: 'warning',
      claim: newMisses.length + ' new miss(es) recorded from commit trailers',
      detail: newMisses.map((m) => m.commit.slice(0, 10) + ' missed by ' + m.check).join('; '),
    })
  }

  report('Governance (' + (enforce ? 'enforcing' : 'warn-only') + ')', findings)

  if (args.json !== false && args['no-json'] !== true) {
    console.log(JSON_BEGIN)
    console.log(
      JSON.stringify({
        schema: 2,
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
  const flaky = !failed && findings.some((f) => f.level === 'flaky')
  process.exit(enforce && failed ? EXIT.failed : flaky ? EXIT.flaky : EXIT.ok)
}

if (process.argv[1]?.includes('governance')) main()
