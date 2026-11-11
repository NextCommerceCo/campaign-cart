// @ts-check
/**
 * Writes the Event Reference: one page per public event, from `EventMap` in `src/engine/events/`
 * (its TSDoc and `@group`). The page's Data table lists the event's own fields; every object they
 * carry (`CartItem`, `Order`, …) gets its own table further down the same page, once, from the same
 * types' TSDoc. A field tagged `@priced` or `@campaign`, or optional, says so in the Present column.
 * Examples are the payloads `tests/event-examples.test.ts` recorded in `docs/event-examples.json`.
 * Pages land in `docs/.staged/event-reference/`, and the index replaces `<!-- event-index -->` in the
 * staged `events.md`. A group's hand-written `lifecycle.md` is ordered just before its first event,
 * in both references.
 * The Analytics Reference is the same for `TrackingMap`: a page per tracking event under
 * `docs/.staged/analytics-reference/`, its triggers, its `data` (the same objects, with the same
 * tables) and its `dataLayer` push from `docs/analytics-examples.json`
 * (`tests/analytics-examples.test.ts`), what each destination sends for it from
 * `docs/destination-examples.json` (`tests/destinations/examples.test.ts`), and `analytics.md` listing
 * them. Each destination gets a page under `docs/.staged/analytics-reference/destinations/`: its
 * config, the tracking event → vendor event table from the same examples, and a section per vendor
 * event from `DataLayerEventMap`, `Ga4EventMap` or `MetaEventMap` (TSDoc, `@see`, schema, example).
 * An Attribute Reference page that writes `<!-- fields: Cart -->` gets that object's tables there.
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
  'src/compat/analytics/schema.ts',
  'src/compat/analytics/customer.ts',
  'src/destinations/ga4.ts',
  'src/destinations/meta.ts',
  'src/destinations/rudderstack/types.ts',
];
const MARKER = '<!-- event-index -->';
const DESTINATIONS = '/analytics-reference/destinations';

/** An internal engine event that triggers a tracking event, as the public event it follows. */
const INTERNAL_TRIGGERS = { 'shipping.settled': ['shipping.selected', ', once the cart is priced with it'] };

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
  const vendors = Object.fromEntries(DESTINATION_PAGES.map((d) => [d.key, named(d.map)]));
  const missing = DESTINATION_PAGES.filter((d) => !vendors[d.key]).map((d) => d.map);
  if (missing.length) throw new Error(`docs-events: ${missing.join(', ')} not found`);
  return { map, tracking, vendors, named };
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

  let shown = 0;
  /** A table for each object linked since the last call, and the objects those link. */
  const objectTables = () => {
    const sections = [];
    for (; shown < objects.length; shown++) {
      const r = objects[shown];
      sections.push(`### ${r.name}\n\n${text(r.comment?.summary)}\n\n${table(r.children ?? [])}`);
    }
    return sections;
  };
  const withObjects = (first) => [first, ...objectTables()].join('\n\n');

  /** The tables of `type`: its fields, or for an array of objects the element's table. */
  const render = (type) =>
    type?.type === 'array' && objectOf(type.elementType)
      ? withObjects(`${typeMd(type)}, one per package.`)
      : withObjects(table(fieldsOf(type)));
  /** `type` as a link to each object it is made of and a table of its other fields, objects left for `objects()`. */
  render.schema = (type) => {
    const parts = type?.type === 'intersection' ? type.types : [type];
    const linked = parts.filter(objectOf).map(typeMd);
    const fields = new Map(
      parts
        .filter((t) => !objectOf(t))
        .flatMap(fieldsOf)
        .map((f) => [f.name, f]),
    );
    if (!linked.length) return table([...fields.values()]);
    const of = `The fields of ${linked.join(' and ')}`;
    return fields.size ? `${of}, and:\n\n${table([...fields.values()])}` : `${of}.`;
  };
  render.objects = () => objectTables().join('\n\n');
  return render;
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

