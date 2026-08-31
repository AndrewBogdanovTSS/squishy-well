---
name: ground-claims
description: Turn assertions into claims that could be proved wrong - grade each one VERIFIED, DOCUMENTED, INFERRED or UNVERIFIED and attach the backing that grade requires. Use when writing a review, a summary of work done, or any statement about what code does.
---

# ground-claims

A claim is worth something when you can name, in advance, what would prove it
wrong. This skill is how to write claims like that, and how to notice when you
have written the other kind.

## The one question

> **What would have to happen for this to be wrong?**

If the honest answer is "nothing I can think of", you are not holding a claim.
Rewrite it until an observation could contradict it, or grade it `UNVERIFIED`
and move on. Both are fine. Pretending is not.

## The four grades

| Grade | Means | Must carry |
|---|---|---|
| VERIFIED | I ran it | an artifact block within 15 lines |
| DOCUMENTED | someone specified it | a citation: URL, § section, issue id, or a file in this repo |
| INFERRED | I reasoned it | two or more numbered steps |
| UNVERIFIED | I believe it | nothing, and it says so |

The artifact block:

````markdown
```artifact
$ pnpm test
Tests  71 passed (71)
exit: 0
```
````

Exact command, verbatim output, exit code. Not a summary of the output - a
summary is a new claim, made by you, about output the reader cannot see.

## Rewrites

| Instead of | Write |
|---|---|
| "the types are fine" | `pnpm typecheck` in an artifact block, `exit: 0` |
| "this is more robust" | what changed, measured how - or drop the sentence |
| "the refactor is behaviour-preserving" | `pnpm fingerprint`, with the output |
| "nothing else uses this" | the search, with `0` results, at a named commit |
| "it works" | `**Effect**:` - what changed, and how you know |
| "users won't notice" | either a measurement, or `UNVERIFIED` |

## Two things worth remembering

**An honest UNVERIFIED beats a decorative VERIFIED.** It tells the reader exactly
where the work is thin, which is information they can act on. A tag nobody can
check is not.

**Not every sentence has to be a measurement.** "This will be hard to maintain"
is taste, and taste belongs in reviews. The rule is only that it must not be
dressed as a check.

## Verification

```sh
pnpm check:claims <file.md>
```

Exit 0 means every claim carries what its grade promises. It does not mean the
claims are true - only that they are the kind of claim that could be tested.
