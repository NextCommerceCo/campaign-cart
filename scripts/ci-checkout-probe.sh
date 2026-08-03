#!/usr/bin/env bash
#
# Answers one question `npm run ci:local` cannot: does the repository still work
# when checked out the way a CI runner checks it out?
#
#   bash scripts/ci-checkout-probe.sh
#
# Why this exists. `docsVersions.test.ts` reads release tags through
# `git for-each-ref refs/tags`. Your own clone has tags, so the test passes here
# and fails on the runner — which is exactly what happened, on every build, until
# the workflow gained `fetch-depth: 0`.
#
# The trap worth knowing: `fetch-tags: true` on actions/checkout does NOT fix it.
# It only removes `--no-tags` from the fetch. The command still runs `--depth=1`
# against a single-SHA refspec, and git's tag auto-follow only brings tags that
# point at commits it downloaded — none, at that depth. This script reproduces
# both forms so the difference is visible rather than argued about.
#
# It clones from your local repo, so it proves the *fetch shape*, not GitHub.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

repo=$PWD
sha=$(git rev-parse HEAD)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

probe() {
  local name=$1 dir=$tmp/$2
  shift 2
  mkdir -p "$dir"
  git -C "$dir" init -q
  git -C "$dir" remote add origin "file://$repo"
  git -C "$dir" -c protocol.version=2 fetch --prune --no-recurse-submodules "$@" \
    >/dev/null 2>&1 || true
  printf '%-46s %s tags\n' "$name" "$(git -C "$dir" for-each-ref refs/tags | wc -l)"
}

echo "Reproducing how the runner fetches this repo:"
echo
probe "fetch-depth: 1 (default, and with fetch-tags)" shallow \
  --depth=1 origin "+$sha:refs/remotes/origin/probe"
probe "fetch-depth: 0 (what the workflow now sets)" full \
  origin '+refs/heads/*:refs/remotes/origin/*' '+refs/tags/*:refs/tags/*'

echo
echo "Zero tags in the first row is the CI failure; a non-zero second row is the fix."
echo "Your own clone currently sees $(git for-each-ref refs/tags | wc -l) tags."
