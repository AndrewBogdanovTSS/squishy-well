# Review: the renderer helpers move to `lib/` - DELIBERATELY BROKEN RECEIPT

> Fixture. Run `sh demo/setup-refs.sh` once, then
> `pnpm check:receipt demo/reviews/bad-receipt.md`.
>
> This is the same review as [`good-receipt.md`](./good-receipt.md) with a
> baseline that has gone stale, a file quoted that was never opened, and one
> citation that does not resolve. Read it first without running anything: it
> looks completely normal, which is the entire problem.
>
> v2: this file was already, by accident, the clearest possible demonstration
> of Improvement 6 before that check existed to name it - the one file it
> quotes (`three.ts`) is not even among the files its own claims cite
> (`nowhere.ts`, `eslint.config.js`). "A file was opened" and "the files this
> review is about were opened" were never the same claim; this is what it looks
> like when only the first one is true.

## Access Receipt

**Repo path**: the local clone this file lives in
**Branch**: master
**HEAD SHA**: f8ae76a0cd2194fcef3e6c69cf9478c4a5bc07ab
**Target branch**: demo-target
**Base SHA**: ed53edc0ed94345a89de5e7cf2fb4edc93f7fe45
**Diff stat**: 9 files changed, 15 insertions(+), 12 deletions(-)
**Files in diff**: 9
**Files opened during review**: 4
**Sample integrity**: `apps/web/app/lib/three.ts` -> `import { COLS, VISIBLE_ROWS } from '@tetris/core';`
**Tools used**: git, the pull request page

Three things are wrong here and none of them is visible by reading.

The **base** was taken from the local branch named `demo-target`, which is behind
its remote. That is not a typo or a shortcut - it is what the obvious command
produces when the local branch has not been pulled. The resulting diff is
*larger* than the real change, so nothing looks missing, and the review's own
file counts still agree with each other.

The **sample line** is close to the real one but not identical. Close is the
tell: a file that was actually opened gets quoted exactly, and a file that was
reconstructed from memory of what such a file usually says gets quoted
approximately.

The **coverage** line admits 4 files opened against 9 in the diff, and offers no
reason - a warning rather than an error, because skipping generated files is
legitimate and skipping silently is not.

## Findings

**Claim**: nothing outside the renderer was touched.
**Grounding**: DOCUMENTED - see `apps/web/app/lib/nowhere.ts:12`, which does not
exist at the reviewed commit.

**Claim**: the engine boundary still holds.
**Grounding**: DOCUMENTED - see `eslint.config.js:9000`, a line number well past
the end of a 57-line file.
