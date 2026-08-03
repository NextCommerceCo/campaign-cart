/**
 * Renders `guide/reference/display-paths.md` (and its `-{namespace}` siblings) —
 * every `data-next-display` path a namespace can show. Split out of
 * `render-feature-reference.ts`; see that file for the other generated pages.
 */

import type {
  DisplayPathDoc,
  DisplayPathsDoc,
  FeatureManifest,
} from '../schema/feature-manifest';
import { blocks, pageHeader } from './render-feature-reference-shared';

/**
 * One `data-next-display` path, extracted from whichever part of the SDK answers
 * the namespace, so the published list cannot drift from what resolves.
 *
 * Re-exported from the extractor rather than declared again here: this file used to
 * carry a second copy without the `path` field, so a caller that imported the type
 * from the renderer could not read where a routing entry sends a name — the two
 * copies had already drifted by one field.
 */
import type { DisplayPath } from '@/docs/extract/extract-display-paths';

export type { DisplayPath };

/**
 * The paths one namespace resolves, and where they were read from.
 *
 * A resolved source, not a lookup table: the caller has already decided which of the
 * two extractors answers this namespace. That is what removes the failure mode this
 * page used to have — handed a table it was not in, it rendered "No paths are
 * declared for the `bundle.` namespace", which reads as a fact about the SDK rather
 * than as the generator missing its source.
 */
export interface DisplayPathSource {
  paths: DisplayPath[];
  /**
   * The symbol the list came from —
   * `bundle-selector.display.ts › BundleDisplayEnhancer.getPropertyValue`.
   */
  where?: string;
  /**
   * Routing-table entries nothing resolves, each with what to write instead. Renders
   * as its own section: the names are already on live pages, so a reader who has one
   * needs to be told it does nothing, not to find it silently missing.
   */
  unanswered?: Array<{
    name: string;
    routedTo: string;
    instead: string;
    /**
     * The routing entry declares a `fallback:`. Whether that ever reaches a page
     * depends on the resolver too — `BaseDisplayEnhancer` only applies it when the
     * resolver returns `null`/`undefined` on the miss, which `order-display` never
     * does (it returns `''`), so `order.status`'s declared fallback rendered nothing,
     * ever, the whole time the page claimed otherwise (finding 144 in
     * `docs/code-findings.md`). `cart.discountCode` is the one entry in the codebase
     * today where this is actually true: `CartDisplayEnhancer.resolveValue` returns
     * `undefined` on its `default:`, so the declared `fallback: ''` does render.
     */
    hasFallback: boolean;
  }>;
  /**
   * Where the routing table that declares {@link unanswered} lives, for the section
   * that tells a reader why a name they can find in the source is not on this page.
   */
  claimedIn?: string;
}

/** Groups render in the order they first appear; ungrouped entries come first. */
function groupPaths(
  docs: DisplayPathDoc[]
): Array<[string | undefined, DisplayPathDoc[]]> {
  const order: Array<string | undefined> = [];
  const byGroup = new Map<string | undefined, DisplayPathDoc[]>();
  for (const doc of docs) {
    if (!byGroup.has(doc.group)) {
      byGroup.set(doc.group, []);
      order.push(doc.group);
    }
    byGroup.get(doc.group)?.push(doc);
  }
  return [
    ...order.filter(g => g === undefined),
    ...order.filter(g => g !== undefined),
  ].map(g => [g, byGroup.get(g) ?? []]);
}

const PATHS_TABLE_HEAD = ['| Path | Format | Notes |', '|---|---|---|'];

/**
 * Every `data-next-display` path a namespace can show, as its own page.
 *
 * Kept separate from `attributes.md` so it works whichever mode owns the
 * reference: a hand-written page keeps its prose and still gets a complete,
 * always-current path inventory beside it.
 *
 * The **list** comes from `source`, which the caller read out of the code that
 * resolves the namespace. The **prose** — the prefix grammar, what each value means,
 * the cautions — comes from `manifest.displayPaths`, because none of it is derivable
 * and all of it is why the page is worth opening. A namespace with no prose still
 * gets its table, which is what the routed namespaces publish today.
 *
 * A routed namespace also gets a second table: the names its routing table declares
 * that nothing resolves. Those are not silently dropped, because a reader arriving
 * with `cart.hasItems` in their markup needs to be told it renders nothing and what
 * to write instead — the page missing it is what let it sit there for months.
 *
 * `namespace`/`doc`/`leaf` default to the manifest's primary
 * {@link FeatureManifest.displayNamespace}/{@link FeatureManifest.displayPaths}, so
 * every existing call site is unaffected. A feature that answers a second namespace
 * from the same resolver — `ProductDisplayEnhancer` answers `package.` and
 * `campaign.` — passes the entry from
 * {@link FeatureManifest.additionalDisplayNamespaces} instead, which is what makes
 * that namespace's page a distinct file with its own sidebar leaf rather than a
 * second, silently-overwriting `Display Paths` page.
 */
