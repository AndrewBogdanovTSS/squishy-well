# Review: lock delay reset cap - DELIBERATELY BROKEN

> This file is a fixture. Every problem in it is on purpose. Run
> `pnpm check:claims demo/reviews/bad-claims.md` and compare with
> [`good-claims.md`](./good-claims.md), which is the same review repaired.
>
> Nothing here is wrong about the game. It is wrong about *evidence*: every claim
> below is one a reader has no way to check, written in the register of someone
> who has checked.

## Findings

**Claim**: the engine's lock-delay reset cap behaves correctly at 20G.
**Grounding**: VERIFIED

There is no artifact block anywhere near this claim. The tag was typed, which
costs one token, and nothing about the claim can now be tested by a reader.

**Claim**: the guideline requires a reset cap of 15 moves.
**Grounding**: DOCUMENTED

No citation follows. Which guideline? Which section? A reader who wanted to
disagree would not know where to look.

**Claim**: raising the cap would make top-outs less likely at high gravity.
**Grounding**: INFERRED

Because it stands to reason.

**Claim**: the replay format is stable across this change.

That claim carries no grounding tag at all.

## Notes

The refactored lock timer is more robust than the previous one.

The two code paths should be equivalent, so no test change was needed.

I ran the suite locally and it works.

You're probably right that this is fine to merge as is.
