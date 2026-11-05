// @ts-check
/**
 * Writes the Event Reference: one page per public event, from `EventMap` in `src/engine/events/`
 * (its TSDoc and `@group`). The page's Data table lists the event's own fields; every object they
 * carry (`CartItem`, `Order`, …) gets its own table further down the same page, once, from the same
 * types' TSDoc. A field tagged `@priced` or `@campaign`, or optional, says so in the Present column.
 * Examples are the payloads `tests/event-examples.test.ts` recorded in `docs/event-examples.json`.
 * Pages land in `docs/.staged/event-reference/`, and the index replaces `<!-- event-index -->` in the
 * staged `events.md`. A group's hand-written `lifecycle.md` is ordered just before its first event.
 * The Analytics Reference is the same for `TrackingMap`: a page per tracking event under
 * `docs/.staged/analytics-reference/`, its triggers, its `data` (the same objects, with the same
 * tables) and its `dataLayer` push from `docs/analytics-examples.json`
 * (`tests/analytics-examples.test.ts`), and `analytics.md` listing them. The provider pages'
 * `<!-- … -->` markers get the tables built from the same data and from `GA4` and `META` below.
 * Nothing here is committed.
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

/** An internal engine event that triggers a tracking event, as the public event it follows. */
const INTERNAL_TRIGGERS = { 'shipping.settled': ['shipping.selected', ', once the cart is priced with it'] };

/** The `object` of each tracking event's envelope, as `OBJECTS` in `src/engine/events/analytics.ts`. */
const OBJECTS = {
  page_viewed: 'page',
  product_viewed: 'product',
  product_list_viewed: 'products',
  product_added_to_cart: 'cart_line',
  product_removed_from_cart: 'cart_line',
  cart_updated: 'cart',
  checkout_started: 'checkout',
  checkout_contact_info_submitted: 'checkout',
  checkout_shipping_address_submitted: 'checkout',
  checkout_shipping_method_submitted: 'checkout',
  checkout_payment_info_submitted: 'checkout',
  checkout_completed: 'order',
  upsell_completed: 'order',
  upsell_viewed: 'upsell',
  upsell_skipped: 'upsell',
  promotion_viewed: 'promotion',
  promotion_selected: 'promotion',
};

/** The GA4 event each tracking event is remapped to, as `GA4` in `src/engine/events/analytics.ts`. */
const GA4 = {
  page_viewed: 'page_view',
  product_viewed: 'view_item',
  product_list_viewed: 'view_item_list',
  product_added_to_cart: 'add_to_cart',
  product_removed_from_cart: 'remove_from_cart',
  cart_updated: 'update_cart',
  checkout_started: 'begin_checkout',
  checkout_contact_info_submitted: 'generate_lead',
  checkout_shipping_address_submitted: 'add_shipping_info',
  checkout_shipping_method_submitted: 'add_shipping_info',
  checkout_payment_info_submitted: 'add_payment_info',
  checkout_completed: 'purchase',
  upsell_completed: 'upsell_purchase',
  upsell_viewed: 'view_upsell',
  upsell_skipped: 'skip_upsell',
  promotion_viewed: 'view_promotion',
  promotion_selected: 'select_promotion',
};
/** How GA4 takes each one: `automatic` is GA4's own page_view, `custom` a name GA4 has no event for. */
const GA4_KIND_OF = {
  page_viewed: 'automatic',
  cart_updated: 'custom',
  upsell_completed: 'custom',
  upsell_viewed: 'custom',
  upsell_skipped: 'custom',
};
const GA4_KIND = {
  recommended: 'a recommended event',
  custom: 'a custom event',
  automatic: 'sent by `gtag` itself; leave it out',
};
const ga4Kind = (name) => GA4_KIND[GA4_KIND_OF[name] ?? 'recommended'];

/** The Meta pixel standard event each tracking event maps to in the Meta recipe. */
const META = {
  product_viewed: 'ViewContent',
  product_added_to_cart: 'AddToCart',
  checkout_started: 'InitiateCheckout',
  checkout_payment_info_submitted: 'AddPaymentInfo',
  checkout_contact_info_submitted: 'Lead',
  checkout_completed: 'Purchase',
};
const WHEN = ['@priced', '@campaign'];
const PRESENT =
  '**Present**: `always`; `optional` when it may be missing; `campaign` once the campaign is loaded; `priced` once the server priced the cart.';