function trackingPage(event, order, example, linkTo, version, sentTo) {
  const envelope = {
    event_id: trackingId(event.name, example.data),
    event_type: event.name,
    object: example.object,
    data: example.data,
    created_at: CREATED_AT,
    session_id: SESSION_ID,
    sdk_version: version,
    context: CONTEXT,
  };
  const triggers = example.triggers.map(linkTo).join(', ');
  const data = tables()(event.member.type);
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

| Destination | As |
| --- | --- |
${DESTINATION_PAGES.map((d) => {
  const sent = sentTo(d.key, event.name).map((s) => `[\`${s}\`](${DESTINATIONS}/${d.key}#${slugifyHeading(s)})`);
  return `| [${d.title}](${DESTINATIONS}/${d.key}) | ${sent.join(', ') || 'Not sent'} |`;
}).join('\n')}
`;
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
sdk_version, context }\`. Each [destination](${DESTINATIONS}/overview) remaps them to its own format.
\`next.analytics.on(name, (event) => …)\` receives one, \`'*'\` every one.
[How analytics works](/analytics-reference/how-it-works) says how each is sent; each group starts
with a diagram of when its events are sent; each event's page has what triggers it, its \`data\`, and
what each destination gets.

${index(events, ANALYTICS)}
`;
}

/** `value` as a JS literal: bare keys, single quotes, arrays of scalars on one line. */
const js = (value, indent = '') => {
  if (typeof value === 'string') return `'${value.replace(/'/g, "\\'")}'`;
  if (value === null || typeof value !== 'object') return String(value);
  const inner = `${indent}  `;
  if (Array.isArray(value)) {
    if (!value.length) return '[]';
    if (value.every((v) => v === null || typeof v !== 'object')) return `[${value.map((v) => js(v)).join(', ')}]`;
    return `[\n${value.map((v) => `${inner}${js(v, inner)},`).join('\n')}\n${indent}]`;
  }
  const entries = Object.entries(value);
  if (!entries.length) return '{}';
  const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : `'${k}'`);
  return `{\n${entries.map(([k, v]) => `${inner}${key(k)}: ${js(v, inner)},`).join('\n')}\n${indent}}`;
};

/** The fields every `dl_*` push carries, which the examples after `dl_user_data` leave out but `event` and `event_id`. */
const COMMON = [
  'event_time',
  'user_properties',
  'page_location',
  'page_title',
  'page_referrer',
  'campaign_id',
  'campaign_name',
  'campaign_currency',
  'campaign_language',
  'campaign_api_key',
  'campaign_session_id',
  'attribution',
  '_metadata',
];
const withCustomer = (push) => Object.keys(push.user_properties ?? {}).length > 1;
const ownFields = (push) =>
  Object.fromEntries(
    Object.entries(push).filter(([k]) => !COMMON.includes(k) || (k === 'user_properties' && withCustomer(push))),
  );

const config = (destinations) => `\`\`\`html
<script>
  window.nextConfig = {
    analytics: {
      destinations: ${destinations},
    },
  };
</script>
\`\`\``;

