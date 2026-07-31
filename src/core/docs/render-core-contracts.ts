/**
 * Renders the two page-level contract references: `guide/reference/meta-tags.md` and
 * `guide/reference/url-parameters.md`.
 *
 * Both pages answer the same question in two places a reader looks: *what can I switch
 * on from outside the markup?* The descriptions come from the hand-written
 * {@link META_TAGS} / {@link URL_PARAMETERS} lists, and the "where it is read" appendix
 * comes from the AST extractor — so the page can never claim a tag that no code reads,
 * and a reader who does not believe a row has a file and line to go and check.
 *
 * Build-time only — see the note on {@link MetaTagDoc}.
 */

import type { AttributeValue } from './feature-manifest';
import { META_TAGS, META_TAG_GROUPS, type MetaTagDoc } from './meta-tags';
import { coreNav } from './nav';
import {
  URL_PARAMETERS,
  URL_PARAMETER_GROUPS,
  type UrlParameterDoc,
} from './url-parameters';

/** One name and every place the code touches it, as the extractor reported it. */
export interface ContractUsage {
  name: string;
  sites: Array<{
    where: string;
    consumer: string;
    access?: string;
  }>;
}

const GENERATED = (source: string): string =>
  '<!-- Generated from the core contract lists. Do not edit by hand:\n' +
  `     edit src/core/docs/${source}, then run \`npm run docs:reference\`. -->`;

function blocks(...parts: Array<string | undefined>): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join('\n\n');
}

/** A union type or an enum list contains `|`, which would end the table cell. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

/**
 * Inline code. Backticks in the source text are dropped rather than escaped: a type
 * written as ``string (in `data-tag-value`)`` would otherwise close the span early and
 * publish half a sentence as prose.
 */
function code(text: string): string {
  return `\`${cell(text).replace(/`/g, '')}\``;
}

/** The Type / Values cell: the declared type, plus a free-text constraint if there is one. */
function typeCell(type: string, values?: AttributeValue[] | string): string {
  if (typeof values === 'string') return `${code(type)}<br>${cell(values)}`;
  if (Array.isArray(values)) {
    return `${values.map(v => code(v.value)).join(' \\| ')}`;
  }
  return code(type);
}

/** `<module>` is how the extractor names top-level code; a reader wants words. */
function consumerLabel(consumer: string): string {
  return consumer === '<module>' ? '*top level of the file*' : code(consumer);
}

/**
 * The consuming code, one line per consumer, capped so the cell stays readable.
 *
 * `ref_id` is touched from eleven places; a reader needs the first two to orient
 * themselves, not all eleven.
 */
function primarySites(usage: ContractUsage | undefined, limit = 3): string {
  if (!usage?.sites.length) return '—';

  const byConsumer = new Map<string, { where: string; access?: string }>();
  for (const site of usage.sites) {
    if (!byConsumer.has(site.consumer)) {
      byConsumer.set(site.consumer, {
        where: site.where,
        ...(site.access ? { access: site.access } : {}),
      });
    }
  }

  const entries = [...byConsumer.entries()];
  const rows = entries
    .slice(0, limit)
    .map(
      ([consumer, site]) =>
        `${consumerLabel(consumer)}${site.access ? ` *(${site.access})*` : ''} — \`${site.where}\``
    );
  if (entries.length > limit) {
    rows.push(`…and ${entries.length - limit} more`);
  }
  return rows.join('<br>');
}

// ── meta tags ──────────────────────────────────────────────────────────────────

const META_LEGEND = [
  '| Mark | Meaning |',
  '|---|---|',
  '| ⚠️ | A trap worth reading before you use the tag. |',
  '| ↩︎ | An older spelling, read only when the current one is absent. |',
  '| 🚫 | Parsed by the code and never acted on — setting it changes nothing. |',
  '| ✍︎ | The SDK also writes this tag at runtime, so finding it on a page does not mean an author put it there. |',
].join('\n');

function metaMarks(tag: MetaTagDoc): string {
  const marks: string[] = [];
  if (tag.status === 'legacy') marks.push('↩︎');
  if (tag.status === 'inert') marks.push('🚫');
  if (tag.writtenBySdk) marks.push('✍︎');
  return marks.length ? ` ${marks.join(' ')}` : '';
}