const EVENT_ID = '3f2b8c1d9e7a4b6c8d5e2f1a0b9c8d7e';
const SESSION_ID = '0b8f3c2d1e4a4f6b9c7d5e3f2a1b0c9d';
const CREATED_AT = '2026-11-04T08:30:00.000Z';

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
  const tracking = named('TrackingMap');
  if (!map || !tracking) throw new Error('docs-events: EventMap or TrackingMap not found in src/engine/events/');
  return { map, tracking };
}

/**
 * Fields of an event's data: a literal, an interface, an intersection of them (the last of a name
 * winning), or one member of an interface (`Events['name']`).
 */
function fieldsOf(type) {
  if (!type) return [];
  if (type.type === 'intersection') {
    const byName = new Map(type.types.flatMap(fieldsOf).map((f) => [f.name, f]));
    return [...byName.values()];
  }
  if (type.type === 'reflection') return type.declaration.children ?? [];
  if (type.type === 'reference' && type.reflection) return type.reflection.children ?? fieldsOf(type.reflection.type);
  if (type.type === 'indexedAccess') {
    const member = fieldsOf(type.objectType).find((f) => f.name === type.indexType.value);
    return fieldsOf(member?.type);
  }
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

  const withObjects = (first) => {
    const sections = [first];
    for (let i = 0; i < objects.length; i++) {
      const r = objects[i];
      sections.push(`### ${r.name}\n\n${text(r.comment?.summary)}\n\n${table(r.children ?? [])}`);
    }
    return sections.join('\n\n');
  };

  /** The tables of `type`: its fields, or for an array of objects the element's table. */
  return (type) =>
    type?.type === 'array' && objectOf(type.elementType)
      ? withObjects(`${typeMd(type)}, one per package.`)
      : withObjects(table(fieldsOf(type)));
}

function page(event, order, example, version) {
  const data = tables()(event.member.type);
  const envelope = {
    event_id: EVENT_ID,
    event_type: event.name,
    object: event.name.split('.')[0],
    data: example,
    created_at: CREATED_AT,
    session_id: SESSION_ID,
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
  page_title: 'Olympus Earbuds',
  page_referrer: '',
  campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
  session_id: SESSION_ID,
  attribution: { funnel: 'Olympus' },
  browser: { user_agent: 'Mozilla/5.0 …', language: 'en-US', device_type: 'desktop' },
};

/** The `event_id` of a tracking event: the transaction id on a purchase, else the event's own. */
const trackingId = (name, data) => {
  if (name === 'checkout_completed') return String(data.number ?? data.ref_id);
  if (name === 'upsell_completed') return `${data.ref_id}-US${data.upsell.number}`;
  return EVENT_ID;
};

function trackingPage(event, order, example, linkTo, version) {
  const envelope = {
    event_id: trackingId(event.name, example.data),
    event_type: event.name,
    object: OBJECTS[event.name],
    data: example.data,
    created_at: CREATED_AT,
    session_id: SESSION_ID,
    sdk_version: version,
    context: CONTEXT,
  };
  const triggers = example.triggers.map(linkTo).join(', ');
  const data = tables()(event.member.type);
  const meta = META[event.name];
  const push = example.dataLayer;
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

## Data

${data.includes('| Present |') ? `${PRESENT}\n\n` : ''}${data}

## Example

The envelope \`next.analytics.on\` hands out, with \`data\` inside. See
[How analytics works](/analytics-reference/how-it-works) for its fields.

\`\`\`json
${JSON.stringify(envelope, null, 2)}
\`\`\`

## Sent to

| Provider | As |
| --- | --- |
| [GTM](${PROVIDERS}/gtm) | ${push ? `\`${push.event}\` on \`dataLayer\` and \`NextDataLayer\`, below` : 'Not pushed'} |
| [GA4](${PROVIDERS}/ga4), from a listener | \`${GA4[event.name]}\`, ${ga4Kind(event.name)} |
| [Meta pixel](${PROVIDERS}/meta), from a listener | ${meta ? `\`${meta}\`` : 'Not sent'} |
${
  push
    ? `
### dataLayer push

\`\`\`json
${JSON.stringify(push, null, 2)}
\`\`\`
`
    : ''
}`;
}

function trackingOverview(events) {
  return `---
