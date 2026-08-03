/**
 * Generic TS-AST reading helpers with no boot-sequence business logic: parsing a
 * source file, citing where a fact lives, reading a string literal, and finding a
 * class/its methods/a static property initializer. Every other sibling module
 * builds on these.
 */

import ts from 'typescript';

import { MODULE_SCOPE, anchor, enclosingFunction } from './source-anchor';
import { readFileSync } from 'node:fs';
import type { BootSource } from './extract-boot-sequence-types';

export function parse(source: BootSource): ts.SourceFile {
  return ts.createSourceFile(
    source.name,
    readFileSync(source.path, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
}

/**
 * Where a boot fact lives, as `file › Symbol`.
 *
 * @param fallbackSymbol Used when the node sits at the top level of its scope — the
 *   loader's inline `<script>` has no enclosing function, and citing the bare file
 *   would not say which of the loader's two bodies of code it came from.
 */
export function at(
  sf: ts.SourceFile,
  node: ts.Node,
  name: string,
  fallbackSymbol?: string
): string {
  const { name: symbol } = enclosingFunction(node, sf);
  return anchor(
    name,
    symbol === MODULE_SCOPE ? (fallbackSymbol ?? '') : symbol
  );
}

/** The method a node sits in, for keeping debug-only dispatches off the boot page. */
export function enclosingMethod(node: ts.Node): string | undefined {
  let current: ts.Node | undefined = node;
  while (current) {
    if (ts.isMethodDeclaration(current) && ts.isIdentifier(current.name)) {
      return current.name.text;
    }
    current = current.parent;
  }
  return undefined;
}

/** `'next:ready'` → `next:ready`; anything not a literal → undefined. */
export function literal(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  return undefined;
}

export function findClass(
  sf: ts.SourceFile,
  name: string
): ts.ClassDeclaration {
  let found: ts.ClassDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node) && node.name?.text === name) found = node;
    ts.forEachChild(node, visit);
  };
  visit(sf);
  if (!found) throw new Error(`class ${name} not found in ${sf.fileName}`);
  return found;
}

export function methodsOf(
  cls: ts.ClassDeclaration
): Map<string, ts.MethodDeclaration> {
  const out = new Map<string, ts.MethodDeclaration>();
  for (const member of cls.members) {
    if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
      out.set(member.name.text, member);
    }
  }
  return out;
}

/** The initializer of a static property, as written: `maxRetries = 3` → `3`. */
export function staticValue(
  cls: ts.ClassDeclaration,
  name: string
): string | undefined {
  for (const member of cls.members) {
    if (
      ts.isPropertyDeclaration(member) &&
      ts.isIdentifier(member.name) &&
      member.name.text === name
    ) {
      return member.initializer?.getText();
    }
  }
  return undefined;
}
