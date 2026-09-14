# scripts/

What is left here is what genuinely cannot move into the
[`evidence-layer`](https://github.com/AndrewBogdanovTSS/evidence-layer) package: this project's routes, its
pinned versions, its fixture shape, which files gate its test suite, which
checks this repo runs by default. Everything with **zero** project-specific
logic - the claim linter, the receipt checker, the CI summary renderer, the
reachability scan, the journal reader and tagger - ships in that package as a
single executable, not here, so a project installing it gets a working CLI
without hand-writing the same wrapper files.

The full tour, with the reasoning: [`docs/evidence-layer.md`](../docs/evidence-layer.md).

| Script | Command | The claim it makes falsifiable |
|---|---|---|
| `check-docs.ts` | `pnpm check:docs` | every number in the README - routes, pins, fixture shape |
| `fingerprint.ts` | `pnpm fingerprint` | "the refactor is behaviour-preserving" - imports `@tetris/core` directly |
| `gather-evidence.ts` | `pnpm evidence` | "I checked that" - supplies the test gate and lint scoping, orchestration lives in the package |
| `governance.ts` | `pnpm check:all` | "this is enforced" - names which checks this repo runs by default |

The other five commands (`check:claims`, `check:receipt`, `ci:summary`,
`journal:report`, `journal:tag`) are one-line aliases for the installed
executable - `evidence-layer claims`, `evidence-layer receipt`,
`evidence-layer ci-summary`, `evidence-layer journal report`,
`evidence-layer journal tag`. The colon-separated names are kept because the
invariants in `docs/decisions/` name them, and a record that says "enforced by
`pnpm check:claims`" should keep resolving to something that runs.

See the package's own README for the "why here, not there" boundary, and
`npx evidence-layer --help` for the current command list.

## Conventions

Every script here:

- opens with a comment naming the claim it makes falsifiable, in plain language;
- fits in one file that can be read in a sitting;
- takes `--help`;
- exits `0` for pass, `1` for at least one error, `3` for an unescalated flaky
  finding (see `evidence-layer`'s outcome model), `2` for bad usage - and `2`
  is never a pass;
- reports `unverifiable` as its own outcome when it could not check something,
  rather than counting that as success.

No dependencies beyond `tsx`, `vitest` and the workspace's own `evidence-layer`
package. Tooling that needs its own runtime does not survive its first
dependency review.

## Tests

```bash
pnpm test:scripts
```

Runs `evidence-layer`'s own suite (everything under `src/` and `bin/`) and
then this folder's (the tetris-specific gate/scope config in
`gather-evidence.ts`). Kept separate from `pnpm test`, which is the game
engine - folding them together would make the engine's test count depend on
the tooling around it, which is exactly the number `pnpm check:docs` checks.
