/**
 * Reads `PROPERTY_MAPPINGS` from `src/features/display/display-types.ts` and
 * returns, per namespace, every path a `data-next-display` value may use.
 *
 * That object is the SDK's own routing table, so it is also the only honest source
 * for "what can I put in `data-next-display`?". Transcribing ~150 paths across
 * five namespaces by hand would be wrong within a release; generating them cannot
 * drift.
 *
 * Build-time only: lives under `src/docs/` and depends on the TypeScript
 * compiler, so it never reaches the bundle.
 */

import { readFileSync } from 'node:fs';
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
      node.name.getText(sf) === 'PROPERTY_MAPPINGS' &&
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