/** One page per built-in destination: its prose, how it is turned on, and how its call is written. */
const DESTINATION_PAGES = [
  {
    key: 'gtm',
    title: 'GTM',
    order: 0.21,
    map: 'DataLayerEventMap',
    vendor: 'Elevar data layer',
    reference: 'Elevar reference',
    as: '`dl_*` push',
    intro: `Pushes each tracking event to \`window.dataLayer\` and \`window.NextDataLayer\` in the 0.4.x
format, for GTM containers and forwarders built on it. The format is **deprecated, and still sent**;
new code listens with \`next.analytics.on\`.`,
    config: `On by default. Off, pushes still reach \`window.NextDataLayer\` but not \`window.dataLayer\`:

${config('{ gtm: { enabled: false } }')}

The 0.4.x \`analytics.providers.gtm.enabled: false\` does the same.`,
    loads: `Nothing of its own: the analytics chunk pushes. The SDK never loads GTM: the container is the
page's own tag.`,
    notes: `\`dl_add_to_cart\` and \`dl_remove_from_cart\` are pushed once per burst of lines, where
\`product_added_to_cart\` comes once per line; \`dl_add_shipping_info\` once per checkout, for the
first of its two tracking events; \`dl_purchase\` once per order, once it is paid.

## Where pushes go

1. \`window.NextDataLayerTransformFn(event)\`, when the page defines it, gets each push first and
   returns the push to send. A falsy return drops it; an error logs and drops it.
2. The push goes to \`window.NextDataLayer\`.
3. Then to \`window.dataLayer\`, after \`{ ecommerce: null }\` so GTM clears the previous ecommerce
   object.

A container built on the tracking names instead pushes them from a listener, with
\`{ ecommerce: null }\` first when it sends an \`ecommerce\` object. Turn the \`dl_*\` pushes off then,
or the container gets each event twice:

\`\`\`js
next.analytics.on('*', ({ event_type, event_id, data }) => {
  window.dataLayer.push({ event: event_type, event_id, ...data });
});
\`\`\`

The exit-intent popup of \`next.exitIntent()\` pushes \`dl_view_promotion\` and \`dl_select_promotion\`
like any promotion, and the five \`dl_exit_intent_*\` pushes below, which have no tracking event. A
close after a click, or the page removing the popup, sends neither \`_dismissed\` nor \`_closed\`.

Every push carries the fields of [\`DataLayerPush\`](#datalayerpush). The examples show them on
\`dl_user_data\`; the others leave them out but \`event\` and \`event_id\`, and \`user_properties\` on
\`dl_purchase\` and \`dl_upsell_purchase\`, which carry the order's customer in it.`,
    call: (name, e) =>
      `\`\`\`json\n${JSON.stringify(name === 'dl_user_data' ? e.push : ownFields(e.push), null, 2)}\n\`\`\``,
  },
  {
    key: 'ga4',
    title: 'GA4',
    order: 0.22,
    map: 'Ga4EventMap',
    vendor: 'GA4 events',
    reference: 'GA4 reference',
    as: 'GA4 event',
    intro: `Sends each tracking event to the page's \`gtag\` as a GA4 event, \`gtag('event', name, params)\`,
with GA4's \`items\` built from the SDK's lines.`,
    config: `Off by default. On:

${config('{ ga4: { enabled: true } }')}`,
    loads: `\`ga4-*.js\` (about 2 KB), only when it is on. The SDK never loads the Google tag: the page has
\`gtag\`. Without it the SDK logs one warning and sends nothing.`,
    notes: `\`page_viewed\` is not sent: \`gtag('config', …)\` sends GA4's own \`page_view\`. \`checkout_completed\`
and each \`upsell_completed\` are a \`purchase\` of their own, with the tracking event's \`event_id\` as
\`transaction_id\`, so GA4 counts each once. A property tagged through GTM uses the
[GTM](${DESTINATIONS}/gtm) pushes instead; with both on, it gets each event twice.`,
    call: (name, e) => `\`\`\`js\ngtag('event', '${name}', ${js(e.params)});\n\`\`\``,
  },
  {
    key: 'meta',
    title: 'Meta pixel',
    order: 0.23,
    map: 'MetaEventMap',
    vendor: 'Meta Pixel standard events',
    reference: 'Meta reference',
    as: 'Meta event',
    intro: `Sends tracking events to the page's \`fbq\` as Meta Pixel standard events,
\`fbq('track', name, params, { eventID })\`. \`PageView\` is one of them, as in 0.4.x: remove
\`fbq('track', 'PageView')\` from the pixel's base code on the page, or Meta gets it twice.`,
    config: `Off by default. On, with the store's name:

${config("{ meta: { enabled: true, storeName: 'shop' } }")}

The 0.4.x \`analytics.providers.facebook.enabled: true\` turns it on too, and \`nextConfig.storeName\`
is read when \`storeName\` is not set.`,
    loads: `\`meta-*.js\` (about 2 KB), only when it is on. The SDK never loads the pixel: the page has its
base code, without its \`fbq('track', 'PageView')\` line. Without \`fbq\` the SDK logs one warning and sends nothing.`,
    notes: `\`AddToCart\` is sent for the first add of the session only, the \`product_added_to_cart\` whose
\`first_in_session\` is \`true\`; later adds and bundle changes are not sent.

\`eventID\` is the tracking event's \`event_id\`, so a
[Conversions API](https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events)
event with the same id is counted once. With \`storeName\`, an order's \`Purchase\` has
\`eventID: '<storeName>-<order number>'\`, the id the store's server-side events use.`,
    call: (name, e) =>
      `\`\`\`js\nfbq('track', '${name}', ${js(e.params)}, { eventID: '${e.event_id}' });\n\`\`\`${
        e.storeName_event_id ? `\n\nWith \`storeName: 'shop'\`: \`{ eventID: '${e.storeName_event_id}' }\`.` : ''
      }`,
  },
  {
    key: 'rudderstack',
    title: 'RudderStack',
    order: 0.24,
    map: 'RudderStackEventMap',
    vendor: 'RudderStack ecommerce spec',
    reference: 'RudderStack reference',
    as: 'RudderStack call',
    intro: `Sends each tracking event to the page's \`rudderanalytics\` as the 0.4.x RudderStack provider did:
the same \`page()\`, \`identify()\` and \`track()\` calls, event names and properties, so RudderStack
destinations and warehouse tables built on 0.4.x keep working.`,
    config: `Off by default. On:

${config('{ rudderstack: { enabled: true } }')}

The 0.4.x \`analytics.providers.rudderstack.enabled: true\` turns it on too.`,
    loads: `\`rudderstack-*.js\` (about 3 KB), only when it is on. The SDK never loads RudderStack: the page has
its JavaScript SDK snippet, whose \`ready()\` the SDK waits for. Without \`rudderanalytics\` the SDK
logs one warning and sends nothing.`,
    notes: `\`page_viewed\` is a \`page()\` and a \`<Page type> Page View\` track: the page type is
\`<meta name="next-page-type">\`, else \`nextConfig.pageType\`, else \`product\`; the page name
\`<meta name="next-page-name">\`, else the page's title. Every track carries \`page_type\`,
\`page_name\` and the \`campaign_*\` fields. \`cart_id\` and \`checkout_id\` are the session id, the
same across the cart, the checkout and the order. \`identify()\` comes when the shopper leaves their
details (with an email) and before each \`Order Completed\`, from the order's billing address.
\`Checkout Step Completed\` is sent once per checkout, for the first of its two tracking events.
\`Order Completed\` prices are before tax, unless the campaign's prices include it, with
\`total = subtotal + tax + shipping\`; each accepted upsell is an \`Order Completed\` of its own.`,
    call: (name, e) => `\`\`\`js\n${e.calls.map(rudderCall).join('\n')}\n\`\`\``,
  },
];

