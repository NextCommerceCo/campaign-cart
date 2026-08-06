/**
 * What each analytics event *means* — the half of the reference a scanner cannot
 * derive.
 *
 * The event list, the field names and types, the emit sites, the provider
 * registry and every adapter's mapping table are all literals in the source, so
 * they are read straight out of it by
 * `src/docs/extract/extract-analytics-events.ts`. What is left over is judgement:
 * when an event fires in product terms, what a field means to the business rather
 * than to the compiler, which provider quietly reshapes or drops it, and what to
 * do when a configured provider receives nothing. That is what lives here.
 *
 * `src/tests/docs/analyticsReference.test.ts` checks this file against the
 * extractor in both directions, so a new event cannot stay undocumented and a
 * removed one cannot keep its row.
 *
 * Build-time only, like the other manifests in this folder: nothing under `src/`
 * outside `src/docs/` may import it.
 */

/** The field tables reused verbatim by many events, documented once. */
export type SharedShapeName = 'UserProperties' | 'Product';

/** Prose for one canonical `dl_*` event. */
export interface AnalyticsEventDoc {
  /** Canonical name, exactly as it appears in `DL_EVENTS`. */
  name: string;
  /** When it fires, in product terms — the shopper action, not the code path. */
  firesWhen: string;
  /**
   * Field meanings that belong to this event alone, or that override the shared
   * description for a path. Keyed by the dotted field path.
   */
  fields?: Record<string, string>;
  /** What the providers do with it beyond the generated mapping table. */
  providerNotes?: string;
  /**
   * Required when nothing in the SDK builds this event: why it is still in the
   * vocabulary. The drift test enforces the correspondence in both directions.
   */
  neverFired?: string;
  /** Traps specific to this event. Each names the symptom and the fix. */
  cautions?: string[];
}

/** Prose for one provider in the registry. */
export interface AnalyticsProviderDoc {
  /** The `analytics.providers.<key>` config key. */
  key: string;
  /** The adapter's own name, as it appears in the debug overlay and logs. */
  adapter: string;
  /** One sentence: where the events end up. */
  summary: string;
  /** What it does to a `dl_*` event before dispatching it. */
  reshaping: string;
  /** Which events it drops, and why that is by design. */
  drops: string;
  /** Traps, each with the symptom and the fix. */
  cautions?: string[];
}

/** One rung of the "nothing arrives" ladder, in the order events pass through. */
export interface AnalyticsFailureStep {
  /** Short label for the check. */
  stage: string;
  /** The condition that stops the event here. */
  condition: string;
  /** What a developer sees (or does not see) when this is the cause. */
  symptom: string;
  /** Where in the source the drop happens, as `path:line`. */
  source: string;
  /** The concrete fix. */
  fix: string;
}

// ── Page-level prose ────────────────────────────────────────────────────────

export const ANALYTICS_EVENTS_INTRO =
  'Every analytics event the SDK can fire, what triggers it, what it carries, ' +
  'and which of your tags will see it. Event names are the canonical `dl_*` ' +
  'names — the same strings you put in `blockedEvents` and the same strings ' +
  'that land in `window.NextDataLayer`.';

/**
 * The finding that surprises everyone: the SDK ships with analytics *off*, and
 * turning it on needs no provider at all.
 */
export const ANALYTICS_ENABLE_NOTE = [
  '## Nothing fires until you turn it on',
  'The config store has no `analytics` block by default and **no meta tag ' +
    'creates one** — only `window.nextConfig.analytics` does. Until it exists, ' +
    '`config.analytics?.enabled` is `undefined`, the analytics boot returns at ' +
    'its first check, and the page fires **zero** events. A page with a GTM ' +
    'container on it and no `analytics` block sends nothing, and the only trace ' +
    'is one info log: `Analytics disabled in configuration`.',
  'The second half is equally counter-intuitive: **providers are optional.** With ' +
    '`enabled: true` and no provider configured, every event is still built, ' +
    'validated, enriched and pushed to `window.NextDataLayer`. Providers are ' +
    'forwarders on top of that array, not the thing that produces it — so your ' +
    'own script can read the array and be the only consumer.',
  '```html\n' +
    '<script>\n' +
    '  window.nextConfig = {\n' +
    '    apiKey: "{YOUR_CAMPAIGN_API_KEY}",\n' +
    '    analytics: {\n' +
    '      enabled: true,   // without this, nothing below runs\n' +
    '      mode: "auto",    // "manual" stops the automatic view/cart events\n' +
    '      debug: false,\n' +
    '      providers: {}    // valid: events still reach window.NextDataLayer\n' +
    '    }\n' +
    '  };\n' +
    '</script>\n' +
    '```',
  'Verify it in the console — `window.NextDataLayer` grows as you interact, and ' +
    '`window.NextAnalytics.getStatus()` reports `initialized: true` with the ' +
    'provider list:',
  '```js\n' +
    'window.NextAnalytics.getStatus();\n' +
    '// { initialized: true, debugMode: false, providers: ["gtm"],\n' +
    '//   eventsTracked: 4, ignored: false }\n' +
    '```',
  '`mode: "auto"` is what fires view, cart and checkout events from page ' +
    'activity. In `"manual"` mode the meta-tag controls and your own ' +
    '`next.trackCustomEvent()` calls are the only sources — the vocabulary is ' +
    'identical either way.',
].join('\n\n');

export const ANALYTICS_PROVIDERS_INTRO =
  'Which destinations the SDK can forward events to, what each one does to an ' +
  'event on the way out, and how to find out where an event went. Five ' +
  'providers can be configured; a sixth file, `ProviderAdapter`, is the shared ' +
  'base class they all extend rather than a destination you can enable.';

