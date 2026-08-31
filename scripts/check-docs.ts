/**
 * `pnpm check:docs` - does the README still tell the truth?
 *
 * The claim it makes falsifiable: every number in the README.
 *
 * A README is a pile of assertions about a repository, written once and then
 * trusted forever. "71 tests" was true the day it was typed. Nothing tells you
 * the day it stops being true - not the linter, not the type checker, not CI.
 * That is not dishonesty on anyone's part. It is a claim nobody could check
 * without doing the work by hand, so nobody did.
 *
 * This script does the work. It is the smallest possible version of the whole
 * idea: a claim, a command, an exit code. No AI anywhere in the story.
 *
 * Exit codes: 0 every checkable claim holds - 1 at least one is wrong - 2 bad usage.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXIT, exitCodeFor, parseArgs, report, usage } from './lib/cli'
import type { Finding } from './lib/cli'
import { run } from './lib/proc'

const HELP = `
pnpm check:docs [--repo <path>] [--skip test] [--strict]

Checks the numeric and structural claims the README makes about this repository.

  --repo    repository root (default: the repo this script lives in)
  --skip    comma-separated checks to skip: test, fixtures, routes, pins, build
  --strict  treat warnings and unverifiable results as failures

exit 0 = every checkable claim holds, 1 = at least one is wrong, 2 = bad usage
`

/** README text with line breaks flattened, so a claim may span two lines. */
function flatten(text: string): string {
  return text.replace(/\s+/g, ' ')
}

/** 1-based line number of the first line matching a pattern. */
function lineOf(lines: string[], re: RegExp): number | undefined {
  const i = lines.findIndex((l) => re.test(l))
  return i === -1 ? undefined : i + 1
}

/**
 * "71 tests" and "71/71 green" - the headline claim, and the only slow check.
 * It has to run the suite, because counting `it(` calls statically gets the
 * wrong answer: two of these files use `it.each`, which expands at runtime.
 */
export function checkTestCount(repo: string, readme: string, lines: string[]): Finding[] {
  const claimed = /(\d+) tests:/.exec(flatten(readme))
  const green = /(\d+)\/(\d+) green/.exec(flatten(readme))
  if (!claimed && !green) {
    return [{ level: 'warning', claim: 'README states a test count', detail: 'no test-count claim found to check' }]
  }

  const res = run('pnpm test', { cwd: repo, timeoutMs: 300_000 })
  const total = /Tests\s+(\d+) passed \((\d+)\)/.exec(res.output)
  if (!total) {
    return [
      {
        level: 'unverifiable',
        claim: 'README says the suite has ' + (claimed?.[1] ?? green?.[1]) + ' tests',
        detail: 'could not parse a total out of the test reporter (exit ' + res.exitCode + ')',
        file: 'README.md',
      },
    ]
  }

  const actual = Number(total[2])
  const findings: Finding[] = []
  if (claimed) {
    const n = Number(claimed[1])
    findings.push({
      level: n === actual ? 'pass' : 'error',
      claim: 'README says the suite has ' + n + ' tests',
      detail: n === actual ? 'the suite reports ' + actual : 'the suite reports ' + actual,
      file: 'README.md',
      line: lineOf(lines, /(\d+) tests:/),
    })
  }
  if (green) {
    const n = Number(green[2])
    findings.push({
      level: n === actual && res.exitCode === 0 ? 'pass' : 'error',
      claim: 'README says ' + green[0],
      detail: 'the suite reports ' + actual + ' passing, exit ' + res.exitCode,
      file: 'README.md',
      line: lineOf(lines, /\d+\/\d+ green/),
    })
  }
  return findings
}

/**
 * "474 pieces, 178 lines, level 18" - free to check, because the fixture's own
 * fingerprint already records exactly those numbers.
 */
export function checkFixtureNumbers(repo: string, readme: string, lines: string[]): Finding[] {
  const path = join(repo, 'packages/tetris-core/test/fixtures/bot-game.replay.json')
  const claim = /(\d+) pieces, (\d+) lines, level (\d+)/.exec(flatten(readme))
  if (!claim) {
    return [{ level: 'warning', claim: 'README describes the bot-game fixture', detail: 'no claim found to check' }]
  }
  if (!existsSync(path)) {
    return [
      {
        level: 'unverifiable',
        claim: 'README says the bot game is ' + claim[0],
        detail: 'the fixture is missing: ' + path,
      },
    ]
  }

  const fixture = JSON.parse(readFileSync(path, 'utf8')) as { fingerprint?: string }
  // fingerprint = boardHash:score:lines:level:pieces:phase
  const parts = (fixture.fingerprint ?? '').split(':')
  if (parts.length !== 6) {
    return [
      {
        level: 'unverifiable',
        claim: 'README says the bot game is ' + claim[0],
        detail: 'the fixture records no parseable fingerprint',
        file: 'packages/tetris-core/test/fixtures/bot-game.replay.json',
      },
    ]
  }

  const actual = { lines: parts[2], level: parts[3], pieces: parts[4] }
  const ok = claim[1] === actual.pieces && claim[2] === actual.lines && claim[3] === actual.level
  return [
    {
      level: ok ? 'pass' : 'error',
      claim: 'README says the bot game is ' + claim[0],
      detail:
        'the fixture fingerprint says ' +
        actual.pieces +
        ' pieces, ' +
        actual.lines +
        ' lines, level ' +
        actual.level,
      file: 'README.md',
      line: lineOf(lines, /pieces, \d+ lines/),
    },
  ]
}

