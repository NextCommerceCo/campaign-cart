/**
 * Returns, per `data-next-display` namespace, every path a value may use — read from
 * whichever piece of the SDK actually answers that namespace.
 *
 * Two namespaces are answered two different ways, so this module has two extractors:
 *
 * | Namespaces | Answered by | Extractor |
 * |---|---|---|
 * | `cart`, `package`, `selection`, `shipping`, `order` | the `PROPERTY_MAPPINGS` routing table | {@link extractDisplayPaths} |
 * | `selector`, `bundle`, `toggle` | the owning enhancer's own `getPropertyValue` | {@link extractEnhancerDisplayPaths} |
 *
 * Both are the SDK's own answer to "what can I put in `data-next-display`?".
 * Transcribing ~190 paths across eight namespaces by hand would be wrong within a
 * release — and was: `bundle-selector`'s reference documented four properties
 * (`compare`, `savings`, `savingsPercentage`, `hasSavings`) that its enhancer has no
 * case for, because they were read off the card renderer's `FORMAT_MAP` instead of
 * off the method that resolves the path (finding 109 in `docs/code-findings.md`).
 *
 * That is why {@link extractEnhancerDisplayPaths} takes the **names** only from
 * `getPropertyValue`. It reads the format table too, but only to look up the default
 * format *of a name the method already answers* — a name that appears solely in the
 * format table never reaches the page.
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

import { anchor, functionName } from './source-anchor';

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

// ───────────────────────────────────────────────────────────────────────────────
// Namespaces answered by an enhancer rather than by the routing table
// ───────────────────────────────────────────────────────────────────────────────

/** The method that decides what a `data-next-display` path resolves to. */
const RESOLVER = 'getPropertyValue';

/** The method that decides a path's format when the page sets no `data-next-format`. */
const FORMATTER = 'getDefaultFormatType';

/** What one enhancer answers for its namespace. */
export interface EnhancerDisplayPaths {
  /** Every path the resolver has an answer for, in the order the source lists them. */
  paths: DisplayPath[];
  /**
   * `bundle-selector.display.ts › BundleDisplayEnhancer.getPropertyValue` — the
   * method a reader should open to check this list. Anchored to the symbol, never a
   * line: see {@link anchor}.
   */
  where: string;
  /**
   * How many dot-separated segments come before the property, read from the
   * `parts.slice(n)` that the class assigns to `this.property`. `bundle.{bundleId}`
   * is 2; `selector.{selectorId}.{packageId}` is 3.
   */
  prefixSegments: number;
}

/** Every class in a source file, so the namespace check can pick the right one. */
function classesIn(sf: ts.SourceFile): ts.ClassDeclaration[] {
  const found: ts.ClassDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) found.push(node);
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** The named method of a class, ignoring anything inherited. */
function methodNamed(
  cls: ts.ClassDeclaration,
  name: string,
  sf: ts.SourceFile
): ts.MethodDeclaration | undefined {
  return cls.members
    .filter(ts.isMethodDeclaration)
    .find(m => m.name.getText(sf) === name);
}

