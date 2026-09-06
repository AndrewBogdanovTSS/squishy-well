# Review: two documented boundaries, made executable

> Fixture for Improvement 3 - the two limits from `docs/evidence-layer.md`
> § "What this does not do" that `check:claims` can demonstrate directly. Run
> `pnpm check:claims demo/reviews/boundary-limits.md`; expect exactly one
> failure, on the final claim below.
>
> Corrected against the original roadmap during Phase 0
> (`docs/phase0-audit.md`): the roadmap's own suggested wording for "does not
> judge taste" used one of this checker's own banned unfalsifiable comparatives
> (see `VAGUE_COMPARATIVE_RE` in `claims.ts`) - that demonstrates the
> banned-language rule working, not the taste boundary. The taste boundary is
> the one actually written in the docs: an ordinary, untagged opinion.
>
> Ordering note: the untagged-taste and structurally-sound-but-false claims
> come first, deliberately, so nothing with an artifact sits within the legacy
> proximity window of the final, deliberately unbacked claim - see that claim's
> own note for why this matters.

## Boundary 1 - untagged taste is not judged (no finding)

This naming scheme will be hard to maintain as more piece types get added. That
is a professional opinion about the future, not a claim with an observable
outcome today - nothing here asks "what would have to happen for this to be
wrong," and it should not have to. It is not dressed as a check, so it is not
checked as one.

## Boundary 2 - a structurally sound but substantively false claim (no finding)

**Claim**: this project's default piece colour is bright green.
**Grounding**: VERIFIED[cmd-1a2b3c]

```artifact:cmd-1a2b3c@0047f95
$ echo checking colours
unrelated output - this does not check piece colour at all
exit: 0
```

This is the boundary that matters most to state plainly: the artifact is real,
addressed, collected at the right commit, and utterly irrelevant to the claim
sitting next to it. `check:claims` verifies that a real command was run and
pointed at on purpose - it does not, and structurally cannot without
reintroducing a probabilistic judgement into a deterministic checker, verify
that the output *means* what the claim says it means. See
`packages/evidence-layer/src/core/claims.ts`'s file header for why that
trade-off is deliberate rather than an oversight.

## Boundary 3 - the same opinion as Boundary 1, dressed as a check (the one failure)

**Claim**: this naming scheme will be hard to maintain.
**Grounding**: VERIFIED

Tagging an opinion does not change what it is, but it does change what the tag
promises - and here the promise is broken: nothing backs it. Bare `VERIFIED`
falls back to the legacy proximity rule (see `ARTIFACT_WINDOW` in
`claims.ts`), which only looks at what artifact sits *nearby* - so this claim
had to be placed with no artifact block anywhere within range, or the legacy
check would have credited it with Boundary 2's block by accident, which is
exactly the failure mode addressing exists to close. Ordering a fixture
around a checker's own blind spot is not a workaround; it is the blind spot,
demonstrated.
