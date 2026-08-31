/**
 * The unit of evidence, and the one module both checkers import.
 *
 * The claim it makes falsifiable: "I ran something." An artifact block names the
 * exact command, quotes its output verbatim, and records the exit code - so
 * anyone can run it again and find out whether the claim survives.
 *
 * The grammar, in full:
 *
 *     (fence)artifact
 *     $ pnpm test
 *     Tests  71 passed (71)
 *     exit: 0
 *     (fence)
 *
 * Rigid on purpose. Rigid is what makes it checkable by a script and re-runnable
 * by a human; a flexible grammar is a grammar nothing can check.
 *
 * `gather-evidence` writes these blocks and `check-claims` lints them. Both
 * import this same file deliberately: a producer and a checker that each keep
 * their own copy of a grammar drift apart, and the drift stays invisible until
 * the moment it matters.
 */

export interface FencedBlock {
  /** The info string after the opening backticks, e.g. `artifact` or `ts`. */
  info: string
  /** 0-based line index of the opening fence. */
  start: number
  /** 0-based line index of the closing fence, or of the last line if unclosed. */
  end: number
  closed: boolean
  body: string[]
}

/** Every fenced code block in a markdown document, in order. */
export function findFencedBlocks(lines: string[]): FencedBlock[] {
  const blocks: FencedBlock[] = []
  let open: FencedBlock | null = null
  for (let i = 0; i < lines.length; i++) {
    const fence = /^\s*```(.*)$/.exec(lines[i]!)
    if (!fence) {
      if (open) open.body.push(lines[i]!)
      continue
    }
    if (!open) {
      open = { info: fence[1]!.trim(), start: i, end: i, closed: false, body: [] }
      continue
    }
    open.end = i
    open.closed = true
    blocks.push(open)
    open = null
  }
  if (open) blocks.push(open)
  return blocks
}

/**
 * Line indexes that sit inside a fenced block.
 *
 * Prose rules must skip these. A review that quotes a bad example, or pastes a
 * diff containing the word "works", is not making that claim itself - and a
 * checker that cannot tell the difference gets switched off within a week.
 */
export function fencedLineNumbers(lines: string[]): Set<number> {
  const inside = new Set<number>()
  for (const block of findFencedBlocks(lines)) {
    for (let i = block.start; i <= block.end; i++) inside.add(i)
  }
  return inside
}

export interface ArtifactBlock extends FencedBlock {
  command: string
  exitCode: number
}

/** Valid artifact blocks only: info string `artifact`, `$ ` first, `exit: N` last. */
export function findArtifactBlocks(lines: string[]): ArtifactBlock[] {
  const found: ArtifactBlock[] = []
  for (const block of findFencedBlocks(lines)) {
    if (block.info !== 'artifact' || !block.closed) continue
    const body = block.body.filter((l) => l.trim() !== '')
    const first = body[0]
    const last = body[body.length - 1]
    if (!first?.startsWith('$ ')) continue
    const exit = last ? /^exit:\s*(\d+)$/.exec(last.trim()) : null
    if (!exit) continue
    found.push({ ...block, command: first.slice(2).trim(), exitCode: Number(exit[1]) })
  }
  return found
}

/**
 * Renders one artifact block.
 *
 * Long output is truncated from the middle rather than the end: the last lines
 * of a test run are the ones that say whether it passed.
 */
export function formatArtifact(
  command: string,
  output: string,
  exitCode: number,
  maxLines = 40,
): string {
  const fence = '`'.repeat(3)
  const lines = output.replace(/\r\n/g, '\n').split('\n')
  const body =
    lines.length <= maxLines
      ? lines
      : [
          ...lines.slice(0, Math.ceil(maxLines / 2)),
          '[... ' + (lines.length - maxLines) + ' lines omitted ...]',
          ...lines.slice(-Math.floor(maxLines / 2)),
        ]
  return [fence + 'artifact', '$ ' + command, ...body, 'exit: ' + exitCode, fence].join('\n')
}
