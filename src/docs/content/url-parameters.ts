/**
 * Every URL query parameter the SDK acts on, and what adding it to a link does.
 *
 * These are the switches nobody can find. They are not in the HTML, so grepping a page
 * never turns them up; they are not owned by a feature, so no manifest documents them.
 * The result is that `?ignore=true` quietly stops a session from being tracked, and
 * `?test=true` puts a live checkout into a mode that posts a fake card to the real order
 * API — both undocumented until this page.
 *
 * The parameter **names** are checked against the source by
 * `src/tests/docs/coreContracts.test.ts` in both directions, so a parameter added to the
 * code and not to this list fails, and a parameter listed here that nothing reads fails.
 * The judgement — what it is for, whether it is safe on a live page, what it does *not*
 * do — is hand-written, because that is what a reader actually needs and no extractor
 * can infer it.
 *
 * Build-time only, like the manifests: nothing under `src/` may import this.
 */

import type { AttributeDoc } from '../schema/feature-manifest';

/** Whether the SDK reads the parameter, writes it, or both. */
export type ParamDirection =
  /** The SDK reads it off the current URL. */
  | 'read'
  /** The SDK reads it, and also puts it on URLs it builds. */
  | 'read+written'
  /** The SDK only ever writes it, for your page or your reports to read. */
  | 'written';

/** One URL query parameter. */
export interface UrlParameterDoc extends AttributeDoc {
  /** Which part of the SDK reads it, for the reader's orientation. */
  owner: string;
  /** Heading to file it under. Required here — 40 parameters need grouping. */
  group: string;
  /** See {@link ParamDirection}. */
  direction: ParamDirection;
  /**
   * True when the parameter changes what a real visitor experiences or what reaches a
   * real API, so it must never be left on a link that ships. The renderer marks these
   * on their own row rather than in a preamble.
   */
  productionHazard?: boolean;
  /**
   * True when the effect outlives the parameter: the SDK copies the value into storage,
   * so removing it from the URL does not undo it for the rest of the session.
   */
  sticky?: boolean;
  /**
   * A copy-paste-ready query fragment, e.g. `?debugger=true`. Required on every
   * parameter — the exact spelling is the whole contract, and several of these accept a
   * compound value no type signature would reveal.
   */
  example: string;
}

/** The group order on the rendered page: everyday first, attribution plumbing last. */
export const URL_PARAMETER_GROUPS = [
  'Currency and country',
  'Debugging',
  'Test orders',
  'Resetting a session',
  'Forcing a page into a state',
  'Loading an order',
  'Analytics',
  'Attribution',
  'Written by the SDK',
] as const;

/** The five UTM parameters, which behave identically. */
const utm = (suffix: string, meaning: string): UrlParameterDoc => ({
  name: `utm_${suffix}`,
  group: 'Attribution',
  owner: 'Attribution collector',
  direction: 'read',
  type: 'string',
  example: `?utm_${suffix}={VALUE}`,
  description: `${meaning} Stored on the attribution record and sent with the order.`,
  notes:
    'Remembered for the session on first sight, so a later page load without it keeps the original value — which is what makes multi-page funnels attribute correctly, and also why clearing it from a link does not clear it from the visitor.',
});

/** `subaffiliateN` and its short alias `subN`, which are read as a pair. */
const subaffiliate = (n: number): UrlParameterDoc[] => [
  {
    name: `subaffiliate${n}`,
    group: 'Attribution',
    owner: 'Attribution collector',
    direction: 'read',
    type: 'string (max 225 characters)',
    example: `?subaffiliate${n}={VALUE}`,
    description: `Sub-affiliate tracking slot ${n} of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.`,
    notes:
      'Values longer than 225 characters are **truncated**, not rejected, with a warning in the log — a long encoded payload arrives at the order silently cut short. Keep it short, or hash it.',
  },
  {
    name: `sub${n}`,
    group: 'Attribution',
    owner: 'Attribution collector',
    direction: 'read',
    type: 'string (max 225 characters)',
    example: `?sub${n}={VALUE}`,
    description: `Short alias for \`subaffiliate${n}\`, read only when the long form is absent.`,
    notes: `With both present \`subaffiliate${n}\` wins, so editing this one on a link that carries both appears to do nothing.`,
  },
];

