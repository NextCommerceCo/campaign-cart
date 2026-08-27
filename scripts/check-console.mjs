#!/usr/bin/env node
/**
 * Raw `console.*` calls in `src/`, ratcheted.
 *
 * `Logger` gates every line it prints: `warn`, `info` and `debug` are dropped in a
 * production bundle unless the page asked for debug mode
 * (`core/logger.ts › isDebugModeEnabled`). A bare `console.log` is not gated by
 * anything, so it prints on a shopper's page, forever, with whatever it was handed.
 *
 * `@typescript-eslint/no-console` already reports these. That is not a gate here:
 * `npm run lint` reports thousands of pre-existing problems, so one more line in the
 * pile is invisible. `console.log('🟢 [CreditCardService] Calling
 * Spreedly.tokenizeCreditCard with:', cardData)` sat on the production checkout path
 * that way until a human read a customer's console.
 *
 * So this is a ratchet in the shape of `check-unused-exports.mjs`: every occurrence
 * that exists today is frozen in `check-console.baseline.json`, and a new one fails.
 * Almost every frozen entry is inside a function a developer calls on purpose from
 * the console — `useAttributionStore.getState().debug()`, the debug panels, the
 * performance report — where printing *is* the job. That is why they are tolerated
 * and why a new one has to be looked at rather than counted.
 *
 * Only three things are excluded by path: `src/docs/` (code samples inside template
 * literals, never executed), `src/core/logger.ts` (the implementation), and tests
 * (not shipped). Everything else — `src/**\/debug/`, `test-mode.ts`, the state
 * stores' `debug()` helpers — is scanned and frozen, because "it lives in a debug
 * folder" is a claim about intent that the next `console.log` added there would
 * inherit for free.
 *
 * Fingerprint is (file, method, first 60 chars of the call) — no line numbers, so
 * `npm run format` cannot churn the baseline. See scripts/type-check-tests.mjs for
 * the same reasoning.
 *
 * Regenerate: npm run check:console:update
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts/check-console.baseline.json');
const UPDATE = process.env.UPDATE_CONSOLE_BASELINE === '1';

/** Methods that print. `console.error`/`warn` are omitted: see the note below. */
const METHODS = [
  'log',
  'info',
  'debug',
  'table',
  'group',
  'groupCollapsed',
  'groupEnd',
  'dir',
  'trace',
];

// `console.error` and `console.warn` are not scanned. `Logger.error` prints in
// production by design (an error a shopper hits is one the developer must see), so a
// raw `console.error` is a style problem for ESLint, not a line that reveals
// something a gated logger would have hidden. Scanning them would add ~40 frozen
// entries and dilute the signal this gate exists for.

const CALL = new RegExp(`\\bconsole\\.(${METHODS.join('|')})\\s*\\(`);

const SKIP_DIRS = new Set(['node_modules', 'dist', 'docs']);

/** Files whose `console.*` occurrences are not code that runs. */
function isExempt(relPath) {
  // `src/docs/**` holds the documentation generators. Their `console.*` hits are
  // inside example snippets in template literals, published for a reader to paste.
  if (relPath.startsWith('src/docs/')) return true;
  // The gated logger's own implementation.
  if (relPath === 'src/core/logger.ts') return true;
  // Tests are not shipped, and a Vitest runner that prints its result to stdout is
  // how the harness in es-bundle-init.test.ts reports back.
  if (relPath.endsWith('.test.ts') || relPath.startsWith('src/tests/')) {
    return true;
  }
  return false;
}

function allSourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) allSourceFiles(abs, out);
      continue;
    }
    if (!entry.name.endsWith('.ts') || entry.name.endsWith('.d.ts')) continue;
    out.push(abs);
  }
  return out;
}

/**
 * A line whose `console.*` is commented out or sits in a doc comment. Crude on
 * purpose — a block comment's continuation lines all start with `*` in this repo's
 * prettier config, and a commented-out call is what it looks like.
 */
function isCommented(line) {
  const t = line.trim();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

const findings = [];
for (const abs of allSourceFiles(join(ROOT, 'src'))) {
  const relPath = relative(ROOT, abs).split('\\').join('/');
  if (isExempt(relPath)) continue;
  const lines = readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (isCommented(line)) return;
    const match = CALL.exec(line);
    if (!match) return;
    // Prettier breaks a long call across lines, leaving a bare `console.log(` that
    // says nothing and — worse — collapses with every other wrapped call in the
    // file. Read on until the snippet has content past the paren.
    const snippet = lines
      .slice(i, i + 3)
      .map(l => l.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .slice(0, 70);
    findings.push({ file: relPath, method: match[1], snippet });
  });
}

/**
 * `(×N)` when a file holds the same call more than once. Without the count, adding
 * a second copy of a line already in the baseline would be tolerated silently.
 */
function fingerprints(all) {
  const counts = new Map();
  for (const f of all) {
    const key = `${f.file} :: console.${f.method} :: ${f.snippet}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts].map(([key, n]) => (n > 1 ? `${key} (×${n})` : key)).sort();
}

const current = fingerprints(findings);

if (UPDATE) {
  const previous = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : { notes: {} };
  const baseline = {
    $comment:
      'Frozen raw `console.*` occurrences (scripts/check-console.mjs). A ratchet: new ' +
      'occurrences fail `npm run check:console`; entries here are tolerated until fixed. ' +
      'Regenerate: npm run check:console:update. Fingerprint is (file, method, call ' +
      'prefix) — no line numbers, so formatting cannot churn it. `notes` records why a ' +
      'group of entries is frozen rather than fixed; keep it in sync by hand.',
    count: current.length,
    errors: current,
    notes: previous.notes ?? {},
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `Baseline written to ${relative(ROOT, BASELINE_PATH)} (${current.length} occurrence(s)).`
  );
  process.exit(0);
}

const baselineData = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { errors: [] };
const frozen = new Set(baselineData.errors ?? []);

const currentSet = new Set(current);
const added = current.filter(fp => !frozen.has(fp));
const closed = [...frozen].filter(fp => !currentSet.has(fp));

console.log(
  `\nRaw console calls: ${current.length} occurrence(s), ${frozen.size} frozen in baseline.\n`
);

if (closed.length) {
  console.log(`CLOSED (${closed.length}):`);
  for (const fp of closed) console.log(`  ${fp}`);
  console.log('');
}

if (added.length) {
  console.error(`NEW (${added.length}) — not in the baseline:`);
  for (const fp of added) console.error(`  ${fp}`);
  console.error(
    '\nFAIL — new raw console call. Nothing gates it, so it prints on a shopper page ' +
      'with whatever it was handed. Route it through `this.logger.{debug,warn,error}` ' +
      '(see .claude/rules/logging.md). If the line belongs in a function a developer ' +
      'invokes on purpose: npm run check:console:update — and add a `notes` entry ' +
      'saying which function and why.\n'
  );
  process.exit(1);
}

if (closed.length) {
  console.log(
    `${closed.length} occurrence(s) fixed since the baseline was written. Lock it in: npm run check:console:update\n`
  );
}

console.log('OK — no new raw console calls.\n');
