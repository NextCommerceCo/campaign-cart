/**
 * Returns, per `data-next-display` namespace, every path a value may use — read from
 * the code that answers that namespace.
 *
 * Two things are read, and they answer two different questions:
 *
 * | Read | What it is | Extractor |
 * |---|---|---|
 * | the enhancer that resolves the namespace | **what the SDK answers** | {@link extractResolvedDisplayPaths} |
 * | the `PROPERTY_MAPPINGS` routing table | **what the SDK claims**, for five namespaces | {@link extractDisplayPaths} |
 *
 * The published list comes from the first. The second is a claim checked against it,
 * which is the correction finding 127 in `docs/code-findings.md` asked for: the
 * generated `cart.` page was rendered straight from the routing table, and ten of its
 * twenty-two rows named paths `CartDisplayEnhancer.resolveValue` has no case for
 * while six paths it does answer were missing. A routing entry is a format, a
 * validator and a fallback — never a promise that something resolves the path.
 *
 * The same mistake one layer down is why the **names** come only from the resolver
 * and never from a format table: `bundle-selector`'s reference documented four
 * properties (`compare`, `savings`, `savingsPercentage`, `hasSavings`) that its
 * enhancer has no case for, because they were read off the card renderer's
 * `FORMAT_MAP` (finding 109). The format table is read only to look up the format
 * *of a name the resolver already answers*; names that appear solely in it are
 * reported as {@link ResolvedDisplayPaths.formatsWithoutPath} so the docs suite can
 * fail on the trap in the source instead of waiting for its next victim.
 *
 * **It finds the routing table by name, not by path.** This used to take the one file
 * the table happened to live in, hardcoded in two places, and moving that file failed
 * doc generation with an `ENOENT` rather than anything a reader could act on — which
 * is what blocked relocating the display base classes. {@link findPropertyMappings}
 * searches the candidates it is given, so the table can live wherever it belongs.
 *
 * Build-time only: lives under `src/docs/` and depends on the TypeScript
 * compiler, so it never reaches the bundle.
 */

import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

import { anchor, anchorOf } from './source-anchor';