title: 'Tracking events'
group: '${ANALYTICS}'
order: 0
---

# Tracking events

The SDK's own tracking contract: what happened on the page, at the moments that count for
tracking, named in the storefront style (\`product_added_to_cart\`, \`checkout_completed\`). Each
carries the same object the SDK's [events](/events) carry (the Cart, a CartItem, the Checkout, the
Order), in one envelope: \`{ event_id, event_type, object, data, created_at, session_id,
sdk_version, context }\`. Each [provider](${PROVIDERS}/overview) remaps them to its own format.
\`next.analytics.on(name, (event) => …)\` receives one, \`'*'\` every one.
[How analytics works](/analytics-reference/how-it-works) says how each is sent; each event's page has
what triggers it, its \`data\`, and what each provider gets.

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
        row(['Tracking event', '`dataLayer`']),
        row(['---', '---']),
        ...tracked.map((e) =>
          row([link(e), examples[e.name].dataLayer ? `\`${examples[e.name].dataLayer.event}\`` : '—']),
        ),
      ].join('\n'),
    },
    'ga4.md': {
      '<!-- ga4-events -->': [
        row(['Tracking event', 'GA4 event', '']),
        row(['---', '---', '---']),
        ...tracked.map((e) => row([link(e), `\`${GA4[e.name]}\``, ga4Kind(e.name)])),
      ].join('\n'),
    },
    'meta.md': {
      '<!-- meta-events -->': [
        row(['Tracking event', 'Meta event']),
        row(['---', '---']),
        ...mapped.map((e) => row([link(e), `\`${META[e.name]}\``])),
      ].join('\n'),
      '<!-- meta-recipe -->': `\`\`\`js
const META = {
${mapped.map((e) => `  ${e.name}: '${META[e.name]}',`).join('\n')}
};

next.analytics.on('*', ({ event_type, event_id, data }) => {
  const event = META[event_type];
  if (!event) return;
  const lines = Array.isArray(data) ? data : (data.lines ?? data.cart?.lines ?? [data]);
  fbq(
    'track',
    event,
    {
      value: data.total ?? data.cart?.total ?? data.price,
      currency: data.currency ?? data.cart?.currency,
      content_ids: lines.map((line) => line.sku ?? String(line.package_id)),
      contents: lines.map((line) => ({ id: line.sku ?? String(line.package_id), quantity: line.quantity })),
      content_type: 'product',
    },
    { eventID: event_id },
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
  const trackingExamples = JSON.parse(await readFile(join(root, 'docs/analytics-examples.json'), 'utf8'));
  const { map, tracking } = await reference(root);
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
    throw new Error(`docs-events: ${name} triggers a tracking event but has no Event Reference page`);
  };
  const overview = join(out, 'events.md');
  const staged = await readFile(overview, 'utf8');
  if (!staged.includes(MARKER)) throw new Error(`docs-events: ${MARKER} is missing from docs/guides/events.md`);
  await writeFile(overview, staged.replace(MARKER, index(events)));

  const tracked = (tracking.children ?? []).map((member) => ({
    name: member.name,
    group: text(member.comment?.getTag('@group')?.content),
    summary: text(member.comment?.summary),
    member,
  }));
  for (const [i, event] of tracked.entries()) {
    if (!(event.name in trackingExamples))
      throw new Error(`docs-events: no tracking example for ${event.name}; run UPDATE_DOCS=1 npm test`);
    if (!(event.name in OBJECTS) || !(event.name in GA4))
      throw new Error(`docs-events: ${event.name} is missing from OBJECTS or GA4 in scripts/docs-events.mjs`);
    const file = join(out, slugifyPath([ANALYTICS, event.group]), `${event.name}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, trackingPage(event, i + 1, trackingExamples[event.name], linkTo, version));
  }
  await writeFile(join(out, 'analytics.md'), trackingOverview(tracked));
  for (const [page, markers] of Object.entries(providerTables(tracked, trackingExamples))) {
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
