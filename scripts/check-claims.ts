/**
 * `pnpm check:claims <review.md>` - is every claim in this review backed?
 *
 * The claim it makes falsifiable: the grounding tags themselves.
 *
 * A review can label each of its claims VERIFIED, DOCUMENTED, INFERRED or
 * UNVERIFIED. That convention is worth nothing on its own, because a tag costs
 * one token to write and nothing checks it. Anything a writer can satisfy for
 * free carries no information.
 *
 * So this script checks the tags. VERIFIED must sit next to a real artifact
 * block. DOCUMENTED must cite something. INFERRED must show its reasoning.
 * Language that cannot be wrong - "more robust", "behaves identically",
 * "it works" - has to be marked UNVERIFIED or backed by a stated effect.
 *
 * An honest UNVERIFIED is worth more than a decorative VERIFIED: it tells the
 * reader exactly where the review is thin.
 *
 * Exit codes: 0 clean - 1 at least one error - 2 bad usage.
 */
import { existsSync, readFileSync } from 'node:fs'
import { EXIT, exitCodeFor, parseArgs, report, usage } from './lib/cli'
import type { Finding } from './lib/cli'
import { fencedLineNumbers, findArtifactBlocks } from './lib/artifact'

const HELP = `
pnpm check:claims <review.md> [--strict]

Lints a review for grounding tags and their required backing.

  --strict  treat warnings as failures

exit 0 = every claim is backed, 1 = at least one is not, 2 = bad usage
`

/** How far below a VERIFIED tag its artifact block is allowed to sit. */
export const ARTIFACT_WINDOW = 15

export const GRADES = ['VERIFIED', 'DOCUMENTED', 'INFERRED', 'UNVERIFIED'] as const
export type Grade = (typeof GRADES)[number]

