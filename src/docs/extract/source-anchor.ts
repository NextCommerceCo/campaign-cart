/**
 * Where a generated doc says a thing lives in the source.
 *
 * Every reference page that cites a call site used to cite it as `file.ts:412`.
 * A line number is the wrong anchor for generated documentation: it is not a
 * property of the code, it is a property of the code's *formatting*. Inserting one
 * blank line near the top of `sdk-initializer.ts` rewrote 30 anchors in
 * `core/guide/reference/logs.md` and failed two drift tests — which made
 * `npm run format` and the repo-wide lint cleanup unrunnable, because any of them
 * would have churned hundreds of generated lines that describe unchanged behaviour.
 *
 * So an anchor names the **enclosing symbol** instead: `sdk-initializer.ts ›
 * SDKInitializer.initializeAnalytics`. That survives reformatting, survives edits
 * elsewhere in the file, and tells a reader more than a number did — the phase of
 * boot a log belongs to is exactly what they wanted to know. It moves only when the
 * symbol is genuinely renamed or the call genuinely relocates, which is a real
 * documentation change and should show up in a diff.
 *
 * The precision that is lost is smaller than it looks: every page that cites a call
 * site also carries the exact string being cited (the log message, the meta name,
 * the storage key), which is greppable. The line number was never how a reader
 * found it.
 *
 * Build-time only: this depends on the TypeScript compiler and lives under
 * `src/docs/`, so it never reaches the bundle.
 *
 * @internal
 */

import ts from 'typescript';

/** Separates the file from the symbol inside it. */
const SEP = ' › ';

/** Symbol name used when a node sits at the top level of a module. */
export const MODULE_SCOPE = '<module>';

/** The nearest named function around a node, plus its own parameters. */
export interface Enclosing {
  /** `ClassName.method`, `functionName`, or {@link MODULE_SCOPE}. */
  name: string;
  /** Parameter names in order, for resolving an identifier to a caller-supplied name. */
  params: string[];
}

/**
 * Name of a function-ish node, including the class for a method.
 *
 * Returns `undefined` for a genuinely anonymous function so
 * {@link enclosingFunction} keeps walking outwards past it.
 */
export function functionName(
  node: ts.Node,
  sf: ts.SourceFile
): string | undefined {
  if (
    ts.isMethodDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  ) {
    const owner = node.parent;
    const cls = ts.isClassDeclaration(owner) ? owner.name?.text : undefined;
    const method = node.name.getText(sf);
    return cls ? `${cls}.${method}` : method;
  }
  if (ts.isConstructorDeclaration(node)) {
    const owner = node.parent;
    const cls = ts.isClassDeclaration(owner) ? owner.name?.text : undefined;
    return cls ? `${cls}.constructor` : 'constructor';
  }
  if (ts.isFunctionDeclaration(node)) return node.name?.text;
  if (ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    // `const getSuccessUrl = () => …` reads as `getSuccessUrl`, not as an anonymous
    // arrow — the reader is looking for the exported name.
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
    if (ts.isPropertyDeclaration(parent)) {
      const owner = parent.parent;
      const cls = ts.isClassDeclaration(owner) ? owner.name?.text : undefined;
      const prop = parent.name.getText(sf);
      return cls ? `${cls}.${prop}` : prop;
    }
    // `loadFromMeta: () => { … }` inside a Zustand `create(…)` object. Without this
    // the whole config store reads as `<module>`, which tells a reader nothing about
    // where the meta tags are actually loaded.
    if (ts.isPropertyAssignment(parent)) return parent.name.getText(sf);
    return undefined;
  }
  return undefined;
}

/**
 * The nearest *named* function around a node, plus its parameters.
 *
 * Anonymous callbacks are skipped so a name resolved inside a `forEach` is still
 * attributed to the method a reader would look up. The parameters returned are that
 * named function's own, which is what makes sink detection exact: an identifier only
 * creates a sink when it really is a parameter the caller supplies.
 */
export function enclosingFunction(node: ts.Node, sf: ts.SourceFile): Enclosing {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) {
      const name = functionName(current, sf);
      if (name !== undefined) {
        return {
          name,
          params: current.parameters
            .filter(p => ts.isIdentifier(p.name))
            .map(p => p.name.getText(sf)),
        };
      }
    }
    current = current.parent;
  }
  return { name: MODULE_SCOPE, params: [] };
}

/**
 * A stable citation for where `node` lives: `file.ts › Class.method`.
 *
 * Falls back to the bare file name when the node sits at module scope, because
 * `logger.ts › <module>` carries no more information than `logger.ts` and reads
 * worse.
 *
 * @param file Name to cite the file as — usually the path relative to `src/`.
 *
 * @example
 * ```ts
 * anchorOf(sf, loggerCall, 'core/sdk-initializer.ts');
 * // → 'core/sdk-initializer.ts › SDKInitializer.initializeAnalytics'
 * ```
 */
export function anchorOf(
  sf: ts.SourceFile,
  node: ts.Node,
  file: string
): string {
  const { name } = enclosingFunction(node, sf);
  return name === MODULE_SCOPE ? file : `${file}${SEP}${name}`;
}

/**
 * Builds an anchor from parts, for callers that already resolved the symbol.
 *
 * Keeps the separator in one place so nothing hand-assembles the format.
 */
export function anchor(file: string, symbol: string): string {
  return symbol === MODULE_SCOPE || symbol === ''
    ? file
    : `${file}${SEP}${symbol}`;
}

/**
 * The file part of an anchor.
 *
 * The one reason this exists rather than callers doing `split(':')[0]`: that is how
 * the file was recovered when anchors were `file:line`, and it silently returns the
 * *whole* anchor once the format changes. Parsing goes through here so the format
 * has exactly one definition.
 */
export function fileOf(value: string): string {
  const at = value.indexOf(SEP);
  return at === -1 ? value : value.slice(0, at);
}
