---
id: DEMO-0002
status: accepted
date: 2026-09-06
invariants:
  - Every real finding gets tagged real or false at fix time; enforced by `pnpm journal:tag` (runtime-composed trigger).
review_by: 2027-09-06
---

# DEMO-0002: a trigger the reachability scanner cannot see, and says so

Fixture for Improvement 3's reachability boundary. Run:

```bash
pnpm check:all --only reachability --decisions demo/decisions/runtime-composed
```

`reachableCommands` works by scanning hook and workflow files for literal
strings like `pnpm journal:tag`. That is a real, permanent blind spot: a
trigger that assembles its command at runtime -

```js
const parts = ['pnpm', 'journal:tag']
execSync(parts.join(' '))
```

- never appears as that literal string anywhere the scanner reads, whether or
not something actually runs it. Without disclosure, the honest answer the
scanner can give is `error` ("nothing reaches this"), which is *wrong* exactly
as often as it is right: it cannot tell "genuinely unwired" from "wired in a
shape I cannot see."

The `(runtime-composed trigger)` annotation is a author's admission, not a
detection: whoever wrote this invariant is saying, in the document itself,
"do not trust reachability's silence on this one." That downgrades the finding
from a false `error` to an honest `unverifiable` - still not a `pass`, because
nobody has actually confirmed it runs, only declared that it might.

Compare with `demo/decisions/unwired.md`'s `pnpm check:spelling`, which carries
no such annotation and is correctly reported as a plain `error`: that command
is not composed anywhere, by anything, in any form. Silence there means
exactly what it says.
