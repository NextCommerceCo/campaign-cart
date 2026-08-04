/**
 * The judgement half of the storage-key registry: what each key holds, how long it
 * lives, and what a visitor loses when it goes.
 *
 * The keys themselves are **not** written here — they are read out of the source by
 * `src/docs/extract/extract-storage-keys.ts`, and the drift test in
 * `src/tests/docs/storageReference.test.ts` fails in both directions: a key that
 * appears in the code and not here, and a row here whose key no longer exists. So
 * this file only carries what no scanner can know.
 *
 * Which store an entry belongs to is a link, not a copy: the seven stores already
 * document their own persistence in their `guide/reference/state-reference.md`, and
 * per `.claude/rules/documentation.md` §4 one fact lives in one place.
 *
 * Build-time only, like every other manifest here: nothing under `src/` may import it.
 */

/** Which of the two browser stores an entry lives in. */
export type StorageArea = 'sessionStorage' | 'localStorage';

/** The seven documented stores, by the `id` in their `*.state-manifest.ts`. */
export type StoreId =
  | 'attribution'
  | 'campaign'
  | 'cart'
  | 'checkout'
  | 'config'
  | 'order'
  | 'parameter';

/** Section a key is filed under, so the page reads by subject rather than by name. */
export type StorageGroupId =
  | 'cart'
  | 'campaign'
  | 'order'
  | 'checkout'
  | 'attribution'
  | 'preferences'
  | 'analytics'
  | 'reference-data'
  | 'page-behaviour'
  | 'debug'
  | 'unused';

export interface StorageGroup {
  id: StorageGroupId;
  title: string;
  /** One or two sentences: what this family of keys is for. */
  intro: string;
}

export const STORAGE_GROUPS: StorageGroup[] = [
  {
    id: 'cart',
    title: 'Cart and pricing',
    intro:
      'What the visitor has selected and what it costs. Losing anything here empties or re-prices the cart in front of them, so these are the keys to be most careful with.',
  },
  {
    id: 'campaign',
    title: 'Campaign catalog cache',
    intro:
      'A copy of the campaign — its packages, prices and currency — so a second page load does not wait on the API. Losing it costs a network round trip, never data.',
  },
  {
    id: 'order',
    title: 'Order and post-purchase',
    intro:
      'The completed order, kept only long enough for the upsell and receipt pages to read it.',
  },
  {
    id: 'checkout',
    title: 'Checkout and abandoned cart',
    intro:
      'Half-finished checkout state. Card details are deliberately absent — the checkout store filters them out before writing.',
  },
  {
    id: 'attribution',
    title: 'Attribution and funnel',
    intro:
      'Where the visitor came from. These are the values attached to the order, so an affiliate or ad network can match the conversion. Losing one does not break the page — it silently breaks someone getting paid.',
  },
  {
    id: 'preferences',
    title: 'Currency, country and locale',
    intro:
      'The country and currency the visitor is shopping in, kept so every page in the funnel agrees. A visitor who pays in EUR must not see USD on the upsell page.',
  },
  {
    id: 'analytics',
    title: 'Analytics session and queued events',
    intro:
      'Session identity, event ordering, and events parked across a redirect. Nothing here is read by the page itself — it only affects what downstream reporting sees.',
  },
  {
    id: 'reference-data',
    title: 'Country reference data',
    intro:
      'Country lists, states and address-format rules fetched from the countries service. Slow-changing, so cached for an hour in localStorage rather than per session.',
  },
  {
    id: 'page-behaviour',
    title: 'Page behaviour',
    intro:
      'One-shot page state — a countdown that must not restart on navigation, a popup that must not fire twice.',
  },
  {
    id: 'debug',
    title: 'Debug overlay',
    intro:
      'Written only when the debug overlay is open (`?debug=true`). Never present on a visitor page, and safe to clear at any time.',
  },
  {
    id: 'unused',
    title: 'Declared but never used',
    intro:
      'A key that exists in the source and is never read or written. Listed so nobody spends an afternoon looking for it in devtools.',
  },
];

