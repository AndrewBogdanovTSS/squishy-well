# Review: DELIBERATELY BROKEN - phantom artifact id

> Fixture for Improvement 1's existence check. Run
> `pnpm check:claims demo/reviews/phantom-artifact.md`.
>
> `VERIFIED[tests-000000]` looks exactly as authoritative as a real addressed
> claim - same syntax, same confident register - and there is no artifact
> block anywhere in this document carrying that id. This is the addressed
> form's equivalent of typing a bare `VERIFIED` with nothing nearby: the id
> just makes the missing half easier to name precisely in the error.

## Findings

**Claim**: the test suite reports no failures.
**Grounding**: VERIFIED[tests-000000]

No artifact with this id exists in this file. The id was typed, not derived
from a real run, which costs exactly as little as it looks like it costs.
