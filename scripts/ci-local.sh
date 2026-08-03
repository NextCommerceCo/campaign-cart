#!/usr/bin/env bash
#
# Runs what .github/workflows/build.yml runs, in the same order, with the same
# runner (bun) — so a green run here means the same thing CI means.
#
#   npm run ci:local
#
# Two deliberate differences from CI, both to protect the working tree:
#
#   * the build goes to a temp directory, because `npm run build` overwrites the
#     committed dist/ and that is Bond's to regenerate deliberately;
#   * it checks dist/ is still clean afterwards, since a stray build is the one
#     way this script could leave a mess.
#
# It cannot reproduce a CI-only failure that depends on the *checkout* — most
# notably missing git tags, which is what broke `docsVersions.test.ts` until the
# workflow gained `fetch-depth: 0`. For that, see `scripts/ci-checkout-probe.sh`.
set -o pipefail
cd "$(git rev-parse --show-toplevel)" || exit 1

export CI=true
runner=$(command -v bun >/dev/null 2>&1 && echo bun || echo npm)
[ "$runner" = npm ] && echo "note: bun not found, using npm — CI uses bun"

fail=0
step() {
  printf '\n=== %s ===\n' "$1"
  shift
  "$@" || { echo ">>> FAILED: $*"; fail=1; }
}

step "Type check"      "$runner" run type-check
step "Test"            "$runner" run test:coverage
step "Docs coverage"   "$runner" run docs:coverage
step "Docs link check" "$runner" run docs:check

printf '\n=== Build (to a temp dir; dist/ is left alone) ===\n'
out=$(mktemp -d)/ci-build
if npx vite build --outDir "$out" --emptyOutDir >/dev/null 2>&1; then
  echo "build ok -> $out"
else
  echo ">>> FAILED: vite build"
  fail=1
fi

printf '\n=== dist/ untouched? ===\n'
if git status --porcelain -- dist | grep -q .; then
  echo ">>> dist/ was modified — do not commit that"
  fail=1
else
  echo "clean"
fi

printf '\n'
[ "$fail" -eq 0 ] && echo "ALL GREEN — matches what CI checks" || echo "SOMETHING FAILED (see >>> above)"
exit $fail
