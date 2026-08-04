/**
 * Dead-code gate: unused *exports* — the gap `check-unused.mjs` documents but
 * cannot close (see finding 176 in docs/code-findings.md). `noUnusedLocals`
 * only inspects a binding inside its own file; a function nothing outside the
 * file imports is never reported by the compiler. That is exactly how finding
 * 167 (`src/utils/typeGuards.ts`, 267 lines, 23 exports, zero callers) and
 * finding 158 (`BILLING_ADDRESS_FIELD_MAP` duplicated, the exported original
 * left with no importers) went unnoticed.
 *
 * ## Why a hand-rolled scanner, not ts-prune or knip
 *
 * ts-prune was the obvious first choice, but its own README now reads
 * "ts-prune is now in maintenance mode — for new projects, we recommend knip"
 * and the repo was archived 2025-09-19. knip was evaluated next and installed
 * against this repo's real tree: it silently returned **zero** unused
 * exports/files (`--include files,exports`, exit 0) even for a synthetic
 * export added with no importers anywhere, and even for known-dead exports
 * fixed nowhere else (`src/core/logger.ts`'s `logger` singleton). Bisecting
 * knip's own instrumented source (`graph/analyze.js`) showed the underlying
 * cause: of ~690 files in its graph, only *one* (`src/index.ts`) ever had a
 * non-empty `file.exports` map once any part of `src/features/**` was present
 * — every other file's export list came back empty, silently, with no error
 * and exit code 0. That reproduced consistently against this repo's full
 * tree and did not depend on file content (adding back any single feature
 * subdirectory alone reproduced it), so it reads as a real defect/limit in
 * knip 6.31.0 at this repo's scale rather than something this gate could work
 * around. A gate that silently reports "clean" on a codebase with known dead
 * exports is worse than no gate — so this script talks to the TypeScript AST
 * directly instead, the same way ts-prune/knip do internally, but scoped
 * tightly enough to stay correct and auditable.
 *
 * ## What it checks
 *
 * For every named, non-type, top-level export in `src/**\/*.ts` (excluding
 * the exemptions below), does *any* other file in `src/`, `e2e/`, or
 * `scripts/` import that name — via a static `import`, a re-export
 * (`export { x } from …`), or a same-module-specifier dynamic `import('literal
 * path')` immediately destructured? If not, it is reported.
 *
 * Deliberately out of scope, each for a reason a false-positive audit surfaced:
 *
 * - **`export default`** — this codebase's default exports are all
 *   `defineFeature(...)` / `defineStore(...)` manifest objects consumed
 *   structurally by `src/docs/**` and `src/tests/**`, a different dead-code
 *   shape than "nothing imports this name." Not checked here.
 * - **Types, interfaces, and enums** (`export type`, `export interface`,
 *   `export enum`) — the task this gate exists for explicitly calls out
 *   "types re-exported through a barrel purely so consumers can name them" as
 *   a guaranteed false positive. Excluding the whole type/enum family avoids
 *   re-litigating that per export.
 * - **`src/index.ts`** — the public API. Everything it exports is meant to be
 *   used only *outside* this repo, so "no importer inside the repo" is the
 *   expected, correct state for every one of its exports.
 * - **`src/docs/**`** — build-time-only: read by `scripts/docs-*.mjs` and
 *   `src/tests/docs/**` to render the TypeDoc site and feature manifests, not
 *   by runtime `src/` code. Scanned as an *importer* (so it still counts as a
 *   real consumer of anything it references) but never as an export source.
 * - **Namespace imports/exports** (`import * as ns`, `export * from`,
 *   `export * as ns from`) — cannot know which specific names a consumer
 *   pulls back out of the namespace object, so every export of the
 *   target module is conservatively treated as used. Same logic for a
 *   dynamic `import('literal')` that is not immediately destructured
 *   (`const mod = await import('x'); mod.Foo`): the whole module is marked
 *   used rather than guessing which property was read.
 *
 * Dynamic `import()` calls with a *computed* specifier (a template literal, a
 * `path.join(...)`, string concatenation) are the one shape this scanner
 * cannot see by design — same limitation as ts-prune/knip, and the reason the
 * task that created this gate calls it out explicitly. This repo's own
 * `AttributeScanner` was checked and does not have that shape: every feature
 * `import()` in `src/core/attribute-scanner/attribute-scanner.ts` uses a literal path
 * (`await import('@/features/cart/add-to-cart')`), so it resolves like any
 * other import. The one place a *path string* is genuinely built at runtime —
 * `src/docs/extract/extract-analytics-events-providers.ts`'s
 * `join(providersDir, 'facebook-adapter.ts')` — reads the file as text for the
 * docs extractor, not as a module import, and lives under the `src/docs/**`
 * exemption above regardless.
 *
 * This is a ratchet, same shape as `check-unused.mjs` / `type-check-tests.mjs`:
 * known occurrences are frozen in `check-unused-exports.baseline.json` and
 * tolerated; a NEW one fails the run. Fingerprint is (file, exported name) —
 * no line numbers, same reasoning as the sibling gates (a line is a property
 * of formatting, not of the finding).
 *
 *   npm run check:unused-exports          # check (this is what CI should run)
 *   npm run check:unused-exports:update   # rewrite the baseline from current state
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'scripts/check-unused-exports.baseline.json');
const UPDATE = process.env.UPDATE_UNUSED_EXPORTS_BASELINE === '1';

// ---------------------------------------------------------------------------
// file discovery
// ---------------------------------------------------------------------------

const SCAN_DIRS = ['src', 'e2e', 'scripts'];

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else if (/\.ts$/.test(entry) && !/\.d\.ts$/.test(entry)) {
      out.push(full);
    }
  }
}

function allTsFiles() {
  const out = [];
  for (const dir of SCAN_DIRS) {
    const abs = join(ROOT, dir);
    if (existsSync(abs)) walk(abs, out);
  }
  return out;
}

function toPosix(p) {
  return p.split('\\').join('/');
}

function relFile(absPath) {
  return toPosix(relative(ROOT, absPath));
}

function isTestFile(relPath) {
  return /\.(test|spec)\.ts$/.test(relPath);
}

/** src/docs/** is build-time-only — see header comment. */
function isDocsFile(relPath) {
  return relPath.startsWith('src/docs/');
}

