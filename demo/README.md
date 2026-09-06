# demo/

Deliberately broken inputs, kept in the repository rather than on a branch so
they can be read without checking anything out.

Every file here is wrong on purpose, and each one says at the top what is wrong
with it. Read them before running the checkers: the point of these fixtures is
that they look completely normal.

## Setup

One command, once - and again any time the local refs look missing, which can
happen after a `git fetch` touches `refs/remotes/origin/*`; it is cheap and
idempotent. It creates two `demo-*` git references so the receipt fixtures
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
| `reviews/good-claims.md` | `pnpm check:claims demo/reviews/good-claims.md` | the same review, repaired, using the v2 addressed `VERIFIED[id]` form - longer, hedgier, and the only one of the two that could be proved wrong |
| `reviews/mismatched-artifact.md` | `pnpm check:claims demo/reviews/mismatched-artifact.md` | a real artifact, addressed correctly, collected at the *wrong* commit for the review it sits in |
| `reviews/phantom-artifact.md` | `pnpm check:claims demo/reviews/phantom-artifact.md` | `VERIFIED[id]` referencing an artifact that does not exist anywhere in the document |
| `reviews/shotgun-artifact.md` | `pnpm check:claims demo/reviews/shotgun-artifact.md` | one real, valid artifact backing far more claims than it should - a warning, not an error |
| `reviews/boundary-limits.md` | `pnpm check:claims demo/reviews/boundary-limits.md` | the two limits `docs/evidence-layer.md` documents in prose, made executable: untagged taste is not judged, and a structurally sound artifact does not make a false claim true |
| `reviews/bad-receipt.md` | `pnpm check:receipt demo/reviews/bad-receipt.md` | a baseline taken from a stale local branch, a file quoted that none of the review's own claims cite, and two citations that do not resolve |
| `reviews/good-receipt.md` | `pnpm check:receipt demo/reviews/good-receipt.md` | a receipt that holds, with one verbatim quote per file the review actually cites |
| `decisions/unwired.md` | `pnpm check:all --only reachability --decisions demo/decisions` | four invariants that all read as enforced; one is |
| `decisions/runtime-composed/decision.md` | `pnpm check:all --only reachability --decisions demo/decisions/runtime-composed` | an invariant whose trigger is composed at runtime, self-disclosed, downgraded to `unverifiable` rather than a false `error` or a silent `pass` |

## Why keep broken files around

Two reasons.

The obvious one: a checker is easier to understand when you have watched it fire.

The less obvious one, and the reason CI runs the negative cases: **a check
nobody has seen fail is indistinguishable from a check that cannot fail.**
These fixtures are regression tests for the checkers themselves. If
`bad-claims.md` ever starts passing, something in the linter quietly stopped
working, and without these files nobody would find out until it mattered.

## A note on the receipt and artifact fixtures

They name specific commits. If the history moves and a SHA no longer resolves,
the checker will say exactly that rather than passing quietly - which is the
behaviour you want, and also mildly inconvenient. Regenerate a sample line by
copying the current value in:

```bash
git rev-parse HEAD
git merge-base origin/demo-base HEAD
git show HEAD:apps/web/app/lib/three.ts | head -1
```

Quote that last line **exactly**. While writing the v1 fixtures, the author
typed a plausible-looking import statement from memory instead of copying the
real one, and the sample-integrity check caught it immediately. That is
precisely the failure the check exists for, and it took under a minute to
demonstrate on its own author.

Regenerating an addressed artifact's id is one function call, not a guess -
`artifactId(command, commit, output)` from `evidence-layer` is deterministic,
so the fixtures were built by actually running the command once and copying
the real id, never by inventing one. `phantom-artifact.md` is the one
deliberate exception, and it says so.
