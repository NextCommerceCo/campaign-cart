/**
 * Type gate for the wider program — test files included.
 *
 * `npm run type-check` runs against `tsconfig.json`, which excludes
 * `**\/*.test.ts` and `**\/*.spec.ts` (tests are not part of the shipped
 * build). That means the SDK's type gate has never once checked a test file —
 * including the `Pick<IApiClient, …>` test-double annotations added
 * specifically so the compiler would catch drift (see finding 116 in
 * docs/code-findings.md).
 *
 * `tsconfig.eslint.json` already covers the wider program (src + e2e +
 * scripts + the two build configs) — it exists for ESLint's type-aware rules.
 * This script runs `tsc` against that same config and reports on the result.
 *
 * There is a backlog of pre-existing errors in real test/e2e code that is not
 * this script's job to fix (touching test source to make a type error vanish
 * is worse than leaving it, since it can hide the thing the test meant to
 * check). So this is a ratchet, same shape as `docs-coverage.mjs` /
 * `docs-coverage.baseline.json`: known errors are frozen in
 * `type-check-tests.baseline.json` and tolerated; a NEW error — in a new
 * place, or a new kind of error in an already-frozen file — fails the run.
 *
 *   npm run type-check:tests          # check (this is what CI should run)
 *   npm run type-check:tests:update   # rewrite the baseline from current state
 *
 * Fingerprints deliberately exclude line/column. A line number is a property
 * of formatting, not of the error — see .claude/rules/documentation.md's
 * "Never cite a source line number in anything generated" — and the same
 * problem applies here: a reformat would shift every line in a file and the
 * ratchet would either false-fail (lines moved) or false-pass (an old
 * fingerprint still "matches" a coincidentally identical line number holding a
 * different error). The fingerprint is (file, TS code, normalized message)
 * instead, kept as a multiset — two identical errors in one file are two
 * entries, not one, so fixing one while a duplicate remains still shows up as
 * a change, and a second identical error appearing elsewhere in the same file
 * is counted as a new occurrence rather than silently absorbed into the first.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSC = join(ROOT, 'node_modules/typescript/bin/tsc');
const BASELINE_PATH = join(ROOT, 'scripts/type-check-tests.baseline.json');
const UPDATE = process.env.UPDATE_TYPE_CHECK_BASELINE === '1';

// ---------------------------------------------------------------------------
// run tsc and parse its diagnostics
// ---------------------------------------------------------------------------

function runTsc() {
  let stdout = '';
  try {
    stdout = execFileSync(
      process.execPath,
      [TSC, '-p', 'tsconfig.eslint.json', '--noEmit', '--pretty', 'false'],
      { cwd: ROOT, encoding: 'utf8' }
    );
  } catch (err) {
    // tsc exits non-zero when there are errors — that is the expected case.
    stdout = err.stdout ?? '';
    if (!stdout && err.stderr) stdout = err.stderr;
  }
  return stdout;
}

const DIAGNOSTIC_START = /^(.+?)\((\d+),(\d+)\): (error|warning) TS(\d+): (.*)$/;

/**
 * Every diagnostic tsc printed, as `{ file, code, message }` — `file` relative
 * to the repo root, `message` the full (possibly multi-line) text with
 * whitespace collapsed. Line/column are read only to recognise where one
 * diagnostic ends and the next begins; they are not kept.
 */
function parseDiagnostics(output) {
  const lines = output.split('\n');
  const diagnostics = [];
  let current = null;

  for (const line of lines) {
    const m = DIAGNOSTIC_START.exec(line);
    if (m) {
      if (current) diagnostics.push(current);
      const [, file, , , , code, message] = m;
      current = {
        file: relative(ROOT, resolve(ROOT, file)).split('\\').join('/'),
        code,
        messageLines: [message],
      };
    } else if (current && line.trim().length > 0) {
      current.messageLines.push(line.trim());
    }
  }
  if (current) diagnostics.push(current);

  return diagnostics.map(d => ({
    file: d.file,
    code: d.code,
    message: d.messageLines.join(' ').replace(/\s+/g, ' ').trim(),
  }));
}

function fingerprint(d) {
  return `${d.file} :: TS${d.code} :: ${d.message}`;
}

// ---------------------------------------------------------------------------
// compare against the baseline (a multiset — duplicates matter)
// ---------------------------------------------------------------------------

function counts(fingerprints) {
  const map = new Map();
  for (const fp of fingerprints) map.set(fp, (map.get(fp) ?? 0) + 1);
  return map;
}

const output = runTsc();
const diagnostics = parseDiagnostics(output);
const currentFingerprints = diagnostics.map(fingerprint).sort();

if (UPDATE) {
  const baseline = {
    $comment:
      'Frozen type errors in the wider program (tsconfig.eslint.json), which ' +
      'includes test files tsconfig.json excludes. A ratchet: new errors fail ' +
      '`npm run type-check:tests`; entries here are tolerated until fixed. ' +
      'Regenerate: npm run type-check:tests:update. Fingerprint is ' +
      '(file, TS code, normalized message) — no line numbers, see the header ' +
      'comment in scripts/type-check-tests.mjs for why.',
    count: currentFingerprints.length,
    errors: currentFingerprints,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written to ${relative(ROOT, BASELINE_PATH)} (${currentFingerprints.length} error(s)).`);
  process.exit(0);
}

const baselineData = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { errors: [] };
const frozenFingerprints = baselineData.errors ?? [];

const frozenCounts = counts(frozenFingerprints);
const currentCounts = counts(currentFingerprints);

const newOccurrences = [];
for (const [fp, count] of currentCounts) {
  const extra = count - (frozenCounts.get(fp) ?? 0);
  for (let i = 0; i < extra; i++) newOccurrences.push(fp);
}

const fixedOccurrences = [];
for (const [fp, count] of frozenCounts) {
  const removed = count - (currentCounts.get(fp) ?? 0);
  for (let i = 0; i < removed; i++) fixedOccurrences.push(fp);
}

console.log(
  `\nType-check (tests included): ${currentFingerprints.length} error(s), ` +
    `${frozenFingerprints.length} frozen in baseline.\n`
);

if (fixedOccurrences.length) {
  console.log(`CLOSED (${fixedOccurrences.length}):`);
  for (const fp of fixedOccurrences) console.log(`  ${fp}`);
  console.log('');
}

if (newOccurrences.length) {
  console.error(`NEW (${newOccurrences.length}) — not in the baseline:`);
  for (const fp of newOccurrences) console.error(`  ${fp}`);
  console.error(
    '\nFAIL — new type error(s) in the wider program. Fix them, or if the gap is ' +
      'deliberate, freeze it with: npm run type-check:tests:update\n'
  );
  process.exit(1);
}

if (fixedOccurrences.length) {
  console.log(`${fixedOccurrences.length} error(s) fixed since the baseline was written. Lock it in: npm run type-check:tests:update\n`);
}

console.log('OK — no new type errors in the wider program.\n');