function metaMeaning(tag: MetaTagDoc): string {
  const parts: string[] = [];
  if (tag.status === 'inert') {
    parts.push('**Does nothing today.**');
  }
  parts.push(cell(tag.description ?? ''));
  if (tag.supersededBy) {
    parts.push(`Use \`${tag.supersededBy}\` instead.`);
  }
  const body = parts.join(' ');
  return tag.notes ? `${body}<br>⚠️ ${cell(tag.notes)}` : body;
}

function metaGroup(group: string): string {
  const tags = META_TAGS.filter(t => t.group === group);
  if (!tags.length) return '';

  const table = [
    '| Tag | Type | Default | What it does |',
    '|---|---|---|---|',
    ...tags.map(t => {
      const required = t.required ? ' **required**' : '';
      const dflt = t.required
        ? '—'
        : t.default === undefined
          ? 'not set'
          : cell(t.default);
      return `| ${code(t.name)}${metaMarks(t)}${required} | ${typeCell(t.type, t.values)} | ${dflt} | ${metaMeaning(t)} |`;
    }),
  ].join('\n');

  const valueTables = tags
    .filter((t): t is MetaTagDoc & { values: AttributeValue[] } =>
      Array.isArray(t.values)
    )
    .map(t =>
      blocks(
        `**\`${t.name}\` values**`,
        [
          '| Value | What it means |',
          '|---|---|',
          ...t.values.map(v => `| ${code(v.value)} | ${cell(v.description)} |`),
        ].join('\n')
      )
    );

  // Only the current, working spellings go in the snippet. Pasting a legacy alias
  // next to the tag that supersedes it would hand the reader two copies of one
  // setting where the newer one always wins — the exact drift this page warns about.
  const usable = tags.filter(t => t.status === 'active');
  const skipped = tags.filter(t => t.status !== 'active');

  const snippet = usable.length
    ? blocks(
        'Copy-paste, then replace the `{TOKENS}`:',
        ['```html', ...usable.map(t => t.example), '```'].join('\n'),
        skipped.length
          ? `Left out on purpose: ${skipped
              .map(
                t =>
                  `\`${t.name}\` (${t.status === 'legacy' ? `older spelling of \`${t.supersededBy}\`` : 'not implemented'})`
              )
              .join(
                ', '
              )}. Pasting these either duplicates a setting the newer tag ` +
              'already covers, or configures nothing.'
          : undefined
      )
    : undefined;

  return blocks(`## ${group}`, table, ...valueTables, snippet);
}

export function renderMetaTags(extracted: ContractUsage[]): string {
  const usage = new Map(extracted.map(e => [e.name, e]));

  const required = META_TAGS.filter(t => t.required);
  const inert = META_TAGS.filter(t => t.status === 'inert');

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'Meta Tags')}# Meta Tags`,
    GENERATED('meta-tags.ts'),
    `The SDK reads **${META_TAGS.length} \`<meta>\` tags** from the page's \`<head>\`. ` +
      'Attributes configure one element; these configure the whole page — the API key it ' +
      'boots with, which funnel step the page is, where checkout sends the visitor, which ' +
      'analytics events fire. Add them to the `<head>`, above the SDK loader script.',
    blocks(
      'The shortest page that works:',
      [
        '```html',
        '<head>',
        ...required.map(t => `  ${t.example}`),
        '  <meta name="next-page-type" content="product">',
        '  <script src="/next-campaign-cart.js" defer></script>',
        '</head>',
        '```',
      ].join('\n'),
      `Everything else on this page is optional. ${
        inert.length
          ? `Two of the ${META_TAGS.length} are marked 🚫: the code parses them and then ignores them, so they are documented here to stop you relying on them.`
          : ''
      }`
    ),
    blocks(
      '## How to read the tables',
      META_LEGEND,
      'The code that reads each tag is listed at the end, under ' +
        '[where these are read](#where-these-are-read).'
    ),
    ...META_TAG_GROUPS.map(g => metaGroup(g)),
    blocks(
      '## Cautions',
      [
        '- **A meta tag beats `window.nextConfig`.** Configuration is loaded from ' +
          '`window.nextConfig` first and from meta tags second, so a leftover tag silently ' +
          'overrides the value your loader script computed. If a config value is not the one ' +
          'you set in JavaScript, search the page for a `<meta name="next-…">` before ' +
          'anything else.',
        '- **Several tags come in two or three spellings and the newest always wins.** ' +
          '`next-success-url` / `next-next-url` / `os-next-page` are one setting, as are the ' +
          'two failure URLs and the two payment keys. Editing the older copy on a page that ' +
          'carries both looks like the SDK ignored you. Collapse them to one when you touch ' +
          'such a page.',
        '- **Analytics tags that replace auto-detection replace it completely.** ' +
          "`next-analytics-view-item` and `next-analytics-view-item-list` switch the SDK's own " +
          'detection off for that event. A wrong package id therefore reports the wrong ' +
          'product rather than falling back to the right one.',
        '- **The debug tag is not the debug overlay.** `next-debug` raises the log level and ' +
          'exposes `window.nextDebug`; the panel needs `?debugger=true`. See ' +
          '[URL parameters](./url-parameters.md).',
      ].join('\n')
    ),
    blocks(
      '## Where these are read',
      'Every tag above, with the code that reads it. This table is generated from the ' +
        'source, so a tag could not be listed on this page unless something reads it.',
      [
        '| Tag | Read by |',
        '|---|---|',
        ...[...META_TAGS]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(t => `| ${code(t.name)} | ${primarySites(usage.get(t.name))} |`),
      ].join('\n')
    ),
  ];

  return `${blocks(...parts)}\n`;
}