/**
 * `blockedEvents` reaches only the two adapters whose factories forward the
 * provider config. Worth its own note because the setting looks universal.
 */
export const ANALYTICS_BLOCKED_EVENTS_NOTE = [
  '## `blockedEvents` reaches every provider',
  'All five adapters — GTM, Meta, RudderStack, NextCampaign and Custom — are ' +
    'constructed with their provider config, so a `blockedEvents` list applies ' +
    'to all of them. Until 2026-07-31 only GTM and Meta received it and the ' +
    'other three ignored it silently, so if you worked around that by blocking ' +
    'at the destination (a RudderStack transformation, a filter at your ' +
    'endpoint), that filter is now doing the same job twice — harmless, but you ' +
    'can drop it.',
  'Names are matched **verbatim** against the canonical event name, so ' +
    '`blockedEvents: ["purchase"]` blocks nothing — the event is `dl_purchase`.',
  'This is a per-provider list set when the SDK boots. The ' +
    '`next-analytics-disable` and `next-analytics-enable-only` meta tags are a ' +
    'separate, page-level mechanism and are **still parsed and never enforced** ' +
    '— do not reach for them expecting this behaviour.',
];

/** Verified behaviour of the `dl_` prefix, per channel. */
export const DL_PREFIX_NOTES = [
  '## The `dl_` prefix: who sees it',
  'One name, four different things done with it. The canonical name is `dl_*` ' +
    'everywhere inside the SDK — in `window.NextDataLayer`, in `blockedEvents`, ' +
    'in the debug overlay — and each provider decides what its own destination ' +
    'gets:',
  [
    '| Channel | What it receives | Why |',
    '|---|---|---|',
    "| `window.NextDataLayer` | `dl_purchase` | The SDK's own array. Always the canonical name. |",
    "| GTM: `window.dataLayer` and `window.ElevarDataLayer` | `dl_purchase`, the whole event object unchanged | Elevar-compatible tags match on `dl_*`. GTM pushes the event verbatim to **both** arrays, preceded by an `{ ecommerce: null }` push to `window.dataLayer` so the previous event's ecommerce block cannot leak into this one. |",
    '| Meta Pixel | `Purchase` | Renamed through a fixed table, not by trimming the prefix — nine of the mapped names are Meta *custom* events sent with `trackCustom`. |',
    '| RudderStack | `Order Completed` | Renamed to the RudderStack ecommerce spec, again by table. |',
    '| NextCampaign | `page_view` | The one name it maps. |',
  ].join('\n'),
  '**GA4 field rules are picked by the stripped name, and only off the ' +
    'non-`dl_` path.** `GTMAdapter` returns as soon as it sees a `dl_` prefix, ' +
    'so its GA4 shaping (`value` only on value-bearing events, `item_list_*` on ' +
    'list events, promotion fields, `transaction_id`/`tax`/`shipping` on ' +
    'purchase and refund) applies to events pushed **without** the prefix — a ' +
    'plain `purchase` sent through `next.trackCustomEvent()`. Canonical `dl_*` ' +
    'events reach `window.dataLayer` in whatever shape the SDK built them, so ' +
    "the GA4 mapping is your GTM container's job, not the adapter's.",
];

/**
 * The three silent drop points the brief calls out, plus the config gates around
 * them, in the order an event meets them.
 */
