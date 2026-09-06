# Review: the renderer helpers move to `lib/` - VALID RECEIPT

> Fixture. Run `sh demo/setup-refs.sh` once, then
> `pnpm check:receipt demo/reviews/good-receipt.md`.
>
> The receipt below is the first block of the review, above any verdict, because
> a reader has to see where the review was written from before they see what it
> concluded.
>
> v2: this review cites two files (`three.ts` and `eslint.config.js`), so it now
> carries **two** Sample integrity lines, one per cited file - see
> `demo/reviews/bad-receipt.md`, which already demonstrated the gap this closes
> by accident, before this rule existed to name it: quoting one file proves
> *a* file was opened, not the ones the review is actually about.

## Access Receipt

**Repo path**: the local clone this file lives in
**Branch**: master
**HEAD SHA**: f8ae76a0cd2194fcef3e6c69cf9478c4a5bc07ab
**Target branch**: demo-base
**Base SHA**: ed53edc0ed94345a89de5e7cf2fb4edc93f7fe45
**Diff stat**: 9 files changed, 15 insertions(+), 12 deletions(-)
**Files in diff**: 9
**Files opened during review**: 9
**Sample integrity**: `apps/web/app/lib/three.ts` -> `import { COLS, VISIBLE_ROWS } from '@tetris/core'`
**Sample integrity**: `eslint.config.js` -> `import tseslint from 'typescript-eslint'`
**Tools used**: git, ripgrep, the local test suite

Every field above is a literal value. Nothing here is a summary, an impression,
or a promise: a reader can re-derive each one by running the same command against
the same commit, and the checker does exactly that.

The sample integrity line is the cheapest of the checks and the hardest to fake.
Quoting the first non-blank line of a file you did not open requires guessing it,
and nobody guesses an import statement verbatim.

## Findings

**Claim**: every renderer helper moved from `utils/` to `lib/` without a
behavioural change to the engine.
**Grounding**: VERIFIED

```artifact
$ pnpm fingerprint
[ ok ] baseline.replay.json replays to its recorded fingerprint
[ ok ] bot-game.replay.json replays to its recorded fingerprint
[ ok ] tspin-double.replay.json replays to its recorded fingerprint
exit: 0
```

**Claim**: the engine's import boundary is machine-enforced rather than agreed.
**Grounding**: DOCUMENTED - `eslint.config.js` restricts `vue`, `three`, `@tresjs/*`
and `pinia` inside the engine package, and the file says why in its header.

Citations in this review point at `apps/web/app/lib/three.ts:1` and
`eslint.config.js:22`, both of which resolve at the commit named above. A
citation that does not resolve is the signature of a review that was assembled
rather than read.