export function renderDisplayPaths(
  manifest: FeatureManifest,
  source: DisplayPathSource,
  namespace: string = manifest.displayNamespace ?? '',
  doc: DisplayPathsDoc | undefined = manifest.displayPaths,
  leaf: string = 'Display Paths'
): string {
  const prefix = doc?.prefix ?? namespace;
  const formats = new Map(source.paths.map(p => [p.name, p]));

  const row = (name: string, notes: string): string => {
    const path = formats.get(name);
    const format =
      !path || path.format === 'auto' ? 'auto' : `\`${path.format}\``;
    const negated = path?.negated ? 'Inverse of another value.' : '';
    return `| \`${prefix}.${name}\` | ${format} | ${notes || negated} |`;
  };

  // With prose, the manifest's order and grouping win; without it, source order.
  const tables: string[] = [];
  if (doc) {
    for (const [group, docs] of groupPaths(doc.paths)) {
      if (group) tables.push(`## ${group}`);
      tables.push(
        [
          ...PATHS_TABLE_HEAD,
          ...docs.map(d => row(d.name, d.description)),
        ].join('\n')
      );
    }
  } else {
    tables.push(
      [...PATHS_TABLE_HEAD, ...source.paths.map(p => row(p.name, ''))].join(
        '\n'
      )
    );
  }

  const provenance =
    `Generated from \`${source.where}\` — the method that resolves these paths — ` +
    'so a name missing here is one the namespace does not answer, whatever else ' +
    'in the feature accepts it.';

  // The "renders the fallback instead" clause is only true when *this* page has an
  // entry where the routing table declares one — finding 144 found it asserted on
  // every routed namespace's page, including `order.`, whose resolver returns `''`
  // on a miss and so can never reach a declared fallback at all. Print the caveat
  // only where a row below can actually exhibit it.
  const anyFallback = source.unanswered?.some(u => u.hasFallback) ?? false;

  const unanswered = source.unanswered?.length
    ? blocks(
        '## Declared but not answered',
        `\`${source.claimedIn ?? 'The routing table'}\` also lists these under ` +
          `\`${namespace}\`, and \`${source.where}\` has no answer for any of them. ` +
          (anyFallback
            ? 'Writing most of these renders nothing — except the ones marked ' +
              '`fallback value` in the Renders column below, which render that ' +
              'value instead, reading as though it worked.'
            : 'Writing one renders nothing.'),
        [
          anyFallback
            ? '| Path | Routed to | Renders | Write instead |'
            : '| Path | Routed to | Write instead |',
          anyFallback ? '|---|---|---|---|' : '|---|---|---|',
          ...source.unanswered.map(u => {
            // An entry that routes a name to itself says nothing extra; showing it
            // reads as though the name were routed somewhere.
            const routed = u.routedTo === u.name ? '—' : `\`${u.routedTo}\``;
            return anyFallback
              ? `| \`${prefix}.${u.name}\` | ${routed} | ${u.hasFallback ? 'fallback value' : 'nothing'} | ${u.instead} |`
              : `| \`${prefix}.${u.name}\` | ${routed} | ${u.instead} |`;
          }),
        ].join('\n')
      )
    : undefined;

  return `${blocks(
    pageHeader(
      manifest,
      leaf,
      '<!-- Generated from the enhancer that resolves this namespace, plus the\n' +
        '     feature manifest. Do not edit by hand: change getPropertyValue or\n' +
        '     <feature>.manifest.ts, then run `npm run docs:reference`. -->'
    ),
    `Every value the \`${namespace}.\` namespace can show. Write it as ` +
      `\`data-next-display="${prefix}.{path}"\`${doc?.intro ? `, ${doc.intro}` : '.'}`,
    doc?.example ? `\`\`\`html\n${doc.example.trim()}\n\`\`\`` : undefined,
    'The Format column is what you get with no `data-next-format`; set that ' +
      'attribute to override it. `auto` means nothing declares a format for the ' +
      'path, so the SDK picks one from the property name in ' +
      '`core/base/base-display-enhancer.ts › BaseDisplayEnhancer.getDefaultFormatType`' +
      ' — it is not a promise of unformatted output. Formatting and hiding modifiers ' +
      'are the same for every namespace — see ' +
      '[display-core](../../../../display/display-core/guide/reference/attributes.md).',
    ...tables,
    unanswered,
    doc?.footer,
    doc?.cautions?.length
      ? blocks('## Cautions', doc.cautions.map(c => `- ${c}`).join('\n'))
      : undefined,
    provenance
  )}\n`;
}
