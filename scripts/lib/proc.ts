/**
 * Runs a command and records what happened, including when it goes wrong.
 *
 * The claim it makes falsifiable: "the command passed."
 *
 * A failed command is evidence. A command that timed out is evidence, recorded
 * as `exit: 124` by the usual shell convention. A command that was never run is
 * not evidence at all - which is why nothing in here quietly swallows a failure
 * or substitutes a plausible-looking result for a real one.
 */
import { spawnSync } from 'node:child_process'

export interface RunResult {
  command: string
  output: string
  exitCode: number
  timedOut: boolean
}

export function run(command: string, opts: { cwd?: string; timeoutMs?: number } = {}): RunResult {
  const timeoutMs = opts.timeoutMs ?? 300_000
  // `shell: true` so `pnpm` resolves to `pnpm.cmd` on Windows without every
  // caller having to know that. The commands run here are literals written in
  // this repository, never user input, so the usual injection objection to
  // `shell: true` does not apply - but do not copy this line into a tool that
  // accepts commands from somewhere else.
  const res = spawnSync(command, {
    cwd: opts.cwd,
    shell: true,
    encoding: 'utf8',
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024,
  })
  const timedOut = res.error !== undefined && (res.error as NodeJS.ErrnoException).code === 'ETIMEDOUT'
  const raw = ((res.stdout ?? '') + (res.stderr ?? '')).trim()
  return {
    command,
    output: timedOut ? (raw + '\n[timed out after ' + timeoutMs + ' ms]').trim() : raw,
    exitCode: timedOut ? 124 : (res.status ?? 1),
    timedOut,
  }
}

/**
 * Trimmed stdout of a command, or `null` when it failed.
 *
 * For cheap git queries where "it did not work" is a legitimate answer that the
 * caller has to handle - not swallow.
 */
export function capture(command: string, cwd?: string): string | null {
  const res = run(command, { cwd, timeoutMs: 30_000 })
  return res.exitCode === 0 ? res.output.trim() : null
}
