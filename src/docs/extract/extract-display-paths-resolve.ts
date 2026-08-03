/**
 * `extractResolvedDisplayPaths` — the public entry point that finds the one class
 * answering a namespace, starts {@link walkResolver} on its `getPropertyValue`, and
 * assembles the result into {@link ResolvedDisplayPaths}, format table and
 * prefix-segment count included. Split out of `extract-display-paths.ts`; see that
 * file for the full picture and the findings that shaped this.
 */

import ts from 'typescript';

import { anchor } from './source-anchor';
import {
  classesIn,
  descendants,
  methodNamed,
} from './extract-display-paths-ast-helpers';
import { claimsNamespace } from './extract-display-paths-namespace-guards';
import {
  FORMATTER,
  formatTable,
  prefixSegments,
} from './extract-display-paths-shape-prover';
import type { DisplayPath } from './extract-display-paths-routing-table';
import {
  RESOLVER,
  SEEDS,
  walkResolver,
  type Callable,
  type WalkContext,
} from './extract-display-paths-walk';

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

/** The one display class in `files`, preferring one that names the namespace itself. */
function findResolver(
  files: Array<[string, string]>,
  namespace: string
): {
  cls: ts.ClassDeclaration;
  method: ts.MethodDeclaration;
  sf: ts.SourceFile;
  file: string;
} {
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
  if (claimed.length === 1) return claimed[0];
  if (claimed.length === 0 && candidates.length === 1) {
    return candidates[0];
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
  const { cls, sf, file } = findResolver(files, namespace);

  // Index by callee name so a delegation can be followed without resolving imports.
  // The resolving class's own methods win: `shipping-display` has a private
  // `getCalculatedProperty` and `order-display` a module function of the same name.
  const index = new Map<string, Callable>();
  const className = cls.name?.text ?? '<anonymous class>';
  for (const [name, text] of files) {
    const source = ts.createSourceFile(
      name,
      text,
      ts.ScriptTarget.Latest,
      true
    );
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
    throw new Error(
      `${className}.${RESOLVER} disappeared between two AST reads.`
    );
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
      hasFallback: false,
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
    formatWhere: formatter
      ? anchor(file, `${className}.${FORMATTER}`)
      : undefined,
  };
}
