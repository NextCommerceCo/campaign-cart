/**
 * Finds every browser-storage key the SDK reads or writes, by reading the source.
 *
 * A visitor's session is spread across roughly forty sessionStorage and localStorage
 * entries, and until this scan existed the docs named five of them. Anyone debugging
 * "why did the cart come back empty" or "why is this page still in EUR" was reading
 * devtools against a key list that lived only in people's heads. Transcribing it by
 * hand would be stale within a release, so the keys are extracted and the drift test
 * refuses to publish a row for a key that has left the codebase.
 *
 * Three shapes produce a key, and all three are scanned:
 *
 * ```ts
 * export const CART_STORAGE_KEY = 'next-cart-state';      // a constant in core/storage.ts
 * persist(fn, { name: 'next-order', storage: … });        // a Zustand persist name
 * sessionStorage.setItem('next_selected_currency', 'EUR'); // a literal call site
 * ```
 *
 * **Dynamic keys keep their shape.** `` `${CAMPAIGN_STORAGE_KEY}_${currency}` `` is
 * reported as `next-campaign-cache_{currency}`, because that is the form a reader can
 * match against `next-campaign-cache_EUR` in devtools. The same rule turns
 * `CALC_CACHE_PREFIX + hex` into `next-price-{hex}` and `` `upsells_${orderId}` ``
 * into `upsells_{orderId}`.
 *
 * **What it deliberately cannot see:** a key that only exists as a function argument —
 * `sessionStorage.setItem(key, value)` where `key` is a parameter of a method its
 * callers pass `'utm_source'` to. Naming those would need call-graph analysis; instead
 * they are hand-declared in `UNSCANNABLE_STORAGE_KEYS` with a source anchor the drift
 * test checks, so they cannot rot silently either.
 *
 * @internal
 */

import ts from 'typescript';

import { anchorOf } from './source-anchor';

export const STORAGE_AREAS = ['sessionStorage', 'localStorage'] as const;

/** Which of the two browser stores an entry lives in. */
export type StorageArea = (typeof STORAGE_AREAS)[number];

/** How the key was found — useful when a documented key looks wrong. */
export type KeySource = 'constant' | 'persist' | 'call';

/** One key (or key pattern), merged across every place it is touched. */
export interface ExtractedStorageKey {
  /**
   * The exact key, or the pattern with varying parts as `{token}` — named after
   * whichever local variable the first site happened to use, so treat it as a
   * readable sample rather than an identity. {@link pattern} is the identity.
   */
  key: string;
  /**
   * The key with every varying part collapsed to `{}`, which is what makes two
   * sites the same key: `` `${CAMPAIGN_STORAGE_KEY}_${currency}` `` and
   * `` `${CAMPAIGN_STORAGE_KEY}_${requestedCurrency}` `` write the same entry, and a
   * page that listed both as separate keys would be describing a codebase quirk
   * instead of the storage.
   */
  pattern: string;
  /** True when the key is built at runtime, so `key` is a pattern not a literal. */
  dynamic: boolean;
  /**
   * Where it lives. Two entries means the same name is used in both stores — which
   * is a real thing here (`evclid`, `next_funnel_name`) and worth seeing.
   * Empty means the key is declared as a constant and never read or written.
   */
  areas: StorageArea[];
  sources: KeySource[];
  /** Every site, `state/cart/cart.state.ts:84` style, sorted. */
  where: string[];
}

/** `getItem`/`setItem`/`removeItem` — the raw Storage API. */
const RAW_METHODS = new Set(['getItem', 'setItem', 'removeItem']);
/** `StorageManager` from `core/storage.ts` wraps the same three. */
const MANAGER_METHODS = new Set(['get', 'set', 'remove', 'has']);

/** Receiver text → the store it means. */
function areaOfReceiver(text: string): StorageArea | undefined {
  const name = text.replace(/^window\./, '');
  if (name === 'sessionStorage' || name === 'sessionStorageManager') {
    return 'sessionStorage';
  }
  if (name === 'localStorage' || name === 'localStorageManager') {
    return 'localStorage';
  }
  return undefined;
}