// Both are real Vite library entries (`vite.config.ts`'s `build.lib.entry`),
// published to customers as the package's `.` and `./styles` sub-paths — not
// consumed from inside this repo, so "no importer in src/" is expected here.
const ENTRY_FILES = new Set(['src/index.ts', 'src/styles.ts']);

// ---------------------------------------------------------------------------
// module resolution — mirrors tsconfig.json's `paths`, read from disk so an
// alias change here does not need a second edit.
// ---------------------------------------------------------------------------

// tsconfig.json is JSONC (has comments) — read it the way tsc does.
const tsconfigRead = ts.readConfigFile(
  join(ROOT, 'tsconfig.json'),
  ts.sys.readFile
);
const rawPaths = tsconfigRead.config?.compilerOptions?.paths ?? {};
// Longest-prefix-first so `@/types/*` is tried before the catch-all `@/*`.
const aliases = Object.entries(rawPaths)
  .map(([pattern, targets]) => ({
    prefix: pattern.replace(/\*$/, ''),
    target: targets[0].replace(/\*$/, ''),
  }))
  .sort((a, b) => b.prefix.length - a.prefix.length);

const EXTENSION_CANDIDATES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

function resolveCandidate(basePath) {
  for (const suffix of EXTENSION_CANDIDATES) {
    const candidate = basePath + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return undefined;
}

/** Resolves an import specifier to an absolute file path, or undefined for a
 * package import (node_modules) or a specifier that does not resolve to a
 * file on disk (reported separately — this gate does not care about broken
 * imports, only unused exports). */
function resolveSpecifier(specifier, containingFile) {
  if (specifier.startsWith('.')) {
    return resolveCandidate(resolve(dirname(containingFile), specifier));
  }
  for (const { prefix, target } of aliases) {
    if (
      specifier === prefix.replace(/\/$/, '') ||
      specifier.startsWith(prefix)
    ) {
      const rest = specifier.slice(prefix.length);
      return resolveCandidate(join(ROOT, target, rest));
    }
  }
  return undefined; // bare package specifier — not part of this repo's graph
}

// ---------------------------------------------------------------------------
// per-file AST pass — collects candidate exports and outgoing usage edges
// ---------------------------------------------------------------------------

/** @typedef {{ name: string, kind: string }} ExportCandidate */

function isExported(node) {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      m => m.kind === ts.SyntaxKind.ExportKeyword
    )
  );
}

function isDefaultExport(node) {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some(
      m => m.kind === ts.SyntaxKind.DefaultKeyword
    )
  );
}

