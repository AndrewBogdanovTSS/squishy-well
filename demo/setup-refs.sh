#!/usr/bin/env sh
# Creates the two references the receipt demos need.
#
# The repository has a short, tidy history, which is exactly the wrong shape for
# showing a baseline going stale. So this script manufactures the situation, in
# the open, with two refs that exist only for the demo:
#
#   origin/demo-base    -> the first commit. A healthy baseline to diff against.
#   demo-target         -> a LOCAL branch left at the first commit
#   origin/demo-target  -> the same branch on the "remote", moved ahead to HEAD
#
# That last pair is the whole point. A local branch that has fallen behind its
# remote still looks like a mainline, and a review that takes its baseline from
# the local name silently attributes every commit it is missing to the branch
# under review. The diff comes out *larger*, so nothing looks missing.
#
# Nothing here touches master, and every ref it creates is named `demo-*`.
# Remove them with:  sh demo/cleanup-refs.sh
set -eu

cd "$(dirname "$0")/.."

FIRST=$(git rev-list --max-parents=0 HEAD | tail -1)
HEAD_SHA=$(git rev-parse HEAD)

echo "first commit : $FIRST"
echo "head         : $HEAD_SHA"

# A healthy baseline: the remote-tracking ref and the local branch agree.
git update-ref refs/remotes/origin/demo-base "$FIRST"
git branch -f demo-base "$FIRST" >/dev/null

# A stale baseline: the local branch is left behind while the remote moves on.
git branch -f demo-target "$FIRST" >/dev/null
git update-ref refs/remotes/origin/demo-target "$HEAD_SHA"

BEHIND=$(git rev-list --count demo-target..origin/demo-target)

echo
echo "created:"
echo "  origin/demo-base   -> $FIRST  (baseline for demo/reviews/good-receipt.md)"
echo "  demo-target        -> $FIRST  (LOCAL, $BEHIND commits behind its remote)"
echo "  origin/demo-target -> $HEAD_SHA"
echo
echo "now run:"
echo "  pnpm check:receipt demo/reviews/good-receipt.md   # passes"
echo "  pnpm check:receipt demo/reviews/bad-receipt.md    # fails on the stale baseline"
