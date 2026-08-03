/**
 * Deciding whether a piece of code only runs for a namespace other than the one
 * being resolved — both the "which class answers this namespace" check and the
 * "is this code reachable while resolving that namespace" check the walker needs.
 * Split out of `extract-display-paths.ts`; see that file for how the walker uses
 * these.
 */

import ts from 'typescript';
import { descendants } from './extract-display-paths-ast-helpers';

/**
 * True when this class parses the given namespace out of the display path.
 *
 * Three of the eight enhancers guard on the first segment — `parts[0] === 'bundle'`
 * — before they read anything else, so that comparison is the class's own statement
 * of which namespace it answers. Matching on it means the manifest's
 * `displayNamespace` is checked against the code rather than trusted. The five
 * routed namespaces leave that parsing to `BaseDisplayEnhancer` and so claim
 * nothing; for those the feature's own file set is the binding, which is why
 * `findResolver` falls back to "the one display class in this feature".
 */
export function claimsNamespace(
  cls: ts.ClassDeclaration,
  namespace: string
): boolean {
  return descendants(cls).some(
    node =>
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isStringLiteral(node.right) &&
      node.right.text === namespace
  );
}

/** The namespace literal an `if` guards on, e.g. `campaign` from `startsWith('campaign.')`. */
function guardedNamespace(expr: string): string | undefined {
  return /startsWith\(\s*['"]([a-z0-9-]+)\.['"]/.exec(expr)?.[1];
}

/** True when every path through `stmt` returns or throws, so nothing after it runs. */
function isTerminalStatement(stmt: ts.Statement): boolean {
  if (ts.isReturnStatement(stmt) || ts.isThrowStatement(stmt)) return true;
  if (ts.isBlock(stmt)) {
    const last = stmt.statements[stmt.statements.length - 1];
    return last !== undefined && isTerminalStatement(last);
  }
  return false;
}

/**
 * True when `node` only runs for a *different* namespace.
 *
 * `ProductDisplayEnhancer` answers `package.` and `campaign.` from one method. Two
 * shapes both guard a namespace, and both had to be caught:
 *
 * - Nested: `if (this.displayPath?.startsWith('campaign.')) { … }` — code *inside*
 *   that block only runs for `campaign.`. Without this the three campaign
 *   properties would be published as `package.` paths that render nothing —
 *   finding 109 again, produced by the generator this time.
 * - Early return: `if (this.displayPath?.startsWith('campaign.')) { return …; }`
 *   with nothing else in the branch, followed by the `package.` handling as plain
 *   sibling statements. Nothing marks those siblings as campaign-free — they run
 *   only when the guard above was false, the same fact an `else` would state
 *   explicitly. Without this, resolving `campaign.` walked straight past the
 *   guard into every `package.` branch below it and published `discountedPrice`,
 *   `unitPrice.raw`, and 27 more as if they were `campaign.` paths — measured
 *   while wiring finding 143's ninth namespace into this extractor.
 */
export function underOtherNamespace(
  node: ts.Node,
  stop: ts.Node,
  sf: ts.SourceFile,
  namespace: string
): boolean {
  let current: ts.Node | undefined = node;
  while (current && current !== stop.parent) {
    const parent: ts.Node | undefined = current.parent;
    if (
      parent &&
      ts.isIfStatement(parent) &&
      parent.thenStatement === current
    ) {
      const guard = guardedNamespace(parent.expression.getText(sf));
      if (guard && guard !== namespace) return true;
    }
    // `current` is a direct statement of this block whenever `parent` is one — the
    // AST has no node between a Block and its own `statements` entries — so it can
    // be found in `parent.statements` and checked against everything before it.
    if (parent && ts.isBlock(parent)) {
      const list = parent.statements;
      const index = list.indexOf(current as ts.Statement);
      for (let i = 0; i < index; i++) {
        const earlier = list[i];
        if (
          earlier &&
          ts.isIfStatement(earlier) &&
          !earlier.elseStatement &&
          isTerminalStatement(earlier.thenStatement)
        ) {
          const guard = guardedNamespace(earlier.expression.getText(sf));
          if (guard && guard === namespace) return true;
        }
      }
    }
    current = parent;
  }
  return false;
}
