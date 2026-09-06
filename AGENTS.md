# AGENTS.md - the contract for anything that writes here

One file, referenced by the others. A rule stated only inside one tool's config
never reaches the people or agents that never load that tool.

This is written runtime-neutral on purpose: it is a contract for *any* coding
agent, not instructions for one product.

**The cross-cutting rule every section below is graded against**: the honest
path must be cheaper than the convenient one - fewer tokens, fewer separate
decisions, less deviation from the trajectory you are already on. If following
a rule in this file costs more than skipping it, the rule is broken, not you -
see [`docs/decisions/0002-evidence-layer-v2.md`](docs/decisions/0002-evidence-layer-v2.md).

---

## Hard rules

1. **Never bypass a hook.** No `--no-verify`, no `--no-gpg-sign`, no disabling a
   check to make a change land. If a hook fails, the hook found something.
2. **Never commit or push unless asked to.** Show the diff and the proposed
   commit message instead.
3. **Never edit a fixture to make a test pass.** A moved replay fingerprint means
   engine behaviour changed. Either that was intended - in which case regenerate
   with `pnpm --filter @tetris/core fixtures` and say so - or it is the bug.
4. **Never widen a test run to make it look thorough.** Run what the change
   touches. The engine suite proves nothing about a change to a Vue component.
5. **Never assert the output of a command you did not run.** Run it and paste it,
   or tag the claim `UNVERIFIED`. There is no third option, and "it would have
   printed" is the first one wearing a disguise.

---

## Pre-review access gate

Before reviewing a change here, in this order:

1. **Work from a real checkout.** Fragments fetched from a hosting API are not a
   substitute: no line context, no sibling files, no grep, no history.
2. **Resolve the head commit**: `git rev-parse HEAD`. This exact value goes in
   the receipt.
3. **Resolve the base from a fetched remote-tracking ref**:

   ```sh
   git fetch origin <target>
   git merge-base origin/<target> <head>
   ```

   **Never use a bare local branch name as a baseline.** A local branch only
   advances when someone pulls it. A stale one silently attributes every commit
   merged since to the change under review - and it fails in the reassuring
   direction, because the diff comes out *larger*, so nothing looks missing.
   Both halves are required: `origin/<target>` is itself only as fresh as the
   last fetch.
4. **Confirm the range**: `git diff --name-only <base>...<head>`. Three dots.
5. **Gather the evidence before writing**: `pnpm evidence --base <base> --head <head>`.

If access cannot be established, say so and stop. A review that cannot name where
it read from is not a review with a caveat; it is a guess with formatting.

---

## Access receipt

The first block of a review, above any verdict, so a reader sees where it was
written from before they see what it concluded. Every field is a literal value
the reader can re-derive by running the same command.

```markdown
**Repo path**: <the checkout>
**Branch**: <branch under review>
**HEAD SHA**: <full 40 characters, from git rev-parse HEAD>
**Target branch**: <the branch this change is aimed at>
**Base SHA**: <full 40 characters, from git merge-base origin/<target> <head>>
**Diff stat**: <the totals line of git diff --stat <base>...<head>>
**Files in diff**: <integer>
**Files opened during review**: <integer>
**Sample integrity**: `<a changed file>` -> `<its first non-blank line, verbatim>`
**Tools used**: <what was actually invoked, not what would have been>
```

One `Sample integrity` line **per file any claim in the review cites**, not
one overall - a single quote proves a file was opened, not the files the
review is actually about. `pnpm evidence` pre-fills one per changed file so
deleting the ones you did not need is the whole edit.

Checked by `pnpm check:receipt <review.md>`.

The sample line is the cheapest check here and the hardest to fake: quoting the
first non-blank line of a file nobody opened requires guessing it exactly, and
nobody guesses an import statement verbatim. A close-but-not-identical quote is
the signature of a file reconstructed from memory of what such a file usually
says.

---

## Claim grammar

Every finding is a claim, and every claim carries the backing its grade requires.
A grade with nothing behind it costs one token to type, which is exactly why it
gets checked rather than trusted.

```markdown
**Claim**: <one sentence>
**Grounding**: VERIFIED | DOCUMENTED | INFERRED | UNVERIFIED
```

| Grade | Means | Must carry |
|---|---|---|
| VERIFIED[id] | I ran it, and this is the exact run | an artifact carrying that same id, anywhere in the document, collected at the reviewed commit |
| VERIFIED (bare) | I ran it | an artifact block within 15 lines - deprecated, warns; becomes an error after the date in `docs/decisions/0002-evidence-layer-v2.md` |
| DOCUMENTED | someone specified it | a citation: URL, § section, issue id, or a file in this repo |
| INFERRED | I reasoned it | two or more numbered steps |
| UNVERIFIED | I believe it | nothing, and it says so |

An artifact block is the unit of evidence:

````markdown
```artifact:engine-8443da@0047f95
$ pnpm fingerprint
[ ok ] bot-game.replay.json replays to its recorded fingerprint
exit: 0
```
````

Exact command, verbatim output, exit code, and - since the id-addressed form -
a stable id plus the commit it was collected at, both inside the fence's own
info string rather than buried in a hash a reader would have to invert. Rigid
on purpose: rigid is what makes it checkable by a script and re-runnable by a
human. `pnpm evidence` computes the id and writes a ready-to-paste
`**Claim**` / `**Grounding**: VERIFIED[id]` skeleton next to it - referencing
an artifact is supposed to mean leaving that block in place, never looking one
up by hand. One artifact should back at most two claims; more than that is a
warning, since it usually means evidence was never actually gathered for the
rest.

**An honest UNVERIFIED is worth more than a decorative VERIFIED.** It tells the
next reader precisely where the review is thin, which is information. A tag
nobody can check is not.

Banned unless the line is tagged `UNVERIFIED`: vague comparatives ("more robust",
"cleaner"), unchecked equivalence ("behaves identically", "should be
equivalent"), and success words ("works", "fixed", "passes") without a stated
`**Effect**:`. Not because they are rude - because nothing could contradict them.

Checked by `pnpm check:claims <review.md>`.

---

## Position integrity

Revise a finding when the evidence changes, not when the pressure does.

- "Here is the spec / the test output / an argument that holds" is evidence.
- "You're wrong", "the lead signed off", "everyone does it this way" is pressure.

Under pressure without evidence, restate the concern. Agreement is not a service.

---

## Execution receipt

If a step in an established protocol was skipped or abbreviated, say so at the
top of the output, before the content. Honest beats tidy: a reader who knows what
was skipped can compensate, and a reader who does not, cannot.

## Flaky is a real outcome, not an excuse

A check can report `flaky`: it failed at a commit where it has already
recorded a pass, so nothing about the code changed between the two runs. That
is real information and it is not the same claim as a regression - but it is
also not a way out. The same check flagged flaky three times converts to a
real error automatically (`pnpm journal:report` shows the count). Never
re-word a genuine failure as "probably flaky" to justify skipping it; let the
journal make that call, because it is the only thing keeping score.

## Recording a miss

If a commit fixes a bug that a clean review missed, add one line to the
commit's own message naming the review or PR that missed it:

```
Missed-By: demo/reviews/good-claims.md
```

`pnpm check:all` extracts this into `journal.jsonl` automatically. It is the
only way the layer learns something a passing check did not already tell it -
see [`docs/decisions/0002-evidence-layer-v2.md`](docs/decisions/0002-evidence-layer-v2.md).
