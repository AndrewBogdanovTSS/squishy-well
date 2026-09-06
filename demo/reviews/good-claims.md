# Review: lock delay reset cap - REPAIRED

> The same review as [`bad-claims.md`](./bad-claims.md), with every claim given
> the backing its tag requires. Run `pnpm check:claims demo/reviews/good-claims.md`.
>
> Read the two side by side. The repaired version is longer, hedges more, and
> sounds less confident - and it is the only one of the two that could be proved
> wrong.
>
> v2: the VERIFIED claim below uses the **addressed** form,
> `VERIFIED[engine-379669]`, rather than a bare `VERIFIED` sitting near an
> artifact. Addressing exists because proximity alone has a real gap: a block
> copied to the wrong place still clears a proximity check, since that check
> only confirms *a* block is nearby, not that it is *the* block the claim is about.
> The id is real and reproducible - re-run `pnpm fingerprint` at the commit
> named in the block and you get the identical id back, because the id is a
> hash of the command, the commit and the output.

## Findings

**Claim**: the recorded games still replay to their stored fingerprints.
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

**Claim**: the reset cap is part of the engine's tuning rather than the input layer.
**Grounding**: DOCUMENTED - see the reactivity and architecture sections of `README.md`, and `maxLockResets` in the tuning block of every replay fixture.

**Claim**: a smaller cap would end games earlier at high gravity.
**Grounding**: INFERRED

1. Lock delay only restarts while the piece can still move, and each restart is
   counted against `maxLockResets`.
2. At 20G a piece arrives at the stack on the tick it spawns, so every remaining
   input is a reset.
3. With a smaller cap the piece therefore locks sooner, on average higher up the
   well, which is where a top-out comes from.

This chain is reasoning, not measurement. Nobody ran a game at a different cap to
find out, which is exactly what the tag is admitting.

**Claim**: the change is worth making at all.
**Grounding**: UNVERIFIED

No data either way. An honest UNVERIFIED is worth more here than a decorative
VERIFIED, because it tells the next reader precisely where this review is thin.

## Notes

The refactored lock timer allocates nothing per tick, unlike the previous one.

**Effect**: the engine suite passes unchanged, and the three replay fingerprints
above are byte-identical to the ones recorded before the change - which is what
"behaviour-preserving" means here, rather than an impression of one.