// ── URL parameters ─────────────────────────────────────────────────────────────

const PARAM_LEGEND = [
  '| Mark | Meaning |',
  '|---|---|',
  '| ⚠️ | A trap worth reading before you use the parameter. |',
  '| 🔴 | Changes what a real visitor gets, or what reaches a real API. Never leave it on a link you publish. |',
  '| 📌 | Sticky: the value is copied into storage, so removing it from the URL does **not** undo it for the rest of the session. |',
  '| ✍︎ | The SDK puts this parameter on URLs it builds for the visitor. |',
].join('\n');

function paramMarks(param: UrlParameterDoc): string {
  const marks: string[] = [];
  if (param.productionHazard) marks.push('🔴');
  if (param.sticky) marks.push('📌');
  if (param.direction !== 'read') marks.push('✍︎');
  return marks.length ? ` ${marks.join(' ')}` : '';
}

function paramMeaning(param: UrlParameterDoc): string {
  const parts: string[] = [];
  if (param.direction === 'written') {
    parts.push('**Written by the SDK, not by you.**');
  }
  parts.push(cell(param.description ?? ''));
  if (param.productionHazard) {
    parts.push('<br>🔴 **Do not leave this on a link that ships.**');
  }
  if (param.notes) parts.push(`<br>⚠️ ${cell(param.notes)}`);
  return parts.join(' ').replace(/ <br>/g, '<br>');
}

function paramGroup(group: string): string {
  const params = URL_PARAMETERS.filter(p => p.group === group);
  if (!params.length) return '';

  const table = [
    '| Parameter | Values | Default | What it does |',
    '|---|---|---|---|',
    ...params.map(p => {
      const dflt = p.default === undefined ? '—' : cell(p.default);
      return `| ${code(p.name)}${paramMarks(p)} | ${typeCell(p.type, p.values)} | ${dflt} | ${paramMeaning(p)} |`;
    }),
  ].join('\n');

  const authored = params.filter(p => p.direction !== 'written');
  const snippet = authored.length
    ? blocks(
        'Add to any page URL:',
        ['```text', ...authored.map(p => p.example), '```'].join('\n')
      )
    : undefined;

  return blocks(`## ${group}`, table, snippet);
}