function descendants(node: ts.Node): ts.Node[] {
  const out: ts.Node[] = [];
  const visit = (n: ts.Node): void => {
    out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(node);
  return out;
}

/**
 * True when this class parses the given namespace out of the display path.
 *
 * Every one of these enhancers guards on the first segment — `parts[0] === 'bundle'`
 * — before it reads anything else, so that comparison is the class's own statement of
 * which namespace it answers. Matching on it means the manifest's `displayNamespace`
 * is checked against the code rather than trusted, and a file holding two display
 * classes cannot hand the wrong one's paths to a page.
 */
function claimsNamespace(
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

/** Property names of an object literal, with the quotes stripped off any key. */
function keysOf(obj: ts.ObjectLiteralExpression, sf: ts.SourceFile): string[] {
  return obj.properties
    .filter(ts.isPropertyAssignment)
    .map(p => p.name.getText(sf).replace(/^['"]|['"]$/g, ''));
}

/**
 * The names {@link RESOLVER} answers, from either shape the codebase uses.
 *
 * `switch (this.property) { case 'price': … }` in two of the three enhancers, and a
 * `const values = { price: …, … }` looked up with `this.property in values` in the
 * third. Only an object the method actually *indexes* counts — an unrelated literal
 * declared in the same body is not a path list.
 */
function resolvedNames(
  method: ts.MethodDeclaration,
  sf: ts.SourceFile
): string[] {
  const nodes = descendants(method);
  const names: string[] = [];

  for (const node of nodes) {
    if (!ts.isSwitchStatement(node)) continue;
    for (const clause of node.caseBlock.clauses) {
      if (ts.isCaseClause(clause) && ts.isStringLiteral(clause.expression)) {
        names.push(clause.expression.text);
      }
    }
  }

  // `this.property in values` / `values[this.property]` — the identifier being
  // indexed is the lookup table, whatever it is called.
  const indexed = new Set(
    nodes.flatMap(node => {
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
        ts.isIdentifier(node.right)
      ) {
        return [node.right.text];
      }
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression)
      ) {
        return [node.expression.text];
      }
      return [];
    })
  );

  for (const node of nodes) {
    if (!ts.isVariableDeclaration(node)) continue;
    if (!ts.isIdentifier(node.name) || !indexed.has(node.name.text)) continue;
    if (node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
      names.push(...keysOf(node.initializer, sf));
    }
  }

  return [...new Set(names)];
}

/**
 * The default format per property, read from the table {@link FORMATTER} indexes.
 *
 * Deliberately found through that method rather than by the table's name: the name is
 * a local convention, while "the object `getDefaultFormatType` looks the property up
 * in" is what the format actually comes from. Callers may only use this to answer
 * *what format does this path have* — never *does this path exist*. The table is a
 * superset in at least one enhancer, and treating it as an inventory is the mistake
 * that published four paths which resolve to nothing.
 */
function formatTable(
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
function prefixSegments(
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

/**
 * Every path the enhancer that answers `namespace` can resolve.
 *
 * Throws rather than returning an empty list when nothing is found. An empty list
 * would render as a page saying the namespace has no paths, which is a worse lie than
 * a stale table — so a moved method, a renamed namespace, or a resolver shape this
 * cannot read all fail loudly at generation time.
 *
 * @param files `[fileName, sourceText]` for one feature's own source, the same shape
 *   {@link extractLogs} takes. The file name is what the citation is anchored to.
 *
 * @example
 * ```ts
 * extractEnhancerDisplayPaths(files, 'bundle').where;
 * // → 'bundle-selector.display.ts › BundleDisplayEnhancer.getPropertyValue'
 * ```
 */
export function extractEnhancerDisplayPaths(
  files: Array<[string, string]>,
  namespace: string
): EnhancerDisplayPaths {
  for (const [name, text] of files) {
    const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);

    for (const cls of classesIn(sf)) {
      const method = methodNamed(cls, RESOLVER, sf);
      // `body` skips the abstract declaration on the shared base class, which every
      // one of these enhancers inherits and none of them resolves paths in.
      if (!method?.body || !claimsNamespace(cls, namespace)) continue;

      const formats = formatTable(cls, sf);
      const paths = resolvedNames(method, sf).map(propertyName => ({
        name: propertyName,
        format: formats[propertyName] ?? 'auto',
        negated: false,
      }));

      if (paths.length === 0) {
        throw new Error(
          `${cls.name?.text ?? '<anonymous class>'}.${RESOLVER} in ${name} answers ` +
            `the \`${namespace}.\` namespace but no paths could be read from it. ` +
            `extractEnhancerDisplayPaths understands a \`switch (this.property)\` and ` +
            'an object literal the method indexes by the property name — if it now ' +
            'resolves properties some other way, teach this extractor that shape ' +
            'rather than letting the page publish an empty list.'
        );
      }

      const segments = prefixSegments(cls, sf);
      if (segments === undefined) {
        throw new Error(
          `${cls.name?.text ?? '<anonymous class>'} in ${name} answers the ` +
            `\`${namespace}.\` namespace but nothing assigns \`this.property\` from a ` +
            '`parts.slice(n)`, so the number of segments before the property cannot ' +
            'be checked against the prefix the manifest publishes.'
        );
      }

      return {
        paths,
        where: anchor(name, functionName(method, sf) ?? RESOLVER),
        prefixSegments: segments,
      };
    }
  }

  throw new Error(
    `No enhancer answers the \`${namespace}.\` namespace. Searched ${RESOLVER} on ` +
      `every class in:\n  ${files.map(([name]) => name).join('\n  ')}\n` +
      'Either the manifest\'s displayNamespace is wrong, or the class no longer ' +
      `guards on \`=== '${namespace}'\` while parsing the display path.`
  );
}