export const ANALYTICS_FAILURE_STEPS: AnalyticsFailureStep[] = [
  {
    stage: 'Analytics never started',
    condition: '`config.analytics.enabled` is not `true`.',
    symptom:
      'One info log, `Analytics disabled in configuration`, and an empty or ' +
      'absent `window.NextDataLayer`. No provider is constructed, so the ' +
      'overlay shows *No analytics providers registered*.',
    source: 'core/analytics/index.ts › NextAnalytics.initialize',
    fix: 'Set `window.nextConfig.analytics.enabled = true` before the SDK loads. There is no meta tag for this.',
  },
  {
    stage: 'Visit is being ignored',
    condition:
      '`?ignore=true` was on the URL at any point this session — the flag is ' +
      'stored in sessionStorage under `analytics_ignore` and outlives the ' +
      'parameter.',
    symptom:
      'Log `Analytics ignored due to ignore parameter`, then `Event tracking ' +
      'skipped due to ignore flag` for each attempt. Nothing reaches the array.',
    source: 'core/analytics/index.ts › NextAnalytics.shouldIgnoreAnalytics',
    fix: 'Run `window.NextAnalyticsClearIgnore()` in the console, or open the page in a fresh session.',
  },
  {
    stage: 'Validation dropped it',
    condition:
      'A field listed in `EVENT_VALIDATION_RULES` for that event is missing or ' +
      'falsy — for example `dl_add_to_cart` without `ecommerce.currency`, or ' +
      '`dl_purchase` without `ecommerce.value`.',
    symptom:
      'An error log naming the field (`Missing required field for ' +
      'dl_add_to_cart: ecommerce.currency`) and **nothing in ' +
      '`window.NextDataLayer`** — the event is dropped before the push, so no ' +
      'provider is ever asked and the overlay has no row for it at all.',
    source: 'core/analytics/data-layer-manager.ts › DataLayerManager.push',
    fix: 'Fix the payload at the source, not the provider. An event missing here never existed as far as every downstream tag is concerned.',
  },
  {
    stage: 'A transform returned null',
    condition:
      '`window.NextDataLayerTransformFn` is set and returned `null` for this ' +
      'event.',
    symptom:
      'Debug log `Event filtered out by transform function`, no array entry, no ' +
      'provider call.',
    source: 'core/analytics/data-layer-manager.ts › DataLayerManager.push',
    fix: 'Return the event (or a modified copy) from your transform. Returning nothing filters it out.',
  },
  {
    stage: 'Held for the next page',
    condition:
      'The event carries the internal `_willRedirect` flag — accepted upsell ' +
      'purchases do, because the page navigates immediately after.',
    symptom:
      'Nothing on this page; the event appears on the *next* page once the ' +
      'pending-events handler replays it, about 200 ms after that page boots.',
    source: 'core/analytics/data-layer-manager.ts › DataLayerManager.push',
    fix: 'Look for it after the redirect. This is intended behaviour, not a loss — it prevents the duplicate that firing on both pages would create.',
  },
  {
    stage: 'Provider never constructed',
    condition:
      'The provider is `enabled` but its required setting is missing (Meta ' +
      'Pixel without `pixelId`, custom endpoint without `endpoint`).',
    symptom:
      'One warning naming the exact config path — `Provider "facebook" is ' +
      'enabled but analytics.providers.facebook.settings.pixelId is missing — ' +
      'set it to enable facebook; skipping.` The provider is absent from ' +
      '`getStatus().providers` and from the overlay strip.',
    source: 'core/analytics/index.ts › NextAnalytics.initializeProviders',
    fix: 'Supply the setting named in the warning. Until then the events flow to the data layer and to every other provider.',
  },
  {
    stage: 'Blocked for this provider',
    condition:
      "The event name is in that provider's `blockedEvents`, or the adapter " +
      'was disabled at runtime with `setEnabled(false)`.',
    symptom:
      'Overlay status **blocked**, with detail `blockedEvents` or `provider ' +
      'disabled`. Other providers still receive it.',
    source: 'core/analytics/providers/provider-adapter.ts › ProviderAdapter.trackEvent',
    fix: 'Remove the name from `blockedEvents`. Match the canonical name exactly — `purchase` blocks nothing, `dl_purchase` does.',
  },
  {
    stage: 'Provider has no mapping',
    condition:
      'The adapter answers `notSupported` — NextCampaign for anything but a ' +
      'page view, RudderStack for a `dl_user_data` with no email or user id, ' +
      'Meta for an event outside its table.',
    symptom:
      'Overlay status **skipped** with the reason spelled out (`NextCampaign ' +
      'only tracks page_view`, `no identifiable user (guest)`, `no Facebook ' +
      'mapping for this event`). No error, no log at warn level.',
    source: 'core/analytics/providers/provider-adapter.ts › ProviderAdapter.trackEvent',
    fix: "Nothing to fix if the reason is by design. If you need the event at that destination, add it to that adapter's mapping table.",
  },
  {
    stage: 'Vendor script never loaded',
    condition:
      "The destination's own snippet is missing, so `fbq` / " +
      '`rudderanalytics` / the NextCampaign SDK never appears. Each adapter ' +
      'waits 5 seconds before giving up.',
    symptom:
      'Overlay status **failed** after roughly 5 s, with the prepared payload ' +
      'still visible so you can check the mapping, plus a one-time warning ' +
      'carrying the fix (`Meta Pixel (fbq) not found — add the Meta Pixel base ' +
      'code to the page`).',
    source: 'core/analytics/providers/provider-adapter.ts › ProviderAdapter.trackEvent',
    fix: 'Add the vendor snippet to the page. The SDK maps and reports the event but never loads the Meta or RudderStack script for you.',
  },
  {
    stage: 'Dispatch threw',
    condition: 'The vendor call itself raised, or returned a rejected promise.',
    symptom:
      'Overlay status **failed** with the error message. Every other provider ' +
      'still receives the event — the base class catches both throws and ' +
      'rejections so one broken destination cannot stop the loop.',
    source: 'core/analytics/providers/provider-adapter.ts › ProviderAdapter.trackEvent',
    fix: 'Read the recorded error. A swallowed failure is invisible in the console at error level only for expected delivery problems, which are logged as warnings instead.',
  },
];

/** How to read the delivery telemetry that every build records. */
export const ANALYTICS_DEBUG_NOTES = [
  '## Finding out where an event went',
  'The SDK records what every provider did with every event — in **all** ' +
    'builds, not only debug ones. `AnalyticsDebugTracker` keeps the last 250 ' +
    'deliveries as a ring buffer: provider, event name, status, the payload it ' +
    'was handed, the payload it actually dispatched, the error if it failed, and ' +
    'how long it took.',
  [
    '| Status | Meaning | What to do |',
    '|---|---|---|',
    '| `pending` | Dispatched, waiting on the vendor script or an async call. | Nothing yet. A row stuck here means the vendor never resolved. |',
    '| `sent` | Handed to the destination. | Confirm the shape in `sentPayload` — this is the exact object the vendor received. |',
    '| `blocked` | Suppressed by config: `blockedEvents`, or a disabled adapter. | Expected if you configured it; otherwise check the spelling of the blocked name. |',
    '| `skipped` | The provider does not handle this event at all. | Read the reason. Usually by design. |',
    '| `failed` | Dispatch was attempted and errored. | Read `error`; the attempted payload is kept so you can still verify the mapping. |',
  ].join('\n'),
  'Read it from the debug overlay — **Analytics & Events** panel. The strip ' +
    'along the top lists every registered provider with a ready/waiting/paused ' +
    'icon; each event row carries one chip per provider tinted by its status, ' +
    "and the row's **Flow** tab shows the per-provider payloads side by side. " +
    'Deliveries are matched to their event by `event_id`.',
  '> ⚠️ There is no console API for this data. `analyticsDebug` is not exposed ' +
    'on `window`, so the overlay is the only reader — a page that cannot open ' +
    'the overlay cannot see delivery status, however faithfully it was ' +
    'recorded. Turn the overlay on with `?debugger=true` on the URL **before** ' +
    'reproducing the problem; the buffer only holds the last 250 deliveries.',
  '> ⚠️ An event dropped by validation or by a transform never becomes a ' +
    'delivery record, because those happen **before** any provider is asked. An ' +
    'event that is missing from the overlay entirely is a data-layer problem, ' +
    'not a provider problem — walk the ladder above from the top.',
];

