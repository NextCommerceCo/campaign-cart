/**
 * Generic TS-AST reading helpers with no analytics-domain logic: parsing a file,
 * finding a top-level `const` initializer, unwrapping `as const satisfies T`, and
 * reading string literals/arrays/records out of an object literal. Every other
 * sibling module builds on these.
 */

import ts from 'typescript';

import { readFileSync } from 'node:fs';

export function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
}

/** The initializer of a top-level `const <name> = …`, anywhere in the file. */
export function findVariableInitializer(
  sf: ts.SourceFile,
  name: string
): ts.Expression | undefined {
  let found: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      !found &&
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** Unwraps `x as const satisfies T` down to the literal underneath. */
export function unwrap(
  node: ts.Expression | undefined
): ts.Expression | undefined {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isParenthesizedExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

export function propertyName(
  prop: ts.ObjectLiteralElementLike
): string | undefined {
  if (!prop.name) return undefined;
  return prop.name.getText(prop.getSourceFile()).replace(/^['"`]|['"`]$/g, '');
}

export function stringOf(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

/** `['a', 'b']` → `['a','b']`, ignoring non-literal entries. */
export function stringArray(node: ts.Expression | undefined): string[] {
  const literal = unwrap(node);
  if (!literal || !ts.isArrayLiteralExpression(literal)) return [];
  return literal.elements
    .map(el => stringOf(el))
    .filter((s): s is string => s !== undefined);
}

/** `{ a: 'x', b: 'y' }` → `{ a: 'x', b: 'y' }`, ignoring non-string values. */
export function stringRecord(
  node: ts.Expression | undefined
): Record<string, string> {
  const literal = unwrap(node);
  const out: Record<string, string> = {};
  if (!literal || !ts.isObjectLiteralExpression(literal)) return out;
  for (const prop of literal.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyName(prop);
    const value = stringOf(prop.initializer);
    if (key && value !== undefined) out[key] = value;
  }
  return out;
}