/** What a key holds and what it costs to lose. Everything a scan cannot tell you. */
export interface StorageKeyDoc {
  /**
   * The key as a reader sees it, with varying parts named — `upsells_{orderId}`.
   * The drift test compares this against the extracted key with token *names*
   * ignored, so naming the token for the reader is free.
   */
  key: string;
  /** Concrete keys to match against devtools, when the pattern is not obvious. */
  examples?: string[];
  group: StorageGroupId;
  /**
   * The expiry window in words, or `null` when the code applies none — the renderer
   * fills in the natural lifetime of the store in that case, so no row repeats
   * "until the tab closes".
   */
  ttl: string | null;
  /** The {@link ExpiryMechanism.name} that enforces `ttl`. */
  ttlMechanism?: string;
  /** One sentence: what is inside, in product terms. */
  holds: string;
  /** What the visitor experiences if this entry disappears. */
  clearing: string;
  /** The store behind it, when one is. Rendered as a link to its reference. */
  store?: StoreId;
  /**
   * How that store relates to the key, because "a store is behind it" is three
   * different things: Zustand `persist` writes the whole store here, the store caches
   * to it by hand, or the store writes it on the side next to its own persist key.
   * A reader who assumes the first will look for the value in the wrong shape.
   */
  storeRelation?: 'persist-key' | 'manual-cache' | 'side-write';
  /** A trap worth naming. Say the symptom and the fix, not only the risk. */
  notes?: string;
}