export const URL_PARAMETERS: UrlParameterDoc[] = [
  // ── Currency and country ─────────────────────────────────────────────────────
  {
    name: 'currency',
    group: 'Currency and country',
    owner: 'SDK boot / campaign load',
    direction: 'read',
    type: 'string (3-letter currency code)',
    default: "the currency detected from the visitor's location",
    sticky: true,
    example: '?currency=EUR',
    description:
      'Loads the campaign priced in this currency and shows every price in it. Highest priority of all the currency sources — it beats a currency the visitor picked earlier and the one detected from their location.',
    notes:
      'The value is copied into session storage under `next_selected_currency`, so it keeps applying to later page loads **without** the parameter, for the rest of the tab. That is deliberate — it stops a checkout from drifting to another currency mid-funnel — but it means deleting the parameter does not undo the test, and neither does `?reset=true`, which only clears keys spelled `next-…`. Load the page once with the currency you want, or open a new tab. A currency the campaign does not price in falls back with a `currency:fallback` event rather than failing.',
  },
  {
    name: 'country',
    group: 'Currency and country',
    owner: 'SDK boot / checkout address form',
    direction: 'read',
    type: 'string (2-letter country code)',
    default: "the country detected from the visitor's location",
    sticky: true,
    example: '?country=CA',
    description:
      "Overrides the detected country: it loads that country's address rules — state list, the label and format of the postcode field — and pre-selects it as the shipping destination.",
    notes:
      'It does **not** change the currency, despite the two normally moving together; use `?currency=` for that, and expect a page showing Canadian address fields with US prices if you set only one. Like the currency it is remembered for the tab (`next_selected_country`) and `?reset=true` does not clear it. A country the campaign does not ship to is rejected with a warning and the dropdown keeps the detected one, so a link that seems ignored is usually a shipping-coverage problem.',
  },

  // ── Debugging ────────────────────────────────────────────────────────────────
  {
    name: 'debug',
    group: 'Debugging',
    owner: 'Logger / attribute scanner',
    direction: 'read',
    type: "'true'",
    default: 'off',
    example: '?debug=true',
    description:
      'Un-suppresses logging. The production bundle drops every `debug`, `info`, and `warn` line unless this is set; with it, the SDK narrates what it is doing in the console. That is all it does.',
    notes:
      'It does **not** open the debug overlay — that is `?debugger=true`, one letter apart, and mixing them up is the single most common confusion on these pages. If you wanted the panel and got only console output, you used this one. Safe to leave on a link: it changes nothing a visitor sees. It travels in one place: the checkout copies it onto the `success_url` and `payment_failed_url` it hands the orders API, so logging is still on when a payment gateway returns the shopper. Nothing else about the order carries it.',
  },
  {
    name: 'debugger',
    group: 'Debugging',
    owner: 'Debug overlay / test mode',
    direction: 'read+written',
    type: "'true'",
    default: 'off',
    productionHazard: true,
    example: '?debugger=true',
    description:
      'Opens the on-page debug overlay — cart, campaign, order, checkout, and analytics panels, plus the currency, country, and upsell pickers — and turns logging all the way up. This is the parameter you want when you mean "show me the debug panel".',
    notes:
      'It also silently puts the page into **test mode**, the same state as `?test=true`, so a debugging session on a live page is one Konami code away from posting a real test order. See `test` below before using it on production. It is also the only way in: neither the `next-debug` meta tag nor `window.nextConfig.debug` opens the overlay — those only raise the log level. `window.nextConfig.debugger = true` is the equivalent for a page you cannot add a parameter to.\n\nIt **survives a payment gateway.** The checkout copies it onto the `success_url` and `payment_failed_url` it sends the orders API, so PayPal or a 3-D Secure step returns the shopper to a page that still has the overlay and the logs — which is the only practical way to debug the return leg, since nothing on that page can add the parameter after the fact. Two consequences worth knowing: the return URL is part of the order payload, so the parameter travels with the order; and because it arms test mode, the page the shopper lands back on is in test mode too. Nothing else from the link travels with it — the copy is an explicit list of `debug` and `debugger`, not the whole query string.',
  },

  // ── Test orders ──────────────────────────────────────────────────────────────
  {
    name: 'test',
    group: 'Test orders',
    owner: 'Test mode manager',
    direction: 'read+written',
    type: "'true'",
    default: 'off',
    productionHazard: true,
    example: '?test=true',
    description:
      'Marks the page as being in test mode, which lets the test-card helpers fill the checkout form with a known card number. `?debugger=true` turns it on too, and the Konami code (↑↑↓↓←→←→BA) both turns it on and writes this parameter into the address bar.',
    notes:
      'The Konami listener is attached the moment the SDK loads, on **every** page including production, and it does not check whether test mode is on first. Typing that sequence on a live checkout fills a hard-coded address (`Test Order, Test Address 123, Tempe AZ 85281`) and posts `card_token: "test_card"` to the real order endpoint — a real API call that creates a real record. Do not demo a checkout page to anyone playing with the arrow keys, and treat any order with that address as a test artefact. There is no way to opt a page out short of a code change.',
  },

  // ── Resetting a session ──────────────────────────────────────────────────────
  {
    name: 'reset',
    group: 'Resetting a session',
    owner: 'SDK boot',
    direction: 'read+written',
    type: "'true'",
    default: 'off',
    productionHazard: true,
    example: '?reset=true',
    description:
      "Clears the SDK's stored state before anything else loads, then removes itself from the URL so a refresh does not clear the page again. The way out of a session wedged by an earlier test.",
    notes:
      "It clears less than the name promises. The sweep only removes keys beginning `next-` or `_next`, which covers the cart, order, attribution, and campaign cache — but the remembered currency (`next_selected_currency`), country (`next_selected_country`), funnel (`next_funnel_name`), the analytics `analytics_ignore` flag, and `evclid` are all spelled with an underscore and **survive**. So a session stuck in the wrong currency, or silently untracked, is not fixed by this parameter; open a new tab instead. It does wipe a **real** visitor's cart if it reaches one, so never leave it on a published link or a redirect target — and because it strips itself from the address bar, a screenshot of the URL will not show that it ran.",
  },

  // ── Forcing a page into a state ──────────────────────────────────────────────
  {
    name: 'forcePackageId',
    group: 'Forcing a page into a state',
    owner: 'SDK boot → cart',
    direction: 'read',
    type: 'string — `{ID}` or `{ID}:{QTY}`, comma-separated',
    productionHazard: true,
    example: '?forcePackageId=123:2,124',
    description:
      'Empties the cart and puts the listed packages in it, with an optional quantity after a colon (default 1). Made for jumping straight to a checkout or upsell page with a known cart instead of clicking through the funnel.',
    notes:
      'The clear happens first and unconditionally, so a visitor who reaches a link carrying this loses whatever they had in their cart. A package id that is not in the campaign is skipped with a warning and the rest still load — so a partially wrong link gives a partially filled cart rather than an error. A malformed id or a quantity of zero abandons the whole operation, leaving the cart empty.',
  },
  {
    name: 'forceShippingId',
    group: 'Forcing a page into a state',
    owner: 'SDK boot → cart',
    direction: 'read',
    type: 'number (a shipping method `ref_id`)',
    example: '?forceShippingId=3',
    description:
      'Selects a shipping method by its campaign id, so you can test a specific rate — free shipping, expedited — without going through the picker.',
    notes:
      'It is applied after the campaign loads, which means it overwrites a method the visitor already chose. An id that is not in the campaign is ignored with a warning and the existing selection stays, so a link that appears to do nothing is usually a stale id: the log lists the ids that do exist.',
  },
  {
    name: 'forceBundleId',
    group: 'Forcing a page into a state',
    owner: 'Bundle selector',
    direction: 'read',
    type: 'string — `{BUNDLE}` or `{SELECTOR}:{BUNDLE}`, comma-separated',
    example: '?forceBundleId=tier-selector:premium',
    description:
      'Pre-selects a bundle card, overriding the card marked `data-next-selected`. Scope it to one selector with `{SELECTOR_ID}:{BUNDLE_ID}` when the page has several; an unscoped value applies to the first selector that has a card with that id.',
    notes:
      'When the bundle id matches no card, the selector logs a warning and falls back to its normal default — so a typo shows up as "the page ignored my link", not as an error. Malformed comma-separated entries are dropped in silence.',
  },

  // ── Loading an order ─────────────────────────────────────────────────────────
  {
    name: 'ref_id',
    group: 'Loading an order',
    owner: 'SDK boot → order store; checkout and upsell redirects',
    direction: 'read+written',
    type: 'string (order reference)',
    example: '?ref_id={ORDER_REF}',
    description:
      'Loads that order when the page opens, which is what makes a receipt page show its totals and an upsell page know what was bought. The SDK appends it for you to the success, upsell, and decline URLs it redirects to, so a well-configured funnel never needs it written by hand.',
    notes:
      'It is an order reference in a URL a visitor can edit, so anything it renders is visible to anyone holding the link — do not put an order-lookup page behind it and assume privacy. If a receipt page is blank, check that the redirect actually carried this parameter: the SDK only appends it when the target URL does not already have one.',
  },
  {
    name: 'order_ref_id',
    group: 'Loading an order',
    owner: 'SDK boot → order store',
    direction: 'read',
    type: 'string (order reference)',
    example: '?order_ref_id={ORDER_REF}',
    description:
      'An alternative spelling of `ref_id`, read only when `ref_id` is absent. Present for links built by older tooling.',
    notes:
      "The SDK never writes this form, only `ref_id`, so a page reached through the SDK's own redirects will always carry the other one. Use `ref_id` in anything new.",
  },

  // ── Analytics ────────────────────────────────────────────────────────────────
  {
    name: 'ignore',
    group: 'Analytics',
    owner: 'Analytics',
    direction: 'read',
    type: "'true'",
    default: 'off',
    sticky: true,
    example: '?ignore=true',
    description:
      'Stops analytics entirely for this visitor: no provider is initialised and no event is sent. Use it so your own testing, QA, and demo traffic does not land in the reports.',
    notes:
      'The flag is copied into session storage on first sight, so it keeps suppressing analytics on every later page in the tab **without** the parameter. That is what makes it useful across a funnel, and it is also the trap: a tester who loads one page with it and then does real work in the same tab records nothing, and there is no on-page sign that tracking is off. Open a fresh tab to get tracking back.',
  },
  {
    name: 'category',
    group: 'Analytics',
    owner: 'Analytics list attribution',
    direction: 'read',
    type: 'string',
    example: '?category=summer-sale',
    description:
      'Names the list a product view or click should be attributed to, when the page is a category listing whose URL path does not already say so.',
    notes:
      'The URL **path** is checked first — a path containing `/collections/…`, `/category/…`, `/search`, `/tag/…` or `/brand/…` wins and this parameter is never consulted. So on a page whose path already matches one of those patterns, setting it has no effect.',
  },
  {
    name: 'collection',
    group: 'Analytics',
    owner: 'Analytics list attribution',
    direction: 'read',
    type: 'string',
    example: '?collection=bestsellers',
    description:
      'The same list attribution as `category`, for pages that call the grouping a collection. Read after `category`.',
    notes:
      'With both present `category` wins. As with `category`, a path that already matches a known listing pattern takes precedence over either.',
  },
  {
    name: 'q',
    group: 'Analytics',
    owner: 'Analytics list attribution',
    direction: 'read',
    type: 'string',
    example: '?q=protein+powder',
    description:
      'Marks the page as search results and puts the search text in the reported list name. Read together with `query` and `search`, whichever is present.',
    notes:
      'All three spellings produce the same list id, `search_results`, so reports cannot tell them apart — pick one across the site if you want the search term to be comparable.',
  },
  {
    name: 'query',
    group: 'Analytics',
    owner: 'Analytics list attribution',
    direction: 'read',
    type: 'string',
    example: '?query=protein+powder',
    description:
      'A second accepted spelling of the search term, read after `q`.',
    notes:
      'Presence alone is enough: `?query=` with an empty value still reports the page as search results, with an empty term.',
  },
  {
    name: 'search',
    group: 'Analytics',
    owner: 'Analytics list attribution',
    direction: 'read',
    type: 'string',
    example: '?search=protein+powder',
    description:
      'A third accepted spelling of the search term, read after `query`.',
    notes:
      'Same caveat as the other two — the value is only used for the list *name*, so it never affects which products are reported.',
  },

  // ── Attribution ──────────────────────────────────────────────────────────────
  {
    name: 'funnel',
    group: 'Attribution',
    owner: 'Attribution collector',
    direction: 'read',
    type: 'string',
    default: 'a remembered funnel, then the `next-funnel` meta tag',
    sticky: true,
    example: '?funnel=summer-bundle-2026',
    description:
      "Names the funnel this visit belongs to, and is the highest-priority source: it overrides both a funnel already remembered for this visitor and the page's `next-funnel` meta tag.",
    notes:
      'It overwrites the remembered value in both session and local storage, so it keeps applying on later visits from the same browser even after the link is gone. That makes it the tool for correcting a mis-tagged visitor, and it also means one test link can permanently relabel your own browser. The override is logged, so the console tells you when it happened.',
  },
  {
    name: 'affid',
    group: 'Attribution',
    owner: 'Attribution collector',
    direction: 'read',
    type: 'string',
    example: '?affid={AFFILIATE_ID}',
    description:
      'The affiliate credited with the order. Remembered for the rest of the browser tab and sent with every order placed in it.',
    notes:
      'It is held in session storage, so it is scoped to the tab: a visitor who arrives through an affiliate link and finishes the purchase in a *new* tab loses the credit. Unlike `funnel` and `evclid` it does not survive the tab closing.',
  },
  {
    name: 'aff',
    group: 'Attribution',
    owner: 'Attribution collector',
    direction: 'read',
    type: 'string',
    example: '?aff={AFFILIATE_ID}',
    description: 'Short alias for `affid`, read only when `affid` is absent.',
    notes:
      'With both on the link `affid` wins. That happens more often than it sounds: a network appends its own parameter to a URL that already had one, and the order is then credited to the value you did not expect.',
  },
  {
    name: 'gclid',
    group: 'Attribution',
    owner: 'Attribution collector',
    direction: 'read',
    type: 'string',
    example: '?gclid={GOOGLE_CLICK_ID}',
    description:
      'The Google Ads click id, added automatically by Google when auto-tagging is on. Stored and sent with the order so a conversion can be matched back to the click.',
    notes:
      'Nothing generates it for you; if it is missing from orders, the cause is upstream — auto-tagging off, or a redirect that dropped the query string.',
  },
  {
    name: 'fbclid',
    group: 'Attribution',
    owner: 'Attribution collector',
    direction: 'read',
    type: 'string',
    example: '?fbclid={FACEBOOK_CLICK_ID}',
    description:
      "The Facebook click id, added by Facebook on outbound clicks. Recorded in the order's attribution metadata when present.",
    notes:
      'It is recorded only when non-empty, so it is absent rather than blank on organic traffic — a report filtering on it will not see those orders at all.',
  },
  {
    name: 'clickid',
    group: 'Attribution',
    owner: 'Attribution collector',
    direction: 'read',
    type: 'string',
    example: '?clickid={CLICK_ID}',
    description:
      "A generic click id for tracking platforms that do not use one of the named parameters. Passed through to the order's attribution metadata unchanged.",
    notes:
      'It is a single slot: a page reached through two networks that both use `clickid` keeps only the value in the current URL. Use the sub-affiliate slots when you need more than one.',
  },
  {
    name: 'evclid',
    group: 'Attribution',
    owner: 'Attribution collector (Everflow)',
    direction: 'read',
    type: 'string',
    example: '?evclid={EVERFLOW_CLICK_ID}',
    description:
      'The Everflow click id, sent with the order as its Everflow transaction id so the network can attribute the conversion.',
    notes:
      'It is written to **local** storage rather than the session, so it persists across tabs and days — a browser that once opened an Everflow link keeps attributing orders to that click until storage is cleared. Worth knowing before you conclude an affiliate is over-credited.',
  },
  utm('source', 'Which site or platform the visit came from.'),
  utm('medium', 'What kind of link it was — cpc, email, social.'),
  utm('campaign', 'Which marketing campaign the link belongs to.'),
  utm('content', 'Which specific creative or link variant was clicked.'),
  utm('term', 'The paid keyword the visit was bought against.'),
  ...subaffiliate(1),
  ...subaffiliate(2),
  ...subaffiliate(3),
  ...subaffiliate(4),
  ...subaffiliate(5),

  // ── Written by the SDK ───────────────────────────────────────────────────────
  {
    name: 'payment_failed',
    group: 'Written by the SDK',
    owner: 'Checkout',
    direction: 'written',
    type: "'true'",
    example: '?payment_failed=true',
    description:
      'Added by the SDK to the fallback failure URL — the current page — when no `next-failure-url` meta tag is set. It is a signal for your page to explain that payment did not go through.',
    notes:
      'Nothing in the SDK reads it, so a declined visitor comes back to a checkout form that looks exactly as it did before, with no message. Either handle this parameter in your own page code or set `next-failure-url` to a page that does. See [meta tags](./meta-tags.md).',
  },
];
