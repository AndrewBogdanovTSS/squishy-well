import { describe, expect, it } from 'vitest'
import { lintClaims } from '../check-claims'

const F = '`'.repeat(3)
const lint = (md: string) => lintClaims(md, 'test.md')
const errors = (md: string) => lint(md).filter((f) => f.level === 'error')

const ARTIFACT = [F + 'artifact', '$ pnpm test', 'Tests 71 passed (71)', 'exit: 0', F].join('\n')

describe('grounding tags', () => {
  it('fails a claim with no tag at all', () => {
    expect(errors('**Claim**: the engine is deterministic.')[0]!.detail).toContain('no grounding tag')
  })

  it('passes VERIFIED when an artifact block follows', () => {
    const md = '**Claim**: the suite passes.\n**Grounding**: VERIFIED\n\n' + ARTIFACT
    expect(errors(md)).toHaveLength(0)
  })

  it('fails VERIFIED with no artifact block', () => {
    const md = '**Claim**: the suite passes.\n**Grounding**: VERIFIED\n\nTrust me.'
    expect(errors(md)[0]!.detail).toContain('no valid artifact block')
  })

  it('will not let one artifact back two VERIFIED claims', () => {
    // Sharing a single command output between two tags is the cheapest way to
    // fake coverage, so each artifact is consumed by at most one claim.
    const md =
      '**Claim**: first.\n**Grounding**: VERIFIED\n\n' +
      ARTIFACT +
      '\n\n**Claim**: second.\n**Grounding**: VERIFIED\n\nnothing here.'
    expect(errors(md)).toHaveLength(1)
  })

  it('accepts a repo file as a citation for DOCUMENTED', () => {
    const md = '**Claim**: the boundary is enforced.\n**Grounding**: DOCUMENTED - see `eslint.config.js`.'
    expect(errors(md)).toHaveLength(0)
  })

  it('fails DOCUMENTED that cites nothing', () => {
    const md = '**Claim**: the guideline says so.\n**Grounding**: DOCUMENTED'
    expect(errors(md)[0]!.detail).toContain('cites nothing')
  })

  it('requires two or more steps for INFERRED', () => {
    const one = '**Claim**: it follows.\n**Grounding**: INFERRED\n\n1. only one step.'
    expect(errors(one)[0]!.detail).toContain('1 numbered step')

    const two = '**Claim**: it follows.\n**Grounding**: INFERRED\n\n1. first.\n2. second.'
    expect(errors(two)).toHaveLength(0)
  })

  it('treats an honest UNVERIFIED as a pass, not a failure', () => {
    const findings = lint('**Claim**: worth doing.\n**Grounding**: UNVERIFIED')
    expect(findings[0]!.level).toBe('pass')
  })
})

describe('prose that cannot be wrong', () => {
  it('flags a vague comparative', () => {
    expect(errors('The new timer is more robust.')).toHaveLength(1)
  })

  it('accepts the same sentence when it admits it is unchecked', () => {
    expect(errors('UNVERIFIED: the new timer is more robust.')).toHaveLength(0)
  })

  it('flags unchecked equivalence', () => {
    expect(errors('The two paths should be equivalent.')).toHaveLength(1)
  })

  it('flags a success word with no stated effect', () => {
    expect(errors('I ran it locally and it works.')).toHaveLength(1)
  })

  it('accepts a success word with an effect nearby', () => {
    const md = 'The clear delay is fixed.\n\n**Effect**: the CLEARING phase now ends after 400 ms; fingerprints unchanged.'
    expect(errors(md)).toHaveLength(0)
  })

  it('warns rather than fails on flattery', () => {
    const findings = lint("You're probably right about that.")
    expect(findings.some((f) => f.level === 'warning')).toBe(true)
    expect(findings.some((f) => f.level === 'error')).toBe(false)
  })
})

describe('false positives - the reason people switch checkers off', () => {
  it('ignores everything inside a fenced block', () => {
    const md = ['Quoting a bad review:', '', F, 'it works and is more robust', F].join('\n')
    expect(errors(md)).toHaveLength(0)
  })

  it('does not fire on ordinary English containing "the same"', () => {
    expect(errors('This is the same review, repaired.')).toHaveLength(0)
  })

  it('does not treat a hypothetical as a success claim', () => {
    expect(errors('It could not be tested without a GPU.')).toHaveLength(0)
  })
})