export interface DisplayPath {
  /** The name written after the namespace, e.g. `total` in `cart.total`. */
  name: string;
  /** The format applied when the mapping declares one, else `auto`. */
  format: string;
  /** True when the mapping negates another value (`hasItems: '!isEmpty'`). */
  negated: boolean;
  /**
   * Where the routing table sends the name — `order.total_incl_tax` for
   * `order.total`. Present only on a routing-table entry, and the reason the
   * fallback check works: what a name resolves to is the *path*, not the name, so
   * `package.compareTotal` is proved against `Package.price_retail_total`.
   */
  path?: string;
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
    return {
      name,
      format: 'auto',
      negated: init.text.startsWith('!'),
      path: init.text,
    };
  }
  if (ts.isObjectLiteralExpression(init)) {
    const entries = init.properties.filter(ts.isPropertyAssignment);
    const format = entries.find(p => p.name.getText(sf) === 'format');
    const path = entries.find(p => p.name.getText(sf) === 'path');
    return {
      name,
      format:
        format && ts.isStringLiteral(format.initializer)
          ? format.initializer.text
          : 'auto',
      negated: false,
      path:
        path && ts.isStringLiteral(path.initializer)
          ? path.initializer.text
          : name,
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
// What the code that answers a namespace actually resolves
// ───────────────────────────────────────────────────────────────────────────────

/** The method every display enhancer implements to answer a path. */
const RESOLVER = 'getPropertyValue';

/** The method that decides a path's format when the page sets no `data-next-format`. */
const FORMATTER = 'getDefaultFormatType';

/**
 * Expressions that hold a display path when a resolver starts running.
 *
 * Everything the walk knows is derived from these two: a variable initialised from
 * one carries a path, an argument built from one delegates a path, and a `switch` on
 * one is a list of names. Anything else — the operator in an expression parser, a
 * line index — is not a path and its `case` labels are not display paths, which is
 * what keeps `+`, `-`, `*` and `/` off the selection page.
 */
const SEEDS = ['this.property', 'this.displayPath'];

/** A `.split()` on anything but a dot produces segments of something else entirely. */
const SPLIT_ON_OTHER = /\.split\(\s*(?!['"]\.['"])/;

/**
 * Reading a path off runtime data yields a **value**, and a value is not a path.
 *
 * Without this the walk follows the value onwards: `order-display` hands the
 * resolved `payment_method` to `beautifyPaymentMethod`, whose lookup table is keyed
 * by payment method, and eight card brands are published as `order.` display paths.
 */
const READS_A_VALUE = /\bgetNestedProperty\(/;

/** What one namespace's resolving code answers, and how it can answer more. */
export interface ResolvedDisplayPaths {
  /** Every path the code has an explicit branch for, in the order the source lists them. */
  paths: DisplayPath[];
  /**
   * `cart-summary.display.ts › CartDisplayEnhancer.getPropertyValue` — the method a
   * reader should open to check this list. Anchored to the symbol, never a line: see
   * {@link anchor}.
   */
  where: string;
  /**
   * Where the code resolves a path it has no branch for by reading it off runtime
   * data, or `undefined` when every path it answers is an explicit branch.
   *
   * A namespace with one of these cannot be judged on `case` labels alone —
   * `package.price_retail_total` has no branch and works. It is the manifest's
   * `displayFallback` that says which declared type the read lands on, and this
   * anchor is what proves such a branch exists at all.
   */
  dataFallback?: string;
  /**
   * How many dot-separated segments come before the property, read from the
   * `parts.slice(n)` that the class assigns to `this.property`. `bundle.{bundleId}`
   * is 2; `selector.{selectorId}.{packageId}` is 3. `undefined` when the class
   * leaves the parsing to `BaseDisplayEnhancer`, which every routed namespace does.
   */
  prefixSegments?: number;
  /**
   * The class's own format table, when it overrides {@link FORMATTER} without
   * calling `super` — in which case the table is the whole truth for this namespace
   * and the routing table's formats never apply. Empty when the class does not
   * override it.
   */
  formats: Record<string, string>;
  /** True when {@link formats} is the only thing that decides this namespace's formats. */
  formatsAreTotal: boolean;
  /**
   * Names the format table declares a format for that the resolver has no answer
   * for — always empty in a healthy enhancer.
   *
   * This is the raw material for the gate on the root cause of finding 109. The
   * extractor already refuses to *publish* a name that only exists in the format
   * table, but a reader opening the source still meets the table first, and the
   * table is what the wrong page was transcribed from. Reporting the difference
   * lets the docs suite fail on the trap itself rather than on its next victim.
   */
  formatsWithoutPath: string[];
  /**
   * `bundle-selector.display.ts › BundleDisplayEnhancer.getDefaultFormatType` — where
   * {@link formats} was read from, so a failure names the file to edit. `undefined`
   * when the class declares no format table at all.
   */
  formatWhere: string | undefined;
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
 * Three of the eight enhancers guard on the first segment — `parts[0] === 'bundle'`
 * — before they read anything else, so that comparison is the class's own statement
 * of which namespace it answers. Matching on it means the manifest's
 * `displayNamespace` is checked against the code rather than trusted. The five
 * routed namespaces leave that parsing to `BaseDisplayEnhancer` and so claim
 * nothing; for those the feature's own file set is the binding, which is why
 * {@link findResolver} falls back to "the one display class in this feature".
 */
function claimsNamespace(cls: ts.ClassDeclaration, namespace: string): boolean {
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

// ── The walk ───────────────────────────────────────────────────────────────────

/** One function the walk can step into. */
interface Callable {
  node: ts.FunctionLikeDeclaration;
  sf: ts.SourceFile;
  file: string;
  /** `ProductDisplayEnhancer.getPropertyValue` — the anchor symbol and the cycle key. */
  symbol: string;
  /** True for a method of the resolving class, whose `this.property` is the same one. */
  ownMethod: boolean;
}

/** Everything the walk shares across functions. */
interface WalkContext {
  namespace: string;
  /** Callee name → its declaration, methods of the resolving class first. */
  index: Map<string, Callable>;
  visited: Set<string>;
  names: string[];
  dataFallback?: string;
}

/** Does this expression text carry a display path derived from one of `carriers`? */
function carriesPath(text: string, carriers: Set<string>): boolean {
  if (SPLIT_ON_OTHER.test(text) || READS_A_VALUE.test(text)) return false;
  return [...carriers].some(carrier => {
    const escaped = carrier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\w.])${escaped}(?![\\w])`).test(text);
  });
}

/** The nearest ancestor of `node` that `match` accepts, searching no further than `stop`. */
function ancestor(
  node: ts.Node,
  stop: ts.Node,
  match: (n: ts.Node) => boolean
): ts.Node | undefined {
  let current: ts.Node | undefined = node.parent;
  while (current && current !== stop.parent) {
    if (match(current)) return current;
    current = current.parent;
  }
  return undefined;
}

/**
 * True when `node` only runs for a *different* namespace.
 *
 * `ProductDisplayEnhancer` answers `package.` and `campaign.` from one method, behind
 * `if (this.displayPath?.startsWith('campaign.'))`. Without this the three campaign
 * properties would be published as `package.` paths that render nothing — finding 109
 * again, produced by the generator this time.
 */
function underOtherNamespace(
  node: ts.Node,
  stop: ts.Node,
  sf: ts.SourceFile,
  namespace: string
): boolean {
  let current: ts.Node | undefined = node;
  while (current && current !== stop.parent) {
    const parent: ts.Node | undefined = current.parent;
    if (parent && ts.isIfStatement(parent) && parent.thenStatement === current) {
      const guard = /startsWith\(\s*['"]([a-z0-9-]+)\.['"]/.exec(
        parent.expression.getText(sf)
      );
      if (guard && guard[1] !== namespace) return true;
    }
    current = parent;
  }
  return false;
}

/** `['a', 'b']` → `a.b`, with an empty segment meaning "the prefix on its own". */
function joinPath(prefix: string, name: string): string {
  if (!prefix) return name;
  return name === '' ? prefix : `${prefix}.${name}`;
}

/**
 * Case clauses grouped with the body that actually runs for them.
 *
 * `case 'user': case 'customer': return getOrderUserProperty(…)` is two labels and
 * one body. Reading each clause on its own would see `user` as a label with no
 * delegation and lose every `user.*` path under it.
 */
function clauseGroups(
  block: ts.CaseBlock
): Array<{ labels: string[]; body: ts.Node[]; isDefault: boolean }> {
  const groups: Array<{ labels: string[]; body: ts.Node[]; isDefault: boolean }> = [];
  let labels: string[] = [];
  let isDefault = false;

  for (const clause of block.clauses) {
    if (ts.isCaseClause(clause)) {
      if (ts.isStringLiteral(clause.expression)) labels.push(clause.expression.text);
      else if (clause.statements.length === 0) continue;
    } else {
      isDefault = true;
    }
    if (clause.statements.length > 0) {
      groups.push({ labels, body: [...clause.statements], isDefault });
      labels = [];
      isDefault = false;
    }
  }
  if (labels.length > 0) groups.push({ labels, body: [], isDefault: false });
  return groups;
}

/**
 * Reads every path the code reachable from `entry` answers, into `ctx`.
 *
 * @param carriers expressions inside this function that hold a display path
 * @param prefix path segments already consumed by an enclosing dispatch, so a
 *   `case 'email'` inside the delegate of `case 'customer'` publishes as
 *   `customer.email`
 */
function walkResolver(
  ctx: WalkContext,
  entry: Callable,
  carriers: Set<string>,
  prefix: string
): void {
  const key = `${entry.symbol}|${prefix}`;
  if (ctx.visited.has(key)) return;
  ctx.visited.add(key);

  const body = entry.node.body;
  if (!body) return;
  const sf = entry.sf;
  const nodes = descendants(body);

  // Locals first: a `switch` on `parts[0]` means nothing until `parts` is known to
  // hold the path. Twice, because a helper may be declared after its first use.
  for (let pass = 0; pass < 2; pass++) {
    for (const node of nodes) {
      if (!ts.isVariableDeclaration(node)) continue;
      if (!ts.isIdentifier(node.name) || !node.initializer) continue;
      const text = node.initializer.getText(sf);
      if (!carriesPath(text, carriers)) continue;
      carriers.add(node.name.text);
      // `AttributeParser.parseDisplayPath(path)` returns `{ object, property }`.
      if (text.includes('parseDisplayPath(')) {
        carriers.add(`${node.name.text}.property`);
      }
    }
  }

  /** Follows one call, binding the callee's parameters to the path it was handed. */
  const delegate = (call: ts.CallExpression, into: string): boolean => {
    const callee = ts.isPropertyAccessExpression(call.expression)
      ? call.expression.name.text
      : ts.isIdentifier(call.expression)
        ? call.expression.text
        : '';
    const target = ctx.index.get(callee);
    if (!target || target.symbol === entry.symbol) return false;

    const seeds = new Set<string>(target.ownMethod ? SEEDS : []);
    let handedAPath = false;
    call.arguments.forEach((argument, position) => {
      if (!carriesPath(argument.getText(sf), carriers)) return;
      handedAPath = true;
      const parameter = target.node.parameters[position]?.name;
      if (parameter && ts.isIdentifier(parameter)) seeds.add(parameter.text);
    });
    if (!handedAPath) return false;

    walkResolver(ctx, target, seeds, into);
    return true;
  };

  // Dispatches. A switch on the path itself lists complete names; a switch on one
  // segment of it lists prefixes, each answered by whatever its body delegates to.
  const consumed = new Set<ts.Node>();
  for (const node of nodes) {
    if (!ts.isSwitchStatement(node)) continue;
    if (underOtherNamespace(node, body, sf, ctx.namespace)) continue;

    const subject = node.expression.getText(sf);
    const segment = /^([\w.]+)\[\d+\]$/.exec(subject);
    const onWholePath = carriers.has(subject);
    const onSegment = !onWholePath && !!segment && carriers.has(segment[1] ?? '');
    if (!onWholePath && !onSegment) continue;

    for (const group of clauseGroups(node.caseBlock)) {
      if (group.isDefault) continue;
      if (onWholePath) {
        for (const label of group.labels) ctx.names.push(joinPath(prefix, label));
        continue;
      }
      const calls = group.body
        .flatMap(descendants)
        .filter(ts.isCallExpression)
        .filter(call => call.arguments.some(a => carriesPath(a.getText(sf), carriers)));
      for (const label of group.labels) {
        let delegated = false;
        for (const call of calls) {
          consumed.add(call);
          delegated = delegate(call, joinPath(prefix, label)) || delegated;
        }
        // No delegate means the branch answers the segment on its own — `testBadge`
        // is a whole path, not a prefix over something else.
        if (!delegated) ctx.names.push(joinPath(prefix, label));
      }
    }
  }

  for (const node of nodes) {
    if (!ts.isCallExpression(node)) continue;

    // The open branch: whatever the path names, read off runtime data.
    if (/(^|\.)getNestedProperty$/.test(node.expression.getText(sf))) {
      ctx.dataFallback ??= anchorOf(sf, node, entry.file);
      continue;
    }

    if (consumed.has(node)) continue;
    if (underOtherNamespace(node, body, sf, ctx.namespace)) continue;
    // A `default:` is by definition the branch for a path nothing named, so what it
    // reaches is not an enumerable path — `lines[0].title` is markup, not a name.
    if (ancestor(node, body, n => ts.isCaseClause(n) || ts.isDefaultClause(n))) {
      continue;
    }
    delegate(node, prefix);
  }

  // `this.property in values` / `values[this.property]` — the identifier being
  // indexed is the lookup table, whatever it is called.
  const indexed = new Set(
    nodes.flatMap(node => {
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.InKeyword &&
        ts.isIdentifier(node.right) &&
        carriesPath(node.left.getText(sf), carriers)
      ) {
        return [node.right.text];
      }
      if (
        ts.isElementAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        carriesPath(node.argumentExpression.getText(sf), carriers)
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
      for (const name of keysOf(node.initializer, sf)) {
        ctx.names.push(joinPath(prefix, name));
      }
    }
  }
}

/** The one display class in `files`, preferring one that names the namespace itself. */
function findResolver(
  files: Array<[string, string]>,
  namespace: string
): { cls: ts.ClassDeclaration; method: ts.MethodDeclaration; sf: ts.SourceFile; file: string } {
  const candidates: Array<{
    cls: ts.ClassDeclaration;
    method: ts.MethodDeclaration;
    sf: ts.SourceFile;
    file: string;
  }> = [];

  for (const [file, text] of files) {
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const cls of classesIn(sf)) {
      const method = methodNamed(cls, RESOLVER, sf);
      // `body` skips the abstract declaration on the shared base class, which every
      // one of these enhancers inherits and none of them resolves paths in.
      if (method?.body) candidates.push({ cls, method, sf, file });
    }
  }

  const claimed = candidates.filter(c => claimsNamespace(c.cls, namespace));
  if (claimed.length === 1) return claimed[0] as (typeof candidates)[number];
  if (claimed.length === 0 && candidates.length === 1) {
    return candidates[0] as (typeof candidates)[number];
  }

  throw new Error(
    `Cannot tell which class answers the \`${namespace}.\` namespace. ` +
      `${candidates.length} classes in this feature implement ${RESOLVER} and ` +
      `${claimed.length} of them guard on \`=== '${namespace}'\`. Searched:\n  ` +
      `${files.map(([name]) => name).join('\n  ')}\n` +
      "Either the manifest's displayNamespace is wrong, or the feature now holds " +
      'two display classes and the namespace guard is what has to tell them apart.'
  );
}

/**
 * Every path the code that answers `namespace` can resolve, read from that code.
 *
 * Works for both kinds of namespace. `selector`, `bundle` and `toggle` resolve
 * everything in their own `getPropertyValue`; `cart`, `package`, `selection`,
 * `shipping` and `order` are *routed* through `PROPERTY_MAPPINGS` and then land on a
 * resolver all the same — `CartDisplayEnhancer.resolveValue`, reached through the
 * `getPropertyValue` that delegates to it. Treating the routing table as the answer
 * for those five is what published ten `cart.` paths that render nothing and hid six
 * that work (finding 127 in `docs/code-findings.md`), so the table is now a claim
 * this list is checked against rather than the list itself.
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
 * extractResolvedDisplayPaths(files, 'cart').where;
 * // → 'cart-summary.display.ts › CartDisplayEnhancer.getPropertyValue'
 * ```
 */
export function extractResolvedDisplayPaths(
  files: Array<[string, string]>,
  namespace: string
): ResolvedDisplayPaths {
  const { cls, method, sf, file } = findResolver(files, namespace);

  // Index by callee name so a delegation can be followed without resolving imports.
  // The resolving class's own methods win: `shipping-display` has a private
  // `getCalculatedProperty` and `order-display` a module function of the same name.
  const index = new Map<string, Callable>();
  const className = cls.name?.text ?? '<anonymous class>';
  for (const [name, text] of files) {
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
    for (const node of descendants(source)) {
      if (!ts.isFunctionDeclaration(node) || !node.name || !node.body) continue;
      index.set(node.name.text, {
        node,
        sf: source,
        file: name,
        symbol: `${name}:${node.name.text}`,
        ownMethod: false,
      });
    }
  }
  for (const member of cls.members) {
    if (!ts.isMethodDeclaration(member) || !member.body) continue;
    const name = member.name.getText(sf);
    index.set(name, {
      node: member,
      sf,
      file,
      symbol: `${file}:${className}.${name}`,
      ownMethod: true,
    });
  }

  const ctx: WalkContext = {
    namespace,
    index,
    visited: new Set(),
    names: [],
  };
  const entry = index.get(RESOLVER);
  if (!entry) {
    throw new Error(`${className}.${RESOLVER} disappeared between two AST reads.`);
  }
  walkResolver(ctx, entry, new Set(SEEDS), '');

  const resolved = [...new Set(ctx.names)];
  if (resolved.length === 0) {
    throw new Error(
      `${className}.${RESOLVER} in ${file} answers the \`${namespace}.\` namespace ` +
        'but no paths could be read from it. extractResolvedDisplayPaths follows a ' +
        '`switch` on the display path, a `switch` on one of its segments, an object ' +
        'literal the code indexes by the path, and delegations that hand the path on ' +
        '— if it now resolves paths some other way, teach this extractor that shape ' +
        'rather than letting the page publish an empty list.'
    );
  }

  const formatter = methodNamed(cls, FORMATTER, sf);
  const formats = formatTable(cls, sf);
  const segments = prefixSegments(cls, sf);

  return {
    paths: resolved.map(name => ({
      name,
      format: formats[name] ?? 'auto',
      negated: false,
    })),
    where: anchor(file, `${className}.${RESOLVER}`),
    ...(ctx.dataFallback ? { dataFallback: ctx.dataFallback } : {}),
    ...(segments === undefined ? {} : { prefixSegments: segments }),
    formats,
    // A `getDefaultFormatType` that never calls `super` is the last word on this
    // namespace's formats, so the routing table's declarations do not apply to it.
    formatsAreTotal:
      !!formatter?.body &&
      !formatter.body.getText(sf).includes(`super.${FORMATTER}`),
    formatsWithoutPath: Object.keys(formats).filter(
      formatted => !resolved.includes(formatted)
    ),
    formatWhere: formatter ? anchor(file, `${className}.${FORMATTER}`) : undefined,
  };
}
