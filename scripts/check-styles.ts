/**
 * `pnpm check:styles` - do component templates use the design-system tokens
 * instead of writing the same font-size, tracking or color value in brackets
 * over and over?
 *
 * The claim it makes falsifiable: docs/design-system.md's Tier 1 rule - font
 * sizes and letter-spacing come from `uno.config.ts`'s `theme`, colors come
 * from a `$name` custom property in app.css (or an `rgb(var(--x-rgb)/N%)`
 * alpha variant of one) - actually holds, not just on the day it was written
 * but on every commit after.
 *
 * Deliberately narrow: only the three patterns that already have a place to
 * go are checked. A `grid-cols-[1fr_auto]` or a `clamp()` hero size has no
 * token to reach for and is not flagged - a check that nags about every
 * bracket regardless of whether there is an honest alternative teaches people
 * to stop reading its output, which is the opposite of the point.
 *
 * Exit codes: 0 no violations - 1 at least one - 2 bad usage.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exitCodeFor, parseArgs, report, usage } from 'evidence-layer'
import type { Finding } from 'evidence-layer'

const HELP = `
pnpm check:styles [--repo <path>]

Scans apps/web/app/**/*.vue template blocks for arbitrary-value utilities that
docs/design-system.md says should be a theme token or a $name color instead.

  --repo    repository root (default: the repo this script lives in)

exit 0 = no violations, 1 = at least one, 2 = bad usage
`

const SCAN_ROOT = 'apps/web/app'

interface Rule {
  name: string
  re: RegExp
  fix: string
}

const RULES: Rule[] = [
  {
    name: 'arbitrary font-size',
    re: /\btext-\[[^\]]+\]/g,
    fix: 'use a uno.config.ts theme.fontSize token (micro/label/body/lead/stat/display) or a built-in like text-base',
  },
  {
    name: 'arbitrary letter-spacing',
    re: /\btracking-\[[^\]]+\]/g,
    fix: 'use a uno.config.ts theme.letterSpacing token (tight/wide/wider/caps/title/hero)',
  },
  {
    name: 'raw color literal in a bracket',
    // A hex code, or rgb()/rgba() whose first argument is a literal channel
    // rather than var(...) - rgb(var(--accent-rgb)/8%) is exactly what this
    // must not flag, since that is the sanctioned single-source form.
    re: /\[[^\]]*(?:#(?:[0-9a-fA-F]{3}){1,2}\b|rgba?\(\s*\d)[^\]]*\]/g,
    fix: "source the color from app.css's :root custom properties ($name, or rgb(var(--x-rgb)/N%) for an alpha variant)",
  },
]

/** The text between <template> and </template> - violations elsewhere in the file (script, comments) are not this check's concern. */
function templateBlock(source: string): string {
  const start = source.indexOf('<template>')
  const end = source.lastIndexOf('</template>')
  if (start === -1 || end === -1 || end <= start) return ''
  return source.slice(start, end)
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length
}

function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.vue')) out.push(full)
  }
  return out
}

export function checkStyles(repo: string): Finding[] {
  const root = join(repo, SCAN_ROOT)
  const files = walk(root, [])
  const findings: Finding[] = []

  for (const file of files) {
    const source = readFileSync(file, 'utf8')
    const block = templateBlock(source)
    if (!block) continue
    const offset = source.indexOf(block)
    const relPath = relative(repo, file).replace(/\\/g, '/')

    for (const rule of RULES) {
      rule.re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = rule.re.exec(block))) {
        findings.push({
          level: 'error',
          claim: relPath + ' uses ' + rule.name + ': `' + m[0] + '`',
          detail: rule.fix,
          file: relPath,
          line: lineOf(source, offset + m.index),
        })
      }
    }
  }

  if (findings.length === 0) {
    return [
      {
        level: 'pass',
        claim: SCAN_ROOT + '/**/*.vue has no arbitrary text-size, tracking or raw-color utilities',
        detail: files.length + ' files scanned',
      },
    ]
  }
  return findings
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const here = fileURLToPath(new URL('.', import.meta.url))
  const repo = typeof args.repo === 'string' ? args.repo : join(here, '..')

  const findings = checkStyles(repo)
  report('Design-system tokens', findings)
  process.exit(exitCodeFor(findings))
}

if (process.argv[1]?.includes('check-styles')) main()
