// @ts-check
/**
 * Writes the Event Reference: one page per public event, from `EventMap` in `src/engine/events/`
 * (its TSDoc and `@group`). The page's Data table lists the event's own fields; every object they
 * carry (`CartItem`, `Order`, …) gets its own table further down the same page, once, from the same
 * types' TSDoc. A field tagged `@priced` or `@campaign`, or optional, says so in the Present column.
 * Examples are the payloads `tests/event-examples.test.ts` recorded in `docs/event-examples.json`.
 * Pages land in `docs/.staged/event-reference/`, and the index replaces `<!-- event-index -->` in the
 * staged `events.md`. A group's hand-written `lifecycle.md` is ordered just before its first event.
 * The Analytics Reference is the same for `AnalyticsMap`: a page per standard event under
 * `docs/.staged/analytics-reference/`, its triggers, params and `dataLayer` push from
 * `docs/analytics-examples.json` (`tests/analytics-examples.test.ts`), and `analytics.md` listing
 * them. The provider pages' `<!-- … -->` markers get the tables built from the same data and from
 * `GA4` and `META` below. Nothing here is committed.
 */
import { readdirSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { slugifyHeading, slugifyPath } from '@clean-jsdoc-theme/utils';
import { Application, OptionDefaults, ReflectionKind, TSConfigReader } from 'typedoc';

const GROUP = 'Event Reference';
const ANALYTICS = 'Analytics Reference';
const SOURCES = [
  ...readdirSync('src/engine/events').map((f) => `src/engine/events/${f}`),
  'src/engine/cart/types.ts',
  'src/engine/types.ts',
];
const MARKER = '<!-- event-index -->';
const PROVIDERS = '/analytics-reference/providers';

/** An internal engine event that triggers a standard event, as the public event it follows. */
const INTERNAL_TRIGGERS = { 'shipping.settled': ['shipping.selected', ', once the cart is priced with it'] };

/** How GA4 takes each standard event under its own name: `automatic` is GA4's own page_view. */
const GA4 = {
  page_view: 'automatic',
  update_cart: 'custom',
  upsell_purchase: 'custom',
  view_upsell: 'custom',
  skip_upsell: 'custom',
};
const ga4Of = (name) => GA4[name] ?? 'recommended';
const GA4_KIND = {
  recommended: 'a recommended event',
  custom: 'a custom event',
  automatic: 'sent by `gtag` itself; leave it out',
};

/** The Meta pixel standard event each standard event maps to in the Meta recipe. */
const META = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  generate_lead: 'Lead',
  purchase: 'Purchase',
};
const WHEN = ['@priced', '@campaign'];
const PRESENT =
  '**Present**: `always`; `optional` when it may be missing; `campaign` once the campaign is loaded; `priced` once the server priced the cart.';

const firstSentence = (s) => s.match(/^.*?\.(?=\s|$)/s)?.[0] ?? s;
const cell = (s) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ');
const linkOf = (e, root = GROUP) => `/${slugifyPath([root, e.group, e.name])}`;

const text = (parts = []) =>
  parts
    .map((p) => (p.kind === 'inline-tag' ? `\`${p.text}\`` : p.text))
    .join('')
    .trim();

async function reference(root) {
  const app = await Application.bootstrap(
    {
      entryPoints: SOURCES.map((s) => join(root, s)),
      tsconfig: join(root, 'tsconfig.json'),
      excludeInternal: true,
      sort: ['source-order'],
      modifierTags: [...OptionDefaults.modifierTags, ...WHEN],
      readme: 'none',
      logLevel: 'Error',
    },
    [new TSConfigReader()],
  );
  const project = await app.convert();
  const named = (name) => project?.getReflectionsByKind(ReflectionKind.Interface).find((r) => r.name === name);
  const map = named('EventMap');
  const analytics = named('AnalyticsMap');
  if (!map || !analytics) throw new Error('docs-events: EventMap or AnalyticsMap not found in src/engine/events/');
  return { map, analytics };
}