/** A constant whose value can be read straight out of the syntax tree. */
interface Resolvable {
  node: ts.Expression;
  sf: ts.SourceFile;
}

/** Marker for a name that exists but holds an unknowable value at build time. */
const OPAQUE = Symbol('opaque');
type Resolution = Resolvable | typeof OPAQUE | undefined;

function unwrap(node: ts.Expression): ts.Expression {
  // `{ … } as const`, `('x')` and `await calcCacheKey(…)` all wrap the value we
  // want. The `await` case is not cosmetic: the bundle-price cache key is built by
  // an async hash, so without it `next-price-*` was invisible to the scan.
  if (
    ts.isAsExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isAwaitExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    return unwrap(node.expression);
  }
  return node;
}

function isExported(node: ts.VariableStatement): boolean {
  return !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Constants that are exported, so a call site in another file can reach them —
 * `CART_STORAGE_KEY` from `core/storage.ts`, `STORAGE_KEYS.SESSION_ID` from
 * `core/analytics/config.ts`. Object members are indexed as `OBJ.PROP`.
 *
 * Non-exported module constants are deliberately left out of this map: three
 * different files declare a private `STORAGE_KEY`, so a global lookup by bare name
 * would hand back the wrong value. Those resolve per file instead.
 */
function indexExportedConstants(
  parsed: Array<[string, ts.SourceFile]>
): Map<string, Resolvable> {
  const found = new Map<string, Resolvable>();

  for (const [, sf] of parsed) {
    for (const stmt of sf.statements) {
      if (!ts.isVariableStatement(stmt) || !isExported(stmt)) continue;
      for (const decl of stmt.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
        const name = decl.name.text;
        const init = unwrap(decl.initializer);

        if (ts.isObjectLiteralExpression(init)) {
          for (const prop of init.properties) {
            if (!ts.isPropertyAssignment(prop) || !prop.name) continue;
            const key = prop.name.getText(sf).replace(/^['"]|['"]$/g, '');
            found.set(`${name}.${key}`, { node: prop.initializer, sf });
          }
          continue;
        }
        if (!found.has(name)) found.set(name, { node: init, sf });
      }
    }
  }

  return found;
}

/** The nearest enclosing class, for `this.foo` and `Foo.BAR` lookups. */
function enclosingClass(node: ts.Node): ts.ClassLikeDeclaration | undefined {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isClassLike(n)) return n;
  }
  return undefined;
}

/**
 * A property on the enclosing class, if it carries a usable value.
 *
 * `private persistenceId: string = ''` is a declaration, not a value — the real id
 * arrives from a `data-persistence-id` attribute in `connectedCallback`. Trusting the
 * initializer there published the timer key as the bare prefix `next-timer-`, which
 * matches nothing in devtools. So an empty string initializer counts as unknown,
 * while a real one (`private cachePrefix = 'next_country_'`) resolves.
 */
function classMember(
  cls: ts.ClassLikeDeclaration,
  name: string,
  sf: ts.SourceFile
): Resolution {
  for (const member of cls.members) {
    if (!ts.isPropertyDeclaration(member) || !member.name) continue;
    if (member.name.getText(sf).replace(/^['"]|['"]$/g, '') !== name) continue;
    const init = member.initializer;
    if (!init) return OPAQUE;
    const placeholder =
      (ts.isStringLiteral(init) || ts.isNoSubstitutionTemplateLiteral(init)) &&
      init.text === '';
    return placeholder ? OPAQUE : { node: init, sf };
  }
  return undefined;
}

/**
 * Resolves an identifier the way the language does: nearest scope outward. Getting
 * this right matters — `country-service.ts` declares `cacheKey` four times with four
 * different values, and a flat per-file map would report whichever it saw last.
 *
 * A function parameter resolves to {@link OPAQUE}: the name exists, its value does
 * not, and that is precisely what becomes a `{token}` in the reported pattern.
 */
function resolveInScope(
  name: string,
  from: ts.Node,
  sf: ts.SourceFile
): Resolution {
  for (let n: ts.Node | undefined = from; n; n = n.parent) {
    // A `CaseBlock` holds clauses rather than statements, so it is not a scope we
    // can read declarations out of directly — its clauses are visited on the way up.
    const statements =
      ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n)
        ? n.statements
        : ts.isCaseOrDefaultClause(n)
          ? n.statements
          : undefined;

    if (statements) {
      for (const stmt of statements) {
        if (!ts.isVariableStatement(stmt)) continue;
        for (const decl of stmt.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || decl.name.text !== name) continue;
          return decl.initializer ? { node: decl.initializer, sf } : OPAQUE;
        }
      }
    }

    if (ts.isFunctionLike(n)) {
      for (const param of n.parameters) {
        if (ts.isIdentifier(param.name) && param.name.text === name) {
          return OPAQUE;
        }
      }
    }
  }
  return undefined;
}

/** The single expression a one-line helper returns, so `getTimerKey(id)` resolves. */
function returnedExpression(fn: ts.Node): ts.Expression | undefined {
  if (
    !ts.isFunctionDeclaration(fn) &&
    !ts.isArrowFunction(fn) &&
    !ts.isFunctionExpression(fn) &&
    !ts.isMethodDeclaration(fn)
  ) {
    return undefined;
  }
  const body = fn.body;
  if (!body) return undefined;
  if (!ts.isBlock(body)) return body; // concise arrow body
  const last = [...body.statements].reverse().find(ts.isReturnStatement);
  return last?.expression;
}

/** Declaration of a locally declared function or arrow constant, by name. */
function findFunction(name: string, sf: ts.SourceFile): ts.Node | undefined {
  let found: ts.Node | undefined;
  const visit = (node: ts.Node): void => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      found = node.initializer;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found;
}

/** `this.selectorId` and `ctx.foo.bar` both read best as their last segment. */
function token(expr: ts.Expression): string {
  const text = expr.getText().replace(/\s+/g, '');
  const last = text.split('.').pop() ?? text;
  return `{${last.replace(/[()[\]]/g, '')}}`;
}

interface Ctx {
  sf: ts.SourceFile;
  exported: Map<string, Resolvable>;
}

/**
 * Reads a key expression as a string, with the parts it cannot know as `{token}`.
 *
 * @param allowToken false at the top of a call — `setItem(key, …)` where `key` is a
 *   bare parameter has no reportable name at all, and publishing `{key}` as if it
 *   were a key would be a lie. True inside a template or a concatenation, where a
 *   known prefix makes the token meaningful (`next_country_{key}`).
 */
function readKey(
  expr: ts.Expression,
  ctx: Ctx,
  allowToken: boolean,
  depth = 0
): string | undefined {
  if (depth > 8) return undefined; // a cycle in the constant graph must not hang
  const node = unwrap(expr);

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }

  if (ts.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      const part = readKey(span.expression, ctx, true, depth + 1);
      out += (part ?? token(span.expression)) + span.literal.text;
    }
    return out;
  }

  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = readKey(node.left, ctx, true, depth + 1);
    const right = readKey(node.right, ctx, true, depth + 1);
    // Both sides unknown means there is no prefix to anchor the reader — skip it.
    if (left === undefined && right === undefined) return undefined;
    return (left ?? token(node.left)) + (right ?? token(node.right));
  }

  if (ts.isCallExpression(node)) {
    const callee = node.expression;
    if (!ts.isIdentifier(callee)) return undefined;
    const fn = findFunction(callee.text, ctx.sf);
    const returned = fn && returnedExpression(fn);
    return returned ? readKey(returned, ctx, true, depth + 1) : undefined;
  }

  if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) {
    const resolved = resolveName(node, ctx);
    if (resolved === OPAQUE) return allowToken ? token(node) : undefined;
    if (resolved) return readKey(resolved.node, ctx, true, depth + 1);
    return allowToken ? token(node) : undefined;
  }

  return undefined;
}

