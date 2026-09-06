# evidence-layer

Checks that turn a review's assertions into claims that could be proved wrong.
Extracted from a tetris game's own governance tooling because none of the
checking logic has anything to do with a tetris game - see
[`../../docs/evidence-layer.md`](../../docs/evidence-layer.md) for the full
tour and [`../../docs/decisions/0002-evidence-layer-v2.md`](../../docs/decisions/0002-evidence-layer-v2.md)
for why it was extracted now rather than later.

Deliberately named `evidence-layer`, not `@tetris/evidence-layer`: the scope
would say this belongs to the game. It does not - it lives here for now.

## The one rule everything here is graded against

**The honest path must be cheaper than the convenient one** - fewer tokens,
fewer separate decisions, less distance from the trajectory the author (human
or model) is already on. Nothing here relies on anyone wanting to be careful.
Anything that made correctness more expensive than a shortcut was rejected or
rebuilt before shipping - see `src/core/skeleton.ts`'s file header for the one
concrete near-miss: addressed evidence very nearly shipped in a form that made
citing an artifact *more* expensive than a bare, unbacked tag.

## Layout: three layers, only two of them are files

```
src/
  core/        no knowledge of any project's stack - text, git, package.json
  adapters/
    node-default.ts   the one file allowed to know this runs on Node
  index.ts     re-exports everything above
bin/           complete CLI entrypoints for the checks that need zero
               project-specific input - see "What ships as a CLI" below
```

The third layer - **project config: which claims a given repository actually
makes** - is not a schema file, on purpose. It is whatever arguments the
consuming project's own thin wrapper scripts pass in. `tres-tetris/scripts/gather-evidence.ts`
is the reference example: it supplies a `testGate` (only run the engine suite
when `packages/tetris-core/` changed) and a `lintCommand` (scope lint to the
files that changed) as plain functions, not configuration a schema would have
to validate. A config layer that is just function arguments cannot drift from
the code that reads it, because there is no second copy of the shape to drift.

## What ships as a CLI, and what stays the consumer's own script

Not every check needs project config, and the ones that don't should not make
every consumer re-write the same wrapper file. `bin/check-claims.ts`,
`check-receipt.ts`, `ci-summary.ts`, `journal-report.ts` and `journal-tag.ts`
are complete, runnable CLI entrypoints with **zero** knowledge of Tetris, Vue,
or any particular project - a consuming project's `package.json` script is a
one-line pointer at the file (`"check:claims": "tsx node_modules/evidence-layer/bin/check-claims.ts"`,
or the equivalent relative path in a workspace):

```bash
tsx path/to/evidence-layer/bin/check-claims.ts review.md
```

`check-docs.ts`, `fingerprint.ts`, and the config-supplying halves of
`gather-evidence.ts` and `governance.ts` stay in the **consumer's own**
`scripts/` folder, because they are not thin wrappers at all - they carry real
facts about one project (routes, pinned versions, which files gate its test
suite, which checks it runs by default) that would have to leave `core/`'s
project-agnostic boundary to live here. `tres-tetris/scripts/README.md` is the
worked example of where that line actually falls.

## What "zero-config" means, precisely

`claims`, `receipt`, `governance`, `exceptions`, `ci-summary`, `journal` and
`misses` need **no adapter at all** - they operate on markdown text, git
output and `package.json`, which every project already has. Call
`gatherEvidence({ repo, base })` with nothing else and it plans `pnpm lint`,
`pnpm typecheck` and `pnpm test` - the three scripts an ordinary Node project
already has names for.

What was **never** claimed to be zero-config, because it cannot be: any check
that asserts a fact specific to one project - a route existing, a dependency
pinned to an exact version, a build fitting a size budget. Those are facts
about that project, not about Node, and belong in the consuming project's own
script (see `tres-tetris/scripts/check-docs.ts`), never smuggled into `core/`.

## The portability test

A claim that a package works on "any project" is exactly the kind of claim
this package's own `claims.ts` would tag UNVERIFIED if nobody had checked it.
[`examples/plain-node-project/`](examples/plain-node-project) is a deliberately
unrelated fixture - plain JavaScript, no TypeScript, no Vue, no monorepo, its
own unconnected `package.json` - that [`test/portability.test.ts`](../test/portability.test.ts)
exercises `readInvariants`, `reachableCommands`, `lintClaims`, `checkReceipt`
and `renderSummary` against, proving none of them read anything about Tetris,
Vue, or a workspace layout to do their job. Anything that had to change in
`core/` rather than in an adapter to make that example work would have been a
layer-separation bug, fixed rather than worked around.

## Boundary enforced by the linter, not by good intentions

`eslint.config.js` at the workspace root bans importing `@tetris/*`, `vue`,
`three`, `@tresjs/*` or `pinia` from anything under `src/core/` - the same
enforcement pattern `packages/tetris-core` already uses for its own boundary.
Node builtins are fine in `core/`: this is CLI tooling, not a sandboxed engine,
and it is expected to shell out and touch the filesystem.

## No new dependencies

`tsx`, `typescript` and `vitest` - already in the workspace before this
package existed. Governance tooling that needs its own runtime does not
survive its first dependency review, in this project or the next one that
copies this folder.