// ── Shared field tables ────────────────────────────────────────────────────

/**
 * The two field tables most events reuse verbatim. Documented once here, linked
 * from every event that carries them.
 */
export const ANALYTICS_SHARED_SHAPES: Record<
  SharedShapeName,
  { summary: string; fields: Record<string, string> }
> = {
  UserProperties: {
    summary:
      'Who the shopper is, as far as this page knows. Almost everything here ' +
      'is empty until the checkout form has been filled in, so an event fired ' +
      'on a landing page carries little more than `visitor_type`.',
    fields: {
      visitor_type:
        'Whether the shopper is signed in. `guest` on every campaign page — the SDK has no account concept, so this is effectively a constant.',
      customer_id:
        "The store's identifier for a known customer. Present only after an order exists.",
      customer_email:
        'Email the shopper typed into checkout. The value ad platforms match on, so its absence is why a conversion may go unattributed.',
      customer_phone: 'Phone number from checkout, unformatted as entered.',
      customer_first_name: 'Given name from the billing details.',
      customer_last_name: 'Family name from the billing details.',
      customer_address_city: 'City from the billing address.',
      customer_address_province:
        'State or province name from the billing address.',
      customer_address_province_code:
        'Short state/province code, for platforms that require the abbreviation rather than the full name.',
      customer_address_country: 'Country name from the billing address.',
      customer_address_country_code:
        'Two-letter country code — the form most ad platforms expect.',
      customer_address_zip: 'Postal code from the billing address.',
      customer_order_count:
        'How many orders this shopper has placed before, for separating new customers from repeat ones.',
      customer_total_spent:
        'Lifetime spend to date, in the campaign currency. Absent for a first-time shopper.',
      customer_tags:
        'Free-form labels the store has attached to the customer, comma-separated.',
    },
  },
  Product: {
    summary:
      'One line of the offer, in GA4 item shape. The SDK builds these from the ' +
      "campaign's packages, so `item_id` is the package reference rather than " +
      'a bare product id.',
    fields: {
      item_id:
        'The package identifier the shopper acted on — what ties an event back to the campaign offer.',
      item_name: 'Display name of the package, as shown on the page.',
      affiliation: 'Which storefront the line is credited to.',
      coupon: 'Discount code applied to this line specifically.',
      currency: "Currency this line's price is stated in.",
      discount:
        'Amount taken off this line per unit — the difference between the compare-at price and what is being charged.',
      index:
        'Where the line sat in the list the shopper was looking at, counted from 0. Lets you tell a first-position click from a fifth.',
      item_brand: 'Brand or product name behind the package.',
      item_category:
        'Top-level grouping, set to the campaign name so events can be split per funnel.',
      item_category2: 'Second grouping level, when the catalog uses one.',
      item_category3: 'Third grouping level, when the catalog uses one.',
      item_category4: 'Fourth grouping level, when the catalog uses one.',
      item_category5: 'Fifth grouping level, when the catalog uses one.',
      item_list_id: 'Identifier of the list this line was shown in.',
      item_list_name: 'Human-readable name of that list.',
      item_variant:
        'Which variant was chosen — size, colour, flavour. Empty when the package has no variants.',
      item_image:
        'Image URL for the line, for platforms that show a thumbnail.',
      location_id: 'Physical or logical location the sale is attributed to.',
      price:
        'Per-unit price actually being charged, after any offer discount — not the compare-at price.',
      quantity: 'How many units of the package this line covers.',
    },
  },
};

/**
 * Field meanings shared across events, keyed by dotted path. An event's own
 * `fields` entry overrides the description here.
 */
export const ANALYTICS_FIELD_DOCS: Record<string, string> = {
  event:
    'The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it.',
  user_properties:
    'Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout.',
  method:
    'How the shopper identified themselves, e.g. `email`. Always `email` today, since that is the only route the SDK offers.',
  order_id:
    'The order the offer belongs to — the original purchase, not the upsell being viewed.',
  search_term: 'Exactly what the shopper typed into the search box.',
  shipping_tier:
    'Name of the shipping method the shopper chose, duplicated at the top level for tags that read it there.',
  payment_type:
    'Payment method the shopper chose (card, PayPal, …), duplicated at the top level for tags that read it there.',

  ecommerce:
    'The GA4 commerce block: which lines this event is about and what they are worth.',
  'ecommerce.currency':
    'Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded.',
  'ecommerce.value':
    'Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel.',
  'ecommerce.coupon':
    'Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code.',
  'ecommerce.items':
    'The lines this event is about. See [Product lines](#product-lines).',
  'ecommerce.impressions':
    'Deprecated copy of `items`, kept so Elevar-era tags keep working. Read `items` in new tags; this field will not gain new data.',
  'ecommerce.cart_contents':
    'Deprecated copy of the cart lines, kept for Elevar-era tags. Read `items` instead.',
  'ecommerce.item_list_id':
    'Identifier of the on-page list the shopper was looking at, so a click can be attributed to the list that produced it.',
  'ecommerce.item_list_name':
    'Human-readable name of that list — what appears in reports.',
  'ecommerce.checkout_id':
    'Identifier grouping the steps of one checkout attempt, so start → shipping → payment can be joined.',
  'ecommerce.checkout_step':
    'Which step of checkout this is, counting from 1. Lets you measure drop-off between steps.',
  'ecommerce.shipping_tier':
    'Name of the shipping method chosen, as the shopper saw it.',
  'ecommerce.payment_type': 'Payment method chosen, as the shopper saw it.',
  'ecommerce.transaction_id':
    'The order reference. This is the key ad platforms and the store both deduplicate on, so it must be the same string everywhere for one order.',
  'ecommerce.affiliation':
    'Which storefront the sale is credited to. Main orders carry the store name; post-purchase upsells carry `Upsell`, which is how you separate the two revenue streams.',
  'ecommerce.tax': 'Tax charged on the order, reported apart from `value`.',
  'ecommerce.shipping':
    'Shipping charged on the order, reported apart from `value`.',
  'ecommerce.discount':
    'Total taken off the order across all lines, as a positive amount.',
  'ecommerce.subscription_id':
    'Identifier of the subscription created, for joining the sign-up to later renewals.',
  'ecommerce.subscription_status':
    'Where the new subscription stands — active, trialling, pending.',

  upsell:
    'The post-purchase offer this event is about. Present only on the offer events, which do not use the `ecommerce` block.',
  'upsell.package_id': 'Package being offered after the order.',
  'upsell.package_name': 'Display name of that offer, as shown to the shopper.',
  'upsell.price': 'Price shown on the offer, per unit.',
  'upsell.quantity': 'How many units the shopper accepted.',
  'upsell.value':
    'Revenue actually added by accepting the offer, across all units — the figure to sum for incremental upsell revenue.',
  'upsell.currency': 'Currency the offer price is stated in.',

  upsell_metadata:
    'Which offer in the sequence produced this second purchase, so post-purchase revenue can be traced back to the original order.',
  'upsell_metadata.original_order_id':
    'The first order — the one the shopper had already paid for when the offer appeared.',
  'upsell_metadata.upsell_number':
    'Position of this offer in the post-purchase flow, counting from 1. Tells you whether shoppers accept the second offer as readily as the first.',
  'upsell_metadata.package_id': 'Package that was accepted.',
  'upsell_metadata.package_name': 'Display name of the accepted package.',
};