/**
 * Reads the destructured property names off `{ a, b: c }` — used for both
 * `export { a, b as c } from '...'` (ExportSpecifier) and a dynamic
 * `import('literal')` immediately destructured into an object pattern.
 */
function destructuredNames(bindingPattern) {
  const names = [];
  for (const el of bindingPattern.elements) {
    if (ts.isOmittedExpression(el)) continue;
    const prop = el.propertyName ?? el.name;
    if (ts.isIdentifier(prop)) names.push(prop.text);
  }
  return names;
}

function analyzeFile(absPath, relPath) {
  const text = readFileSync(absPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    absPath,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );

  /** @type {ExportCandidate[]} */
  const candidates = [];
  /** name -> true */
  const usedNames = new Map(); // key: `${resolvedAbsPath}\u0000${name}` -> true
  const wildcardUsedFiles = new Set(); // resolvedAbsPath

  function addUsageEdge(resolvedFile, name) {
    if (!resolvedFile) return;
    usedNames.set(`${resolvedFile}\u0000${name}`, true);
  }
  function addWildcardUsage(resolvedFile) {
    if (!resolvedFile) return;
    wildcardUsedFiles.add(resolvedFile);
  }

  function visitDynamicImportDestructure(node) {
    // const { A, B: C } = await import('literal') — or .then(({ A }) => ...)
    if (
      !ts.isCallExpression(node) ||
      node.expression.kind !== ts.SyntaxKind.ImportKeyword
    )
      return;
    const arg = node.arguments[0];
    if (!arg || !ts.isStringLiteralLike(arg)) return; // computed specifier — cannot see it, see header
    const resolved = resolveSpecifier(arg.text, absPath);
    if (!resolved) return;

    let host = node.parent;
    // await import('x')  -> AwaitExpression -> VariableDeclaration
    if (host && ts.isAwaitExpression(host)) host = host.parent;
    if (
      host &&
      ts.isVariableDeclaration(host) &&
      ts.isObjectBindingPattern(host.name)
    ) {
      for (const name of destructuredNames(host.name))
        addUsageEdge(resolved, name);
      return;
    }
    // import('x').then(({ A }) => ...)
    const callParent = node.parent;
    if (
      callParent &&
      ts.isPropertyAccessExpression(callParent) &&
      callParent.name.text === 'then' &&
      callParent.parent &&
      ts.isCallExpression(callParent.parent)
    ) {
      const cb = callParent.parent.arguments[0];
      const param =
        cb && (ts.isArrowFunction(cb) || ts.isFunctionExpression(cb))
          ? cb.parameters[0]
          : undefined;
      if (param && ts.isObjectBindingPattern(param.name)) {
        for (const name of destructuredNames(param.name))
          addUsageEdge(resolved, name);
        return;
      }
    }
    // Not destructured — conservatively mark the whole module used.
    addWildcardUsage(resolved);
  }

  function visit(node) {
    // --- static imports ---
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      const resolved = resolveSpecifier(node.moduleSpecifier.text, absPath);
      const clause = node.importClause;
      if (resolved && clause) {
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamedImports(bindings)) {
          for (const el of bindings.elements) {
            addUsageEdge(resolved, (el.propertyName ?? el.name).text);
          }
        } else if (bindings && ts.isNamespaceImport(bindings)) {
          addWildcardUsage(resolved);
        }
        // default import binding: not tracked (we don't check default exports)
      }
    }

    // --- re-exports: `export { a, b as c } from '...'`, `export * from '...'`, `export * as ns from '...'` ---
    if (ts.isExportDeclaration(node)) {
      if (
        node.moduleSpecifier &&
        ts.isStringLiteralLike(node.moduleSpecifier)
      ) {
        const resolved = resolveSpecifier(node.moduleSpecifier.text, absPath);
        if (node.exportClause) {
          if (ts.isNamedExports(node.exportClause)) {
            for (const el of node.exportClause.elements) {
              if (el.isTypeOnly || node.isTypeOnly) continue;
              addUsageEdge(resolved, (el.propertyName ?? el.name).text);
            }
          } else if (ts.isNamespaceExport(node.exportClause)) {
            addWildcardUsage(resolved); // export * as ns from '...'
          }
        } else {
          addWildcardUsage(resolved); // export * from '...'
        }
      } else if (
        !node.moduleSpecifier &&
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        !node.isTypeOnly
      ) {
        // `export { local as public }` (no moduleSpecifier) — a candidate
        // export of THIS file, publicly named `public`.
        for (const el of node.exportClause.elements) {
          if (el.isTypeOnly) continue;
          candidates.push({ name: el.name.text, kind: 'export-specifier' });
        }
      }
    }

    // --- dynamic import() ---
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      visitDynamicImportDestructure(node);
    }

    // --- top-level export candidates ---
    if (isExported(node) && !isDefaultExport(node)) {
      if (ts.isFunctionDeclaration(node) && node.name) {
        candidates.push({ name: node.name.text, kind: 'function' });
      } else if (ts.isClassDeclaration(node) && node.name) {
        candidates.push({ name: node.name.text, kind: 'class' });
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            candidates.push({ name: decl.name.text, kind: 'variable' });
          }
        }
      }
      // export type / interface / enum: intentionally not collected — see header
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return { candidates, usedNames, wildcardUsedFiles };
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const files = allTsFiles();
const exportCandidates = new Map(); // absPath -> ExportCandidate[]
const globalUsedNames = new Map(); // `${absPath}\u0000${name}` -> true
const globalWildcardUsed = new Set(); // absPath