export const STORAGE_KEYS_DOC: StorageKeyDoc[] = [
  // ── Cart and pricing ──────────────────────────────────────────────────────
  {
    key: 'next-cart-state',
    group: 'cart',
    store: 'cart',
    storeRelation: 'persist-key',
    ttl: null,
    holds:
      'The cart the visitor has built: selected packages, quantities, applied vouchers and the chosen shipping method.',
    clearing:
      'The cart reads as empty on the next page and the visitor has to reselect everything. This is the one key whose loss a visitor definitely notices.',
    notes:
      "Only the six fields in the store's `partialize` list are written. A field you added and expected back after a refresh is not here — check the cart state reference before assuming storage lost it.",
  },
  {
    key: 'next-price-{hash}',
    examples: ['next-price-4f3a1c…'],
    group: 'cart',
    ttl: '10 minutes',
    ttlMechanism: '`BUNDLE_PRICE_CACHE_TTL_MS`',
    holds:
      'A priced bundle keyed by a SHA-1 of its packages, quantities, currency, vouchers and API key, so a page showing the same bundle twice prices it once.',
    clearing:
      'The next bundle price is fetched from the API instead of read locally — slower by one request, never wrong.',
    notes:
      "The hash covers the API key, so switching API keys never reuses another account's prices. Entries are written per bundle and never swept, so a page that prices many bundles leaves many entries behind; they die with the tab.",
  },

  // ── Campaign catalog cache ────────────────────────────────────────────────
  {
    key: 'next-campaign-cache_{currency}',
    examples: ['next-campaign-cache_USD', 'next-campaign-cache_EUR'],
    group: 'campaign',
    store: 'campaign',
    storeRelation: 'manual-cache',
    ttl: '10 minutes from the moment the campaign was fetched',
    ttlMechanism: '`CACHE_EXPIRY_MS`',
    holds:
      'The campaign payload — every package, price and product name — for one currency, alongside the API key it was fetched with.',
    clearing:
      'The next page load refetches the campaign. Prices and names appear a beat later; nothing the visitor entered is lost.',
    notes:
      'An entry whose stored API key differs from the current one is ignored rather than reused, so a cache hit you were counting on can silently not happen after an API-key change.',
  },
  {
    key: 'next-campaign-cache_USD',
    group: 'campaign',
    store: 'campaign',
    storeRelation: 'manual-cache',
    ttl: '10 minutes',
    ttlMechanism: '`CACHE_EXPIRY_MS`',
    holds:
      'Nothing of its own — it is the `{currency}` entry for USD, named explicitly because the loader falls back to reading USD when the requested currency has no cached entry.',
    clearing:
      'The fallback misses and the campaign is refetched in the requested currency.',
  },
  {
    key: 'next-campaign-cache',
    group: 'campaign',
    ttl: null,
    holds:
      'Nothing. No code writes it. It is a pre-currency-suffix key that `clearCache()` still deletes so an old tab does not keep a stale entry forever.',
    clearing: 'No effect.',
  },

  // ── Order and post-purchase ───────────────────────────────────────────────
  {
    key: 'next-order',
    group: 'order',
    store: 'order',
    storeRelation: 'persist-key',
    ttl: '15 minutes from when the order was loaded',
    ttlMechanism: '`EXPIRY_TIME` (order store)',
    holds:
      'The completed order — its number, ref id, lines and totals — so upsell and receipt pages can render it without refetching.',
    clearing:
      'Upsell and receipt pages have no order to show and fall back to fetching by `ref_id` from the URL. Without that parameter they render empty.',
    notes:
      'The window is checked on rehydrate, not on a timer. A tab left open for an hour still holds the entry in storage; the store discards it the next time the page loads.',
  },
  {
    key: 'upsells_{orderId}',
    examples: ['upsells_4821-9930-1176'],
    group: 'order',
    ttl: null,
    holds:
      'How many post-purchase upsells have been accepted for that order, so each upsell analytics event carries the right position number.',
    clearing:
      'The next accepted upsell is reported as the first one, so funnel reports understate how deep the upsell path went. The visitor sees nothing.',
  },

  // ── Checkout and abandoned cart ───────────────────────────────────────────
  {
    key: 'next-checkout-store',
    group: 'checkout',
    store: 'checkout',
    storeRelation: 'persist-key',
    ttl: null,
    holds:
      'The checkout form as the visitor left it — name, email, address, shipping choice — minus anything transient.',
    clearing:
      'The form comes back blank and the visitor retypes their address.',
    notes:
      "Card data is excluded by the store's `partialize`, and that is the point of the filter. Never add a field carrying payment details to it.",
  },
  {
    key: 'next_prospect_cart',
    group: 'checkout',
    ttl: 'whatever `expires_at` the API returned with the cart',
    ttlMechanism: 'prospect cart `expires_at`',
    holds:
      'The abandoned-cart record created once a visitor typed an email, including the checkout URL that can be emailed back to them.',
    clearing:
      'A fresh prospect cart is created the next time they type an email, and the earlier abandoned-cart link stops matching this visitor.',
  },
  {
    key: 'next-shown-order-warnings',
    group: 'checkout',
    ttl: null,
    holds:
      'The `ref_id`s of orders whose "you have already paid" modal has been shown, so returning to the checkout does not warn twice.',
    clearing:
      'The duplicate-purchase warning shows again for an order the visitor already acknowledged. Harmless, mildly confusing.',
  },
  {
    key: 'next_utm_data',
    group: 'checkout',
    ttl: null,
    holds:
      'UTM parameters gathered on earlier pages, merged into the prospect cart so an abandoned-cart email knows which campaign produced it.',
    clearing:
      'The abandoned-cart record is created without campaign source, so that recovery is unattributed.',
  },

  // ── Attribution and funnel ────────────────────────────────────────────────
  {
    key: 'next-attribution',
    group: 'attribution',
    store: 'attribution',
    storeRelation: 'persist-key',
    ttl: null,
    holds:
      'The whole attribution store — every `utm_*` tag, affiliate and sub-affiliate id, click id and funnel name that will be attached to the order.',
    clearing:
      'The order is submitted with no attribution, so the affiliate or ad network cannot match the conversion. The visitor sees a completely normal checkout, which is what makes this one expensive to miss.',
    notes:
      "Written to **sessionStorage only** — the store's `persist` config supplies a custom storage whose `getItem`, `setItem` and `removeItem` all use sessionStorage (`state/attribution/attribution.state.ts`). The collector also reads this name out of **localStorage** in three places (`core/attribution/attribution-collector.ts › AttributionCollector.getStoredValue`, `core/attribution/attribution-collector.ts › AttributionCollector.getFunnelName`, `core/attribution/attribution-collector.ts › AttributionCollector.getFirstVisitTimestamp`), and nothing ever writes it there, so those are dead branches. The consequence that does bite: `first_visit_timestamp` cannot be recovered in a new tab, so returning-visitor logic built on it always reports a first visit. Write your own marker to localStorage if you need truth across tabs.",
  },
  {
    key: 'next_funnel_name',
    group: 'attribution',
    store: 'attribution',
    storeRelation: 'side-write',
    ttl: null,
    holds:
      "The funnel name declared by the page's tracking-tag meta, kept so every later page in the funnel reports the same name.",
    clearing:
      'Orders record no funnel and funnel-level reporting goes blank for that visit. To clear it deliberately, call `useAttributionStore.getState().clearPersistedFunnel()` — it removes both copies.',
    notes:
      'Written to sessionStorage **and** localStorage. The localStorage copy outlives the tab, so a visitor who lands on a second campaign in the same browser can be attributed to the first funnel until something overwrites it.',
  },
  {
    key: 'evclid',
    group: 'attribution',
    ttl: null,
    holds:
      'The Everflow click id, taken from the URL and echoed into storage so it survives navigation to checkout.',
    clearing:
      'The order goes out without the click id and Everflow cannot match the conversion. Nothing is visibly wrong on the page.',
    notes:
      'Written to both stores, and read back from either. Clearing one copy is not clearing it.',
  },
  {
    key: 'tn_tag_{tagName}',
    examples: ['tn_tag_funnel_name', 'tn_tag_offer_id'],
    group: 'attribution',
    ttl: null,
    holds:
      'One value from a `<meta name="data-next-tracking-tag" data-persist="true">` tag, so a tag declared on the landing page is still available at checkout.',
    clearing:
      'That tag is missing from the order metadata unless the current page declares it again.',
  },

  // ── Currency, country and locale ──────────────────────────────────────────
  {
    key: 'next_selected_currency',
    group: 'preferences',
    store: 'config',
    storeRelation: 'side-write',
    ttl: null,
    holds:
      'The currency this visitor is shopping in, whether they chose it, `?currency=` set it, or geo-detection picked it.',
    clearing:
      'The next page redetects the currency. A visitor mid-funnel can watch prices change between pages, and an upsell can be priced in a different currency from the order they already paid for.',
  },
  {
    key: 'next_selected_country',
    group: 'preferences',
    ttl: null,
    holds:
      'The shipping country in force, from the address form, the debug country selector, or `?country=`.',
    clearing:
      'Country falls back to geo-detection, which can disagree with the address the visitor already entered — the state dropdown and postcode rules reset with it.',
  },
  {
    key: 'next_selected_locale',
    group: 'preferences',
    ttl: null,
    holds:
      "The locale used to format prices and numbers, so `1.234,56 €` stays `1.234,56 €` across pages. Written only by the debug overlay's locale picker, and it outranks a campaign's `window.nextConfig.locale` — that is what lets a pinned store be previewed in another locale.",
    clearing:
      "Formatting falls back to the campaign's pinned `locale` when it sets one, and to the browser's own locale otherwise. Amounts stay correct; separators and symbol placement can change mid-funnel.",
  },

  // ── Analytics ─────────────────────────────────────────────────────────────
  {
    key: 'analytics_session_id',
    group: 'analytics',
    ttl: null,
    holds:
      'The session identifier stamped on every analytics event fired from this tab.',
    clearing:
      'A new id is minted and the visit is reported as two sessions, so funnel steps split across them.',
  },
  {
    key: 'analytics_sequence',
    group: 'analytics',
    ttl: null,
    holds:
      'A counter giving each analytics event an ordering number within the tab, so events that arrive out of order can be re-sorted.',
    clearing:
      'Numbering restarts at 1 and a visit looks like it began mid-funnel.',
  },
  {
    key: 'analytics_current_list',
    group: 'analytics',
    ttl: '30 minutes from when the list page was viewed',
    ttlMechanism: '`LIST_EXPIRY_MS`',
    holds:
      'Which collection or list page the visitor last browsed, plus its URL, so an add-to-cart is credited to the list it came from.',
    clearing:
      'The next `add_to_cart` and `purchase` carry no list attribution, so "which collection sells" reporting is blank for that visit.',
  },
  {
    key: 'analytics_list_id',
    group: 'analytics',
    ttl: null,
    holds:
      'The id of the product list the visitor clicked through from, read directly when an item event is built.',
    clearing: 'Item events lose `item_list_id`.',
  },
  {
    key: 'analytics_list_name',
    group: 'analytics',
    ttl: null,
    holds: 'The display name of that same product list.',
    clearing: 'Item events lose `item_list_name`.',
  },
  {
    key: 'analytics_ignore',
    group: 'analytics',
    ttl: null,
    holds:
      'The flag set by `?ignore=true` that suppresses every analytics event from this tab, so internal testing does not pollute reporting.',
    clearing:
      'Analytics starts firing again from this tab. Clear it deliberately with `nextAnalytics.clearIgnoreFlag()` rather than by hand.',
  },
  {
    key: 'next_v2_pending_events',
    group: 'analytics',
    ttl: 'the key never expires; individual queued events older than 5 minutes are dropped when the queue is processed',
    ttlMechanism: 'pending-event staleness check (inline literal)',
    holds:
      'Analytics events parked because a redirect was about to happen — a purchase event queued on the checkout page and fired on the receipt page.',
    clearing:
      'The queued purchase event is never sent, so an order that really happened is missing from reporting. Nothing on the page indicates it.',
  },
  {
    key: 'user_data',
    group: 'analytics',
    ttl: null,
    holds:
      "The visitor's identity fields for analytics — email, phone, name, address — as collected at checkout.",
    clearing:
      'User-data events go out without identity fields until the visitor types them again. A 365-day `next_user_data` cookie holds a second copy, so clearing storage alone does not remove it.',
  },
  {
    key: 'session_id',
    group: 'analytics',
    ttl: null,
    holds:
      'A per-tab id that ties user-data events together. Distinct from `analytics_session_id`, which belongs to the event pipeline.',
    clearing: 'A new id is generated; user-data events split across two ids.',
  },
  {
    key: 'visitor_id',
    group: 'analytics',
    ttl: null,
    holds:
      'A pseudonymous visitor id, generated once and reused so returning visits can be recognised without a login.',
    clearing:
      'The visitor is counted as new on their next visit, inflating new-visitor numbers. This is the only analytics identifier that intentionally outlives the tab.',
  },
  {
    key: 'nextDataLayer_sessionId',
    group: 'analytics',
    ttl: 'refreshed on every event; a gap longer than the session timeout starts a new session',
    ttlMechanism: 'dataLayer `sessionTimeout`',
    holds: 'The data-layer session id pushed with GTM events.',
    clearing:
      'The next event starts a new data-layer session, splitting the visit in GTM-based reporting.',
  },
  {
    key: 'nextDataLayer_sessionStart',
    group: 'analytics',
    ttl: 'rewritten on every event, which is how the rolling session window is measured',
    ttlMechanism: 'dataLayer `sessionTimeout`',
    holds:
      'When the current data-layer session last saw activity. Compared against the session timeout to decide whether to keep or replace the session id.',
    clearing: 'The session id is treated as expired and replaced.',
  },
  {
    key: 'nextDataLayer_userProperties',
    group: 'analytics',
    ttl: null,
    holds:
      'User properties set on the data layer, so they are re-attached on the next page without being recollected.',
    clearing: 'Events go out without user properties until they are set again.',
  },
  {
    key: 'nextDataLayer_debugMode',
    group: 'analytics',
    ttl: null,
    holds:
      'Whether data-layer debug logging is on, and with which options. A developer switch, not visitor data.',
    clearing: 'Debug logging goes quiet. No effect on a visitor.',
  },

  // ── Country reference data ────────────────────────────────────────────────
  {
    key: 'next_country_{cacheKey}',
    examples: ['next_country_location_data', 'next_country_states_US'],
    group: 'reference-data',
    ttl: '1 hour',
    ttlMechanism: '`cacheExpiry` (CountryService)',
    holds:
      'Responses from the countries service: the full country list with the detected country (`location_data`), and per country its states plus its address rules — state label, postcode label and length limits.',
    clearing:
      "The next page refetches. The address form's state dropdown is briefly empty and postcode validation falls back to defaults until the response lands.",
    notes:
      'Written to localStorage, because a country list does not change between sessions. The service also sweeps the same prefix out of sessionStorage, which only ever holds legacy entries from an older version.',
  },
  {
    key: 'next_country_states_{countryCode}',
    examples: ['next_country_states_US', 'next_country_states_GB'],
    group: 'reference-data',
    ttl: '1 hour',
    ttlMechanism: '`cacheExpiry` (CountryService)',
    holds:
      'The same per-country entries as the row above. It is listed separately because `CountryService.clearCountryCache(countryCode)` names this shape explicitly when dropping one country.',
    clearing: "That one country's states and address rules are refetched.",
  },

  // ── Page behaviour ────────────────────────────────────────────────────────
  {
    key: 'next-timer-{persistenceId}',
    examples: ['next-timer-default-timer', 'next-timer-flash-sale'],
    group: 'page-behaviour',
    ttl: null,
    holds:
      'The moment a countdown started, so a timer keeps counting down across page loads instead of restarting at full duration.',
    clearing:
      'The countdown restarts from its full duration — a visitor who watched it reach two minutes sees fifteen again, which undoes the urgency the timer exists for.',
    notes:
      'The timer feature writes this to **localStorage**, so a countdown survives closing the tab. `saveTimerState()` in `core/storage.ts` writes the same prefix to **sessionStorage** and is called from nowhere; do not reach for those helpers expecting them to read what the timer wrote.',
  },
  {
    key: 'next-url-params',
    group: 'page-behaviour',
    store: 'parameter',
    storeRelation: 'persist-key',
    ttl: null,
    holds:
      'The query-string parameters the visitor arrived with, kept for the whole session so a later page can still react to them after they have gone from the address bar.',
    clearing:
      'Pages further down the funnel stop seeing the parameters the visitor landed with, so a variant that was meant to follow them — a hidden banner, a skipped timer — reverts to its default.',
  },
  {
    key: 'next-exit-intent-dismissed',
    group: 'page-behaviour',
    ttl: null,
    holds:
      'That the exit-intent popup has already fired for this session, so leaving the page again does not show it twice.',
    clearing:
      'The popup can fire again in the same session. Annoying rather than broken.',
    notes:
      'The name is overridable via the `sessionStorageKey` option passed to `next.exitIntent({ … })`, so a page running two exit-intent popups can keep them apart. The default is the one listed here.',
  },

  // ── Debug overlay ─────────────────────────────────────────────────────────
  {
    key: 'debug-overlay-expanded',
    group: 'debug',
    ttl: null,
    holds: 'Whether the debug overlay is expanded or collapsed.',
    clearing: 'The overlay opens collapsed next time.',
  },
  {
    key: 'debug-overlay-active-panel',
    group: 'debug',
    ttl: null,
    holds: 'Which debug panel was open — cart, campaign, events, storage.',
    clearing: 'The overlay opens on its default panel.',
  },
  {
    key: 'debug-overlay-active-tab',
    group: 'debug',
    ttl: null,
    holds: 'Which tab inside that panel was selected.',
    clearing: 'The panel opens on its first tab.',
  },
  {
    key: 'debug-mini-cart-visible',
    group: 'debug',
    ttl: null,
    holds: 'Whether the floating mini-cart readout is shown.',
    clearing: 'The mini-cart starts hidden.',
  },
  {
    key: 'debug-mini-cart-height',
    group: 'debug',
    ttl: null,
    holds: 'The height the mini-cart panel was last dragged to, in pixels.',
    clearing: 'The mini-cart returns to its default height.',
  },
  {
    key: 'debug-xray-active',
    group: 'debug',
    ttl: null,
    holds:
      'Whether the x-ray overlay — which outlines every element the SDK has enhanced — is on.',
    clearing: 'X-ray starts off.',
  },
  {
    key: 'debug-events-history',
    group: 'debug',
    ttl: 'cleared wholesale after 2 hours, and only events from the last hour are kept on each read and write',
    ttlMechanism: '`STORAGE_EXPIRY_HOURS`',
    holds:
      'A rolling log of SDK events for the debug timeline, so a reload does not lose the sequence you were reading.',
    clearing:
      'The event timeline starts empty. Events fired before you cleared it are gone — capture what you need before clearing.',
  },
  {
    key: 'debug-events-expiry',
    group: 'debug',
    ttl: 'holds the expiry timestamp for `debug-events-history` rather than having one',
    ttlMechanism: '`STORAGE_EXPIRY_HOURS`',
    holds:
      'The timestamp at which the stored event history should be dropped, rewritten 2 hours ahead each time it lapses.',
    clearing:
      'The next overlay load treats the history as expired and clears it.',
  },
  {
    key: 'debug-events-show-internal',
    group: 'debug',
    ttl: null,
    holds:
      'Whether the timeline shows internal SDK events as well as the public ones.',
    clearing: 'The timeline hides internal events again.',
  },
  {
    key: 'debug-events-view',
    group: 'debug',
    ttl: null,
    holds: 'Which timeline layout was selected — list or grouped.',
    clearing: 'The timeline returns to its default layout.',
  },

  // ── Declared but never used ───────────────────────────────────────────────
  {
    key: 'next-config-state',
    group: 'unused',
    ttl: null,
    holds:
      'Nothing. `CONFIG_STORAGE_KEY` is exported from `core/storage.ts` and no code reads or writes it — the config store has no persistence at all.',
    clearing:
      'Nothing to clear. If you are hunting for a persisted config value, `next_selected_currency` is the one the config store actually mirrors.',
  },
];

