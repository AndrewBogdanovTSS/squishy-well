import { describe, expect, it } from 'vitest'
import {
  fencedLineNumbers,
  findArtifactBlocks,
  findFencedBlocks,
  formatArtifact,
} from '../lib/artifact'

const F = '`'.repeat(3)

describe('findFencedBlocks', () => {
  it('captures the info string and the body', () => {
    const blocks = findFencedBlocks([F + 'ts', 'const a = 1', F])
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.info).toBe('ts')
    expect(blocks[0]!.body).toEqual(['const a = 1'])
    expect(blocks[0]!.closed).toBe(true)
  })

  it('reports an unclosed block rather than swallowing it', () => {
    expect(findFencedBlocks([F + 'artifact', '$ ls'])[0]!.closed).toBe(false)
  })
})

describe('fencedLineNumbers', () => {
  it('covers the fences themselves as well as the body', () => {
    // Prose rules skip these lines: a review quoting a bad example is not
    // making that claim, and a checker that cannot tell gets switched off.
    expect([...fencedLineNumbers(['before', F, 'inside', F, 'after'])]).toEqual([1, 2, 3])
  })
})

describe('findArtifactBlocks', () => {
  const valid = [F + 'artifact', '$ pnpm test', 'Tests 71 passed', 'exit: 0', F]

  it('accepts a well-formed block', () => {
    const [block] = findArtifactBlocks(valid)
    expect(block?.command).toBe('pnpm test')
    expect(block?.exitCode).toBe(0)
  })

  it('records a non-zero exit rather than rejecting it - a failure is evidence', () => {
    expect(findArtifactBlocks([F + 'artifact', '$ pnpm test', 'boom', 'exit: 124', F])[0]!.exitCode).toBe(124)
  })

  it.each([
    ['the wrong info string', [F + 'sh', '$ pnpm test', 'exit: 0', F]],
    ['no command line', [F + 'artifact', 'pnpm test', 'exit: 0', F]],
    ['no exit line', [F + 'artifact', '$ pnpm test', 'Tests 71 passed', F]],
    ['an unclosed fence', [F + 'artifact', '$ pnpm test', 'exit: 0']],
  ])('rejects a block with %s', (_label, lines) => {
    expect(findArtifactBlocks(lines)).toHaveLength(0)
  })
})

describe('formatArtifact', () => {
  it('round-trips through the parser, so producer and checker cannot drift', () => {
    const rendered = formatArtifact('pnpm fingerprint', 'all three match', 0).split('\n')
    const [parsed] = findArtifactBlocks(rendered)
    expect(parsed?.command).toBe('pnpm fingerprint')
    expect(parsed?.exitCode).toBe(0)
  })

  it('truncates from the middle, keeping the lines that say whether it passed', () => {
    const output = Array.from({ length: 100 }, (_, i) => 'line ' + i).join('\n')
    const rendered = formatArtifact('cmd', output, 0, 10)
    expect(rendered).toContain('line 0')
    expect(rendered).toContain('line 99')
    expect(rendered).toContain('lines omitted')
  })
})
