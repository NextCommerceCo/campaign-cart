/**
 * Finds the two contracts the SDK exposes to a page that live in no manifest: the
 * `<meta>` tags it reads, and the URL query parameters it acts on.
 *
 * Both are switches an author flips on the page rather than attributes on an element,
 * so no feature owns them and nothing kept a hand-written list honest. Transcribing
 * them is also the kind of job that is wrong within a week — `?ignore=true` silently
 * kills analytics and appeared in no doc at all — so they are read from the source.
 *
 * Two shapes have to be handled, because most of these are not written literally at
 * the point of use:
 *
 * ```ts
 * document.querySelector('meta[name="next-api-key"]');        // literal
 * private getMeta(name: string) {                             // …and a helper
 *   return document.querySelector(`meta[name="${name}"]`);    //   whose parameter
 * }                                                           //   is the real name
 * this.getMeta('next-analytics-list-id');                     //   at the call site
 * ```
 *
 * So the extractor resolves indirection in two ways, both of them exact rather than
 * pattern-matched on the name:
 *
 * - **Helper (sink) resolution.** A function whose body builds a selector from one of
 *   its own parameters becomes a *sink*; its call sites supply the literal. Applied to
 *   a fixed point, so a helper that forwards to another helper (`parseArray` →
 *   `getMeta`) is followed too.
 * - **Local-variable resolution.** `const metaName = cond ? 'a' : 'b'` used in the
 *   selector resolves to both branches.
 *
 * Anything it cannot resolve to a literal is dropped rather than guessed — a name
 * published here that the code does not read is worse than a gap, because a reader
 * trusts it.
 *
 * @internal
 */

import ts from 'typescript';

/** How a name was reached from the source, so a reader can retrace the extraction. */
export type Resolution =
  /** Written out at the call site: `meta[name="next-api-key"]`. */
  | 'literal'
  /** Passed to a helper that builds the selector: `this.getMeta('next-debug')`. */
  | 'helper argument'
  /** Assigned to a local first: `const metaName = … ? 'a' : 'b'`. */
  | 'local variable';

/** What a URL parameter call site does with the parameter. */
export type ParamAccess =
  | 'get'
  | 'has'
  | 'getAll'
  | 'set'
  | 'append'
  | 'delete';

/** One place a contract is touched. */
export interface ContractSite {
  /** `core/sdk-initializer.ts:390` — where to look when the description is unclear. */
  where: string;
  /**
   * What consumes it: `ClassName.method`, a bare function name, or `<module>` for
   * code at the top level of a file. This is the "who cares about this" column.
   */
  consumer: string;
  /** How the extractor got from the source to this name. */
  resolution: Resolution;
  /** URL parameters only: whether the site reads the value or rewrites the URL. */
  access?: ParamAccess;
}

/** One meta tag or URL parameter, with every place it is touched. */
export interface ExtractedContract {
  name: string;
  sites: ContractSite[];
}

export interface CoreContracts {
  metaTags: ExtractedContract[];
  urlParameters: ExtractedContract[];
}

/** Reads the value. Anything else rewrites the URL for the visitor's next page. */
const READ_ACCESS = new Set<ParamAccess>(['get', 'has', 'getAll']);

export function isReadAccess(access: ParamAccess | undefined): boolean {
  return access !== undefined && READ_ACCESS.has(access);
}

const PARAM_ACCESS = new Set<string>([
  'get',
  'has',
  'getAll',
  'set',
  'append',
  'delete',
]);

/** A static `meta[name="x"]` selector. Excludes `${…}`, which is the dynamic case. */
const META_LITERAL = /meta\[name="([^"$}{]+)"\]/g;
/** The dynamic case: `meta[name="${metaName}"]`. Captures the expression. */
const META_DYNAMIC = /meta\[name="\$\{([^}]+)\}"\]/g;

// ── source text of a string-ish node ────────────────────────────────────────────

/**
 * The literal text of a string node, with interpolations kept as `${expr}` so the
 * dynamic-selector pattern is still recognisable.
 */