/** Fields of an event's data: a literal, an interface, or an intersection of them, the last of a name winning. */
function fieldsOf(type) {
  if (!type) return [];
  if (type.type === 'intersection') {
    const byName = new Map(type.types.flatMap(fieldsOf).map((f) => [f.name, f]));
    return [...byName.values()];
  }
  if (type.type === 'reflection') return type.declaration.children ?? [];
  if (type.type === 'reference' && type.reflection) return type.reflection.children ?? fieldsOf(type.reflection.type);
  return [];
}

const objectOf = (type) =>
  type?.type === 'reference' && type.reflection?.kindOf(ReflectionKind.Interface) ? type.reflection : undefined;

/** Writes one page's tables, collecting the objects its fields carry so each gets a table once. */
function tables() {
  const objects = [];
  const anchor = (r) => `#${slugifyHeading(r.name)}`;

  const typeMd = (type) => {
    switch (type?.type) {
      case 'reference': {
        const r = type.reflection;
        if (objectOf(type)) {
          if (!objects.includes(r)) objects.push(r);
          return `[\`${r.name}\`](${anchor(r)})`;
        }
        if (r?.kindOf(ReflectionKind.TypeAlias) && r.type?.type === 'union') return typeMd(r.type);
        const linked = (a) => objectOf(a.type === 'array' ? a.elementType : a);
        const args = type.typeArguments ?? [];
        if (!args.some(linked)) return `\`${type.toString()}\``;
        let md = '';
        let code = `${type.name}<`;
        args.forEach((a, i) => {
          if (i) code += ', ';
          if (!linked(a)) return void (code += a.toString());
          md += `\`${code}\`${typeMd(a)}`;
          code = '';
        });
        return `${md}\`${code}>\``;
      }
      case 'array':
        return objectOf(type.elementType) ? `${typeMd(type.elementType)}\`[]\`` : `\`${type.toString()}\``;
      case 'union':
        return type.types.map(typeMd).join(' | ');
      case 'reflection':
        return '`object`';
      default:
        return `\`${type?.toString() ?? 'unknown'}\``;
    }
  };

  const whenOf = (f) => WHEN.find((tag) => f.comment?.hasModifier(tag))?.slice(1);

  const rows = (fields, prefix = '') =>
    fields.flatMap((f) => {
      const name = `${prefix}${f.name}`;
      const present = whenOf(f) ?? (f.flags.isOptional ? 'optional' : 'always');
      const literal = f.type?.type === 'array' ? f.type.elementType : f.type;
      const row = { name, present, type: typeMd(f.type), about: text(f.comment?.summary) };
      const nested =
        literal?.type === 'reflection'
          ? rows(literal.declaration.children ?? [], `${name}${literal === f.type ? '.' : '[].'}`)
          : [];
      return [row, ...nested];
    });

  const table = (fields) => {
    const body = rows(fields);
    if (!body.length) return 'None.';
    const varies = body.some((r) => r.present !== 'always');
    const line = (r) => `| \`${r.name}\` | ${cell(r.type)} |${varies ? ` ${r.present} |` : ''} ${cell(r.about)} |`;
    const head = varies
      ? ['| Field | Type | Present | |', '| --- | --- | --- | --- |']
      : ['| Field | Type | |', '| --- | --- | --- |'];
    return [...head, ...body.map(line)].join('\n');
  };

  return (fields) => {
    const sections = [table(fields)];
    for (let i = 0; i < objects.length; i++) {
      const r = objects[i];
      sections.push(`### ${r.name}\n\n${text(r.comment?.summary)}\n\n${table(r.children ?? [])}`);
    }
    return sections.join('\n\n');
  };
}

function page(event, order, example, version) {
  const data = tables()(fieldsOf(event.member.type));
  const envelope = {
    event_id: '3f2b8c1d9e7a4b6c8d5e2f1a0b9c8d7e',
    event_type: event.name,
    object: event.name.split('.')[0],
    data: example,
    created_at: '2026-11-04T08:30:00.000Z',
    session_id: '0b8f3c2d1e4a4f6b9c7d5e3f2a1b0c9d',
    sdk_version: version,
  };
  return `---
title: '${event.name}'
group: '${GROUP}/${event.group}'
order: ${order}
---

# ${event.name}

${event.summary}

\`\`\`js
next.on('${event.name}', (data, event) => {});
\`\`\`

## Data

${data.includes('| Present |') ? `${PRESENT}\n\n` : ''}${data}

## Example

The second argument, with \`data\` inside. See [Events](/events) for the envelope's fields.

\`\`\`json
${JSON.stringify(envelope, null, 2)}
\`\`\`
`;
}