/** Identifier / `this.X` / `Class.X` / `OBJ.PROP` → its declaration, if findable. */
function resolveName(
  node: ts.Identifier | ts.PropertyAccessExpression,
  ctx: Ctx
): Resolution {
  if (ts.isIdentifier(node)) {
    const local = resolveInScope(node.text, node, ctx.sf);
    if (local) return local;
    const cls = enclosingClass(node);
    const member = cls && classMember(cls, node.text, ctx.sf);
    if (member) return member;
    return ctx.exported.get(node.text);
  }

  const prop = node.name.text;
  const receiver = node.expression;

  if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
    const cls = enclosingClass(node);
    return cls ? classMember(cls, prop, ctx.sf) : undefined;
  }

  if (ts.isIdentifier(receiver)) {
    // `DebugOverlay.ACTIVE_TAB_KEY` — a static on a class in this file.
    let cls: ts.ClassLikeDeclaration | undefined;
    const visit = (n: ts.Node): void => {
      if (cls) return;
      if (ts.isClassLike(n) && n.name?.text === receiver.text) cls = n;
      ts.forEachChild(n, visit);
    };
    visit(ctx.sf);
    if (cls) {
      const member = classMember(cls, prop, ctx.sf);
      if (member) return member;
    }
    // `STORAGE_KEYS.SESSION_ID` — an exported object literal, possibly imported.
    return (
      ctx.exported.get(`${receiver.text}.${prop}`) ??
      resolveInScope(receiver.text, node, ctx.sf)
    );
  }

  return undefined;
}

