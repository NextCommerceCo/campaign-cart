/**
 * Dead-code gate: unused locals, parameters, and imports.
 *
 * `tsconfig.json` sets `noUnusedLocals: false` and `noUnusedParameters: false`,
 * so nothing in this repo has ever reported a dead import, local, or parameter
 * — see finding 171 in docs/code-findings.md, where `RawDataHelper` sat
 * imported-and-unused for a whole wave. Turning the flags on in `tsconfig.json`
 * itself would change what `npm run build`/`type-check` compiles, which is a
 * decision for that file's owner, not this gate — so `tsconfig.unused-check.json`
 * flips them on in a config used only here, extending `tsconfig.eslint.json`'s
 * already-wide program (src + e2e + scripts + build configs).
 *
 * This is a ratchet, same shape as `type-check-tests.mjs` /
 * `type-check-tests.baseline.json`: known occurrences are frozen in
 * `check-unused.baseline.json` and tolerated; a NEW one — in a new place, or a
 * new kind in an already-frozen file — fails the run.
 *
 *   npm run check:unused          # check (this is what CI should run)
 *   npm run check:unused:update   # rewrite the baseline from current state
 *
 * Only TypeScript's "unused" diagnostic family is in scope (see UNUSED_CODES
 * below) — every other diagnostic `tsconfig.unused-check.json` might surface
 * is `type-check:tests`'s job, not this gate's, so it is filtered out here
 * even though it comes from the same `tsc` run.
 *
 * Fingerprints deliberately exclude line/column, same reasoning as
 * `type-check-tests.mjs`: a line number is a property of formatting, not of
 * the error (see .claude/rules/documentation.md's "Never cite a source line
 * number in anything generated"). The fingerprint is (file, TS code,
 * normalized message), kept as a multiset.
 *
 * What this gate does NOT cover: an unused *export* — a function or constant
 * nothing imports, but which is still "read" inside its own file, or not read
 * anywhere but never flagged because `noUnusedLocals` only inspects a single
 * file's own bindings, never cross-file import graphs. Finding 167 (a 267-line
 * module, 23 exports, zero callers) and finding 158 (an exported constant
 * duplicated locally, original left with no importers) are both invisible to
 * this gate for exactly that reason — it would take a project-wide reference
 * count (e.g. a `ts-prune`-style pass over the checker's symbol table) to
 * catch those, which is a different tool than turning on two compiler flags.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TSC = join(ROOT, 'node_modules/typescript/bin/tsc');
const BASELINE_PATH = join(ROOT, 'scripts/check-unused.baseline.json');
const UPDATE = process.env.UPDATE_UNUSED_BASELINE === '1';

// TypeScript's "declared but never used" family. 6133 is the one this repo has
// hit so far (covers unused locals, parameters, and named imports alike); the
// others are included so a whole-declaration-unused shape (e.g. every binding
// in one destructure, or every import in one `import { … }`) still lands in
// this gate instead of silently falling outside every filter.
const UNUSED_CODES = new Set(['6133', '6192', '6198', '6205']);

// ---------------------------------------------------------------------------
// run tsc and parse its diagnostics
// ---------------------------------------------------------------------------

function runTsc() {
  let stdout = '';
  try {
    stdout = execFileSync(
      process.execPath,
      [TSC, '-p', 'tsconfig.unused-check.json', '--noEmit', '--pretty', 'false'],
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

  return diagnostics
    .map(d => ({
      file: d.file,
      code: d.code,
      message: d.messageLines.join(' ').replace(/\s+/g, ' ').trim(),
    }))
    .filter(d => UNUSED_CODES.has(d.code));
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
  const baselineData = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : { notes: {} };
  const baseline = {
    $comment:
      'Frozen unused-local/parameter/import occurrences (tsconfig.unused-check.json), ' +
      'each one a place noUnusedLocals/noUnusedParameters would otherwise fail the ' +
      'build on. A ratchet: new occurrences fail `npm run check:unused`; entries here ' +
      'are tolerated until fixed. Regenerate: npm run check:unused:update. Fingerprint ' +
      'is (file, TS code, normalized message) — no line numbers, see the header comment ' +
      'in scripts/check-unused.mjs for why. `notes` records *why* each frozen file is ' +
      'frozen rather than fixed — keep it in sync by hand when the set of frozen files ' +
      'changes.',
    count: currentFingerprints.length,
    errors: currentFingerprints,
    notes: baselineData.notes ?? {},
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written to ${relative(ROOT, BASELINE_PATH)} (${currentFingerprints.length} occurrence(s)).`);
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
  `\nUnused locals/parameters/imports: ${currentFingerprints.length} occurrence(s), ` +
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
    '\nFAIL — new unused local/parameter/import. Fix it (delete the dead code, or use a ' +
      'leading `_` if it exists only to satisfy an interface/callback signature), or if ' +
      'freezing it is deliberate: npm run check:unused:update — and add a `notes` entry ' +
      'saying why.\n'
  );
  process.exit(1);
}

if (fixedOccurrences.length) {
  console.log(`${fixedOccurrences.length} occurrence(s) fixed since the baseline was written. Lock it in: npm run check:unused:update\n`);
}

console.log('OK — no new unused locals/parameters/imports.\n');
