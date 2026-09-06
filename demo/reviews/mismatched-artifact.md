# Review: DELIBERATELY BROKEN - artifact collected at the wrong commit

> Fixture for Improvement 1's commit-mismatch check. Run
> `pnpm check:claims demo/reviews/mismatched-artifact.md`.
>
> The Access Receipt below states this review is about
> `0047f9500cfba9097d380c14e98ebad0b09c39df`. The artifact the VERIFIED claim
> addresses was collected at `f8ae76a0cd2194fcef3e6c69cf9478c4a5bc07ab` - an
> earlier commit, embedded plainly in the block's own fence rather than buried
> inside the hash, so this is checkable without inverting anything.
>
> This is the gap semantic addressing exists to close beyond plain proximity: a
> block that is genuinely *about a real run*, genuinely present nearby, and
> still not evidence for *this* commit's review.

## Access Receipt

**Repo path**: the local clone this file lives in
**Branch**: master
**HEAD SHA**: 0047f9500cfba9097d380c14e98ebad0b09c39df
**Target branch**: master
**Base SHA**: f8ae76a0cd2194fcef3e6c69cf9478c4a5bc07ab
**Diff stat**: 1 file changed
**Files in diff**: 1
**Files opened during review**: 1
**Sample integrity**: `AGENTS.md` -> `# AGENTS.md - the contract for anything that writes here`

## Findings

**Claim**: the recorded games still replay to their stored fingerprints.
**Grounding**: VERIFIED[engine-44e945]

```artifact:engine-44e945@f8ae76a
$ pnpm fingerprint
Engine fingerprints
-------------------
[ ok ] baseline.replay.json replays to its recorded fingerprint
        0a56c479:460:0:1:20:GAME_OVER
[ ok ] bot-game.replay.json replays to its recorded fingerprint
        c87d36c8:229812:178:18:474:GAME_OVER
[ ok ] tspin-double.replay.json replays to its recorded fingerprint
        b3a260d4:1200:2:1:1:FALLING

3 checked - 0 failed, 0 flaky, 0 warnings, 0 unverifiable
exit: 0
```
