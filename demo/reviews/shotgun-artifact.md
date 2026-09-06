# Review: DELIBERATELY QUESTIONABLE - one artifact backing eight claims

> Fixture for Improvement 1's shotgun check. Run
> `pnpm check:claims demo/reviews/shotgun-artifact.md`.
>
> Every claim below addresses the *same* real, valid, correctly-committed
> artifact - `pnpm fingerprint`'s output. Each individual `VERIFIED[id]` holds
> up on its own: the id exists, the commit matches, nothing is phantom or
> mismatched. The pattern only becomes visible in aggregate, which is exactly
> why this is a **warning**, not an error - a small number of closely related
> claims sharing one artifact is sometimes legitimate, and the layer's own
> design rule (`ground-technical-claims`) does not ban that outright. It bans
> **not noticing** when it stops being a handful and starts being a stand-in for
> evidence the review never actually gathered.

## Findings

**Claim**: the engine is deterministic.
**Grounding**: VERIFIED[engine-379669]

**Claim**: the lock-delay reset cap did not change.
**Grounding**: VERIFIED[engine-379669]

**Claim**: the 7-bag randomizer is unaffected.
**Grounding**: VERIFIED[engine-379669]

```artifact:engine-379669@0047f95
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
