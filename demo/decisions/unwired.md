---
id: DEMO-0001
status: accepted
date: 2026-08-31
invariants:
  - Every review is spell-checked before posting; enforced by `pnpm check:spelling`.
  - Bundle size never grows by more than 5% in a single change; enforced by `pnpm size-limit`.
  - Reviewers consider the accessibility impact of every visual change; enforced by a reviewer.
  - Recorded games replay to their stored fingerprints; enforced by `pnpm fingerprint`.
review_by: 2027-08-31
---

# DEMO-0001: a decision record that is mostly decoration

This record is a fixture. Run:

```bash
pnpm check:all --only reachability --decisions demo/decisions
```

Four invariants, and they fail in four different ways. Read them before running
anything - every one of them looks exactly as authoritative as the others.

1. **`pnpm check:spelling`** is not a script in `package.json`. The record names
   a command that does not exist. Nobody noticed, because nobody was looking, and
   the sentence reads as a rule that is in force.

2. **`pnpm size-limit`** - same shape, and this one is the more common case in
   real projects: a tool the team genuinely intended to add, named in a document
   that shipped before the tool did.

3. **"enforced by a reviewer"** names no runnable command at all. This is a
   *warning*, not an error, and the distinction matters: plenty of real rules are
   enforced by people, and pretending otherwise would push authors into naming a
   fake command to get a green check. The finding just says out loud that this
   one cannot be verified mechanically.

4. **`pnpm fingerprint`** exists, and something runs it. This is what a live
   invariant looks like, and it is here so the other three have something to be
   compared against.

The point is not that any individual line is careless. It is that a record can
carry `status: accepted`, name its enforcement, pass every human review, and be
inert - and until something resolves those names, nothing in the repository can
tell an enforced rule from a decorative one.