/** Every route the README advertises has a page file behind it. */
export function checkRoutes(repo: string, readme: string): Finding[] {
  const pages: Record<string, string> = {
    '/': 'apps/web/app/pages/index.vue',
    '/play': 'apps/web/app/pages/play.vue',
    '/debug': 'apps/web/app/pages/debug.vue',
  }
  return Object.entries(pages)
    .filter(([route]) => readme.includes('`' + route + '`'))
    .map(([route, file]): Finding => ({
      level: existsSync(join(repo, file)) ? 'pass' : 'error',
      claim: 'README advertises the route ' + route,
      detail: existsSync(join(repo, file)) ? 'served by ' + file : 'no page file at ' + file,
      file: 'README.md',
    }))
}

/** "pinned to exact versions on purpose" - so none of the four may carry a range. */
export function checkPinnedVersions(repo: string, readme: string): Finding[] {
  const named = ['three', '@types/three', '@tresjs/core', '@tresjs/nuxt']
  if (!/pinned to exact/.test(flatten(readme))) return []

  const pkgPath = join(repo, 'apps/web/package.json')
  if (!existsSync(pkgPath)) {
    return [{ level: 'unverifiable', claim: 'README says four packages are pinned', detail: 'no apps/web/package.json' }]
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const all = { ...pkg.dependencies, ...pkg.devDependencies }

  return named.map((name): Finding => {
    const version = all[name]
    if (!version) {
      return { level: 'error', claim: 'README says ' + name + ' is pinned', detail: 'not a dependency of apps/web' }
    }
    const pinned = /^\d/.test(version)
    return {
      level: pinned ? 'pass' : 'error',
      claim: 'README says ' + name + ' is pinned to an exact version',
      detail: 'apps/web/package.json says "' + version + '"',
      file: 'apps/web/package.json',
    }
  })
}

/**
 * "2.25 MB total" - checkable only after a build.
 *
 * This is the important row. Without `.output` on disk the honest answer is
 * "cannot tell", and that is reported as its own outcome rather than quietly
 * counted as a pass. Three outcomes, never two.
 */
export function checkBuildSize(repo: string, readme: string): Finding[] {
  const claim = /([\d.]+) MB total/.exec(flatten(readme))
  if (!claim) return []

  const outDir = join(repo, 'apps/web/.output')
  if (!existsSync(outDir)) {
    return [
      {
        level: 'unverifiable',
        claim: 'README says the build is ' + claim[1] + ' MB total',
        detail: 'no build output on disk - run `pnpm build`, then check again',
        file: 'README.md',
      },
    ]
  }

  const du = run('node -e "const{statSync,readdirSync}=require(\'fs\');const{join}=require(\'path\');const w=d=>readdirSync(d,{withFileTypes:true}).reduce((n,e)=>n+(e.isDirectory()?w(join(d,e.name)):statSync(join(d,e.name)).size),0);console.log(w(process.argv[1]))"' + ' "' + outDir + '"', { cwd: repo, timeoutMs: 60_000 })
  const bytes = Number(du.output.trim())
  if (!Number.isFinite(bytes) || bytes === 0) {
    return [
      {
        level: 'unverifiable',
        claim: 'README says the build is ' + claim[1] + ' MB total',
        detail: 'could not measure ' + outDir,
      },
    ]
  }
  const mb = bytes / 1024 / 1024
  const claimed = Number(claim[1])
  // A size claim is a budget, not a constant. Within 15% is the claim holding.
  const ok = Math.abs(mb - claimed) / claimed <= 0.15
  return [
    {
      level: ok ? 'pass' : 'error',
      claim: 'README says the build is ' + claimed + ' MB total',
      detail: 'measured ' + mb.toFixed(2) + ' MB in apps/web/.output',
      file: 'README.md',
    },
  ]
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const here = fileURLToPath(new URL('.', import.meta.url))
  const repo = typeof args.repo === 'string' ? args.repo : join(here, '..')
  const skip = typeof args.skip === 'string' ? args.skip.split(',').map((s) => s.trim()) : []

  const readmePath = join(repo, 'README.md')
  if (!existsSync(readmePath)) {
    console.error('no README.md at ' + readmePath)
    process.exit(EXIT.usage)
  }
  const readme = readFileSync(readmePath, 'utf8')
  const lines = readme.split(/\r?\n/)

  const findings: Finding[] = []
  if (!skip.includes('fixtures')) findings.push(...checkFixtureNumbers(repo, readme, lines))
  if (!skip.includes('routes')) findings.push(...checkRoutes(repo, readme))
  if (!skip.includes('pins')) findings.push(...checkPinnedVersions(repo, readme))
  if (!skip.includes('build')) findings.push(...checkBuildSize(repo, readme))
  if (!skip.includes('test')) findings.push(...checkTestCount(repo, readme, lines))

  report('README claims', findings)
  process.exit(exitCodeFor(findings, args.strict === true))
}

if (process.argv[1]?.includes('check-docs')) main()
