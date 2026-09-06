---
name: review-change
description: Review a change in this repository end to end - establish access, gather evidence before writing, ground every claim, then verify the review against the repo before handing it over. Use when asked to review a diff, a branch, or a pull request here.
---

# review-change

A review is a set of claims about a repository. This skill is the order that
makes those claims checkable, and every step ends in a command rather than an
intention.

Contract: [`AGENTS.md`](../../../AGENTS.md). Read it first; this skill assumes it.

## When to use

- "review this branch / this PR / these changes"
- before merging anything that touches `packages/tetris-core`
- when an existing review looks confident and you want to know whether it is
  grounded

## Steps

### 1. Establish access

Work from a real checkout. Capture the head commit and resolve the base from a
fetched remote-tracking ref, never a bare local branch name:

```sh
git fetch origin <target>
git rev-parse HEAD
git merge-base origin/<target> <head>
git diff --name-only <base>...<head>
```

Why the base matters more than it looks: a local branch that has fallen behind
still produces a diff. A *larger* one. Nothing about the result looks wrong.

### 2. Gather the evidence before writing a word

```sh
pnpm evidence --base <base> --head <head>
```

This is the step people skip, and skipping it is not laziness - it is that
gathering sits off the path you are on once you have started composing findings.
Running it first removes the decision.

`evidence.local.md` now includes a **Suggested claims** section and a
**Suggested sample integrity** section - each artifact's id already
substituted, each changed file's first line already quoted. Writing the review
should mean copying blocks out of that file and deleting the ones that do not
apply, not looking anything up by hand.

If engine files changed, also run:

```sh
pnpm fingerprint
```

A moved fingerprint is the answer to "is this behaviour-preserving", and it is
the only answer that could have come out otherwise.

### 3. Read the diff before the description

The title, the description and any existing approvals are anchors. Read the code
first and write down a verdict *before* reading them, then check afterwards
whether the description changed your mind and why.

### 4. Write the review

Open with the access receipt from `AGENTS.md`, above any verdict. Then findings,
each as a claim with its grade and backing. Cite locations as `` `path:line` ``
so they can be resolved.

Prefer an honest `UNVERIFIED` over a `VERIFIED` you cannot back. The tag is not a
confidence display; it is a promise about what exists next to it.

### 5. Verify your own review before handing it over

```sh
pnpm check:receipt review.local.md
pnpm check:claims review.local.md
```

Both must exit 0. If either fails, the review is blocked regardless of how
thorough it reads.

Be honest about what this step is: the party being checked is running the check.
That is a conflict of interest, and it is why the same two commands run in CI on
the demo fixtures. Treat a passing self-check as a self-report, not as proof.

## Verification

Before handing over, confirm:

1. The receipt's base came from `origin/<target>`, not a local branch name.
2. Every `VERIFIED[id]` addresses a real artifact someone else can re-run, collected at the reviewed commit.
3. Every location cited resolves at the reviewed commit, and every cited file carries its own verbatim sample quote.
4. Anything skipped is disclosed at the top, per the execution receipt rule.
5. If this review's own verdict on a prior review turned out to be a miss, that commit's message names it - see AGENTS.md § Recording a miss.
