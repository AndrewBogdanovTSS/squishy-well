/**
 * `pnpm check:receipt <review.md>` - was this review written against this repo?
 *
 * The claim it makes falsifiable: **"I read the code."**
 *
 * A review states, in a fixed block at the top, where it read from: the commit,
 * the baseline it diffed against, how many files the diff touched, how many it
 * opened, and one file quoted verbatim as proof it was really opened. Every
 * field is a literal value a reader can re-derive by running the same command.
 *
 * The check that matters most is the baseline. `git diff base...head` is only
 * as honest as `base`, and a local branch reference goes stale silently: it
 * still looks like a mainline, the diff still reconciles with itself, and the
 * review simply describes a much larger change than the one under review. It
 * fails in the reassuring direction, because the diff comes out *bigger*, so
 * nothing looks missing.
 *
 * So the baseline is checked by **equality** against `merge-base origin/<target>
 * <head>`, never by ancestry: a stale local tip is still an ancestor of the
 * mainline, so an ancestry check waves it straight through.
 *
 * Exit codes: 0 receipt holds - 1 at least one error - 2 bad usage.
 */
import { existsSync, readFileSync } from 'node:fs'
import { EXIT, exitCodeFor, parseArgs, report, usage } from './lib/cli'
import type { Finding } from './lib/cli'
import { capture } from './lib/proc'

const HELP = `
pnpm check:receipt <review.md> [--repo <path>] [--sha <expected-head>] [--strict]

Checks the Access Receipt at the top of a review against the repository.

  --repo    repository to check against (default: current directory)
  --sha     the head commit the review is supposed to be about; pass it whenever
            something other than the review itself knows the answer
  --strict  treat warnings and unverifiable results as failures

exit 0 = the receipt holds, 1 = it does not, 2 = bad usage
`

export interface Receipt {
  branch?: string
  headSha?: string
  targetBranch?: string
  baseSha?: string
  filesInDiff?: number
  filesOpened?: number
  samplePath?: string
  sampleLine?: string
}

