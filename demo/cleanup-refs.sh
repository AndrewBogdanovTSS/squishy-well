#!/usr/bin/env sh
# Removes everything demo/setup-refs.sh created. Nothing else is touched.
set -eu

cd "$(dirname "$0")/.."

git branch -D demo-base 2>/dev/null || true
git branch -D demo-target 2>/dev/null || true
git update-ref -d refs/remotes/origin/demo-base 2>/dev/null || true
git update-ref -d refs/remotes/origin/demo-target 2>/dev/null || true

echo "demo refs removed"