const CONTEXT = {
  page_location: 'https://shop.test/checkout/',
  page_referrer: '',
  campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
  session_id: '0b8f3c2d1e4a4f6b9c7d5e3f2a1b0c9d',
  attribution: { funnel: 'Olympus' },
  browser: { user_agent: 'Mozilla/5.0 …', language: 'en-US', device_type: 'desktop' },
};

function analyticsPage(event, order, example, linkTo) {
  const envelope = {
    name: event.name,
    id: '3f2b8c1d9e7a4b6c8d5e2f1a0b9c8d7e',
    time: '2026-11-04T08:30:00.000Z',
    params: example.params,
    context: CONTEXT,
  };
  const triggers = example.triggers.map(linkTo).join(', ');
  const meta = META[event.name];
  return `---
title: '${event.name}'
group: '${ANALYTICS}/${event.group}'
order: ${order}
---

# ${event.name}

${event.summary}

\`\`\`js
next.analytics.on('${event.name}', (event) => {});
\`\`\`

**Triggered by** ${triggers}.

## Params

${tables()(fieldsOf(event.member.type))}

## Example

\`\`\`json
${JSON.stringify(envelope, null, 2)}
\`\`\`

## Sent to

| Provider | As |
| --- | --- |
| [GTM](${PROVIDERS}/gtm) | \`${example.dataLayer.event}\` on \`dataLayer\` and \`NextDataLayer\`, below |
| [GA4](${PROVIDERS}/ga4), from a listener | \`${event.name}\`, ${GA4_KIND[ga4Of(event.name)]} |
| [Meta pixel](${PROVIDERS}/meta), from a listener | ${meta ? `\`${meta}\`` : 'Not sent'} |

### dataLayer push

\`\`\`json
${JSON.stringify(example.dataLayer, null, 2)}
\`\`\`
`;
}

function analyticsOverview(events) {
  return `---
title: 'Standard events'
group: '${ANALYTICS}'
order: 0
---

# Standard events

The SDK's own tracking events, one shape for every page: \`{ name, id, time, params, context }\`.
They are the contract, like [Events](/events): each [provider](${PROVIDERS}/overview) takes them and
remaps them to its own format. Names follow GA4 ecommerce where GA4 has one.
\`next.analytics.on(name, (event) => …)\` receives one, \`'*'\` every one.
[How analytics works](/analytics-reference/how-it-works) says how each is sent; each event's page has
what triggers it, its \`params\`, and what each provider gets.

${index(events, ANALYTICS)}
`;
}

/** Each provider page's markers and the markdown they become. */
function providerTables(tracked, examples) {
  const row = (cells) => `| ${cells.join(' | ')} |`;
  const link = (e) => `[\`${e.name}\`](${linkOf(e, ANALYTICS)})`;
  const mapped = tracked.filter((e) => META[e.name]);
  return {
    'gtm.md': {
      '<!-- gtm-events -->': [
        row(['Standard event', '`dataLayer`']),
        row(['---', '---']),
        ...tracked.map((e) => row([link(e), `\`${examples[e.name].dataLayer.event}\``])),
      ].join('\n'),
    },
    'ga4.md': {
      '<!-- ga4-events -->': [
        row(['Standard event', 'In GA4']),
        row(['---', '---']),
        ...tracked.map((e) => row([link(e), GA4_KIND[ga4Of(e.name)]])),
      ].join('\n'),
    },
    'meta.md': {
      '<!-- meta-events -->': [
        row(['Standard event', 'Meta event']),
        row(['---', '---']),
        ...mapped.map((e) => row([link(e), `\`${META[e.name]}\``])),
      ].join('\n'),
      '<!-- meta-recipe -->': `\`\`\`js
const META = {
${mapped.map((e) => `  ${e.name}: '${META[e.name]}',`).join('\n')}
};

next.analytics.on('*', ({ name, id, params }) => {
  const event = META[name];
  if (!event) return;
  const items = params.items ?? [];
  fbq(
    'track',
    event,
    {
      value: params.value,
      currency: params.currency,
      content_ids: items.map((item) => item.item_id),
      contents: items.map((item) => ({ id: item.item_id, quantity: item.quantity })),
      content_type: 'product',
    },
    { eventID: id },
  );
});
\`\`\``,
    },
  };
}

