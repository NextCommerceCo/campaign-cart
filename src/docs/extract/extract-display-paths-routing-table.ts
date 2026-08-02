/**
 * Reads `PROPERTY_MAPPINGS` — what the SDK **claims** each namespace can show, for
 * the five namespaces it routes. Split out of `extract-display-paths.ts`; see that
 * file for how this claim is checked against what actually resolves.
 */

import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

export interface DisplayPath {
  /** The name written after the namespace, e.g. `total` in `cart.total`. */
  name: string;
  /** The format applied when the mapping declares one, else `auto`. */
  format: string;
  /** True when the mapping negates another value (`hasItems: '!isEmpty'`). */
  negated: boolean;
  /**
   * Where the routing table sends the name — `order.total_incl_tax` for
   * `order.total`. Present only on a routing-table entry, and the reason the
   * fallback check works: what a name resolves to is the *path*, not the name, so
   * `package.compareTotal` is proved against `Package.price_retail_total`.
   */
  path?: string;
  /**
   * True when the routing entry declares a `fallback:`. On its own this proves
   * nothing about what a page visitor sees — `BaseDisplayEnhancer` only applies it
   * when the resolver returns `null`/`undefined`, and `order-display.properties.ts
   * › getDisplayValue` returns `''` on every miss, which is why `order.status`'s
   * declared `fallback: 'Completed'` never once rendered (finding 144 in
   * `docs/code-findings.md`). It only becomes a live trap on an entry the resolver
   * has no branch for at all — see {@link DisplayPathSource.unanswered} in
   * `render-feature-reference.ts`, which is the one place this is load-bearing.
   */
  hasFallback: boolean;
}

/**
 * A mapping entry is either `name: 'path'` or
 * `name: { path: '…', format: '…' }`.
 */
function readEntry(
  prop: ts.PropertyAssignment,
  sf: ts.SourceFile
): DisplayPath | undefined {
  const name = prop.name.getText(sf).replace(/^['"]|['"]$/g, '');
  const init = prop.initializer;

  if (ts.isStringLiteral(init)) {
    return {
      name,
      format: 'auto',
      negated: init.text.startsWith('!'),
      path: init.text,
      hasFallback: false,
    };
  }
  if (ts.isObjectLiteralExpression(init)) {
    const entries = init.properties.filter(ts.isPropertyAssignment);
    const format = entries.find(p => p.name.getText(sf) === 'format');
    const path = entries.find(p => p.name.getText(sf) === 'path');
    const fallback = entries.find(p => p.name.getText(sf) === 'fallback');
    return {
      name,
      format:
        format && ts.isStringLiteral(format.initializer)
          ? format.initializer.text
          : 'auto',
      negated: false,
      path:
        path && ts.isStringLiteral(path.initializer)
          ? path.initializer.text
          : name,
      hasFallback: fallback !== undefined,
    };
  }
  return undefined;
}

/** Name of the routing table, in one place so both the search and the error use it. */
const TABLE = 'PROPERTY_MAPPINGS';

/**
 * The first of `candidates` that declares {@link TABLE}.
 *
 * Callers pass every place the table could reasonably live rather than the one place
 * it lives today, so relocating the file is not a breaking change to doc generation.
 * A `.filter(existsSync)` is deliberately *not* applied to the failure message: naming
 * the paths that were searched is what turns "ENOENT" into something actionable.
 */
export function findPropertyMappings(candidates: string[]): string {
  const found = candidates.find(path => {
    if (!existsSync(path)) return false;
    // A cheap text check first — parsing every candidate to find one declaration is
    // wasteful, and the name is distinctive enough that a false positive would still
    // be caught by the AST walk returning nothing.
    return new RegExp(`\\b${TABLE}\\b`).test(readFileSync(path, 'utf8'));
  });

  if (found === undefined) {
    throw new Error(
      `${TABLE} not found. Searched:\n  ${candidates.join('\n  ')}\n` +
        `Add the file's new location to the candidate list in the caller ` +
        `(src/tests/docs/featureReference.test.ts).`
    );
  }
  return found;
}

export function extractDisplayPaths(
  displayTypesPath: string
): Record<string, DisplayPath[]> {
  const text = readFileSync(displayTypesPath, 'utf8');
  const sf = ts.createSourceFile(
    displayTypesPath,
    text,
    ts.ScriptTarget.Latest,
    true
  );

  const byNamespace: Record<string, DisplayPath[]> = {};

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sf) === TABLE &&
      node.initializer &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const ns of node.initializer.properties) {
        if (!ts.isPropertyAssignment(ns)) continue;
        if (!ts.isObjectLiteralExpression(ns.initializer)) continue;
        const namespace = ns.name.getText(sf).replace(/^['"]|['"]$/g, '');
        byNamespace[namespace] = ns.initializer.properties
          .filter(ts.isPropertyAssignment)
          .map(p => readEntry(p, sf))
          .filter((p): p is DisplayPath => p !== undefined);
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return byNamespace;
}