function stringishText(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateExpression(node)) {
    let out = node.head.text;
    for (const span of node.templateSpans) {
      out += `\${${span.expression.getText()}}${span.literal.text}`;
    }
    return out;
  }
  return undefined;
}

/** Every string literal reachable from an expression, following `a ? b : c` and `a ?? b`. */
function literalsOf(node: ts.Expression): string[] {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return [node.text];
  }
  if (ts.isConditionalExpression(node)) {
    return [...literalsOf(node.whenTrue), ...literalsOf(node.whenFalse)];
  }
  if (ts.isBinaryExpression(node)) {
    return [...literalsOf(node.left), ...literalsOf(node.right)];
  }
  if (ts.isParenthesizedExpression(node)) return literalsOf(node.expression);
  return [];
}

// ── the enclosing function, for `consumer` and for parameter lookup ─────────────

interface Enclosing {
  /** `ClassName.method`, `functionName`, or `<module>`. */
  name: string;
  /** Parameter names in order, for resolving an identifier to a sink parameter. */
  params: string[];
}

/** Name of a function-ish node, including the class for a method. */
function functionName(node: ts.Node, sf: ts.SourceFile): string | undefined {
  if (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) {
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
function enclosingFunction(node: ts.Node, sf: ts.SourceFile): Enclosing {
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
  return { name: '<module>', params: [] };
}

// ── per-file index of what a local name resolves to ─────────────────────────────

interface FileIndex {
  name: string;
  sf: ts.SourceFile;
  /** `const params = new URLSearchParams(…)` / `const p = url.searchParams`. */
  paramObjects: Set<string>;
  /** `const metaName = 'a'` / `= c ? 'a' : 'b'` → the reachable literals. */
  stringVars: Map<string, string[]>;
}

/**
 * True when the expression evaluates to the query string of a *page* URL.
 *
 * The `location` check is what keeps outbound API requests out of the reference:
 * `new URLSearchParams({ query_text })` in `api/client.ts` is a request body being
 * assembled, and its `append('country', …)` has nothing to do with `?country=` on the
 * page. A `.searchParams` of any `URL` still counts — those are the links the SDK
 * builds for the visitor's next page, and a parameter it forwards is one an author
 * will see in the address bar.
 */
function looksLikeParams(expr: ts.Expression, index: FileIndex): boolean {
  if (
    ts.isNewExpression(expr) &&
    expr.expression.getText(index.sf) === 'URLSearchParams'
  ) {
    return (expr.arguments ?? []).some(a =>
      a.getText(index.sf).includes('location')
    );
  }
  const text = expr.getText(index.sf);
  if (/(^|\.)searchParams$/.test(text)) return true;
  if (ts.isIdentifier(expr)) return index.paramObjects.has(expr.text);
  return false;
}

function buildIndex(name: string, text: string): FileIndex {
  const sf = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true);
  const index: FileIndex = {
    name,
    sf,
    paramObjects: new Set(),
    stringVars: new Map(),
  };

  // Two passes so `const a = new URLSearchParams(…); const b = a;` resolves either
  // way round, without needing declaration order to cooperate.
  for (let round = 0; round < 2; round += 1) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        if (looksLikeParams(node.initializer, index)) {
          index.paramObjects.add(node.name.text);
        }
        const literals = literalsOf(node.initializer);
        if (literals.length) index.stringVars.set(node.name.text, literals);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }

  return index;
}

// ── collecting ─────────────────────────────────────────────────────────────────

/** A helper whose parameter at `index` ends up as a meta name or a parameter name. */
interface Sink {
  fn: string;
  param: number;
}

class Collector {
  private found = new Map<string, ContractSite[]>();

  public add(
    name: string,
    site: ContractSite,
    filter?: (n: string) => boolean
  ): void {
    const trimmed = name.trim();
    if (trimmed === '') return;
    if (filter && !filter(trimmed)) return;
    const sites = this.found.get(trimmed) ?? [];
    // The same name on the same line twice (`get('q') || get('q')`) is one site.
    if (sites.some(s => s.where === site.where && s.access === site.access)) {
      return;
    }
    sites.push(site);
    this.found.set(trimmed, sites);
  }