// ── Per-event prose ────────────────────────────────────────────────────────

export const ANALYTICS_EVENT_DOCS: AnalyticsEventDoc[] = [
  {
    name: 'dl_view_item_list',
    firesWhen:
      'A group of offers becomes visible — a package selector or product grid ' +
      'scrolls into view, or a `next-analytics-view-item-list` meta tag names ' +
      'the packages to report on page load.',
    providerNotes:
      'RudderStack sends the whole list as a `products[]` array. Meta has no ' +
      'name for a list impression, so it skips this event.',
    cautions: [
      'It fires once per list per page. Re-rendering the list does not fire it again, so a list rebuilt by your own code will be missing from reports — fire it yourself with `next.trackViewItemList()` if you rebuild lists dynamically.',
    ],
  },
  {
    name: 'dl_view_item',
    firesWhen:
      'A single offer is presented as the focus of the page, or a ' +
      '`next-analytics-view-item` meta tag names the package.',
  },
  {
    name: 'dl_select_item',
    firesWhen: 'The shopper picks one offer out of a list.',
    providerNotes:
      'Meta has no name for a list click, so it skips this event. The list the ' +
      'offer was chosen from travels with it.',
  },
  {
    name: 'dl_view_search_results',
    firesWhen: 'A page of search results is shown to the shopper.',
    providerNotes:
      "Meta's search event is `dl_search`, which the SDK never fires — so " +
      'search results reach your GTM container and nowhere else.',
  },
  {
    name: 'dl_search',
    firesWhen:
      'a shopper searched, and the results view should be reported to Meta as ' +
      '`Search`.',
    neverFired:
      "Declared for Meta's Search event and for `blockedEvents` completeness; no SDK feature builds it.",
    providerNotes:
      'Mapped by Meta to `Search`. GTM forwards it if you push it.',
  },
  {
    name: 'dl_add_to_cart',
    firesWhen:
      'A package is added to the cart — an add-to-cart button, a selector in ' +
      'swap mode, or a quantity increase.',
    providerNotes:
      'Becomes Meta `AddToCart` and RudderStack `Product Added`. RudderStack ' +
      'reports only the **first** line of `items`, per its spec, so a ' +
      'multi-line add is under-reported there while GTM sees every line.',
    cautions: [
      'Pairing a swap-mode package selector with a separate add-to-cart action writes the cart twice and fires this event twice. Use one or the other on a given selector.',
    ],
  },
  {
    name: 'dl_remove_from_cart',
    firesWhen:
      'A line leaves the cart — a remove control, or a quantity decrease that ' +
      'reaches zero.',
    providerNotes:
      '`RemoveFromCart` is a Meta *custom* event rather than a standard one, so ' +
      "it will not appear in Meta's standard-event reporting until you define " +
      'it there.',
  },
  {
    name: 'dl_add_to_wishlist',
    firesWhen:
      'a shopper saved an offer for later, on a page that implements its own ' +
      'wishlist.',
    neverFired:
      'No wishlist feature exists in the SDK; the name is reserved so GTM and Meta mappings are ready if a page pushes it.',
    providerNotes:
      'Mapped by Meta to `AddToWishlist`, and treated as GA4 ecommerce by GTM.',
  },
  {
    name: 'dl_view_cart',
    firesWhen:
      'The cart contents are shown — a cart page loads, or a cart panel opens.',
    providerNotes:
      '`ViewCart` is a Meta custom event. RudderStack correlates cart and ' +
      'checkout events by the analytics session id, which it sends as `cart_id`.',
  },
  {
    name: 'dl_begin_checkout',
    firesWhen:
      'The shopper reaches checkout with a non-empty cart, or submits the ' +
      'first checkout step.',
  },
  {
    name: 'dl_add_shipping_info',
    firesWhen: 'A shipping method is chosen or confirmed during checkout.',
    providerNotes:
      'RudderStack reports it as checkout `step: 2` — its spec has no shipping ' +
      'event, so shipping is modelled as a numbered step. `AddShippingInfo` is ' +
      'a Meta custom event.',
  },
  {
    name: 'dl_add_payment_info',
    firesWhen:
      'Payment details are accepted by the form — after validation, before the ' +
      'order is created.',
    providerNotes: 'RudderStack reports it as checkout `step: 3`.',
  },
  {
    name: 'dl_purchase',
    firesWhen:
      'A page opened with `?ref_id=` has fetched a **paid** order — the main ' +
      'conversion, and the one event the SDK raises from `order:loaded` alone. ' +
      'Every payment method reports from the page the shopper lands on after ' +
      'checkout, never from the checkout page itself. Once per order.',
    providerNotes:
      'Becomes Meta `Purchase` and RudderStack `Order Completed`. Meta gets an ' +
      '`eventID` of `{storeName}-{orderNumber}` when a store name is ' +
      'configured, which is what lets Meta deduplicate this browser event ' +
      'against a server-side copy of the same order. RudderStack recomputes ' +
      '`total` as value + tax + shipping and also calls `identify()` from the ' +
      "event's user properties.",
    cautions: [
      'An order created but not yet paid does **not** produce this event. Express checkout (PayPal, Apple Pay, Google Pay) and a card payment needing 3-D Secure both create the order before the money moves; the SDK reports them only when the shopper returns to the success page. Until 2026-08-05 the event fired at creation time and was then replayed on the next page in the session, so pressing back from PayPal — or landing on `payment_failed_url` — reported a purchase for an order that never existed, with a fabricated `order_<timestamp>` transaction id ([issue #71](https://github.com/NextCommerceCo/campaign-cart/issues/71)). A conversion count from before that date over-reports express checkout.',
      '**Your success page must load the SDK, and must keep the `?ref_id=` on its URL.** That is now the only thing that reports a purchase — the checkout page no longer raises one for any payment method. The SDK appends `ref_id` to the success URL itself, so this holds unless the page strips it or the redirect goes somewhere the SDK is not installed (the platform’s own `order_status_url`, for instance). Confirm `dl_purchase` fires there once, with the real order number, before trusting the numbers.',
      'The event is emitted at most once per `transaction_id`, remembered in `localStorage` (`nextDataLayer_reportedPurchases`). A payload with no order number and no `ref_id` is dropped with an error rather than sent under a made-up id — there is no `order_<timestamp>` fallback any more.',
      'A redirect payment returns on one of **two** legs, `success_url` or `payment_failed_url`, and both come back with `?ref_id=` — so the order loads on the failure page too. Nothing is reported there: the checkout page records both paths (`nextDataLayer_checkoutReturnPaths`) so the landing page can tell them apart, and `?payment_failed=true` — the SDK’s default failure URL — is treated as a failure on its own. If your failure page needs to report anything of its own, hang it on `order:loaded` and check the URL yourself.',
      'A zero-value order — a 100% discount, a free trial — now reports normally, carrying `value: 0` with its real `transaction_id`, currency and items. Until 2026-07-31 validation required `ecommerce.value` to be *truthy*, so those orders were dropped before reaching the data layer and no provider ever saw them; a conversion count from before that date under-reports free orders.',
      "Reporting `value` as item revenue means it excludes tax and shipping by design. A GA4 revenue figure that looks low against the store's own total is usually this, not a lost event.",
    ],
  },
  {
    name: 'dl_refund',
    firesWhen:
      'an order was refunded. Refunds happen in the back office, so this is a ' +
      'server-side or tag-side push rather than a page event.',
    neverFired:
      'Reserved so a page or a server-side tag can push a refund under the canonical name; GTM already shapes it as GA4 ecommerce.',
    providerNotes:
      'GTM treats it as ecommerce and adds `transaction_id`, `tax` and ' +
      '`shipping`. No other provider maps it.',
  },
  {
    name: 'dl_view_promotion',
    firesWhen: 'a banner or promotional offer was shown to the shopper.',
    neverFired:
      'Reserved for pages that report their own banner or offer impressions; GTM has the GA4 promotion field mapping ready.',
    providerNotes:
      'GTM shapes `creative_name`, `creative_slot`, `promotion_id` and ' +
      '`promotion_name` for it — but only on the non-`dl_` path.',
  },
  {
    name: 'dl_select_promotion',
    firesWhen: 'the shopper clicked a banner or promotional offer.',
    neverFired: 'Reserved for pages that report their own promotion clicks.',
    providerNotes: 'Same GA4 promotion shaping as `dl_view_promotion` in GTM.',
  },
  {
    name: 'dl_user_data',
    firesWhen:
      'First, before any other event, at the start of every page in auto mode ' +
      '— and again on every client-side route change. It establishes who the ' +
      'shopper is and what is in the cart so later events can be attributed.',
    fields: {
      'ecommerce.value':
        'Item revenue of the current cart: price × quantity summed, excluding tax and shipping. `0` on an empty cart.',
      'ecommerce.items':
        'A snapshot of the whole cart at this moment — not the line the shopper acted on. See [Product lines](#product-lines).',
    },
    providerNotes:
      'Meta treats it as `PageView`. RudderStack turns it into an `identify()` ' +
      'call — and **skips it entirely for a guest**, because there is no email ' +
      'or user id to identify. GTM receives it like any other event.',
    cautions: [
      'The boot sequence waits 100 ms after firing this before starting the other trackers, so it is always first in the array. Code that pushes its own events during boot can land ahead of it and lose that ordering guarantee.',
    ],
  },
  {
    name: 'dl_sign_up',
    firesWhen:
      'An account is created. On a campaign page this is driven by your own ' +
      'code calling `next.trackSignUp(email)` — no feature fires it.',
  },
  {
    name: 'dl_login',
    firesWhen:
      'A shopper signs in, via `next.trackLogin(email)`. Campaign ' +
      'pages have no login form of their own.',
    providerNotes: '`Login` is a Meta custom event, not a standard one.',
  },
  {
    name: 'dl_subscribe',
    firesWhen:
      'A subscription is created — a recurring package is purchased or a ' +
      'trial converts.',
    providerNotes:
      '`Subscribe` is a Meta custom event. RudderStack has no mapping for it, ' +
      'so subscriptions never reach that destination.',
    cautions: [
      'Validation requires a top-level `lead_type` on this event, which is not part of its field schema. An event built only from the schema is dropped before the push — supply `lead_type` when you build one by hand.',
    ],
  },
  {
    name: 'dl_start_trial',
    firesWhen:
      "a shopper started a trial — Meta's StartTrial, for pages that sell " +
      'trials.',
    neverFired:
      'No trial feature exists in the SDK; the Meta mapping is ready for a page that pushes the name.',
    providerNotes: 'Mapped by Meta to `StartTrial`, a custom event.',
  },
  {
    name: 'dl_viewed_upsell',
    firesWhen:
      'A post-purchase offer becomes visible on the upsell page, after the ' +
      'original order is already paid for.',
    providerNotes:
      "Both vendor names are custom events, outside either vendor's standard " +
      'set — define them at the destination before reporting on them.',
  },
  {
    name: 'dl_accepted_upsell',
    firesWhen:
      'a post-purchase offer was accepted. The SDK reports that as ' +
      '`dl_upsell_purchase` instead, in GA4 purchase shape, so upsell revenue ' +
      'lands in the same reports as the main order.',
    neverFired:
      'Superseded by `dl_upsell_purchase`. The name, its field schema and its Meta mapping all survive, so a tag written against it never fires — track `dl_upsell_purchase` instead.',
    providerNotes:
      'Mapped by Meta to `AcceptedUpsell`, and validated as if it fired. No ' +
      'RudderStack mapping.',
    cautions: [
      'Blocking or listening for `dl_accepted_upsell` has no effect, in either direction: nothing produces it. Use `dl_upsell_purchase` in `blockedEvents` and in your tags.',
    ],
  },
  {
    name: 'dl_skipped_upsell',
    firesWhen: 'The shopper declines a post-purchase offer and moves on.',
    providerNotes:
      "Both vendor names are custom events, outside either vendor's standard " +
      'set.',
  },
  {
    name: 'dl_upsell_purchase',
    firesWhen:
      'A post-purchase offer is accepted and charged. This is the revenue ' +
      'event for upsells — a second transaction against the same shopper.',
    fields: {
      'ecommerce.transaction_id':
        "The upsell's own order reference, `{order}-US{n}` — deliberately different from the original order id so the two purchases are not deduplicated into one.",
      'ecommerce.affiliation':
        'Always `Upsell` here, which is how upsell revenue is separated from the main order in reports.',
    },
    providerNotes:
      'RudderStack sends it as a second `Order Completed`. Meta has no mapping ' +
      'for it, so accepted upsells do **not** reach the Meta Pixel as ' +
      'purchases — a real gap if you optimise Meta campaigns on total revenue.',
    cautions: [
      'It is queued rather than pushed on the page where it happens, because that page redirects immediately. Expect it in the data layer of the *next* page, roughly 200 ms after boot.',
    ],
  },
  {
    name: 'dl_cart_updated',
    firesWhen:
      'The cart contents change for any reason — a line added, removed, or its ' +
      'quantity changed. A snapshot event, fired alongside the specific one.',
    providerNotes:
      'RudderStack maps it to `Cart Viewed`, the same name it uses for ' +
      '`dl_view_cart`, so the two are indistinguishable downstream unless you ' +
      'block one. Meta has no mapping.',
  },
  {
    name: 'dl_package_swapped',
    firesWhen:
      'A selector in swap mode replaces one package with another in a single ' +
      'step, rather than removing and adding.',
    providerNotes:
      'No vendor models a swap as one action, so neither Meta nor RudderStack ' +
      'maps it — a swap is visible to your GTM container only.',
    cautions: [
      'Validation requires `ecommerce.items_removed` and `ecommerce.items_added`, which are not in any field schema. An event built without both is dropped before the push.',
    ],
  },
  {
    name: 'dl_page_view',
    firesWhen:
      'A page is shown, including client-side navigations that never reload ' +
      'the document.',
    providerNotes:
      'The only event NextCampaign forwards. RudderStack turns it into a ' +
      '`page()` call plus a `{PageType} Page View` track event, and sends it ' +
      '**once per page load** — a second page view in the same load is skipped ' +
      'as a duplicate. Meta maps it to `PageView`.',
  },
  {
    name: 'dl_route_changed',
    firesWhen:
      'The URL changes without a document load — a single-page navigation.',
    providerNotes:
      'Redundant with `dl_page_view`, which fires for the same navigation — ' +
      'report on one of the two, not both.',
  },
  {
    name: 'dl_scroll_depth',
    firesWhen:
      'The shopper scrolls past a threshold named in the ' +
      '`next-analytics-scroll-tracking` meta tag. Each threshold fires once ' +
      'per page.',
  },
  {
    name: 'dl_exit_intent_shown',
    firesWhen:
      'An exit-intent popup is displayed because the shopper moved to leave.',
  },
  {
    name: 'dl_exit_intent_accepted',
    firesWhen: 'The shopper takes the offer in an exit-intent popup.',
  },
  {
    name: 'dl_exit_intent_dismissed',
    firesWhen:
      'The shopper declines an exit-intent popup — the explicit "no thanks" ' +
      'path, as opposed to closing it.',
  },
  {
    name: 'dl_exit_intent_closed',
    firesWhen:
      'The shopper closes an exit-intent popup without answering it, e.g. the ' +
      'X or the overlay.',
  },
  {
    name: 'dl_exit_intent_action',
    firesWhen:
      'A custom action inside an exit-intent popup runs — anything the popup ' +
      'defines beyond accept, dismiss and close.',
  },
];