/**
 * The store a call site writes to.
 *
 * `country-service.ts` picks its store at runtime — `const storage = useLocalStorage
 * ? localStorage : sessionStorage` — and then calls `storage.getItem(…)`. Following
 * that one indirection is what keeps `next_country_*` from vanishing from the page.
 */
function areasOfCall(
  receiver: ts.Expression,
  ctx: Ctx
): StorageArea[] | undefined {
  const direct = areaOfReceiver(receiver.getText(ctx.sf));
  if (direct) return [direct];

  if (!ts.isIdentifier(receiver)) return undefined;
  const resolved = resolveInScope(receiver.text, receiver, ctx.sf);
  if (!resolved || resolved === OPAQUE) return undefined;

  const init = unwrap(resolved.node);
  if (!ts.isConditionalExpression(init)) return undefined;
  const areas = [init.whenTrue, init.whenFalse]
    .map(branch => areaOfReceiver(branch.getText(ctx.sf)))
    .filter((a): a is StorageArea => a !== undefined);
  return areas.length === 2 ? areas : undefined;
}

interface Site {
  key: string;
  dynamic: boolean;
  areas: StorageArea[];
  source: KeySource;
  where: string;
}

/** `persist(fn, { name: 'next-order', storage: { … } })` */
function persistSite(
  node: ts.CallExpression,
  ctx: Ctx,
  where: (n: ts.Node) => string
): Site | undefined {
  const callee = node.expression;
  const isPersist = ts.isIdentifier(callee) && callee.text === 'persist';
  if (!isPersist) return undefined;

  const options = node.arguments[1];
  if (!options || !ts.isObjectLiteralExpression(options)) return undefined;

  const nameProp = options.properties.find(
    (p): p is ts.PropertyAssignment =>
      ts.isPropertyAssignment(p) &&
      !!p.name &&
      p.name.getText(ctx.sf).replace(/^['"]|['"]$/g, '') === 'name'
  );
  if (!nameProp) return undefined;

  const key = readKey(nameProp.initializer, ctx, false);
  if (key === undefined) return undefined;

  // Every store here hands `persist` its own adapter, so the store it writes to is
  // named inside the same options object rather than being Zustand's default.
  const text = options.getText(ctx.sf);
  const areas: StorageArea[] = /\blocalStorage/.test(text)
    ? ['localStorage']
    : ['sessionStorage'];

  return {
    key,
    dynamic: key.includes('{'),
    areas,
    source: 'persist',
    where: where(nameProp),
  };
}

/**
 * Exported `*_STORAGE_KEY` constants, so a key that is declared and never used still
 * appears — with no store against it, which is the tell that it is dead.
 *
 * `*_STORAGE_PREFIX` constants are skipped on purpose: a prefix is never a key on its
 * own, and it always shows up inside the fuller pattern built from it
 * (`next-timer-{persistenceId}`).
 */
function constantSites(ctx: Ctx, where: (n: ts.Node) => string): Site[] {
  const sites: Site[] = [];
  for (const stmt of ctx.sf.statements) {
    if (!ts.isVariableStatement(stmt) || !isExported(stmt)) continue;
    for (const decl of stmt.declarationList.declarations) {
      if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
      if (!/_STORAGE_KEY$/.test(decl.name.text)) continue;
      const key = readKey(decl.initializer, ctx, false);
      if (key === undefined) continue;
      sites.push({
        key,
        dynamic: key.includes('{'),
        areas: [],
        source: 'constant',
        where: where(decl),
      });
    }
  }
  return sites;
}

/**
 * @param files `[relativeName, sourceText]` for every non-test file under `src/`
 */
export function extractStorageKeys(
  files: Array<[string, string]>
): ExtractedStorageKey[] {
  const parsed: Array<[string, ts.SourceFile]> = files.map(([name, text]) => [
    name,
    ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true),
  ]);
  const exported = indexExportedConstants(parsed);
  const sites: Site[] = [];

  for (const [name, sf] of parsed) {
    const ctx: Ctx = { sf, exported };
    const where = (node: ts.Node): string => anchorOf(sf, node, name);

    sites.push(...constantSites(ctx, where));

    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const fromPersist = persistSite(node, ctx, where);
        if (fromPersist) sites.push(fromPersist);

        if (ts.isPropertyAccessExpression(node.expression)) {
          const method = node.expression.name.text;
          const raw = RAW_METHODS.has(method);
          const managed = MANAGER_METHODS.has(method);
          if (raw || managed) {
            const areas = areasOfCall(node.expression.expression, ctx);
            const arg = node.arguments[0];
            const key = arg && readKey(arg, ctx, false);
            if (areas && key !== undefined && key.trim() !== '') {
              sites.push({
                key,
                dynamic: key.includes('{'),
                areas,
                source: 'call',
                where: where(node),
              });
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  // One row per key. The same name in both stores stays one row with two areas —
  // that overlap is a fact about the code worth showing, not two separate keys.
  const byKey = new Map<string, ExtractedStorageKey>();
  for (const site of sites) {
    const pattern = toPattern(site.key);
    const existing = byKey.get(pattern);
    if (existing) {
      for (const area of site.areas) {
        if (!existing.areas.includes(area)) existing.areas.push(area);
      }
      if (!existing.sources.includes(site.source)) {
        existing.sources.push(site.source);
      }
      if (!existing.where.includes(site.where)) existing.where.push(site.where);
      continue;
    }
    byKey.set(pattern, {
      key: site.key,
      pattern,
      dynamic: site.dynamic,
      areas: [...site.areas],
      sources: [site.source],
      where: [site.where],
    });
  }

  const order = (a: StorageArea): number => STORAGE_AREAS.indexOf(a);
  for (const entry of byKey.values()) {
    entry.areas.sort((a, b) => order(a) - order(b));
    entry.sources.sort();
    entry.where.sort();
  }

  return [...byKey.values()].sort((a, b) => a.pattern.localeCompare(b.pattern));
}

/**
 * `next-campaign-cache_{currency}` → `next-campaign-cache_{}`.
 *
 * Exported so the drift test can compare a hand-written, reader-facing key against
 * an extracted one without the token *name* mattering.
 */
export function toPattern(key: string): string {
  return key.replace(/\{[^}]*\}/g, '{}');
}
