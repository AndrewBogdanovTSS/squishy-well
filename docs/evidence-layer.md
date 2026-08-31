# The evidence layer

Five commands, each turning one kind of claim into something that could be proved
wrong, and one that checks whether anything runs them.

None of this is specific to a tetris game. Copy any of it.

## Why

This repository already enforced the thing it cared most about. The three-layer
architecture is not a convention here - `eslint.config.js` makes a `vue` or
`three` import inside the engine a build error, and says why in its header:

> the three-layer architecture is worth nothing if it is enforced by good
> intentions

Everything else ran on trust. The README asserted a test count, a build size and
a set of pinned versions; all were true when written, and none had a clock. A
review of a change here could assert anything at all about what it had read and
what it had run, in prose that reads identically whether or not any of it
happened.

The gap between those two states is the whole subject. A claim is worth something
when you can name, in advance, what would prove it wrong. **Falsifiable** does not
mean fragile or fake-able; it means testable. A claim that survives every possible
observation is not strong, it is empty.

## The tour

Run these in order. Each takes seconds.

### 1. `pnpm check:docs` - does the README still tell the truth?

The smallest possible version of the whole idea, and the one with no AI anywhere
in the story. A README is a pile of assertions written once and trusted forever.
This checks them: the test count against the suite, the bot-game numbers against
the fixture's own fingerprint, the advertised routes against the page files, the
"pinned to exact versions" claim against `package.json`.

Watch the build-size row. Without a build on disk it reports `unverifiable` -
not a pass. **Three outcomes, never two.** A checker that reports success when it
could not run manufactures confidence out of nothing.

Then try this, because a check nobody has seen fail is indistinguishable from a
check that cannot fail: change `71 tests` to `72 tests` in the README and run it
again.

### 2. `pnpm fingerprint` - did engine behaviour change?

"The refactor is behaviour-preserving" is one of the most common sentences in
software and one of the least backed, because backing it by hand is tedious.
Here it is one command: three recorded games replayed through the current
engine, compared against the fingerprints stored with them.

Same fingerprints, and the claim survived a test it could have failed. Different,
and either the change was not behaviour-preserving or it was meant to be - in
which case regenerate deliberately with
`pnpm --filter @tetris/core fixtures`.

### 3. `pnpm evidence --base <ref> --head <ref>` - gather before you write

Runs the diff summary, the lint, the typecheck and the tests, and writes them
into `evidence.local.md` as artifact blocks a review can cite.

The problem this solves is not dishonesty. Anyone writing a review - person or
model - reliably uses evidence already in front of them and unreliably chooses to
go and get it halfway through composing a sentence. Gathering is off the path
they are on. So run it first, with something that is not the reviewer.

It refuses to run if the working tree is not at the commit you asked about,
because evidence gathered at the wrong commit describes a different codebase than
the review does.

### 4. `pnpm check:claims <review.md>` - is every claim backed?

A review can label each claim VERIFIED, DOCUMENTED, INFERRED or UNVERIFIED. That
convention is worth nothing on its own: a tag costs one token to write, and
anything a writer can satisfy for free carries no information.

So the tags get checked. VERIFIED needs an artifact block next to it. DOCUMENTED
needs a citation. INFERRED needs its reasoning. Language that cannot be wrong -
"more robust", "behaves identically", "it works" - needs a stated effect or an
explicit UNVERIFIED.

Try it on the fixtures:

```bash
pnpm check:claims demo/reviews/bad-claims.md    # 7 errors, 1 warning
pnpm check:claims demo/reviews/good-claims.md   # clean
```

Read those two files side by side. The repaired one is longer, hedges more and
sounds less confident - and it is the only one of the two that could be proved
wrong.

### 5. `pnpm check:receipt <review.md>` - was this written against this repo?

A review states where it read from, in a fixed block above any verdict: the
commit, the baseline, how many files the diff touched, how many were opened, and
one file quoted verbatim as proof it was really opened.

The check that matters most is the baseline. `git diff base...head` is only as
honest as `base`, and a local branch reference goes stale in silence: it still
looks like a mainline, the file counts still reconcile with each other, and the
review simply describes a much bigger change than the one under review. It fails
in the reassuring direction, because the diff comes out *larger*, so nothing
looks missing.

So the baseline is checked by **equality** against
`merge-base origin/<target> <head>`, never by ancestry - a stale local tip is
still an ancestor of the mainline, so an ancestry check waves it straight
through.

```bash
sh demo/setup-refs.sh
pnpm check:receipt demo/reviews/good-receipt.md   # clean
pnpm check:receipt demo/reviews/bad-receipt.md    # stale baseline, and it says how far behind
```

### 6. `pnpm check:all` - does anything actually run these?

The one that checks the checks.

A decision record here declares its invariants and names the command that
enforces each one. This resolves those names against the package scripts and
follows the trigger graph - the git hook and the CI workflow, expanded through
the scripts they call - to find out whether anything reaches them. An invariant
nothing reaches is a finding.

That matters because of the least interesting and most common failure in this
whole area: the rule was written, the tool was built, the documentation said it
was enforced, and nothing ever ran it. Ordinary repositories cannot tell a
decorative rule from a live one.

```bash
pnpm check:all                                                    # this repo: clean
pnpm check:all --only reachability --decisions demo/decisions     # a record that is mostly decoration
```

It prints a machine-readable block on every run, **including a clean one**,
because an absent report is the only signal a reader has for "never ran".

## What runs it

| Trigger | Mode |
|---|---|
| [`.github/workflows/evidence.yml`](../.github/workflows/evidence.yml) on push and pull request | warn-only |
| `.githooks/pre-push`, after `pnpm hooks:install` | warn-only, `--fast` |

Warn-only is deliberate. A gate switched on before its report is clean teaches
people to route around it. Flipping to enforcing is one word - add `--enforce` to
the governance step and delete its `continue-on-error`.

The hook is defence in depth, not a gate: anyone can pass `--no-verify`. Saying
so plainly beats implying a guarantee it cannot give.

## What this does not do

- It does not make findings correct. Access, gathered evidence and grounded
  claims are necessary, not sufficient. None of the three makes a claim true.
- It does not stop someone determined to fake it. It removes the *default*
  failure, which is the one that actually happens.
- It does not judge taste. "This will be hard to maintain" is a legitimate review
  comment and always will be. It just must not be dressed as a check.
- The reachability scan reads literal command strings, so a command assembled at
  runtime is invisible to it. Blind spots that are written down can be calibrated
  against; blind spots that are not, cannot.

## The design rules, if you copy this

1. Nothing goes in that cannot be pointed at and explained.
2. One file, one idea, small enough to read in a sitting.
3. No new dependencies. Tooling that needs its own runtime does not survive its
   first dependency review.
4. Every script says, in its first comment, which claim it makes falsifiable.
5. Three outcomes: pass, fail, `unverifiable`. Exit `2` is bad usage and is never
   a pass.
6. Warn-only first, and name the person who owns the flip before you need them.
