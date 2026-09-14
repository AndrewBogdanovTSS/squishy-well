# demo/baselines/

Captured checker output, kept because the interesting result is the one that
stops existing the moment it is fixed.

The rest of `demo/` is inputs that are wrong on purpose. This folder is the
opposite: real output from a real run against the real tree, on a date, at a
commit. A fixture can be re-run forever. A blind spot cannot - it disappears
the moment somebody closes it, and then the only record of it is a slide
claiming it once happened.

Each capture names the command, the commit and the date, and says what it is
evidence *of*. Do not regenerate them in place. Add a new one.

## The captures

| File | Command | What it is evidence of |
|---|---|---|
| `2026-09-09-check-docs.txt` | `pnpm check:docs` | `check:docs` reporting three green route rows while a fourth route exists and is undocumented |

## 2026-09-09 - the route check passes and is wrong

Command: `pnpm check:docs`
Commit: `7d99ccf5e86f2211cdbe4a99008d88986a83bccf`
Result: exit 1 - 11 checked, 1 failed

Two separate facts, and they fail in different ways. Only the second one is
interesting.

**The build-size claim fails, out loud.** The README says 2.25 MB, the build
measures 4.15 MB, and the checker says so. This is the check working. A number
went stale, something noticed, the exit code went non-zero. Nothing to fix in
the tooling.

**The route check passes, and is wrong.** `apps/web/app/pages/settings.vue`
exists. The README's route table documents `/`, `/play` and `/debug` and does
not mention `/settings`. The checker reports three green rows and no fourth
row - not a failure, not a warning, not `unverifiable`. Silence.

That silence is structural, not an oversight in a list. `checkRoutes` in
`scripts/check-docs.ts` reads:

```ts
return Object.entries(pages)
  .filter(([route]) => readme.includes('`' + route + '`'))
```

It iterates the *documented* routes and asks whether each has a page file. It
can only ever check in one direction, doc to code. A route that exists in code
and appears in no document is not something it can find, because the README is
where it gets its list of things to look at. Adding `/settings` to the hardcoded
`pages` map would not fix this either: the `.filter` would drop it again for not
being mentioned in the README.

So the checker cannot answer the question people assume it answers. It does not
check that the README describes the routes. It checks that the routes the README
already describes exist.

**Why this is worth a file.** The wall of green in this capture is not a bug in
the sense of something broken. Every row is true. The exit code is correct for
the claims it examined. It is confidently, verifiably right about a strictly
smaller question than the one anybody reads it as answering - which is the same
shape as the failure the checkers exist to catch, one level up, in the tool
itself.

The fix is inverting the check: enumerate routes from the pages directory, parse
the documented list out of the README, and diff both directions. When that
lands, this capture is the only remaining evidence of what it was like before.