export function renderUrlParameters(extracted: ContractUsage[]): string {
  const usage = new Map(extracted.map(e => [e.name, e]));
  const hazards = URL_PARAMETERS.filter(p => p.productionHazard);
  const sticky = URL_PARAMETERS.filter(p => p.sticky);

  const parts: Array<string | undefined> = [
    `${coreNav('Reference', 'URL Parameters')}# URL Parameters`,
    GENERATED('url-parameters.ts'),
    `The SDK acts on **${URL_PARAMETERS.length} query parameters**. They are the ` +
      'configuration surface with no trace in the markup: nothing on the page mentions ' +
      'them, so grepping a template never finds them, and adding one to a link changes ' +
      'what the page does.',
    blocks(
      `**${hazards.length} of them are not safe on a link you publish** — they change what a real ` +
        'visitor gets or what reaches a real API. They are marked 🔴 in the tables below, ' +
        `with the reason on their own row: ${hazards.map(p => `\`${p.name}\``).join(', ')}.`,
      `**${sticky.length} are sticky** (marked 📌): the SDK copies the value into storage, so the ` +
        'effect continues on later page loads after you take the parameter out of the URL. ' +
        'When a page behaves as though a parameter is still set, it is.'
    ),
    blocks(
      '## `?debug` and `?debugger` are different switches',
      'They are one letter apart and they do unrelated things, which is the most common ' +
        'confusion on these pages:',
      [
        '| You want | Use | What you get |',
        '|---|---|---|',
        '| Console output on a live page | `?debug=true` | Un-suppresses the `debug`, `info`, and `warn` lines the production bundle normally drops. No UI. |',
        '| The on-page debug panel | `?debugger=true` | The overlay with the cart, campaign, order, checkout, and analytics panels — **and test mode**, silently. |',
      ].join('\n'),
      'Neither the `next-debug` meta tag nor `window.nextConfig.debug` opens the overlay: ' +
        'they raise the log level and expose `window.nextDebug`, nothing more. Only ' +
        '`?debugger=true` or `window.nextConfig.debugger = true` opens it. See ' +
        '[meta tags](./meta-tags.md).'
    ),
    blocks('## How to read the tables', PARAM_LEGEND),
    ...URL_PARAMETER_GROUPS.map(g => paramGroup(g)),
    blocks(
      '## Any other parameter is still captured',
      'Every query parameter on the URL — not only the ones listed here — is copied into ' +
        'the parameter store at boot and forwarded onto links the SDK builds, so a flag ' +
        'you invent survives the whole funnel. That is how a condition like ' +
        '`data-next-show="param.seen == \'1\'"` works. Two things to know before relying ' +
        'on it: the values are always strings, and they are only readable after the SDK ' +
        'has processed the URL. ' +
        'Both are covered in the parameter store reference — ' +
        '[`useParameterStore`](../../../state/parameter/guide/reference/state-reference.md).'
    ),
    blocks(
      '## Cautions',
      [
        '- **`?test=true` reaches the real order API.** Test mode fills a hard-coded address ' +
          'and posts `card_token: "test_card"` to the live order endpoint. Worse, the Konami ' +
          'listener that turns it on is attached on every page load in production and does ' +
          'not check whether test mode is already on — typing ↑↑↓↓←→←→BA on a live checkout ' +
          'creates a real order record. Treat any order addressed to *Test Order, Test ' +
          'Address 123, Tempe AZ 85281* as a test artefact.',
        '- **`?debugger=true` implies test mode.** Debugging a live page therefore arms the ' +
          'above. Use it on staging, or accept the risk knowingly.',
        '- **`?reset=true` clears less than it sounds like.** It only removes storage keys ' +
          'spelled `next-…`, so the remembered currency, country, funnel, the analytics ' +
          'ignore flag, and the Everflow click id all survive it. A session stuck in the ' +
          'wrong currency needs a new tab, not this parameter.',
        '- **`?ignore=true` is invisible once set.** It writes a session flag, so analytics ' +
          'stays off for the rest of the tab with nothing in the URL to show it. If a QA ' +
          'session produced no events, this is the first thing to check.',
        '- **`?forcePackageId` empties the cart first.** It is a testing tool, not a ' +
          '"pre-fill the cart" feature for campaigns — a real visitor who follows such a ' +
          'link loses what they had.',
      ].join('\n')
    ),
    blocks(
      '## Where these are read',
      'Every parameter above, with the code that reads or writes it. Generated from the ' +
        'source, so a parameter could not be listed on this page unless the SDK touches it.',
      [
        '| Parameter | Read by |',
        '|---|---|',
        ...[...URL_PARAMETERS]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(p => `| ${code(p.name)} | ${primarySites(usage.get(p.name))} |`),
      ].join('\n')
    ),
  ];

  return `${blocks(...parts)}\n`;
}