const CLAIM_RE = /^\s*\*\*Claim\*\*:/
// Built from GRADES so the list of grades exists in exactly one place.
const GRADE_RE = new RegExp('\\b(' + GRADES.join('|') + ')\\b')
// A citation is anything a reader can go and open: a URL, a spec section, an
// issue id, or a file in this repository. The last form matters here - a project
// without an issue tracker still has documents, and refusing to accept them
// would push writers towards the vaguer tag rather than the truer one.
const CITATION_RE = /(https?:\/\/\S+|§\s*\S+|#\d+|\b[A-Z][A-Z0-9]+-\d+\b|`[\w./@-]+\.[a-z]+`)/
const NUMBERED_STEP_RE = /^\s*\d+\.\s+\S/

// Language that survives every outcome. Not banned because it is rude - banned
// because nothing could contradict it, which makes it decoration wearing the
// costume of a finding.
const VAGUE_COMPARATIVE_RE = /\bmore (?:resilient|robust|safe|explicit|performant|idiomatic)\b|\bcleaner\b/i
// Narrow on purpose. An earlier version of this matched a bare "is the same",
// which fires on ordinary English ("the same review, repaired") and teaches
// people to stop reading the output. Precision is the feature, not the polish.
const UNCHECKED_EQUIVALENCE_RE =
  /\b(?:should (?:be|compile|behave)|behaves?|compiles? to|(?:is|are) functionally) (?:equivalent|identical|the same)\b/i
const SUCCESS_WORD_RE = /\b(?:works|fixed|resolved|passes|tested|validated)\b/i
// Modals and negations turn an assertion into a question, a hypothetical, or a
// statement about what is possible. None of those is a success claim.
const HYPOTHETICAL_RE = /\b(?:might|could|would|may|can|cannot|can't|if|whether|until)\b/i
const EFFECT_RE = /\*\*Effect\*\*:/
const SYCOPHANCY_RES = [
  /you'?re (?:probably )?right/i,
  /i was overthinking/i,
  /but i could be wrong/i,
  /good catch/i,
]

interface Claim {
  /** 0-based line of the `**Claim**:` line. */
  line: number
  text: string
  grade?: Grade
  /** 0-based line the grade was found on. */
  gradeLine?: number
}

export function findClaims(lines: string[], fenced: Set<number>): Claim[] {
  const claims: Claim[] = []
  for (let i = 0; i < lines.length; i++) {
    if (fenced.has(i) || !CLAIM_RE.test(lines[i]!)) continue
    const claim: Claim = { line: i, text: lines[i]!.replace(CLAIM_RE, '').trim() }
    // The grade lives on the claim line or within the next two lines - close
    // enough that a reader always sees them together.
    for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
      const found = GRADE_RE.exec(lines[j]!)
      if (found) {
        claim.grade = found[1] as Grade
        claim.gradeLine = j
        break
      }
    }
    claims.push(claim)
  }
  return claims
}

export function lintClaims(markdown: string, file: string): Finding[] {
  const lines = markdown.split(/\r?\n/)
  const fenced = fencedLineNumbers(lines)
  const claims = findClaims(lines, fenced)
  const artifacts = findArtifactBlocks(lines)
  const findings: Finding[] = []

  if (claims.length === 0) {
    findings.push({
      level: 'warning',
      claim: 'the review states claims',
      detail: 'no `**Claim**:` lines found - nothing here can be checked',
      file,
    })
  }

  // An artifact may back at most one claim. Two VERIFIED tags sharing a single
  // command output is the cheapest way to fake coverage.
  const consumed = new Set<number>()

  claims.forEach((claim, index) => {
    const where = { file, line: claim.line + 1 }
    const nextClaimLine = claims[index + 1]?.line ?? lines.length

    if (!claim.grade) {
      findings.push({
        level: 'error',
        claim: claim.text,
        detail: 'carries no grounding tag (VERIFIED / DOCUMENTED / INFERRED / UNVERIFIED)',
        ...where,
      })
      return
    }

    const gradeLine = claim.gradeLine!

    if (claim.grade === 'VERIFIED') {
      const idx = artifacts.findIndex(
        (a, i) => !consumed.has(i) && a.start > gradeLine && a.start - gradeLine <= ARTIFACT_WINDOW,
      )
      if (idx === -1) {
        findings.push({
          level: 'error',
          claim: claim.text,
          detail: 'VERIFIED, but no valid artifact block within ' + ARTIFACT_WINDOW + ' lines',
          ...where,
        })
        return
      }
      consumed.add(idx)
      findings.push({
        level: 'pass',
        claim: claim.text,
        detail: 'VERIFIED by `' + artifacts[idx]!.command + '` (exit ' + artifacts[idx]!.exitCode + ')',
        ...where,
      })
      return
    }

    if (claim.grade === 'DOCUMENTED') {
      const window = lines.slice(gradeLine, Math.min(gradeLine + 2, lines.length)).join(' ')
      const ok = CITATION_RE.test(window)
      findings.push({
        level: ok ? 'pass' : 'error',
        claim: claim.text,
        detail: ok ? 'DOCUMENTED with a citation' : 'DOCUMENTED, but cites nothing (URL, § section, or issue id)',
        ...where,
      })
      return
    }

    if (claim.grade === 'INFERRED') {
      const steps = lines
        .slice(gradeLine + 1, nextClaimLine)
        .filter((l, i) => !fenced.has(gradeLine + 1 + i) && NUMBERED_STEP_RE.test(l)).length
      findings.push({
        level: steps >= 2 ? 'pass' : 'error',
        claim: claim.text,
        detail:
          steps >= 2
            ? 'INFERRED with a ' + steps + '-step chain'
            : 'INFERRED, but shows ' + steps + ' numbered step(s) - two or more are required',
        ...where,
      })
      return
    }

    findings.push({
      level: 'pass',
      claim: claim.text,
      detail: 'UNVERIFIED, and says so - which is the honest outcome, not a failure',
      ...where,
    })
  })

  findings.push(...lintProse(lines, fenced, file))
  return findings
}

/**
 * Rules that apply to the prose rather than to a tagged claim.
 *
 * Everything inside a fenced block is skipped. A review that quotes a bad
 * example, or pastes a diff containing the word "works", is not asserting it -
 * and a checker that cries wolf gets switched off, after which you have nothing.
 */
export function lintProse(lines: string[], fenced: Set<number>, file: string): Finding[] {
  const findings: Finding[] = []
  const nearby = (i: number, re: RegExp, radius = 3): boolean =>
    lines
      .slice(Math.max(0, i - radius), Math.min(lines.length, i + radius + 1))
      .some((l) => re.test(l))

  for (let i = 0; i < lines.length; i++) {
    if (fenced.has(i)) continue
    const line = lines[i]!
    const where = { file, line: i + 1 }

    const vague = VAGUE_COMPARATIVE_RE.exec(line) ?? UNCHECKED_EQUIVALENCE_RE.exec(line)
    if (vague && !nearby(i, /\bUNVERIFIED\b/, 1)) {
      findings.push({
        level: 'error',
        claim: '"' + vague[0].trim() + '"',
        detail: 'compared to what, measured how? Back it or tag the line UNVERIFIED',
        ...where,
      })
    }

    const success = SUCCESS_WORD_RE.exec(line)
    if (
      success &&
      !CLAIM_RE.test(line) &&
      !/\*\*Grounding\*\*/.test(line) &&
      !HYPOTHETICAL_RE.test(line) &&
      !nearby(i, EFFECT_RE)
    ) {
      findings.push({
        level: 'error',
        claim: '"' + success[0] + '"',
        detail: 'a success claim with no stated effect - add `**Effect**:` saying what changed and how you know',
        ...where,
      })
    }

    if (SYCOPHANCY_RES.some((re) => re.test(line))) {
      findings.push({
        level: 'warning',
        claim: line.trim().slice(0, 60),
        detail: 'agreement is not evidence - revise on evidence, not on pressure',
        ...where,
      })
    }
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

  const findings = lintClaims(readFileSync(path, 'utf8'), path)
  report('Claims in ' + path, findings)
  process.exit(exitCodeFor(findings, args.strict === true))
}

if (process.argv[1]?.includes('check-claims')) main()
