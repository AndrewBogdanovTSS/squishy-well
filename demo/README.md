# demo/

Deliberately broken inputs, kept in the repository rather than on a branch so
they can be read without checking anything out.

Every file here is wrong on purpose, and each one says at the top what is wrong
with it. Read them before running the checkers: the point of these fixtures is
that they look completely normal.

## Setup

One command, once. It creates two `demo-*` git references so the receipt fixtures
have a baseline to point at, and a local branch that has been left behind its
remote so the stale-baseline failure can actually happen:

```bash
sh demo/setup-refs.sh
```

Remove them again with `sh demo/cleanup-refs.sh`. Nothing touches `master`.

## The fixtures

| File | Run | What it shows |
|---|---|---|
| `reviews/bad-claims.md` | `pnpm check:claims demo/reviews/bad-claims.md` | a tag with nothing behind it, a citation-free DOCUMENTED, a chain-free INFERRED, an untagged claim, two unfalsifiable comparisons, a bare "it works", and one line of flattery |
| `reviews/good-claims.md` | `pnpm check:claims demo/reviews/good-claims.md` | the same review, repaired - longer, hedgier, and the only one of the two that could be proved wrong |
| `reviews/bad-receipt.md` | `pnpm check:receipt demo/reviews/bad-receipt.md` | a baseline taken from a stale local branch, a file quoted approximately rather than verbatim, a citation to a file that does not exist and one past the end of a real file |
| `reviews/good-receipt.md` | `pnpm check:receipt demo/reviews/good-receipt.md` | a receipt that holds |
| `decisions/unwired.md` | `pnpm check:all --only reachability --decisions demo/decisions` | four invariants that all read as enforced; one is |

## Why keep broken files around

Two reasons.

The obvious one: a checker is easier to understand when you have watched it fire.

The less obvious one, and the reason CI runs all four: **a check nobody has seen
fail is indistinguishable from a check that cannot fail.** These fixtures are
regression tests for the checkers themselves. If `bad-claims.md` ever starts
passing, something in the linter quietly stopped working, and without these files
nobody would find out until it mattered.

## A note on the receipt fixtures

They name a specific commit. If the history moves and the SHAs no longer resolve,
the checker will say exactly that rather than passing quietly - which is the
behaviour you want, and also mildly inconvenient. Regenerate them by copying the
current values in:

```bash
git rev-parse HEAD
git merge-base origin/demo-base HEAD
git show HEAD:apps/web/app/lib/three.ts | head -1
```

Quote that last line **exactly**. While writing these fixtures the first time,
the author typed a plausible-looking import statement from memory instead of
copying the real one, and the sample-integrity check caught it immediately. That
is precisely the failure the check exists for, and it took under a minute to
demonstrate on its own author.
