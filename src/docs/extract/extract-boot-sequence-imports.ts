/**
 * Follows a call that leaves `SDKInitializer` through an import, the same way
 * `./extract-boot-sequence-collect` follows a call that stays inside it. This is what
 * lets a boot step be split out into its own file without vanishing from the
 * published page or having its failure behaviour silently relabelled — the defect
 * finding 166 describes, and the reason this module exists as its own concern rather
 * than a helper inlined into the step walk.
 */

import ts from 'typescript';

import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import type { BootSource } from './extract-boot-sequence-types';

/**
 * A free function this module followed an import to, resolved the same way
 * `methods.get(member)` resolves a call that stays on `this`.
 */
export interface ImportedStep {
  /**
   * The function's own declared name — `initializeLocationAndCurrency`, not
   * `locationCurrencyMethods.initializeLocationAndCurrency` — so a step that moves to
   * its own file but keeps its name also keeps its `STEP_NOTES` entry in
   * `render-boot-sequence.ts`.
   */
  name: string;
  fn: ts.FunctionDeclaration;
  sf: ts.SourceFile;
  /** How the target file is cited, e.g. `core/sdk-initializer.location-currency.ts`. */
  fileName: string;
}

/** Local name → module specifier, for every `import * as X from '…'` in the file. */
function namespaceImportModules(sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const statement of sf.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings &&
      ts.isNamespaceImport(statement.importClause.namedBindings) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      out.set(
        statement.importClause.namedBindings.name.text,
        statement.moduleSpecifier.text
      );
    }
  }
  return out;
}

/** Local name → `{ module specifier, exported name }`, for every named import. */
function namedImportModules(
  sf: ts.SourceFile
): Map<string, { module: string; exportedName: string }> {
  const out = new Map<string, { module: string; exportedName: string }>();
  for (const statement of sf.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const module = statement.moduleSpecifier.text;
      for (const element of statement.importClause.namedBindings.elements) {
        out.set(element.name.text, {
          module,
          exportedName: (element.propertyName ?? element.name).text,
        });
      }
    }
  }
  return out;
}

/** The nearest ancestor directory literally named `src`, walked up from a file inside it. */
function findSrcRoot(fromPath: string): string | undefined {
  for (let dir = dirname(fromPath); ; dir = dirname(dir)) {
    if (basename(dir) === 'src') return dir;
    if (dirname(dir) === dir) return undefined; // reached the filesystem root
  }
}

/**
 * `@/core/sdk-initializer.location-currency` (as written at the import site) resolved
 * to an absolute path on disk, or `undefined` when it cannot be — a bare package name,
 * or a path that does not exist. Either way the caller falls back to the pre-fix
 * behaviour: the call is left unanalysed rather than guessed at.
 */
function resolveModuleFile(
  specifier: string,
  fromPath: string
): string | undefined {
  let target: string | undefined;
  if (specifier.startsWith('@/')) {
    const srcRoot = findSrcRoot(fromPath);
    if (srcRoot) target = join(srcRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    target = join(dirname(fromPath), specifier);
  }
  if (!target) return undefined;

  for (const ext of ['.ts', '.tsx', '']) {
    if (existsSync(`${target}${ext}`)) return `${target}${ext}`;
  }
  return undefined;
}

/** How the resolved file is cited, matching the `core/…ts` style every other anchor uses. */
function citeAs(specifier: string, source: BootSource): string {
  if (specifier.startsWith('@/')) return `${specifier.slice(2)}.ts`;
  if (specifier.startsWith('.')) {
    const dir = source.name.includes('/')
      ? source.name.slice(0, source.name.lastIndexOf('/'))
      : '';
    const joined = specifier.replace(/^\.\//, dir ? `${dir}/` : '');
    return joined.endsWith('.ts') ? joined : `${joined}.ts`;
  }
  return specifier;
}

const moduleCache = new Map<
  string,
  { sf: ts.SourceFile; functions: Map<string, ts.FunctionDeclaration> }
>();

/** Parses an imported file once and indexes its top-level `export function`s by name. */
function loadModule(
  path: string,
  fileName: string
): { sf: ts.SourceFile; functions: Map<string, ts.FunctionDeclaration> } {
  const cached = moduleCache.get(path);
  if (cached) return cached;

  const sf = ts.createSourceFile(
    fileName,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const functions = new Map<string, ts.FunctionDeclaration>();
  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      functions.set(statement.name.text, statement);
    }
  }
  const entry = { sf, functions };
  moduleCache.set(path, entry);
  return entry;
}

/**
 * Follows a call that leaves `SDKInitializer` through an import, the same way
 * `methods.get(member)` follows a call that stays inside it — resolving the identifier
 * to the file it was imported from and reading the named function's body there.
 *
 * Two shapes resolve: `namespaceImport.exportedFn(…)`, how the boot-step splits in this
 * file are called, and a bare `importedFn(…)` reached through a named import. Anything
 * else — a call through an object that happens to be imported (`cartOperations.clear()`
 * is a named import, not a namespace, so it does not match the first shape), a bare
 * package specifier, or a module specifier that does not resolve to a file on disk —
 * returns `undefined`, and the caller leaves the step exactly as unanalysed as it was
 * before this function existed.
 */
export function resolveImportedCall(
  callee: ts.LeftHandSideExpression,
  sf: ts.SourceFile,
  source: BootSource
): ImportedStep | undefined {
  let moduleSpecifier: string | undefined;
  let exportedName: string | undefined;

  if (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression)
  ) {
    moduleSpecifier = namespaceImportModules(sf).get(callee.expression.text);
    exportedName = callee.name.text;
  } else if (ts.isIdentifier(callee)) {
    const named = namedImportModules(sf).get(callee.text);
    moduleSpecifier = named?.module;
    exportedName = named?.exportedName;
  }
  if (!moduleSpecifier || !exportedName) return undefined;

  const path = resolveModuleFile(moduleSpecifier, source.path);
  if (!path) return undefined;

  const fileName = citeAs(moduleSpecifier, source);
  const { sf: targetSf, functions } = loadModule(path, fileName);
  const fn = functions.get(exportedName);
  if (!fn) return undefined;

  return { name: exportedName, fn, sf: targetSf, fileName };
}
