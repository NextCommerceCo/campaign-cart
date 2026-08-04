/**
 * Follows a script the boot path builds as a string rather than writes as real code —
 * the loader assigns its module script via `moduleScript.innerHTML = \`…\``, so the
 * `next:ready` dispatch inside it is a string to the parser and an AST walk over the
 * file alone finds nothing. That would quietly drop the one fact
 * `./extract-boot-sequence-collect` exists to correct, so each such template is
 * re-parsed as its own {@link Scope}.
 */

import ts from 'typescript';

import { MODULE_SCOPE, enclosingFunction } from './source-anchor';

/** One parseable body of code: a file, or a script the loader builds as a string. */
export interface Scope {
  sf: ts.SourceFile;
  /** File this scope is cited as. */
  name: string;
  /**
   * Symbol to cite when a fact sits at this scope's top level. Set for a nested
   * script, whose statements have no enclosing function of their own.
   */
  fallbackSymbol?: string;
  /** Method names whose dispatches count; every method counts when absent. */
  allowFrom?: Set<string>;
}

/**
 * Scripts the file assigns as text — `moduleScript.innerHTML = \`…\`` in the loader.
 *
 * The loader's `next:ready` dispatch lives inside such a template, so it is a string
 * to the parser and an AST walk over the file alone finds nothing. That would quietly
 * drop the one fact this page exists to correct. Each template is re-parsed as its own
 * script with `${…}` spans swapped for a placeholder identifier — `${isDebug} ? 'a' :
 * 'b'` is not parseable, `__EXPR__ ? 'a' : 'b'` is. Each fact the template yields is
 * cited against the symbol that *builds* the script, since the template's own
 * statements sit at top level and have no enclosing function to name.
 */
export function nestedScripts(scope: Scope): Scope[] {
  const out: Scope[] = [];

  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      /\.innerHTML$/.test(node.left.getText(scope.sf)) &&
      ts.isTemplateExpression(node.right)
    ) {
      const template = node.right;
      const text =
        template.head.text +
        template.templateSpans.map(s => `__EXPR__${s.literal.text}`).join('');
      // Statements inside the template have no enclosing function of their own, so
      // they inherit the symbol that *builds* the script — `loader.js › loadModule`
      // reads better than the bare file, and says which of the loader's bodies of
      // code the dispatch came from.
      const builder = enclosingFunction(node, scope.sf).name;
      out.push({
        sf: ts.createSourceFile(
          scope.name,
          text,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.JS
        ),
        name: scope.name,
        // At top level there is no builder to name, so cite the element the script is
        // assigned to (`moduleScript.innerHTML` → `moduleScript`). That is a real
        // identifier in the file, so a reader can still grep straight to it.
        fallbackSymbol:
          builder === MODULE_SCOPE
            ? node.left.getText(scope.sf).replace(/\.innerHTML$/, '')
            : builder,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(scope.sf);

  return out;
}
