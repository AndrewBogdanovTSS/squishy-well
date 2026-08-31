/**
 * `pnpm ci:summary <captured-output-file>` - render the governance report for CI.
 *
 * The claim it makes falsifiable: **"the checks ran."**
 *
 * `pnpm check:all` prints a delimited JSON block on every run, including a clean
 * one. This is the consumer that block exists for. It turns the report into the
 * markdown GitHub renders at the top of a workflow run, so the result is visible
 * without opening a log.
 *
 * The important branch is the last one. If the delimited block is absent, this
 * does not shrug and print nothing - it says so, loudly, because an absent
 * report is the only signal anyone has for "never ran", and telling that apart
 * from "checked, found nothing" is the whole discipline.
 *
 * Exit codes: 0 always. This renders a report; it does not decide anything.
 */
import { readFileSync } from 'node:fs'
import { EXIT, parseArgs, usage } from './lib/cli'

const HELP = `
pnpm ci:summary <file>

Reads captured \`pnpm check:all\` output and writes a markdown summary to stdout.

  <file>   a file containing the output of \`pnpm check:all\`

exit 0 always - this renders a report, it does not decide anything
`

const BEGIN = '---GOVERNANCE-JSON-BEGIN---'
const END = '---GOVERNANCE-JSON-END---'

export interface Report {
  schema: number
  mode: string
  generatedAt: string
  summary: string
  findings: { level: string; claim: string; detail: string; file?: string }[]
}

/** Pulls the machine-readable block out of a pile of console output. */
export function extractReport(output: string): Report | null {
  const start = output.indexOf(BEGIN)
  const end = output.indexOf(END)
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(output.slice(start + BEGIN.length, end).trim()) as Report
  } catch {
    return null
  }
}

const ICON: Record<string, string> = {
  pass: '✅',
  warning: '⚠️',
  error: '❌',
  unverifiable: '❓',
}

export function renderSummary(report: Report | null, mode: string): string {
  if (!report) {
    // Not a formatting problem. The check did not report, which is a finding.
    return [
      '## ❌ Governance: no report',
      '',
      'The run produced no machine-readable report block.',
      '',
      'That is not the same as a clean run. A clean run still prints its report -',
      'that is the entire reason the block is emitted unconditionally. An absent',
      'report means the checks **did not run**, and nothing here can tell you what',
      'the repository looks like.',
      '',
    ].join('\n')
  }

  const errors = report.findings.filter((f) => f.level === 'error').length
  const warnings = report.findings.filter((f) => f.level === 'warning').length
  const unknown = report.findings.filter((f) => f.level === 'unverifiable').length

  const verdict =
    errors > 0
      ? mode === 'enforce'
        ? '❌ Governance: ' + errors + ' failing'
        : '⚠️ Governance: ' + errors + ' would fail once enforcement is on'
      : '✅ Governance: clean'

  const lines = [
    '## ' + verdict,
    '',
    '`' + report.summary + '` &middot; mode `' + report.mode + '` &middot; ' + report.generatedAt,
    '',
    '| | Claim | Detail | Where |',
    '|---|---|---|---|',
  ]

  for (const f of report.findings) {
    const where = f.file ? '`' + f.file + '`' : ''
    const detail = f.detail.replace(/\r?\n\s*/g, ' &middot; ').replace(/\|/g, '\\|')
    lines.push(
      '| ' + (ICON[f.level] ?? f.level) + ' | ' + f.claim.replace(/\|/g, '\\|') + ' | ' + detail + ' | ' + where + ' |',
    )
  }

  lines.push('')
  if (errors === 0 && warnings === 0 && unknown === 0) {
    lines.push('Every invariant that claims enforcement is reachable from a wired trigger.')
  }
  if (mode !== 'enforce' && errors > 0) {
    lines.push(
      'Warn-only: the build stays green. Enforcement is one flag - add `--enforce` to the',
      'governance step and delete its `continue-on-error`.',
    )
  }
  lines.push('')
  return lines.join('\n')
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const path = (args._ as string[])[0]
  if (!path) usage(HELP)

  let output = ''
  try {
    output = readFileSync(path, 'utf8')
  } catch {
    // Even a missing capture file gets a real answer rather than silence.
    process.stdout.write(renderSummary(null, 'warn'))
    process.exit(EXIT.ok)
  }

  const report = extractReport(output)
  process.stdout.write(renderSummary(report, report?.mode ?? 'warn'))
  process.exit(EXIT.ok)
}

if (process.argv[1]?.includes('ci-summary')) main()