  public result(): ExtractedContract[] {
    return [...this.found.entries()]
      .map(([name, sites]) => ({ name, sites }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

function lineOf(node: ts.Node, index: FileIndex): string {
  const line =
    index.sf.getLineAndCharacterOfPosition(node.getStart(index.sf)).line + 1;
  return `${index.name}:${line}`;
}

/** The bare name of whatever a call expression calls: `this.getMeta` → `getMeta`. */
function calleeName(call: ts.CallExpression, sf: ts.SourceFile): string {
  const callee = call.expression;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.getText(sf);
  if (ts.isIdentifier(callee)) return callee.text;
  return '';
}

/**
 * Resolves an expression used where a *name* is expected into the literal names it
 * can be, registering a new sink when the expression is the enclosing function's own
 * parameter (which makes that function a helper its callers supply the name to).
 */
function resolveName(
  expr: ts.Expression,
  index: FileIndex,
  sinks: Sink[]
): { names: string[]; resolution: Resolution } {
  const direct = literalsOf(expr);
  if (direct.length) return { names: direct, resolution: 'literal' };

  if (ts.isIdentifier(expr)) {
    const enclosing = enclosingFunction(expr, index.sf);
    const paramIndex = enclosing.params.indexOf(expr.text);
    if (paramIndex >= 0 && enclosing.name !== '<module>') {
      if (!sinks.some(s => s.fn === enclosing.name && s.param === paramIndex)) {
        // A method is registered under its bare name: the call site writes
        // `this.getMeta(…)`, so `MetaTagController.getMeta` would never match.
        const bare = enclosing.name.split('.').pop() ?? enclosing.name;
        sinks.push({ fn: bare, param: paramIndex });
      }
      return { names: [], resolution: 'helper argument' };
    }
    const local = index.stringVars.get(expr.text);
    if (local?.length) return { names: local, resolution: 'local variable' };
  }

  return { names: [], resolution: 'literal' };
}

/**
 * Every source file that could read a meta tag or a query parameter, keyed by its path
 * under `src/`.
 *
 * Tests, manifests, and `docs/` are excluded because they *quote* these names in prose
 * — `package-toggle.manifest.ts` mentions `meta[name="next-upsell-accept-url"]` in a
 * default value, and this very page's declaration file names every tag it documents.
 * A quote is not a read, and counting one would make the drift check circular.
 */
export function coreContractSources(): Array<[string, string]> {
  const files = import.meta.glob<string>('../../**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  return Object.entries(files)
    .map(([path, text]): [string, string] => [
      path.replace(/^(\.\.\/)+/, ''),
      text,
    ])
    .filter(([name]) => {
      if (name.endsWith('.d.ts') || /\.(test|spec)\.ts$/.test(name))
        return false;
      if (name.includes('.manifest.ts')) return false;
      return !/(^|\/)(tests?|docs)\//.test(name);
    })
    .sort(([a], [b]) => a.localeCompare(b));
}

/**
 * @param files `[relativeName, sourceText]` for every non-test, non-docs source file
 *   that could read a meta tag or a query parameter — see {@link coreContractSources}.
 */
export function extractCoreContracts(
  files: Array<[string, string]>
): CoreContracts {
  const indexes = files.map(([name, text]) => buildIndex(name, text));

  const metaTags = new Collector();
  const urlParameters = new Collector();

  const metaSinks: Sink[] = [];
  const paramSinks: Sink[] = [];

  /** A meta name is `next-…`, `os-…`, `data-next-…`, or the bare pixel alias. */
  const isMetaName = (n: string): boolean => /^[a-z][a-z0-9-]*$/.test(n);
  /** A query parameter name — no spaces, no punctuation a URL would not carry. */
  const isParamName = (n: string): boolean =>
    /^[A-Za-z][A-Za-z0-9_-]*$/.test(n);

  // ── pass 1: selectors and accessor calls written out in full ────────────────
  for (const index of indexes) {
    const visit = (node: ts.Node): void => {
      const text = stringishText(node);
      if (text !== undefined && text.includes('meta[name=')) {
        const enclosing = enclosingFunction(node, index.sf);
        for (const match of text.matchAll(META_LITERAL)) {
          const name = match[1];
          if (name !== undefined) {
            metaTags.add(
              name,
              {
                where: lineOf(node, index),
                consumer: enclosing.name,
                resolution: 'literal',
              },
              isMetaName
            );
          }
        }
        for (const match of text.matchAll(META_DYNAMIC)) {
          const expr = match[1];
          if (expr === undefined) continue;
          // Re-parse the hole as an expression so the same resolver handles it.
          const holder = ts.createSourceFile(
            index.name,
            `(${expr})`,
            ts.ScriptTarget.Latest,
            true
          );
          const first = holder.statements[0];
          const inner =
            first && ts.isExpressionStatement(first)
              ? first.expression
              : undefined;
          if (!inner) continue;
          // The hole's identifier has to be resolved against the *real* file, so
          // reuse the original node's position for parameter lookup.
          const asIdentifier = ts.isParenthesizedExpression(inner)
            ? inner.expression
            : inner;
          if (!ts.isIdentifier(asIdentifier)) continue;

          const paramIndex = enclosing.params.indexOf(asIdentifier.text);
          if (paramIndex >= 0 && enclosing.name !== '<module>') {
            const bare = enclosing.name.split('.').pop() ?? enclosing.name;
            if (!metaSinks.some(s => s.fn === bare && s.param === paramIndex)) {
              metaSinks.push({ fn: bare, param: paramIndex });
            }
            continue;
          }
          for (const name of index.stringVars.get(asIdentifier.text) ?? []) {
            metaTags.add(
              name,
              {
                where: lineOf(node, index),
                consumer: enclosing.name,
                resolution: 'local variable',
              },
              isMetaName
            );
          }
        }
      }

      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        PARAM_ACCESS.has(node.expression.name.text) &&
        looksLikeParams(node.expression.expression, index)
      ) {
        const access = node.expression.name.text as ParamAccess;
        const arg = node.arguments[0];
        if (arg) {
          const enclosing = enclosingFunction(node, index.sf);
          const resolved = resolveName(arg, index, paramSinks);
          for (const name of resolved.names) {
            urlParameters.add(
              name,
              {
                where: lineOf(node, index),
                consumer: enclosing.name,
                resolution: resolved.resolution,
                access,
              },
              isParamName
            );
          }
        }
      }

      ts.forEachChild(node, visit);
    };
    visit(index.sf);
  }

  // ── pass 2: call sites of the helpers found in pass 1, to a fixed point ─────
  // `parseArray('next-analytics-disable')` only resolves once `parseArray` is known
  // to be a helper, which only happens once `getMeta` is — hence the loop.
  const collectFromSinks = (
    sinks: Sink[],
    collector: Collector,
    filter: (n: string) => boolean,
    access?: ParamAccess
  ): void => {
    for (let round = 0; round < 6; round += 1) {
      const before = sinks.length;

      for (const index of indexes) {
        const visit = (node: ts.Node): void => {
          if (ts.isCallExpression(node)) {
            const callee = calleeName(node, index.sf);
            for (const sink of sinks) {
              if (sink.fn !== callee) continue;
              const arg = node.arguments[sink.param];
              if (!arg) continue;
              const enclosing = enclosingFunction(node, index.sf);
              const resolved = resolveName(arg, index, sinks);
              for (const name of resolved.names) {
                collector.add(
                  name,
                  {
                    where: lineOf(node, index),
                    consumer: enclosing.name,
                    resolution:
                      resolved.resolution === 'literal'
                        ? 'helper argument'
                        : resolved.resolution,
                    ...(access ? { access } : {}),
                  },
                  filter
                );
              }
            }
          }
          ts.forEachChild(node, visit);
        };
        visit(index.sf);
      }

      if (sinks.length === before) return;
    }
  };

  collectFromSinks(metaSinks, metaTags, isMetaName);
  collectFromSinks(paramSinks, urlParameters, isParamName, 'get');

  return { metaTags: metaTags.result(), urlParameters: urlParameters.result() };
}
