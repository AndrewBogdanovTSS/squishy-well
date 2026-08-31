# Demoing the pipeline

How to show the evidence layer running in CI, where it is no longer the author
checking their own work.

That distinction is the whole reason this workflow exists. Every check here can
be run locally by whoever wrote the change, which makes a passing local run a
*self-report*: anyone who skipped the gathering step skips the verifying step
just as easily. [`.github/workflows/evidence.yml`](../.github/workflows/evidence.yml)
is the independent runner. Same commands, different party.

## What the workflow does

Two jobs, on every push to `master` and every pull request.

**`build`** - lint, typecheck, engine tests, checker tests. Ordinary CI. It fails
the build like anyone else's.

**`evidence`** - the layer itself, with every check as its own named step, so the
run page reads as a list of claims that were checked rather than one opaque green
tick:

| Step | Asserts |
|---|---|
| A grounded review passes the claim linter | the repaired fixture stays clean |
| An ungrounded review still fails it | **the broken fixture stays broken** |
| A valid access receipt passes | the good receipt still resolves |
| A stale baseline is caught | the stale-base failure is still detected |
| The README still tells the truth | every claim in `README.md` |
| Engine behaviour is unchanged | the three replay fingerprints |
| Governance | whether anything actually runs the above |

The two negative steps matter as much as the positive ones. A checker that
quietly stops finding things is worse than no checker, because nobody notices. If
either of those steps ever goes green, something in the linter broke.

After the checks, `pnpm ci:summary` renders the governance report into the run's
job summary, and on a pull request posts it as a single comment that is updated in
place rather than a new one per push.

## The live demo, in four steps

Roughly three minutes, and it needs network. Have screenshots as a fallback.

### 1. Show a green run

Open the Actions tab and pick the most recent run on `master`. Point at two
things:

- the **step list** - seven named checks, each one a claim about the repository
- the **job summary** at the top of the run, rendered from the machine-readable
  block that `pnpm check:all` prints on every run

Say the line that goes with the summary: a clean report and a missing report must
never look the same, which is why the block is emitted unconditionally and why
`ci:summary` has a branch that says **"no report"** in as many words.

### 2. Break something in a pull request

```bash
git switch -c demo/stale-readme
sed -i 's/71 tests/72 tests/' README.md
git commit -am "docs: update the test count"
git push -u origin demo/stale-readme
```

Open the pull request. That commit message is deliberately reasonable - it looks
like documentation housekeeping, and nothing about the diff suggests a problem.

### 3. Watch it fail

The `evidence` job fails on **The README still tells the truth**, naming the file,
the value claimed and the value found. The report lands as a comment on the pull
request within a minute.

The point to make out loud: nobody on the review would have caught this. It is a
number in a README, in a one-line diff, in a change whose description is accurate.

### 4. Fix it and watch the same check pass

```bash
git checkout README.md
git commit -am "docs: revert the test count"
git push
```

The comment updates in place. Same check, same command, different answer -
which is the definition of a claim that could have come out otherwise.

Delete the branch afterwards:

```bash
git push origin --delete demo/stale-readme
git switch master && git branch -D demo/stale-readme
```

## Warn-only, and the flip

Governance runs with `continue-on-error: true`, so an unreachable invariant is
reported and the build stays green. That is deliberate: a gate switched on before
its report is clean teaches people to route around it.

Turning it into a real gate is one flag and one deletion:

```yaml
      - name: Governance - is anything actually running these?
        run: pnpm check:all --enforce | tee governance.log
```

Everything else in the workflow already fails the build today. Governance is the
only step still in observation mode, and the summary says so on every run.

## If you are copying this

Three things are easy to get wrong:

- **`fetch-depth: 0`.** The receipt check resolves a merge-base, and a shallow
  clone cannot. It would report `unverifiable` - honest, and useless as a gate.
- **The negative steps need an explicit inversion.** `if <cmd>; then exit 1; fi`
  rather than `! <cmd>`, so the failure message says which checker stopped
  working instead of just failing the shell.
- **The pull-request comment needs `pull-requests: write`** and is skipped for
  pull requests from forks, where the token is read-only by design.