for (const absPath of files) {
  const relPath = relFile(absPath);
  const { candidates, usedNames, wildcardUsedFiles } = analyzeFile(
    absPath,
    relPath
  );

  const isCandidateSource =
    relPath.startsWith('src/') &&
    !isTestFile(relPath) &&
    !isDocsFile(relPath) &&
    !ENTRY_FILES.has(relPath);
  if (isCandidateSource && candidates.length) {
    exportCandidates.set(absPath, candidates);
  }
  for (const key of usedNames.keys()) globalUsedNames.set(key, true);
  for (const f of wildcardUsedFiles) globalWildcardUsed.add(f);
}

const findings = [];
for (const [absPath, candidates] of exportCandidates) {
  if (globalWildcardUsed.has(absPath)) continue;
  const relPath = relFile(absPath);
  for (const { name } of candidates) {
    if (globalUsedNames.has(`${absPath}\u0000${name}`)) continue;
    findings.push({ file: relPath, name });
  }
}
findings.sort((a, b) =>
  a.file === b.file
    ? a.name.localeCompare(b.name)
    : a.file.localeCompare(b.file)
);

function fingerprint(f) {
  return `${f.file} :: EXPORT :: '${f.name}' is exported but not imported anywhere in src/e2e/scripts.`;
}

const currentFingerprints = findings.map(fingerprint);

if (UPDATE) {
  const baselineData = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : { notes: {} };
  const baseline = {
    $comment:
      'Frozen unused-export occurrences (scripts/check-unused-exports.mjs), each one a ' +
      'named export nothing in src/e2e/scripts imports. A ratchet: new occurrences fail ' +
      '`npm run check:unused-exports`; entries here are tolerated until fixed. Regenerate: ' +
      'npm run check:unused-exports:update. Fingerprint is (file, exported name) — no line ' +
      'numbers, same reasoning as check-unused.baseline.json. `notes` records *why* each ' +
      'frozen entry is frozen rather than fixed — keep it in sync by hand when the set changes.',
    count: currentFingerprints.length,
    errors: currentFingerprints.sort(),
    notes: baselineData.notes ?? {},
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(
    `Baseline written to ${relative(ROOT, BASELINE_PATH)} (${currentFingerprints.length} occurrence(s)).`
  );
  process.exit(0);
}

const baselineData = existsSync(BASELINE_PATH)
  ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
  : { errors: [] };
const frozenFingerprints = new Set(baselineData.errors ?? []);

const newOccurrences = currentFingerprints.filter(
  fp => !frozenFingerprints.has(fp)
);
const currentSet = new Set(currentFingerprints);
const fixedOccurrences = [...frozenFingerprints].filter(
  fp => !currentSet.has(fp)
);

console.log(
  `\nUnused exports: ${currentFingerprints.length} occurrence(s), ${frozenFingerprints.size} frozen in baseline.\n`
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
    '\nFAIL — new unused export. Delete it, or if freezing it is deliberate: ' +
      'npm run check:unused-exports:update — and add a `notes` entry saying why.\n'
  );
  process.exit(1);
}

if (fixedOccurrences.length) {
  console.log(
    `${fixedOccurrences.length} occurrence(s) fixed since the baseline was written. Lock it in: npm run check:unused-exports:update\n`
  );
}

console.log('OK — no new unused exports.\n');