/** One recorded `rudderanalytics` call, as page code would write it. */
const rudderCall = (c) =>
  c.call === 'page'
    ? `rudderanalytics.page(${js(c.category)}, ${js(c.name)}, ${js(c.properties)});`
    : c.call === 'identify'
      ? `rudderanalytics.identify(${js(c.userId)}, ${js(c.traits)});`
      : `rudderanalytics.track(${js(c.name)}, ${js(c.properties)});`;

const seeOf = (r) => text(r?.comment?.getTag('@see')?.content);

/** A destination's page: config, the event table, then a section per vendor event and the objects they carry. */
function destinationPage(d, map, examples = {}, tracked) {
  const link = (name) => {
    const e = tracked.find((t) => t.name === name);
    return e ? `[\`${name}\`](${linkOf(e, ANALYTICS)})` : `\`${name}\``;
  };
  const anchor = (name) => `[\`${name}\`](#${slugifyHeading(name)})`;
  const sentAs = (name) => Object.keys(examples).filter((key) => examples[key].from.includes(name));
  const rows = tracked.map((e) => `| ${link(e.name)} | ${sentAs(e.name).map(anchor).join(', ') || 'Not sent'} |`);
  const render = tables();
  const sections = (map.children ?? []).map((member) => {
    const example = examples[member.name];
    const see = seeOf(member);
    const from = example ? `\n\nFrom ${example.from.map(link).join(', ')}.` : '';
    return `## ${member.name}

${[text(member.comment?.summary), see && `See the [${d.reference}](${see}).`].filter(Boolean).join(' ')}${from}

${render.schema(member.type)}${example ? `\n\n${d.call(member.name, example)}` : ''}`;
  });
  const objects = render.objects();
  return `---
title: '${d.title}'
group: '${ANALYTICS}/Destinations'
order: ${d.order}
---

# ${d.title}

${d.intro} Vendor docs: [${d.vendor}](${seeOf(map)}).

## Config

${d.config}

## What loads

${d.loads}

## Events

| Tracking event | ${d.as} |
| --- | --- |
${rows.join('\n')}

${d.notes}

${sections.join('\n\n')}
${objects ? `\n## Types\n\n${objects}\n` : ''}`;
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

/** Orders each group's hand-written `lifecycle.md` under `root` just before the group's first page. */
async function orderLifecycles(out, root, pages) {
  for (const group of new Set(pages.map((e) => e.group))) {
    const lifecycle = join(out, slugifyPath([root, group]), 'lifecycle.md');
    const text = await readFile(lifecycle, 'utf8').catch(() => undefined);
    const first = pages.findIndex((e) => e.group === group) + 1;
    if (text) await writeFile(lifecycle, text.replace(/^---\n/, `---\norder: ${first - 0.5}\n`));
  }
}

/** @param {string} root  @param {string} out  staged docs root */
export async function stageEventReference(root, out) {
  const version = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
  const examples = JSON.parse(await readFile(join(root, 'docs/event-examples.json'), 'utf8'));
  const trackingExamples = JSON.parse(await readFile(join(root, 'docs/analytics-examples.json'), 'utf8'));
  const sent = JSON.parse(await readFile(join(root, 'docs/destination-examples.json'), 'utf8'));
  const { map, tracking, vendors, named } = await reference(root);
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
  await orderLifecycles(out, GROUP, events);
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

  /** The vendor events `destination` sends for tracking event `name`, from the recorded examples. */
  const sentTo = (destination, name) =>
    Object.entries(sent[destination] ?? {})
      .filter(([, e]) => e.from.includes(name))
      .map(([key]) => key);
  const tracked = (tracking.children ?? []).map((member) => ({
    name: member.name,
    group: text(member.comment?.getTag('@group')?.content),
    summary: text(member.comment?.summary),
    member,
  }));
  for (const [i, event] of tracked.entries()) {
    if (!(event.name in trackingExamples))
      throw new Error(`docs-events: no tracking example for ${event.name}; run UPDATE_DOCS=1 npm test`);
    const file = join(out, slugifyPath([ANALYTICS, event.group]), `${event.name}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, trackingPage(event, i + 1, trackingExamples[event.name], linkTo, version, sentTo));
  }
  await orderLifecycles(out, ANALYTICS, tracked);
  await writeFile(join(out, 'analytics.md'), trackingOverview(tracked));
  for (const d of DESTINATION_PAGES) {
    const file = join(out, slugifyPath([ANALYTICS]), 'destinations', `${d.key}.md`);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, destinationPage(d, vendors[d.key], sent[d.key], tracked));
  }
  await stageFieldTables(join(out, 'attribute-reference'), named);
  return { events: events.length, analytics: tracked.length };
}

const FIELDS = /<!-- fields: (\w+) -->/g;

/** Replaces `<!-- fields: Cart -->` in an Attribute Reference page with that object's tables, from the same TSDoc as the Event Reference. */
async function stageFieldTables(dir, named) {
  const files = readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.md'))
    .map((d) => join(d.parentPath, d.name));
  for (const file of files) {
    const page = await readFile(file, 'utf8');
    if (!FIELDS.test(page)) continue;
    const staged = page.replace(FIELDS, (_, name) => {
      const reflection = named(name);
      if (!reflection) throw new Error(`docs-events: <!-- fields: ${name} --> names no interface`);
      return tables()({ type: 'reference', reflection });
    });
    await writeFile(file, staged);
  }
}
