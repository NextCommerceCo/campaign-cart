/**
 * Generic TypeScript-AST helpers shared by the display-path extractor's other
 * modules — nothing here is specific to a namespace or a resolver shape. Split out
 * of `extract-display-paths.ts`; see that file for how the pieces fit together.
 */

import ts from 'typescript';

/** Every class in a source file, so the namespace check can pick the right one. */
export function classesIn(sf: ts.SourceFile): ts.ClassDeclaration[] {
  const found: ts.ClassDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The named method of a class, ignoring anything inherited. */
export function methodNamed(
  cls: ts.ClassDeclaration,
  name: string,
  sf: ts.SourceFile
): ts.MethodDeclaration | undefined {
  return cls.members
    .filter(ts.isMethodDeclaration)
    .find(m => m.name.getText(sf) === name);
}

export function descendants(node: ts.Node): ts.Node[] {
  const out: ts.Node[] = [];
  const visit = (n: ts.Node): void => {
    out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/** Property names of an object literal, with the quotes stripped off any key. */
export function keysOf(
  obj: ts.ObjectLiteralExpression,
  sf: ts.SourceFile
): string[] {
  return obj.properties
    .filter(ts.isPropertyAssignment)
    .map(p => p.name.getText(sf).replace(/^['"]|['"]$/g, ''));
}