// ── Providers ──────────────────────────────────────────────────────────────

export const ANALYTICS_PROVIDER_DOCS: AnalyticsProviderDoc[] = [
  {
    key: 'gtm',
    adapter: 'GTM',
    summary:
      'Forwards every event into Google Tag Manager, where your container ' +
      'decides what to do with it.',
    reshaping:
      'None for canonical events: a `dl_*` event is pushed **verbatim** to ' +
      '`window.ElevarDataLayer` and to `window.dataLayer`, with an ' +
      '`{ ecommerce: null }` push in front of the second so the previous ' +
      "event's ecommerce block cannot bleed into this one. Events pushed " +
      'without the `dl_` prefix take the other path and are reshaped to GA4 ' +
      'field rules.',
    drops:
      'Nothing beyond `blockedEvents` — it forwards every name it is given.',
    cautions: [
      'It needs no settings and its `containerId` is never read: enabling `gtm` only wires the adapter to `window.dataLayer`. If the container tag is not on the page, events pile up in the array and nothing reports them — add the GTM snippet separately.',
      'Every event is pushed to two arrays. A tag that listens on both `dataLayer` and `ElevarDataLayer` counts each event twice.',
    ],
  },
  {
    key: 'facebook',
    adapter: 'Facebook',
    summary: 'Sends mapped events to the Meta Pixel through `fbq`.',
    reshaping:
      'Renames the event through a fixed table and rebuilds the payload into ' +
      'Meta parameters — `content_ids`, `contents`, `value`, `num_items`. Nine ' +
      'of the mapped names are Meta **custom** events dispatched with ' +
      '`trackCustom`, so they will not appear as standard events in Meta ' +
      'reporting until you define them there.',
    drops:
      'Every event outside its table — including `dl_upsell_purchase`, so ' +
      'post-purchase revenue never reaches Meta.',
    cautions: [
      'It never loads the pixel. Without the Meta base code on the page it waits 5 seconds per event, then records `failed` with a one-time warning — the mapped payload is kept so you can still verify the mapping.',
      '`Purchase` deduplication needs `storeName` in the loader config; without it no `eventID` is sent and a server-side copy of the same order will double-count.',
    ],
  },
  {
    key: 'rudderstack',
    adapter: 'RudderStack',
    summary:
      'Sends events to RudderStack under its ecommerce spec names, via the ' +
      "page's `rudderanalytics` SDK.",
    reshaping:
      'Renames to spec names (`Order Completed`, `Product Added`) and rebuilds ' +
      'the payload as spec objects: `products[]`, `revenue`/`subtotal` as item ' +
      'revenue and `total` as value + tax + shipping. Page views become a ' +
      '`page()` call plus a `{PageType} Page View` track. Purchases also ' +
      'trigger an `identify()`.',
    drops:
      'Unmapped names, a second page view in the same page load, and — the one ' +
      'that surprises people — `dl_user_data` for any shopper with no email or ' +
      'user id, which is every visitor before checkout.',
    cautions: [
      'Guest traffic produces no `identify()` at all, so a funnel that only ever sees anonymous visitors will look empty on the identity side while events still arrive.',
      '`dl_view_cart` and `dl_cart_updated` both arrive as `Cart Viewed`. If you need to tell them apart, block one of the two for this provider.',
      'Cart and checkout ids are the analytics session id, not a real cart id, because the SDK has no client-side cart identifier. They group a funnel correctly but do not join to anything server-side.',
      'It ignores `blockedEvents` — see the note above the matrix.',
    ],
  },
  {
    key: 'nextCampaign',
    adapter: 'NextCampaign',
    summary:
      'Reports page views to the 29Next campaign analytics platform, loading ' +
      'its own script.',
    reshaping:
      'Maps page views to `page_view` with the document title and URL, and ' +
      'nothing else.',
    drops:
      'Every event that is not a page view — recorded as `skipped` with the ' +
      'reason `NextCampaign only tracks page_view`, which is by design and not ' +
      'a misconfiguration.',
    cautions: [
      'It is the one provider that loads a remote script itself, using the campaign `apiKey`. With no `apiKey` it logs a warning and stays inert; if the script host is unreachable, every event records `failed` after the load timeout.',
      'It fires its own initial page view on window load, in addition to the mapped `dl_page_view`. Expect two page views per page on that platform.',
      'It ignores `blockedEvents` — see the note above the matrix.',
    ],
  },
  {
    key: 'custom',
    adapter: 'Custom',
    summary: 'POSTs events to an endpoint of your own, batched, with retries.',
    reshaping:
      'Passes the event through your `transformFunction` (identity by default) ' +
      'and wraps a batch of up to 10 into one request body with a ' +
      '`batch_info` header block.',
    drops:
      'Nothing by name. Without an `endpoint` the provider is never ' +
      'constructed at all.',
    cautions: [
      'Delivery is deferred: an event is recorded as sent once it is queued, up to 5 seconds before the POST actually goes out. A `sent` status here means "queued", not "accepted by your endpoint" — check your endpoint\'s own logs to confirm receipt.',
      'A failed batch is **not** retried in practice. The retry queue is keyed on an event `id` that nothing in the pipeline sets (events carry `event_id`), so the `maxRetries: 3` setting never takes effect and a failed batch is lost after one error log. Treat this endpoint as best-effort and reconcile from your own side.',
      'It ignores `blockedEvents` — see the note above the matrix.',
    ],
  },
];