/**
 * Every expiry window in the SDK, and the one place each is written.
 *
 * There is no shared TTL constant and no shared expiry helper. Each of these was
 * added next to the code that needed it, which is why "how long does the SDK cache
 * things for" has ten different answers. A reader who assumes one number will get
 * nine of them wrong.
 *
 * Rows are anchored by {@link ExpiryMechanism.evidence} rather than by a line number:
 * the drift test asserts the text is still in the file, so a renamed or deleted
 * constant fails the build while an unrelated edit above it does not.
 */
export interface ExpiryMechanism {
  /** The constant, or a short name when the window is an inline literal. */
  name: string;
  /** Source file, relative to `src/`. */
  file: string;
  /** Text that must still appear in `file` — the anchor the drift test checks. */
  evidence: string;
  /** The window, in words. */
  window: string;
  /** Which keys it governs, and how it is enforced. */
  governs: string;
}

export const EXPIRY_MECHANISMS: ExpiryMechanism[] = [
  {
    name: '`EXPIRY_TIME` (order store)',
    file: 'state/order/order.state.ts',
    evidence: 'const EXPIRY_TIME = 15 * 60 * 1000',
    window: '15 minutes',
    governs:
      '`next-order`. Checked when the store rehydrates, not on a timer — the entry sits in storage until a page load notices it is stale.',
  },
  {
    name: '`CACHE_EXPIRY_MS`',
    file: 'state/campaign/api.slice.ts',
    evidence: 'const CACHE_EXPIRY_MS = 10 * 60 * 1000',
    window: '10 minutes',
    governs:
      '`next-campaign-cache_{currency}`. **Declared twice** — the same value is repeated in `state/campaign/items.slice.ts`, so changing the window means editing both files or the reader and the writer disagree.',
  },
  {
    name: '`BUNDLE_PRICE_CACHE_TTL_MS`',
    file: 'state/cart/cart-calculator.ts',
    evidence: 'const BUNDLE_PRICE_CACHE_TTL_MS = 10 * 60 * 1000',
    window:
      '10 minutes, overridable per call via `options.ttl` (`0` skips the cache)',
    governs:
      '`next-price-{hash}`. The expiry is stored inside each entry as `expiresAt`, so entries written before a change keep the old window.',
  },
  {
    name: '`cacheExpiry` (CountryService)',
    file: 'core/country-service.ts',
    evidence: 'private cacheExpiry = 3600000',
    window: '1 hour',
    governs:
      '`next_country_*`. Checked on read; a stale entry is deleted and refetched rather than served.',
  },
  {
    name: '`LIST_EXPIRY_MS`',
    file: 'core/analytics/tracking/list-attribution-tracker.ts',
    evidence: 'const LIST_EXPIRY_MS = 30 * 60 * 1000',
    window: '30 minutes',
    governs:
      '`analytics_current_list`. Checked when the tracker loads; past the window the entry is removed and attribution starts blank.',
  },
  {
    name: '`STORAGE_EXPIRY_HOURS`',
    file: 'core/debug/panels/event-timeline/event-timeline-panel.persistence.ts',
    evidence: 'STORAGE_EXPIRY_HOURS = 2',
    window:
      '2 hours for the whole log, plus a 1-hour window on individual events',
    governs:
      '`debug-events-history` and `debug-events-expiry`. Two windows stacked: the log is dropped wholesale every 2 hours, and each read and write also filters to events from the last hour.',
  },
  {
    name: 'pending-event staleness check (inline literal)',
    file: 'core/analytics/tracking/pending-events-handler.ts',
    evidence: '5 * 60 * 1000',
    window: '5 minutes, per event',
    governs:
      '`next_v2_pending_events`. An inline literal, not a named constant. The key itself never expires — individual events older than 5 minutes are discarded when the queue is processed.',
  },
  {
    name: 'dataLayer `sessionTimeout`',
    file: 'core/analytics/data-layer-manager.ts',
    evidence: '30 * 60 * 1000',
    window: '30 minutes of inactivity, configurable',
    governs:
      '`nextDataLayer_sessionId` and `nextDataLayer_sessionStart`. Comes from analytics config with an inline default rather than from a constant, so the value you see in the file is only the fallback.',
  },
  {
    name: 'prospect cart `expires_at`',
    file: 'features/checkout/prospect-cart/prospect-cart.enhancer.ts',
    evidence: 'prospectCart.expires_at',
    window: 'whatever the API returned',
    governs:
      '`next_prospect_cart`. The only expiry the SDK does not choose — it is read off the stored payload, so the window can differ per cart.',
  },
  {
    name: '`next_user_data` cookie',
    file: 'core/analytics/user-data-storage.ts',
    evidence: 'cookieExpiryDays = 365',
    window: '365 days',
    governs:
      'Not a storage key at all — a cookie holding the same payload as `user_data`. Listed because clearing sessionStorage does not clear it, and identity fields come straight back.',
  },
];

