/**
 * Proving a routed path against the resolver's own format table and against how
 * many prefix segments a class parses before the property. Split out of
 * `extract-display-paths.ts`; see that file for how the walker uses these.
 */

import ts from 'typescript';
import { descendants, methodNamed } from './extract-display-paths-ast-helpers';

/** The method that decides a path's format when the page sets no `data-next-format`. */
export const FORMATTER = 'getDefaultFormatType';

/**
 * The default format per property, read from the table {@link FORMATTER} indexes.
 *
 * Deliberately found through that method rather than by the table's name: the name is
 * a local convention, while "the object `getDefaultFormatType` looks the property up
 * in" is what the format actually comes from. Callers may only use this to answer
 * *what format does this path have*, or *which of these formats answers no path at
 * all* ({@link ResolvedDisplayPaths.formatsWithoutPath}) — never *does this path
 * exist*. Treating the table as an inventory is the mistake that published four
 * paths which resolve to nothing.
 */
export function formatTable(
  cls: ts.ClassDeclaration,
  sf: ts.SourceFile
): Record<string, string> {
  const method = methodNamed(cls, FORMATTER, sf);
  if (!method) return {};

  const tableName = descendants(method)
    .filter(ts.isElementAccessExpression)
    .map(node => (ts.isIdentifier(node.expression) ? node.expression.text : ''))
    .find(name => name !== '');
  if (!tableName) return {};

  const table: Record<string, string> = {};
  for (const node of descendants(sf)) {
    if (!ts.isVariableDeclaration(node)) continue;
    if (!ts.isIdentifier(node.name) || node.name.text !== tableName) continue;
    if (!node.initializer || !ts.isObjectLiteralExpression(node.initializer)) {
      continue;
    }
    for (const prop of node.initializer.properties) {
      if (!ts.isPropertyAssignment(prop)) continue;
      if (!ts.isStringLiteral(prop.initializer)) continue;
      table[prop.name.getText(sf).replace(/^['"]|['"]$/g, '')] =
        prop.initializer.text;
    }
  }
  return table;
}

/**
 * Segments before the property, from the `parts.slice(n)` assigned to `this.property`.
 *
 * This is what makes the `prefix` a manifest declares checkable. `bundle.{bundleId}`
 * is a claim about the markup a reader writes, and it silently stops being true the
 * day the class parses one more segment out of the path.
 */
export function prefixSegments(
  cls: ts.ClassDeclaration,
  sf: ts.SourceFile
): number | undefined {
  for (const node of descendants(cls)) {
    if (!ts.isBinaryExpression(node)) continue;
    if (node.operatorToken.kind !== ts.SyntaxKind.EqualsToken) continue;
    if (node.left.getText(sf) !== 'this.property') continue;
    for (const n of descendants(node.right)) {
      if (!ts.isCallExpression(n)) continue;
      if (!ts.isPropertyAccessExpression(n.expression)) continue;
      if (n.expression.name.text !== 'slice') continue;
      const [count] = n.arguments;
      if (count && ts.isNumericLiteral(count)) return Number(count.text);
    }
  }
  return undefined;
}
