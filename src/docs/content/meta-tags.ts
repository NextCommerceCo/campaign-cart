/**
 * Every `<meta>` tag the SDK reads, and what putting it on a page does.
 *
 * Meta tags are the SDK's other configuration surface. Attributes configure one
 * element; these configure the whole page — the API key it boots with, where checkout
 * sends the visitor, which analytics events fire. No feature owns them, so before this
 * list they were documented nowhere, and two of them are parsed and then ignored.
 *
 * The tag **names** are checked against the source by `src/tests/docs/coreContracts.test.ts`
 * in both directions: a tag added to the code and not to this list fails, and a tag on
 * this list that nothing reads fails. Everything else here is judgement an extractor
 * cannot supply — whether a value is required, what happens when it is wrong, and which
 * of two spellings is the current one.
 *
 * Build-time only, like the manifests: nothing under `src/` may import this.
 */

import type { AttributeDoc } from '../schema/feature-manifest';

/**
 * How much of the documented behaviour a tag actually has.
 *
 * `inert` exists because two tags are genuinely dead: `MetaTagController` parses
 * `next-analytics-disable` and `next-analytics-enable-only` into its config and the
 * only method that reads that config, `shouldBlockEvent()`, has no caller. Publishing
 * them as working switches would send a reader off to debug analytics that was never
 * blocked.
 */
export type MetaTagStatus =
  /** Read and acted on. */
  | 'active'
  /** An older spelling kept as a fallback. Use the tag it points at instead. */
  | 'legacy'
  /** Parsed by the code and never acted on. Setting it changes nothing. */
  | 'inert';

/** One `<meta>` tag, with the subsystem that reads it. */
export interface MetaTagDoc extends AttributeDoc {
  /** Which part of the SDK reads it, for the reader's orientation. */
  owner: string;
  /** Heading to file it under. Required here — 27 tags need grouping to be usable. */
  group: string;
  /** See {@link MetaTagStatus}. */
  status: MetaTagStatus;
  /** For a `legacy` tag: the current spelling to use instead. */
  supersededBy?: string;
  /**
   * A copy-paste-ready line, e.g. `<meta name="next-debug" content="true">`. Required
   * on every tag — a reader who can copy the exact syntax does not have to guess how
   * the value is spelled, and two of these tags carry extra attributes that no type
   * signature would reveal.
   */
  example: string;
  /** True when the SDK also creates or rewrites this tag at runtime. */
  writtenBySdk?: boolean;
}

/**
 * The group order on the rendered page: what a reader needs to boot at all, then the
 * things they reach for next.
 */
export const META_TAG_GROUPS = [
  'Booting the SDK',
  'Debugging',
  'Where the page goes next',
  'Attribution',
  'Analytics',
] as const;

