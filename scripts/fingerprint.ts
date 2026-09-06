/**
 * `pnpm fingerprint` - did the engine's behaviour change?
 *
 * The claim it makes falsifiable: **"the refactor is behaviour-preserving."**
 *
 * That sentence appears in pull requests every day and almost nothing is ever
 * offered to back it, because backing it by hand is tedious. Here it is one
 * command: replay three recorded games through the current engine and compare
 * the resulting fingerprint against the one recorded in each fixture.
 *
 * Same fingerprints - the claim survived a test it could have failed.
 * Different  - paste the difference into the review, or regenerate the fixtures
 *              on purpose with `pnpm --filter @tetris/core fixtures`.
 *
 * The fingerprint is `boardHash:score:lines:level:pieces:phase`, so a mismatch
 * also tells you roughly what moved.
 *
 * Deliberately never routed through the journal's flaky policy (see
 * `evidence-layer`'s `applyFlakyPolicy`, used by `check-docs.ts`): a fingerprint
 * mismatch with unchanged engine source is not noise to be smoothed over, it is
 * a determinism bug in the engine itself - a more serious finding than an
 * ordinary failure, not a lesser one. Determinism is a property this project
 * declares about itself in its own README; treating its violation as flaky
 * would be exactly the kind of leniency this layer's own cost rule forbids -
 * see `docs/decisions/0002-evidence-layer-v2.md`.
 *
 * Exit codes: 0 all fixtures match - 1 at least one moved - 2 bad usage.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { playReplay } from '../packages/tetris-core/src/replay'
import type { Replay } from '../packages/tetris-core/src/replay'
import { EXIT, exitCodeFor, parseArgs, report, usage } from 'evidence-layer'
import type { Finding } from 'evidence-layer'

const HELP = `
pnpm fingerprint [--dir <fixtures dir>] [--strict]

Replays every recorded fixture through the current engine and compares the
result to the fingerprint stored in the fixture.

  --dir      fixtures directory (default packages/tetris-core/test/fixtures)
  --strict   treat warnings as failures

exit 0 = every fixture matches, 1 = at least one moved, 2 = bad usage
`

export function checkFixtures(dir: string): Finding[] {
  const files = readdirSync(dir).filter((f) => f.endsWith('.replay.json')).sort()
  if (files.length === 0) {
    return [
      {
        level: 'unverifiable',
        claim: 'engine behaviour is unchanged',
        detail: 'no replay fixtures found in ' + dir + ' - nothing to compare against',
      },
    ]
  }

  return files.map((file): Finding => {
    const replay = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Replay
    const claim = file + ' replays to its recorded fingerprint'

    // A fixture with no fingerprint cannot fail, so it cannot pass either.
    if (!replay.fingerprint) {
      return {
        level: 'unverifiable',
        claim,
        detail: 'the fixture records no fingerprint, so replaying it proves nothing',
        file: join(dir, file),
      }
    }

    const actual = playReplay(replay).fingerprint
    if (actual === replay.fingerprint) {
      return { level: 'pass', claim, detail: actual, file: join(dir, file) }
    }
    return {
      level: 'error',
      claim,
      detail: 'recorded ' + replay.fingerprint + '\n        replayed ' + actual + ' - engine determinism bug, not noise',
      file: join(dir, file),
    }
  })
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const here = fileURLToPath(new URL('.', import.meta.url))
  const dir =
    typeof args.dir === 'string'
      ? args.dir
      : join(here, '..', 'packages', 'tetris-core', 'test', 'fixtures')

  let findings: Finding[]
  try {
    findings = checkFixtures(dir)
  } catch (err) {
    console.error('could not read fixtures from ' + dir + ': ' + (err as Error).message)
    process.exit(EXIT.usage)
  }

  report('Engine fingerprints', findings)
  if (findings.some((f) => f.level === 'error')) {
    console.log('A fingerprint moved. Either the change was not behaviour-preserving,')
    console.log('or it was meant to be - in which case regenerate deliberately:')
    console.log('  pnpm --filter @tetris/core fixtures\n')
  }
  process.exit(exitCodeFor(findings, args.strict === true))
}

if (import.meta.url.startsWith('file:') && process.argv[1]?.includes('fingerprint')) main()