/** Reads `**Field**: value` pairs out of the receipt block. */
export function parseReceipt(markdown: string): Receipt {
  const field = (name: string): string | undefined => {
    const re = new RegExp('^\\s*\\*\\*' + name + '\\*\\*:\\s*(.+)$', 'im')
    return re.exec(markdown)?.[1]?.trim().replace(/^`|`$/g, '')
  }
  const sample = /^\s*\*\*Sample integrity\*\*:\s*`([^`]+)`\s*->\s*`(.*)`\s*$/im.exec(markdown)
  const num = (name: string): number | undefined => {
    const raw = field(name)
    return raw === undefined ? undefined : Number(raw.replace(/[^\d]/g, ''))
  }
  return {
    branch: field('Branch'),
    headSha: field('HEAD SHA'),
    targetBranch: field('Target branch'),
    baseSha: field('Base SHA'),
    filesInDiff: num('Files in diff'),
    filesOpened: num('Files opened during review'),
    samplePath: sample?.[1],
    sampleLine: sample?.[2],
  }
}

const SHA_RE = /^[0-9a-f]{40}$/

export function checkReceipt(
  receipt: Receipt,
  markdown: string,
  repo: string,
  expectedSha?: string,
): Finding[] {
  const findings: Finding[] = []

  // 1. Completeness. A missing field is not a small problem: the whole point of
  //    the receipt is that a reader can re-derive every value.
  const required: [keyof Receipt, string][] = [
    ['branch', 'Branch'],
    ['headSha', 'HEAD SHA'],
    ['targetBranch', 'Target branch'],
    ['baseSha', 'Base SHA'],
    ['filesInDiff', 'Files in diff'],
    ['filesOpened', 'Files opened during review'],
    ['samplePath', 'Sample integrity'],
  ]
  for (const [key, label] of required) {
    if (receipt[key] === undefined || receipt[key] === '') {
      findings.push({ level: 'error', claim: 'receipt records ' + label, detail: 'field missing or unparseable' })
    }
  }
  if (!receipt.headSha || !SHA_RE.test(receipt.headSha)) {
    findings.push({ level: 'error', claim: 'HEAD SHA is a full 40-character commit id', detail: String(receipt.headSha) })
    return findings
  }

  // 2. The commit exists here. Cheap proof the reviewer had a real clone.
  //    `git cat-file -t` rather than the more idiomatic `<sha>^{commit}`: on
  //    Windows the shell eats the caret, and the check then fails for everyone
  //    on that platform for a reason that has nothing to do with the review.
  const headExists = capture('git cat-file -t ' + receipt.headSha, repo) === 'commit'
  findings.push({
    level: headExists ? 'pass' : 'error',
    claim: 'HEAD SHA ' + receipt.headSha.slice(0, 10) + ' exists in this repository',
    detail: headExists ? 'found' : 'unknown commit - the review was not written against this repo',
  })

  // 3. It is the commit somebody else expected, when somebody else knows.
  if (expectedSha) {
    findings.push({
      level: receipt.headSha === expectedSha ? 'pass' : 'error',
      claim: 'the review is about the expected commit',
      detail: receipt.headSha === expectedSha ? 'matches --sha' : 'receipt says ' + receipt.headSha + ', expected ' + expectedSha,
    })
  }

  findings.push(...checkBase(receipt, repo))
  findings.push(...checkSample(receipt, repo))
  findings.push(...checkCitations(markdown, receipt.headSha, repo))

  // 6. Coverage. Not an error - a reviewer may legitimately skip generated
  //    files - but an unexplained gap is worth saying out loud.
  if (receipt.filesInDiff !== undefined && receipt.filesOpened !== undefined) {
    const ok = receipt.filesOpened >= receipt.filesInDiff
    findings.push({
      level: ok ? 'pass' : 'warning',
      claim: 'every file in the diff was opened',
      detail: receipt.filesOpened + ' opened of ' + receipt.filesInDiff + ' in the diff',
    })
  }

  return findings
}

/** The baseline check. Equality, not ancestry - see the file header. */
export function checkBase(receipt: Receipt, repo: string): Finding[] {
  const claim = 'Base SHA is the merge-base with origin/' + (receipt.targetBranch ?? '?')
  if (!receipt.baseSha || !SHA_RE.test(receipt.baseSha) || !receipt.targetBranch) {
    return [{ level: 'error', claim, detail: 'base SHA or target branch missing' }]
  }

  const remoteRef = 'refs/remotes/origin/' + receipt.targetBranch
  if (!capture('git rev-parse --verify --quiet ' + remoteRef, repo)) {
    return [
      {
        level: 'unverifiable',
        claim,
        detail: 'no ' + remoteRef + ' in this clone - fetch it, or accept that this cannot be checked here',
      },
    ]
  }

  const mergeBase = capture('git merge-base origin/' + receipt.targetBranch + ' ' + receipt.headSha, repo)
  if (!mergeBase) {
    return [{ level: 'unverifiable', claim, detail: 'no merge-base found (shallow clone, or unrelated histories)' }]
  }
  if (mergeBase === receipt.baseSha) {
    return [{ level: 'pass', claim, detail: mergeBase.slice(0, 10) }]
  }

  // The interesting failure: the recorded base is the tip of a *local* branch of
  // the same name that has fallen behind. This is the 20x case - and an ancestry
  // check would have passed it, because a stale tip is still an ancestor.
  const localTip = capture('git rev-parse --verify --quiet refs/heads/' + receipt.targetBranch, repo)
  let detail = 'receipt says ' + receipt.baseSha.slice(0, 10) + ', merge-base is ' + mergeBase.slice(0, 10)
  if (localTip === receipt.baseSha) {
    const behind = capture(
      'git rev-list --count ' + receipt.baseSha + '..origin/' + receipt.targetBranch,
      repo,
    )
    detail =
      'the base is the tip of the LOCAL branch ' +
      receipt.targetBranch +
      ', which is ' +
      (behind ?? '?') +
      (behind === '1' ? ' commit behind origin/' : ' commits behind origin/') +
      receipt.targetBranch +
      '. Every one of those commits is being attributed to the branch under review.'
  }
  return [{ level: 'error', claim, detail }]
}

/** The cheapest possible proof that a file was actually opened. */
export function checkSample(receipt: Receipt, repo: string): Finding[] {
  const claim = 'the sampled file was really read'
  if (!receipt.samplePath || receipt.sampleLine === undefined) {
    return [{ level: 'error', claim, detail: 'no sample integrity line in the receipt' }]
  }
  const content = capture('git show ' + receipt.headSha + ':' + receipt.samplePath, repo)
  if (content === null) {
    return [{ level: 'error', claim, detail: receipt.samplePath + ' does not exist at that commit' }]
  }
  const firstLine = content.split('\n').find((l) => l.trim() !== '')?.trim() ?? ''
  const quoted = receipt.sampleLine.trim()
  return [
    {
      level: firstLine === quoted ? 'pass' : 'error',
      claim: claim,
      detail:
        firstLine === quoted
          ? receipt.samplePath + ' line 1 matches verbatim'
          : 'quoted "' + quoted + '"\n        actual "' + firstLine + '"',
      file: receipt.samplePath,
    },
  ]
}

/**
 * Every `path:line` citation in the review resolves at the reviewed commit.
 *
 * Citations are written in backticks so this can find them without guessing at
 * prose. A citation that does not resolve is the signature of a review that was
 * assembled rather than read.
 */
export function checkCitations(markdown: string, headSha: string, repo: string): Finding[] {
  const seen = new Set<string>()
  const findings: Finding[] = []
  const re = /`([\w./@-]+\.[a-z]+):(\d+)`/g
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown)) !== null) {
    const [, path, lineNo] = match
    const key = path + ':' + lineNo
    if (seen.has(key)) continue
    seen.add(key)

    const content = capture('git show ' + headSha + ':' + path, repo)
    if (content === null) {
      findings.push({ level: 'error', claim: 'citation ' + key, detail: 'no such file at the reviewed commit' })
      continue
    }
    const total = content.split('\n').length
    const line = Number(lineNo)
    findings.push({
      level: line >= 1 && line <= total ? 'pass' : 'error',
      claim: 'citation ' + key,
      detail: line <= total ? 'resolves (' + total + ' lines)' : 'file has only ' + total + ' lines',
    })
  }
  if (findings.length === 0) {
    findings.push({
      level: 'warning',
      claim: 'the review cites specific lines',
      detail: 'no `path:line` citations found - findings without locations cannot be checked',
    })
  }
  return findings
}

function main(): void {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) usage(HELP)

  const path = (args._ as string[])[0] ?? (typeof args.path === 'string' ? args.path : undefined)
  if (!path) usage(HELP)
  if (!existsSync(path)) {
    console.error('no such review file: ' + path)
    process.exit(EXIT.usage)
  }

  const repo = typeof args.repo === 'string' ? args.repo : process.cwd()
  const markdown = readFileSync(path, 'utf8')
  const findings = checkReceipt(
    parseReceipt(markdown),
    markdown,
    repo,
    typeof args.sha === 'string' ? args.sha : undefined,
  )

  report('Access receipt in ' + path, findings)
  process.exit(exitCodeFor(findings, args.strict === true))
}

if (process.argv[1]?.includes('check-receipt')) main()