export const META_TAGS: MetaTagDoc[] = [
  // ── Booting the SDK ──────────────────────────────────────────────────────────
  {
    name: 'next-api-key',
    group: 'Booting the SDK',
    owner: 'Config store → campaign load',
    status: 'active',
    type: 'string',
    required: true,
    example: '<meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">',
    description:
      "The campaign's public API key. It is the one tag a page cannot run without: the SDK uses it to fetch the campaign — its packages, prices, and shipping methods — and nothing on the page enhances until that call returns.",
    notes:
      'Missing or empty, initialization throws `API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey` and every price stays as its `{token}` placeholder. If you set both this tag and `window.nextConfig.apiKey`, **the tag wins** — configuration is loaded from `window` first and meta tags second, so a stale tag silently overrides the value your loader script computed.',
  },
  {
    name: 'next-campaign-id',
    group: 'Booting the SDK',
    owner: 'Config store (stored, never used)',
    status: 'inert',
    type: 'string',
    example: '<meta name="next-campaign-id" content="12345">',
    description:
      'Kept for backwards compatibility. The campaign is identified by the API key alone, so this value is stored on the config store and read by nothing except the debug panel that displays it.',
    notes:
      'It looks like it selects which campaign loads, and it does not — changing it has no effect on the data the page gets. Remove it rather than maintaining it; if a page loads the wrong campaign, the API key is what to check.',
  },
  {
    name: 'next-page-type',
    group: 'Booting the SDK',
    owner: 'Config store / analytics / upsell detection',
    status: 'active',
    type: "'product' | 'cart' | 'checkout' | 'upsell' | 'receipt'",
    default: 'product',
    values: [
      { value: 'product', description: 'A landing or offer page.' },
      { value: 'cart', description: 'A cart review page.' },
      {
        value: 'checkout',
        description: 'The page carrying the checkout form.',
      },
      {
        value: 'upsell',
        description:
          'A post-purchase upsell page. Also what makes the upsell page-view event fire.',
      },
      { value: 'receipt', description: 'The order confirmation page.' },
    ],
    example: '<meta name="next-page-type" content="checkout">',
    description:
      'Declares which funnel step this page is, so analytics events land on the right step and the post-purchase upsell tracking knows it is on an upsell page.',
    notes:
      'On an upsell page this is what triggers the upsell page-view event — leave it off and the funnel shows purchases with no upsell views before them. It can also come from `window.nextConfig.pageType`; the tag wins over it. Anything outside the five values is passed through unvalidated and shows up in reports verbatim.',
  },
  {
    name: 'next-page-name',
    group: 'Booting the SDK',
    owner: 'RudderStack adapter',
    status: 'active',
    type: 'string',
    default: 'the document `<title>`, then the page type',
    example: '<meta name="next-page-name" content="Summer Bundle — Offer">',
    description:
      'A human-readable page name for RudderStack page and track calls, when the document title is not what you want reported.',
    notes:
      'Only the RudderStack provider reads it. With GA4 or Facebook alone, setting it changes nothing.',
  },
  {
    name: 'next-clear-cart',
    group: 'Booting the SDK',
    owner: 'SDK boot',
    status: 'active',
    type: "'true' | 'false'",
    default: 'false',
    example: '<meta name="next-clear-cart" content="true">',
    description:
      'Empties the cart every time this page loads, once the stored cart has finished rehydrating. Use it on the first page of a funnel so a visitor who comes back does not start with items from a previous visit.',
    notes:
      'It runs on **every** load of the page, including a refresh and a back-navigation — a visitor who adds items and refreshes loses them. Only put it on entry pages, never on a cart, checkout, or upsell page. Only the exact string `true` enables it.',
  },
  {
    name: 'next-spreedly-key',
    group: 'Booting the SDK',
    owner: 'Config store → card fields',
    status: 'active',
    type: 'string',
    default: 'the key that comes with the campaign data',
    example: '<meta name="next-spreedly-key" content="{ENVIRONMENT_KEY}">',
    description:
      'The payment environment key used to mount the hosted credit-card fields. A fallback: the campaign response normally carries the right key, and that takes precedence.',
    notes:
      'Because campaign data wins, setting this tag does not let you point a page at a different payment environment for testing — it only fills a gap when the campaign has no key. A wrong value here shows up as card fields that never appear.',
  },
  {
    name: 'next-payment-env-key',
    group: 'Booting the SDK',
    owner: 'Config store → card fields',
    status: 'legacy',
    supersededBy: 'next-spreedly-key',
    type: 'string',
    example: '<meta name="next-payment-env-key" content="{ENVIRONMENT_KEY}">',
    description:
      'The same payment environment key under an older name. Read only when `next-spreedly-key` is absent.',
    notes:
      'Setting both is not an error but the other tag always wins, so a page with both is a page where editing this one appears to do nothing.',
  },

  // ── Debugging ────────────────────────────────────────────────────────────────
  {
    name: 'next-debug',
    group: 'Debugging',
    owner: 'Config store → debug boot',
    status: 'active',
    type: "'true' | 'false'",
    default: 'false',
    example: '<meta name="next-debug" content="true">',
    description:
      "Turns on the SDK's debug boot: the log level drops to `debug` and the `window.nextDebug` helpers become available for poking at the stores from the console.",
    notes:
      'It does **not** open the on-page debug overlay, and in a production build it does not restore the suppressed logs either — the production logger decides whether to print by looking at the URL and `window.nextConfig`, and never at this tag, so a page with only this tag stays silent. For the overlay and for logs on a live page use `?debugger=true`; for logs alone use `?debug=true`. See [URL parameters](./url-parameters.md).',
  },

  // ── Where the page goes next ─────────────────────────────────────────────────
  {
    name: 'next-success-url',
    group: 'Where the page goes next',
    owner: 'Checkout',
    status: 'active',
    type: 'string (path or absolute URL)',
    default: '`/success` on the current origin',
    writtenBySdk: true,
    example: '<meta name="next-success-url" content="/receipt">',
    description:
      "Where a visitor lands after an order succeeds. It is also sent to the order API as the order's success URL, so an off-site payment method returns the visitor to the same place. The order reference is appended as `?ref_id=…`, which is what lets the receipt page load the order.",
    notes:
      'A relative value is resolved against the current origin, so `receipt` and `/receipt` both work — but a value pointing at another domain sends the visitor off-site with the reference in the query string. The checkout enhancer also *writes* this tag when `setSuccessUrl()` is called, so reading the tag back does not prove an author set it.',
  },
  {
    name: 'next-next-url',
    group: 'Where the page goes next',
    owner: 'Checkout',
    status: 'legacy',
    supersededBy: 'next-success-url',
    type: 'string (path or absolute URL)',
    writtenBySdk: true,
    example: '<meta name="next-next-url" content="/receipt">',
    description:
      'The success destination under an older name. Read only when `next-success-url` is absent.',
    notes:
      'With both present, `next-success-url` wins — so editing this tag on a page that has both looks like a no-op. Delete it and keep one.',
  },
  {
    name: 'os-next-page',
    group: 'Where the page goes next',
    owner: 'Checkout',
    status: 'legacy',
    supersededBy: 'next-success-url',
    type: 'string (path or absolute URL)',
    writtenBySdk: true,
    example: '<meta name="os-next-page" content="/receipt">',
    description:
      'The oldest spelling of the success destination, from before the `next-` prefix. Last in the fallback chain after `next-success-url` and `next-next-url`.',
    notes:
      'Present on many older pages. It still works, so there is no urgency — but when you touch such a page, collapse all three into `next-success-url`, because a page with three copies of one URL drifts.',
  },
  {
    name: 'next-failure-url',
    group: 'Where the page goes next',
    owner: 'Checkout',
    status: 'active',
    type: 'string (path or absolute URL)',
    default: 'the current URL with `?payment_failed=true` appended',
    writtenBySdk: true,
    example: '<meta name="next-failure-url" content="/checkout">',
    description:
      "Where a visitor lands when payment fails. Sent to the order API as the order's failure URL, so a payment method that redirects away brings a declined visitor back here rather than dropping them.",
    notes:
      'Without it the visitor comes back to the *current* URL with `?payment_failed=true` on it — which works, but nothing on the page reads that parameter, so unless you handle it yourself the visitor sees a checkout form with no explanation of what went wrong.',
  },
  {
    name: 'os-failure-url',
    group: 'Where the page goes next',
    owner: 'Checkout',
    status: 'legacy',
    supersededBy: 'next-failure-url',
    type: 'string (path or absolute URL)',
    writtenBySdk: true,
    example: '<meta name="os-failure-url" content="/checkout">',
    description:
      'The failure destination under its pre-`next-` name. Read only when `next-failure-url` is absent.',
    notes:
      'With both present `next-failure-url` wins, so this one is the copy that goes stale unnoticed.',
  },
  {
    name: 'next-upsell-accept-url',
    group: 'Where the page goes next',
    owner: 'Post-purchase upsell / package toggle',
    status: 'active',
    type: 'string (path or absolute URL)',
    example: '<meta name="next-upsell-accept-url" content="/upsell-2">',
    description:
      'Where an upsell page goes after the visitor accepts the offer. A page-level fallback: an accept element with its own `data-next-url` uses that instead. The order reference is carried over as `?ref_id=…` so the next page can still load the order.',
    notes:
      'With neither this tag nor `data-next-url`, accepting the upsell adds the item and leaves the visitor on the same page looking at an offer they already took. On a funnel of several upsell pages, set it on each one — it is per page, not global.',
  },
  {
    name: 'next-upsell-decline-url',
    group: 'Where the page goes next',
    owner: 'Post-purchase upsell',
    status: 'active',
    type: 'string (path or absolute URL)',
    example: '<meta name="next-upsell-decline-url" content="/receipt">',
    description:
      'Where an upsell page goes when the visitor declines. The same page-level fallback as the accept URL, for the skip path.',
    notes:
      'Leaving it off is the more common mistake of the two, because declining is the path nobody tests — the visitor clicks "no thanks" and stays on the offer. Point it at the receipt.',
  },

  // ── Attribution ──────────────────────────────────────────────────────────────
  {
    name: 'next-funnel',
    group: 'Attribution',
    owner: 'Attribution collector',
    status: 'active',
    type: 'string',
    example: '<meta name="next-funnel" content="summer-bundle-2026">',
    description:
      'Names the funnel this page belongs to, so orders can be reported per funnel. Last in a priority chain: a `?funnel=` parameter wins, then a funnel already remembered for this visitor, and only then this tag.',
    notes:
      'Because a remembered value beats the tag, changing it does not affect a visitor who already has a funnel stored from an earlier page in the same browser — you will see the old name on their order while a fresh browser shows the new one. To retest, clear storage or load the page once with `?funnel=` set.',
  },
  {
    name: 'data-next-tracking-tag',
    group: 'Attribution',
    owner: 'Attribution collector',
    status: 'active',
    type: 'string (in data-tag-value, not content)',
    example:
      '<meta name="data-next-tracking-tag" data-tag-name="funnel_name" data-tag-value="summer-bundle" data-persist="true">',
    description:
      'Attaches an arbitrary named value to every order placed from this page. Unlike every other tag here, the value lives in `data-tag-value` and the field name in `data-tag-name`; add `data-persist="true"` to carry it across later pages in the session. Repeat the tag once per value. A `data-tag-name` of `funnel_name` also supplies the funnel.',
    notes:
      'A tag with `data-tag-name` but no `data-tag-value` is skipped in silence — if a value is missing from an order, check that you did not put it in `content`. This tag is also listed with the SDK-level attributes: see [SDK-level attributes](../../../../docs/sdk-attributes.md) for its element-side story.',
  },
  {
    name: 'os-tracking-tag',
    group: 'Attribution',
    owner: 'Attribution collector',
    status: 'legacy',
    supersededBy: 'data-next-tracking-tag',
    type: 'string (in data-tag-value)',
    example:
      '<meta name="os-tracking-tag" data-tag-name="funnel_name" data-tag-value="summer-bundle">',
    description:
      'The pre-`next-` spelling of the custom tracking tag. Read with exactly the same rules, and both names are collected together rather than one overriding the other.',
    notes:
      'Because both spellings are collected, a page carrying the same `data-tag-name` under both names sends whichever the browser returns last — silently. Keep one spelling per field.',
  },
  {
    name: 'os-facebook-pixel',
    group: 'Attribution',
    owner: 'Attribution collector',
    status: 'active',
    type: 'string (pixel id)',
    default: "a pixel id scraped out of the page's own scripts",
    example: '<meta name="os-facebook-pixel" content="1234567890">',
    description:
      "The Facebook pixel id to report with the order, so Facebook can match the conversion. Highest priority — when it is absent the SDK falls back to scanning the page's script tags for a pixel id.",
    notes:
      'The fallback scan is a guess against page markup and will pick the wrong id on a page with more than one pixel. If Facebook attribution is wrong, set this tag explicitly rather than trusting the scan.',
  },
  {
    name: 'facebook-pixel-id',
    group: 'Attribution',
    owner: 'Attribution collector',
    status: 'active',
    type: 'string (pixel id)',
    example: '<meta name="facebook-pixel-id" content="1234567890">',
    description:
      'An alternative name for the pixel id, read in the same selector as `os-facebook-pixel` with no ordering between them.',
    notes:
      'Neither name wins over the other — the two are looked up in one selector, so with both present the browser decides. Pick one.',
  },

  // ── Analytics ────────────────────────────────────────────────────────────────
  {
    name: 'next-analytics-view-item',
    group: 'Analytics',
    owner: 'Analytics meta tag controller',
    status: 'active',
    type: 'string — a package ref id, or url:{PARAM}',
    example:
      '<meta name="next-analytics-view-item" content="123" trigger="view:#offer">',
    description:
      'Fires a product-view event for one package, and **replaces** the SDK\'s own detection of what the page is showing. Use `content="url:pid"` to take the package id from a query parameter instead of hard-coding it. The optional `trigger` attribute delays the event: `time:2000` fires after two seconds, `view:{CSS_SELECTOR}` fires when that element scrolls into view.',
    notes:
      'Because it replaces auto-detection, a wrong package id here means the page reports a product view for the wrong product rather than reporting none. An unknown package id, or a `url:` parameter missing from the URL, logs a warning and fires nothing — so a silent funnel with this tag set is the tag, not the analytics provider. An unrecognised `trigger` fires immediately.',
  },
  {
    name: 'next-analytics-view-item-list',
    group: 'Analytics',
    owner: 'Analytics meta tag controller',
    status: 'active',
    type: 'string — comma-separated package ref ids, or url:{PARAM}',
    example:
      '<meta name="next-analytics-view-item-list" content="123,124,125">',
    description:
      "Fires one product-list view event covering the listed packages, and replaces the SDK's own detection of which packages the page lists. `url:{PARAM}` reads the comma-separated list from a query parameter.",
    notes:
      'Ids that match no package are dropped with a warning and the event still fires with the rest, so a partially wrong list under-reports quietly. If every id is wrong, nothing fires at all. Pair it with `next-analytics-list-id` / `next-analytics-list-name` or the list arrives unnamed.',
  },
  {
    name: 'next-analytics-list-id',
    group: 'Analytics',
    owner: 'Analytics meta tag controller',
    status: 'active',
    type: 'string',
    example: '<meta name="next-analytics-list-id" content="summer_offers">',
    description:
      'Sets the list id attributed to every product event on the page, so a click can be traced back to the list it came from.',
    notes:
      'It is page-level: every event on the page gets the same list id, including events from elements that belong to a different list. On a page showing two distinct lists, leave it off and let per-element attribution work.',
  },
  {
    name: 'next-analytics-list-name',
    group: 'Analytics',
    owner: 'Analytics meta tag controller',
    status: 'active',
    type: 'string',
    example: '<meta name="next-analytics-list-name" content="Summer Offers">',
    description:
      'The human-readable name shown next to the list id in reports. Page-level, like the id.',
    notes:
      'A name with no id groups poorly in most report tools. Set both or neither.',
  },
  {
    name: 'next-analytics-scroll-tracking',
    group: 'Analytics',
    owner: 'Analytics meta tag controller',
    status: 'active',
    type: 'string — comma-separated percentages',
    example:
      '<meta name="next-analytics-scroll-tracking" content="25,50,75,100">',
    description:
      'Emits a scroll-depth event the first time the visitor passes each listed percentage of the page. Each threshold fires at most once, and the scroll listener removes itself once they have all been reached.',
    values: 'Numbers greater than 0 and up to 100; anything else is discarded',
    notes:
      'Values outside 0–100 and non-numbers are dropped without a warning, so `content="25,50,fifty"` tracks two thresholds and looks like it tracks three. On a page shorter than the viewport there is nothing to scroll and no event ever fires.',
  },
  {
    name: 'next-analytics-disable',
    group: 'Analytics',
    owner: 'Analytics meta tag controller (parsed, never enforced)',
    status: 'inert',
    type: 'string — comma-separated event names',
    example: '<meta name="next-analytics-disable" content="dl_view_item">',
    description:
      "Intended to stop the named analytics events from being sent. The value is parsed into the controller's config and the only method that consults it, `shouldBlockEvent()`, is called from nowhere — so the events still fire.",
    notes:
      'This is the trap: the tag looks like it works, and a page carrying it sends every event anyway, which is how duplicate or unwanted conversions reach a provider. Two ways to suppress events that do work today: add `?ignore=true` to the URL, which sets a session-wide flag in `analytics/index.ts › NextAnalytics.checkAndSetIgnoreFlag` and is checked by `analytics/index.ts › NextAnalytics.shouldIgnoreAnalytics` before any provider initialises, or filter the event in your tag manager. Do **not** reach for `window.nextConfig.tracking` — that value is stored and read by nothing. Treat this tag as not implemented until `shouldBlockEvent()` has a caller.',
  },
  {
    name: 'next-analytics-enable-only',
    group: 'Analytics',
    owner: 'Analytics meta tag controller (parsed, never enforced)',
    status: 'inert',
    type: 'string — comma-separated event names',
    example: '<meta name="next-analytics-enable-only" content="dl_purchase">',
    description:
      'Intended as the allow-list counterpart of `next-analytics-disable`: send these events and nothing else. It is parsed and never enforced for the same reason — the check that would apply it has no caller.',
    notes:
      'A page with this tag sends its full event set, not the one event listed, which is the opposite of what the author asked for. Nothing looks wrong while it happens, because the extra events are valid ones. Use the same alternatives as `next-analytics-disable`.',
  },
];
