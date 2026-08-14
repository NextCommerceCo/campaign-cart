/**
 * The walk itself: given one function that resolves a `data-next-display` path,
 * find every path it (and whatever it delegates to) answers — a `switch` on the
 * whole path, a `switch` on one segment of it, an object literal indexed by it, and
 * a call that hands the path on to another function. Split out of
 * `extract-display-paths.ts`; `extract-display-paths-resolve.ts` is what starts
 * this walk and turns its result into {@link ResolvedDisplayPaths}.
 */

import ts from 'typescript';

import { anchorOf } from './source-anchor';
import { descendants, keysOf } from './extract-display-paths-ast-helpers';
import { underOtherNamespace } from './extract-display-paths-namespace-guards';

/** The method every display enhancer implements to answer a path. */
export const RESOLVER = 'getPropertyValue';

/**
 * Expressions that hold a display path when a resolver starts running.
 *
 * Everything the walk knows is derived from these two: a variable initialised from
 * one carries a path, an argument built from one delegates a path, and a `switch` on
 * one is a list of names. Anything else — the operator in an expression parser, a
 * line index — is not a path and its `case` labels are not display paths, which is
 * what keeps `+`, `-`, `*` and `/` off the selection page.
 */
export const SEEDS = ['this.property', 'this.displayPath'];

/** A `.split()` on anything but a dot produces segments of something else entirely. */
const SPLIT_ON_OTHER = /\.split\(\s*(?!['"]\.['"])/;

/**
 * Reading a path off runtime data yields a **value**, and a value is not a path.
 *
 * Without this the walk follows the value onwards: `order-display` hands the
 * resolved `payment_method` to `paymentMethodLabel`, whose lookup table is keyed
 * by payment method, and eight card brands are published as `order.` display paths.
 */
const READS_A_VALUE = /\bgetNestedProperty\(/;

/** One function the walk can step into. */
export interface Callable {
  node: ts.FunctionLikeDeclaration;
  sf: ts.SourceFile;
  file: string;
  /** `ProductDisplayEnhancer.getPropertyValue` — the anchor symbol and the cycle key. */
  symbol: string;
  /** True for a method of the resolving class, whose `this.property` is the same one. */
  ownMethod: boolean;
}

/** Everything the walk shares across functions. */
export interface WalkContext {
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
  const groups: Array<{
    labels: string[];
    body: ts.Node[];
    isDefault: boolean;
  }> = [];
  let labels: string[] = [];
  let isDefault = false;

  for (const clause of block.clauses) {
    if (ts.isCaseClause(clause)) {
      if (ts.isStringLiteral(clause.expression))
        labels.push(clause.expression.text);
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
export function walkResolver(
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
    const onSegment =
      !onWholePath && !!segment && carriers.has(segment[1] ?? '');
    if (!onWholePath && !onSegment) continue;

    for (const group of clauseGroups(node.caseBlock)) {
      if (group.isDefault) continue;
      if (onWholePath) {
        for (const label of group.labels)
          ctx.names.push(joinPath(prefix, label));
        continue;
      }
      const calls = group.body
        .flatMap(descendants)
        .filter(ts.isCallExpression)
        .filter(call =>
          call.arguments.some(a => carriesPath(a.getText(sf), carriers))
        );
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
    if (
      ancestor(node, body, n => ts.isCaseClause(n) || ts.isDefaultClause(n))
    ) {
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