function index(events, root = GROUP) {
  return [...new Set(events.map((e) => e.group))]
    .map((group) => {
      const list = events
        .filter((e) => e.group === group)
        .map((e) => `| [\`${e.name}\`](${linkOf(e, root)}) | ${cell(firstSentence(e.summary))} |`);
      return [`### ${group}`, '', '| Event | When |', '| --- | --- |', ...list].join('\n');
    })
    .join('\n\n');
}

/** @param {string} root  @param {string} out  staged docs root */
export async function stageEventReference(root, out) {
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  const examples = JSON.parse(await readFile(join(root, 'docs/event-examples.json'), 'utf8'));
  const analyticsExamples = JSON.parse(await readFile(join(root, 'docs/analytics-examples.json'), 'utf8'));
  const { map, analytics } = await reference(root);
  const groups = (map.extendedTypes ?? []).map((t) => t.toString());
  const groupOf = (member) => groups.indexOf(member.inheritedFrom?.name.split('.')[0] ?? '');
  const events = [...(map.children ?? [])]
    .sort((a, b) => groupOf(a) - groupOf(b))
    .map((member) => ({
      name: member.name,
      group: text(member.comment?.getTag('@group')?.content),
      summary: text(member.comment?.summary),
      member,
    }))
    .filter((e) => e.group);
  for (const [i, event] of events.entries()) {
    if (!(event.name in examples))
      throw new Error(`docs-events: no example for ${event.name}; run UPDATE_DOCS=1 npm test`);
    const file = join(out, slugifyPath([GROUP, event.group]), `${event.name}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, page(event, i + 1, examples[event.name], version));
  }
  for (const group of new Set(events.map((e) => e.group))) {
    const lifecycle = join(out, slugifyPath([GROUP, group]), 'lifecycle.md');
    const text = await readFile(lifecycle, 'utf8').catch(() => undefined);
    const first = events.findIndex((e) => e.group === group) + 1;
    if (text) await writeFile(lifecycle, text.replace(/^---\n/, `---\norder: ${first - 0.5}\n`));
  }
  const linkTo = (name) => {
    const event = events.find((e) => e.name === name);
    if (event) return `[\`${name}\`](${linkOf(event)})`;
    if (name in INTERNAL_TRIGGERS) return linkTo(INTERNAL_TRIGGERS[name][0]) + INTERNAL_TRIGGERS[name][1];
    throw new Error(`docs-events: ${name} triggers an analytics event but has no Event Reference page`);
  };
  const overview = join(out, 'events.md');
  const staged = await readFile(overview, 'utf8');
  if (!staged.includes(MARKER)) throw new Error(`docs-events: ${MARKER} is missing from docs/guides/events.md`);
  await writeFile(overview, staged.replace(MARKER, index(events)));

  const tracked = (analytics.children ?? []).map((member) => ({
    name: member.name,
    group: text(member.comment?.getTag('@group')?.content),
    summary: text(member.comment?.summary),
    member,
  }));
  for (const [i, event] of tracked.entries()) {
    if (!(event.name in analyticsExamples))
      throw new Error(`docs-events: no analytics example for ${event.name}; run UPDATE_DOCS=1 npm test`);
    const file = join(out, slugifyPath([ANALYTICS, event.group]), `${event.name}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, analyticsPage(event, i + 1, analyticsExamples[event.name], linkTo));
  }
  await writeFile(join(out, 'analytics.md'), analyticsOverview(tracked));
  for (const [page, markers] of Object.entries(providerTables(tracked, analyticsExamples))) {
    const file = join(out, slugifyPath([ANALYTICS]), 'providers', page);
    let staged = await readFile(file, 'utf8');
    for (const [marker, markdown] of Object.entries(markers)) {
      if (!staged.includes(marker)) throw new Error(`docs-events: ${marker} is missing from ${file}`);
      staged = staged.replace(marker, markdown);
    }
    await writeFile(file, staged);
  }
  return { events: events.length, analytics: tracked.length };
}