/**
 * Keys the AST scan cannot name, declared by hand with a source anchor.
 *
 * These exist because the key is a *parameter*: `sessionStorage.setItem(key, value)`
 * inside a helper whose callers pass the real names. Naming them would need call-graph
 * analysis; instead each row carries text that must still be in the file it points at,
 * so the row cannot outlive the code either.
 */
export interface UnscannableStorageKeyDoc extends StorageKeyDoc {
  areas: StorageArea[];
  /** Why the scan cannot see it, in one line. */
  invisibleBecause: string;
  /** Source file, relative to `src/`. */
  file: string;
  /** Text that must still appear in `file`. */
  evidence: string;
}

export const UNSCANNABLE_STORAGE_KEYS: UnscannableStorageKeyDoc[] = [
  {
    key: '{attributionParameter}',
    examples: [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
      'affid',
      'aff',
      'subaffiliate1',
      'sub1',
      'gclid',
      'fbclid',
      'clickid',
    ],
    areas: ['sessionStorage'],
    group: 'attribution',
    ttl: null,
    holds:
      'Each attribution parameter found in the URL, mirrored to storage under its own name so it survives navigation to checkout. Twenty-two names in all: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `affid`, `aff`, `subaffiliate1`–`subaffiliate5`, `sub1`–`sub5`, `gclid`, `fbclid`, `clickid`, `evclid`.',
    clearing:
      'The order goes out with that parameter empty, so the click cannot be credited. The page behaves normally, which is why this is usually noticed in a payout report rather than in QA.',
    invisibleBecause:
      'the write is `sessionStorage.setItem(key, value)` inside `getStoredValue(key)`, and the real names only exist at its call sites',
    file: 'core/attribution/attribution-collector.ts',
    evidence: "this.getStoredValue('utm_source')",
    notes:
      'Read priority is URL, then sessionStorage, then localStorage, then the `next-attribution` blob — so a value can come back from a copy you did not clear. The last step in that chain never resolves: nothing writes `next-attribution` to localStorage. Clear the URL parameter and both stores.',
  },
];
