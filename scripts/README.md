# scripts/

Six commands. Each one takes a sentence people write without thinking and turns
it into something that could come out otherwise.

The full tour, with the reasoning: [`docs/evidence-layer.md`](../docs/evidence-layer.md).

| Script | Command | The claim it makes falsifiable |
|---|---|---|
| `check-docs.ts` | `pnpm check:docs` | every number in the README |
| `fingerprint.ts` | `pnpm fingerprint` | "the refactor is behaviour-preserving" |
| `gather-evidence.ts` | `pnpm evidence` | "I checked that" - by gathering first |
| `check-claims.ts` | `pnpm check:claims <file>` | the grounding tags in a review |
| `check-receipt.ts` | `pnpm check:receipt <file>` | "I read the code" |
| `governance.ts` | `pnpm check:all` | "this is enforced" |
| `ci-summary.ts` | `pnpm ci:summary <log>` | "the checks ran" |

`lib/` holds the three pieces they share:

- `artifact.ts` - the evidence grammar. Imported by both the producer
  (`gather-evidence`) and the checker (`check-claims`) on purpose: two copies of
  a grammar drift apart, and the drift stays invisible until it matters.
- `proc.ts` - running a command and recording what happened, including a timeout,
  which is evidence rather than a crash.
- `cli.ts` - argument parsing, the report format, and the exit-code contract.

## Conventions

Every script here:

- opens with a comment naming the claim it makes falsifiable, in plain language;
- fits in one file that can be read in a sitting;
- takes `--help`;
- exits `0` for pass, `1` for at least one error, `2` for bad usage - and `2` is
  never a pass;
- reports `unverifiable` as its own outcome when it could not check something,
  rather than counting that as success.

No dependencies beyond `tsx` and `vitest`, which the workspace already had.
Tooling that needs its own runtime does not survive its first dependency review.

## Tests

```bash
pnpm test:scripts
```

Kept separate from `pnpm test`, which is the game engine. Folding them together
would make the engine's test count depend on the tooling around it - and the
README makes a claim about that number which `pnpm check:docs` checks.
