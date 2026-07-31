/**
 * Reads the `PROPERTY_MAPPINGS` routing table and returns, per namespace, every path
 * a `data-next-display` value may use.
 *
 * That object is the SDK's own routing table, so it is also the only honest source
 * for "what can I put in `data-next-display`?". Transcribing ~150 paths across
 * five namespaces by hand would be wrong within a release; generating them cannot
 * drift.
 *
 * **It finds the table by name, not by path.** This used to take the one file the
 * table happened to live in, hardcoded in two places, and moving that file failed
 * doc generation with an `ENOENT` rather than anything a reader could act on — which
 * is what blocked relocating the display base classes. {@link findPropertyMappings}
 * searches the candidates it is given, so the table can live wherever it belongs.
 *
 * Build-time only: lives under `src/docs/` and depends on the TypeScript
 * compiler, so it never reaches the bundle.
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
    return { name, format: 'auto', negated: init.text.startsWith('!') };
  }
  if (ts.isObjectLiteralExpression(init)) {
    const format = init.properties
      .filter(ts.isPropertyAssignment)
      .find(p => p.name.getText(sf) === 'format');
    return {
      name,
      format:
        format && ts.isStringLiteral(format.initializer)
          ? format.initializer.text
          : 'auto',
      negated: false,
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
