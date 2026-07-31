---
title: "Core/Reference/Storage Keys"
group: "Core"
category: "Core Reference"
---

# Storage keys

<!-- Generated from the storage-key registry. Do not edit by hand:
     edit src/core/docs/storage-keys.ts, then run `npm run docs:reference`. -->

Every sessionStorage and localStorage entry the SDK reads or writes: what is inside it, how long it lives, and what the visitor loses if it goes. Use it when a cart came back empty, a page is priced in the wrong currency, or an order arrived with no attribution — those are all one storage entry away.

**48 keys are read out of the source**, plus 1 hand-written family that the scan cannot name. The **Lives in** column says which browser store: `session` is gone when the tab closes, `local` survives until something removes it, and a few keys are written to both.

## There is no shared expiry mechanism

Do not go looking for one TTL constant — there is no such thing, and no shared expiry helper either. **10 independent windows** exist, each written next to the code that needed it. They range from 5 minutes to 365 days, and two of them are inline literals rather than named constants.

| Window | Where it is written | Governs |
|---|---|---|
| 15 minutes | `EXPIRY_TIME` (order store)<br><sub>state/order.state.ts</sub> | `next-order`. Checked when the store rehydrates, not on a timer — the entry sits in storage until a page load notices it is stale. |
| 10 minutes | `CACHE_EXPIRY_MS`<br><sub>state/campaign/api.slice.ts</sub> | `next-campaign-cache_{currency}`. **Declared twice** — the same value is repeated in `state/campaign/items.slice.ts`, so changing the window means editing both files or the reader and the writer disagree. |
| 10 minutes, overridable per call via `options.ttl` (`0` skips the cache) | `BUNDLE_PRICE_CACHE_TTL_MS`<br><sub>state/cart/cart-calculator.ts</sub> | `next-price-{hash}`. The expiry is stored inside each entry as `expiresAt`, so entries written before a change keep the old window. |
| 1 hour | `cacheExpiry` (CountryService)<br><sub>core/country-service.ts</sub> | `next_country_*`. Checked on read; a stale entry is deleted and refetched rather than served. |
| 30 minutes | `LIST_EXPIRY_MS`<br><sub>core/analytics/tracking/ListAttributionTracker.ts</sub> | `analytics_current_list`. Checked when the tracker loads; past the window the entry is removed and attribution starts blank. |
| 2 hours for the whole log, plus a 1-hour window on individual events | `STORAGE_EXPIRY_HOURS`<br><sub>core/debug/panels/EventTimelinePanel.ts</sub> | `debug-events-history` and `debug-events-expiry`. Two windows stacked: the log is dropped wholesale every 2 hours, and each read and write also filters to events from the last hour. |
| 5 minutes, per event | pending-event staleness check (inline literal)<br><sub>core/analytics/tracking/PendingEventsHandler.ts</sub> | `next_v2_pending_events`. An inline literal, not a named constant. The key itself never expires — individual events older than 5 minutes are discarded when the queue is processed. |
| 30 minutes of inactivity, configurable | dataLayer `sessionTimeout`<br><sub>core/analytics/DataLayerManager.ts</sub> | `nextDataLayer_sessionId` and `nextDataLayer_sessionStart`. Comes from analytics config with an inline default rather than from a constant, so the value you see in the file is only the fallback. |
| whatever the API returned | prospect cart `expires_at`<br><sub>features/checkout/prospect-cart.enhancer.ts</sub> | `next_prospect_cart`. The only expiry the SDK does not choose — it is read off the stored payload, so the window can differ per cart. |
| 365 days | `next_user_data` cookie<br><sub>core/analytics/userDataStorage.ts</sub> | Not a storage key at all — a cookie holding the same payload as `user_data`. Listed because clearing sessionStorage does not clear it, and identity fields come straight back. |

The practical consequence: changing "how long the SDK caches things" is never a one-line edit. Change the window a key needs, in the file that owns it, and update its row here in the same change.

## Matching what you see in devtools

These keys are built at runtime, so the name in storage is never the name in the source. Match the fixed part and read the rest as the variable:

| Pattern in the source | A real entry looks like |
|---|---|
| `next-price-{hash}` | `next-price-4f3a1c…` |
| `next-campaign-cache_{currency}` | `next-campaign-cache_USD`, `next-campaign-cache_EUR` |
| `upsells_{orderId}` | `upsells_4821-9930-1176` |
| `tn_tag_{tagName}` | `tn_tag_funnel_name`, `tn_tag_offer_id` |
| `next_country_{cacheKey}` | `next_country_location_data`, `next_country_states_US` |
| `next_country_states_{countryCode}` | `next_country_states_US`, `next_country_states_GB` |
| `next-timer-{persistenceId}` | `next-timer-default-timer`, `next-timer-flash-sale` |

Everything else in this page is a literal key you can search for as written.

## Which keys have a store behind them

9 of these entries have one of the seven documented stores behind them, and that store is the place to read about the shape inside — this page does not repeat their schemas. How the store relates to the key differs, and the difference decides what you find in the value:

| Key | Store | How the store uses it |
|---|---|---|
| `next-cart-state` | [`cart`](../../../state/cart/guide/reference/state-reference.md) | Zustand `persist` writes the whole store here, so the value is the store's own shape (minus anything its `partialize` drops). |
| `next-campaign-cache_{currency}` | [`campaign`](../../../state/campaign/guide/reference/state-reference.md) | The store caches to it by hand — no `persist` involved — so the value is a fixed cache envelope, not the store's shape. |
| `next-campaign-cache_USD` | [`campaign`](../../../state/campaign/guide/reference/state-reference.md) | The store caches to it by hand — no `persist` involved — so the value is a fixed cache envelope, not the store's shape. |
| `next-order` | [`order`](../../../state/order/guide/reference/state-reference.md) | Zustand `persist` writes the whole store here, so the value is the store's own shape (minus anything its `partialize` drops). |
| `next-checkout-store` | [`checkout`](../../../state/checkout/guide/reference/state-reference.md) | Zustand `persist` writes the whole store here, so the value is the store's own shape (minus anything its `partialize` drops). |
| `next-attribution` | [`attribution`](../../../state/attribution/guide/reference/state-reference.md) | Zustand `persist` writes the whole store here, so the value is the store's own shape (minus anything its `partialize` drops). |
| `next_funnel_name` | [`attribution`](../../../state/attribution/guide/reference/state-reference.md) | The store writes this alongside its own persist key, so the value is a single bare value rather than a store snapshot. |
| `next_selected_currency` | [`config`](../../../state/config/guide/reference/state-reference.md) | The store writes this alongside its own persist key, so the value is a single bare value rather than a store snapshot. |
| `next-url-params` | [`parameter`](../../../state/parameter/guide/reference/state-reference.md) | Zustand `persist` writes the whole store here, so the value is the store's own shape (minus anything its `partialize` drops). |

The rest are written by core services — attribution, analytics, the country service, the boot sequence — with no store behind them. Nothing reactive watches those: a value written there does not notify anything, so code that needs to react has to read it at the moment it needs it.

## The keys

### Cart and pricing

What the visitor has selected and what it costs. Losing anything here empties or re-prices the cart in front of them, so these are the keys to be most careful with.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next-cart-state`<br><sub>core/sdk-initializer.ts:1038 +2 more</sub> | `session` | none — gone when the tab closes | The cart the visitor has built: selected packages, quantities, applied vouchers and the chosen shipping method.<br><br>**Clearing it:** The cart reads as empty on the next page and the visitor has to reselect everything. This is the one key whose loss a visitor definitely notices.<br><br>Store: [`cart`](../../../state/cart/guide/reference/state-reference.md).<br><br>⚠️ Only the six fields in the store's `partialize` list are written. A field you added and expected back after a refresh is not here — check the cart state reference before assuming storage lost it. |
| `next-price-{hash}`<br>e.g. `next-price-4f3a1c…`<br><sub>state/cart/cart-calculator.ts:247 +1 more</sub> | `session` | 10 minutes<br>via `BUNDLE_PRICE_CACHE_TTL_MS` | A priced bundle keyed by a SHA-1 of its packages, quantities, currency, vouchers and API key, so a page showing the same bundle twice prices it once.<br><br>**Clearing it:** The next bundle price is fetched from the API instead of read locally — slower by one request, never wrong.<br><br>⚠️ The hash covers the API key, so switching API keys never reuses another account's prices. Entries are written per bundle and never swept, so a page that prices many bundles leaves many entries behind; they die with the tab. |

### Campaign catalog cache

A copy of the campaign — its packages, prices and currency — so a second page load does not wait on the API. Losing it costs a network round trip, never data.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next-campaign-cache_{currency}`<br>e.g. `next-campaign-cache_USD`, `next-campaign-cache_EUR`<br><sub>state/campaign/api.slice.ts:190 +4 more</sub> | `session` | 10 minutes from the moment the campaign was fetched<br>via `CACHE_EXPIRY_MS` | The campaign payload — every package, price and product name — for one currency, alongside the API key it was fetched with.<br><br>**Clearing it:** The next page load refetches the campaign. Prices and names appear a beat later; nothing the visitor entered is lost.<br><br>Store: [`campaign`](../../../state/campaign/guide/reference/state-reference.md).<br><br>⚠️ An entry whose stored API key differs from the current one is ignored rather than reused, so a cache hit you were counting on can silently not happen after an API-key change. |
| `next-campaign-cache_USD`<br><sub>state/campaign/api.slice.ts:54</sub> | `session` | 10 minutes<br>via `CACHE_EXPIRY_MS` | Nothing of its own — it is the `{currency}` entry for USD, named explicitly because the loader falls back to reading USD when the requested currency has no cached entry.<br><br>**Clearing it:** The fallback misses and the campaign is refetched in the requested currency.<br><br>Store: [`campaign`](../../../state/campaign/guide/reference/state-reference.md). |
| `next-campaign-cache`<br><sub>core/storage.ts:147 +1 more</sub> | `session` | none — gone when the tab closes | Nothing. No code writes it. It is a pre-currency-suffix key that `clearCache()` still deletes so an old tab does not keep a stale entry forever.<br><br>**Clearing it:** No effect. |

### Order and post-purchase

The completed order, kept only long enough for the upsell and receipt pages to read it.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next-order`<br><sub>features/checkout/checkout-form.enhancer.ts:1722 +1 more</sub> | `session` | 15 minutes from when the order was loaded<br>via `EXPIRY_TIME` (order store) | The completed order — its number, ref id, lines and totals — so upsell and receipt pages can render it without refetching.<br><br>**Clearing it:** Upsell and receipt pages have no order to show and fall back to fetching by `ref_id` from the URL. Without that parameter they render empty.<br><br>Store: [`order`](../../../state/order/guide/reference/state-reference.md).<br><br>⚠️ The window is checked on rehydrate, not on a timer. A tab left open for an hour still holds the entry in storage; the store discards it the next time the page loads. |
| `upsells_{orderId}`<br>e.g. `upsells_4821-9930-1176`<br><sub>core/analytics/tracking/AutoEventListener.ts:372 +2 more</sub> | `session` | none — gone when the tab closes | How many post-purchase upsells have been accepted for that order, so each upsell analytics event carries the right position number.<br><br>**Clearing it:** The next accepted upsell is reported as the first one, so funnel reports understate how deep the upsell path went. The visitor sees nothing. |

### Checkout and abandoned cart

Half-finished checkout state. Card details are deliberately absent — the checkout store filters them out before writing.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next-checkout-store`<br><sub>state/checkout.state.ts:163</sub> | `session` | none — gone when the tab closes | The checkout form as the visitor left it — name, email, address, shipping choice — minus anything transient.<br><br>**Clearing it:** The form comes back blank and the visitor retypes their address.<br><br>Store: [`checkout`](../../../state/checkout/guide/reference/state-reference.md).<br><br>⚠️ Card data is excluded by the store's `partialize`, and that is the point of the filter. Never add a field carrying payment details to it. |
| `next_prospect_cart`<br><sub>features/checkout/prospect-cart.enhancer.ts:420 +5 more</sub> | `session` | whatever `expires_at` the API returned with the cart<br>via prospect cart `expires_at` | The abandoned-cart record created once a visitor typed an email, including the checkout URL that can be emailed back to them.<br><br>**Clearing it:** A fresh prospect cart is created the next time they type an email, and the earlier abandoned-cart link stops matching this visitor. |
| `next-shown-order-warnings`<br><sub>features/checkout/checkout-form.enhancer.ts:1733 +1 more</sub> | `session` | none — gone when the tab closes | The `ref_id`s of orders whose "you have already paid" modal has been shown, so returning to the checkout does not warn twice.<br><br>**Clearing it:** The duplicate-purchase warning shows again for an order the visitor already acknowledged. Harmless, mildly confusing. |
| `next_utm_data`<br><sub>features/checkout/prospect-cart.enhancer.ts:652 +1 more</sub> | `session` | none — gone when the tab closes | UTM parameters gathered on earlier pages, merged into the prospect cart so an abandoned-cart email knows which campaign produced it.<br><br>**Clearing it:** The abandoned-cart record is created without campaign source, so that recovery is unattributed. |

### Attribution and funnel

Where the visitor came from. These are the values attached to the order, so an affiliate or ad network can match the conversion. Losing one does not break the page — it silently breaks someone getting paid.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next-attribution`<br><sub>core/attribution/attribution-collector.ts:143 +3 more</sub> | `session` + `local` | none — the `session` copy dies with the tab, the `local` copy does not | The whole attribution store — every `utm_*` tag, affiliate and sub-affiliate id, click id and funnel name that will be attached to the order.<br><br>**Clearing it:** The order is submitted with no attribution, so the affiliate or ad network cannot match the conversion. The visitor sees a completely normal checkout, which is what makes this one expensive to miss.<br><br>Store: [`attribution`](../../../state/attribution/guide/reference/state-reference.md).<br><br>⚠️ Written to **sessionStorage only** — the store's `persist` config supplies a custom storage whose `getItem`, `setItem` and `removeItem` all use sessionStorage (`state/attribution.state.ts:367-379`). The collector also reads this name out of **localStorage** in three places (`core/attribution/attribution-collector.ts:143`, `:230`, `:375`), and nothing ever writes it there, so those are dead branches. The consequence that does bite: `first_visit_timestamp` cannot be recovered in a new tab, so returning-visitor logic built on it always reports a first visit. Write your own marker to localStorage if you need truth across tabs. |
| `next_funnel_name`<br><sub>core/attribution/attribution-collector.ts:190 +17 more</sub> | `session` + `local` | none — the `session` copy dies with the tab, the `local` copy does not | The funnel name declared by the page's tracking-tag meta, kept so every later page in the funnel reports the same name.<br><br>**Clearing it:** Orders record no funnel and funnel-level reporting goes blank for that visit. To clear it deliberately, call `useAttributionStore.getState().clearPersistedFunnel()` — it removes both copies.<br><br>Store: [`attribution`](../../../state/attribution/guide/reference/state-reference.md).<br><br>⚠️ Written to sessionStorage **and** localStorage. The localStorage copy outlives the tab, so a visitor who lands on a second campaign in the same browser can be attributed to the first funnel until something overwrites it. |
| `evclid`<br><sub>core/attribution/attribution-collector.ts:278 +9 more</sub> | `session` + `local` | none — the `session` copy dies with the tab, the `local` copy does not | The Everflow click id, taken from the URL and echoed into storage so it survives navigation to checkout.<br><br>**Clearing it:** The order goes out without the click id and Everflow cannot match the conversion. Nothing is visibly wrong on the page.<br><br>⚠️ Written to both stores, and read back from either. Clearing one copy is not clearing it. |
| `tn_tag_{tagName}`<br>e.g. `tn_tag_funnel_name`, `tn_tag_offer_id`<br><sub>core/attribution/attribution-collector.ts:326</sub> | `session` | none — gone when the tab closes | One value from a `<meta name="data-next-tracking-tag" data-persist="true">` tag, so a tag declared on the landing page is still available at checkout.<br><br>**Clearing it:** That tag is missing from the order metadata unless the current page declares it again. |

### Currency, country and locale

The country and currency the visitor is shopping in, kept so every page in the funnel agrees. A visitor who pays in EUR must not see USD on the upsell page.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next_selected_currency`<br><sub>core/debug/CountrySelector.ts:394 +10 more</sub> | `session` | none — gone when the tab closes | The currency this visitor is shopping in, whether they chose it, `?currency=` set it, or geo-detection picked it.<br><br>**Clearing it:** The next page redetects the currency. A visitor mid-funnel can watch prices change between pages, and an upsell can be priced in a different currency from the order they already paid for.<br><br>Store: [`config`](../../../state/config/guide/reference/state-reference.md). |
| `next_selected_country`<br><sub>core/debug/CountrySelector.ts:353 +10 more</sub> | `session` | none — gone when the tab closes | The shipping country in force, from the address form, the debug country selector, or `?country=`.<br><br>**Clearing it:** Country falls back to geo-detection, which can disagree with the address the visitor already entered — the state dropdown and postcode rules reset with it. |
| `next_selected_locale`<br><sub>core/debug/LocaleSelector.ts:344 +3 more</sub> | `session` | none — gone when the tab closes | The locale used to format prices and numbers, so `1.234,56 €` stays `1.234,56 €` across pages.<br><br>**Clearing it:** Prices format with the browser's own locale instead. Amounts stay correct; separators and symbol placement can change mid-funnel. |

### Analytics session and queued events

Session identity, event ordering, and events parked across a redirect. Nothing here is read by the page itself — it only affects what downstream reporting sees.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `analytics_session_id`<br><sub>core/analytics/events/EventBuilder.ts:230 +1 more</sub> | `session` | none — gone when the tab closes | The session identifier stamped on every analytics event fired from this tab.<br><br>**Clearing it:** A new id is minted and the visit is reported as two sessions, so funnel steps split across them. |
| `analytics_sequence`<br><sub>core/analytics/events/EventBuilder.ts:246 +1 more</sub> | `session` | none — gone when the tab closes | A counter giving each analytics event an ordering number within the tab, so events that arrive out of order can be re-sorted.<br><br>**Clearing it:** Numbering restarts at 1 and a visit looks like it began mid-funnel. |
| `analytics_current_list`<br><sub>core/analytics/tracking/ListAttributionTracker.ts:269 +2 more</sub> | `session` | 30 minutes from when the list page was viewed<br>via `LIST_EXPIRY_MS` | Which collection or list page the visitor last browsed, plus its URL, so an add-to-cart is credited to the list it came from.<br><br>**Clearing it:** The next `add_to_cart` and `purchase` carry no list attribution, so "which collection sells" reporting is blank for that visit. |
| `analytics_list_id`<br><sub>core/analytics/events/EventBuilder.ts:620 +2 more</sub> | `session` | none — gone when the tab closes | The id of the product list the visitor clicked through from, read directly when an item event is built.<br><br>**Clearing it:** Item events lose `item_list_id`. |
| `analytics_list_name`<br><sub>core/analytics/events/EventBuilder.ts:621 +2 more</sub> | `session` | none — gone when the tab closes | The display name of that same product list.<br><br>**Clearing it:** Item events lose `item_list_name`. |
| `analytics_ignore`<br><sub>core/analytics/index.ts:109 +2 more</sub> | `session` | none — gone when the tab closes | The flag set by `?ignore=true` that suppresses every analytics event from this tab, so internal testing does not pollute reporting.<br><br>**Clearing it:** Analytics starts firing again from this tab. Clear it deliberately with `nextAnalytics.clearIgnoreFlag()` rather than by hand. |
| `next_v2_pending_events`<br><sub>core/analytics/tracking/PendingEventsHandler.ts:127 +4 more</sub> | `session` | the key never expires; individual queued events older than 5 minutes are dropped when the queue is processed<br>via pending-event staleness check (inline literal) | Analytics events parked because a redirect was about to happen — a purchase event queued on the checkout page and fired on the receipt page.<br><br>**Clearing it:** The queued purchase event is never sent, so an order that really happened is missing from reporting. Nothing on the page indicates it. |
| `user_data`<br><sub>core/analytics/userDataStorage.ts:147 +2 more</sub> | `session` | none — gone when the tab closes | The visitor's identity fields for analytics — email, phone, name, address — as collected at checkout.<br><br>**Clearing it:** User-data events go out without identity fields until the visitor types them again. A 365-day `next_user_data` cookie holds a second copy, so clearing storage alone does not remove it. |
| `session_id`<br><sub>core/analytics/userDataStorage.ts:122 +1 more</sub> | `session` | none — gone when the tab closes | A per-tab id that ties user-data events together. Distinct from `analytics_session_id`, which belongs to the event pipeline.<br><br>**Clearing it:** A new id is generated; user-data events split across two ids. |
| `visitor_id`<br><sub>core/analytics/userDataStorage.ts:112 +1 more</sub> | `local` | none — stays until something clears it | A pseudonymous visitor id, generated once and reused so returning visits can be recognised without a login.<br><br>**Clearing it:** The visitor is counted as new on their next visit, inflating new-visitor numbers. This is the only analytics identifier that intentionally outlives the tab. |
| `nextDataLayer_sessionId`<br><sub>core/analytics/DataLayerManager.ts:334 +1 more</sub> | `local` | refreshed on every event; a gap longer than the session timeout starts a new session<br>via dataLayer `sessionTimeout` | The data-layer session id pushed with GTM events.<br><br>**Clearing it:** The next event starts a new data-layer session, splitting the visit in GTM-based reporting. |
| `nextDataLayer_sessionStart`<br><sub>core/analytics/DataLayerManager.ts:335 +2 more</sub> | `local` | rewritten on every event, which is how the rolling session window is measured<br>via dataLayer `sessionTimeout` | When the current data-layer session last saw activity. Compared against the session timeout to decide whether to keep or replace the session id.<br><br>**Clearing it:** The session id is treated as expired and replaced. |
| `nextDataLayer_userProperties`<br><sub>core/analytics/DataLayerManager.ts:175 +1 more</sub> | `local` | none — stays until something clears it | User properties set on the data layer, so they are re-attached on the next page without being recollected.<br><br>**Clearing it:** Events go out without user properties until they are set again. |
| `nextDataLayer_debugMode`<br><sub>core/analytics/DataLayerManager.ts:145 +1 more</sub> | `local` | none — stays until something clears it | Whether data-layer debug logging is on, and with which options. A developer switch, not visitor data.<br><br>**Clearing it:** Debug logging goes quiet. No effect on a visitor. |

### Country reference data

Country lists, states and address-format rules fetched from the countries service. Slow-changing, so cached for an hour in localStorage rather than per session.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next_country_{cacheKey}`<br>e.g. `next_country_location_data`, `next_country_states_US`<br><sub>core/country-service.ts:370 +2 more</sub> | `session` + `local` | 1 hour<br>via `cacheExpiry` (CountryService) | Responses from the countries service: the full country list with the detected country (`location_data`), and per country its states plus its address rules — state label, postcode label and length limits.<br><br>**Clearing it:** The next page refetches. The address form's state dropdown is briefly empty and postcode validation falls back to defaults until the response lands.<br><br>⚠️ Written to localStorage, because a country list does not change between sessions. The service also sweeps the same prefix out of sessionStorage, which only ever holds legacy entries from an older version. |
| `next_country_states_{countryCode}`<br>e.g. `next_country_states_US`, `next_country_states_GB`<br><sub>core/country-service.ts:354 +1 more</sub> | `session` + `local` | 1 hour<br>via `cacheExpiry` (CountryService) | The same per-country entries as the row above. It is listed separately because `CountryService.clearCountryCache(countryCode)` names this shape explicitly when dropping one country.<br><br>**Clearing it:** That one country's states and address rules are refetched. |

### Page behaviour

One-shot page state — a countdown that must not restart on navigation, a popup that must not fire twice.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next-timer-{persistenceId}`<br>e.g. `next-timer-default-timer`, `next-timer-flash-sale`<br><sub>core/storage.ts:161 +5 more</sub> | `session` + `local` | none — the `session` copy dies with the tab, the `local` copy does not | The moment a countdown started, so a timer keeps counting down across page loads instead of restarting at full duration.<br><br>**Clearing it:** The countdown restarts from its full duration — a visitor who watched it reach two minutes sees fifteen again, which undoes the urgency the timer exists for.<br><br>⚠️ The timer feature writes this to **localStorage**, so a countdown survives closing the tab. `saveTimerState()` in `core/storage.ts` writes the same prefix to **sessionStorage** and is called from nowhere; do not reach for those helpers expecting them to read what the timer wrote. |
| `next-url-params`<br><sub>state/parameter.state.ts:150</sub> | `session` | none — gone when the tab closes | The query-string parameters the visitor arrived with, kept for the whole session so a later page can still react to them after they have gone from the address bar.<br><br>**Clearing it:** Pages further down the funnel stop seeing the parameters the visitor landed with, so a variant that was meant to follow them — a hidden banner, a skipped timer — reverts to its default.<br><br>Store: [`parameter`](../../../state/parameter/guide/reference/state-reference.md). |
| `next-exit-intent-dismissed`<br><sub>features/behavior/simple-exit-intent.enhancer.ts:137 +2 more</sub> | `session` | none — gone when the tab closes | That the exit-intent popup has already fired for this session, so leaving the page again does not show it twice.<br><br>**Clearing it:** The popup can fire again in the same session. Annoying rather than broken.<br><br>⚠️ The name is overridable via the `sessionStorageKey` option passed to `next.exitIntent({ … })`, so a page running two exit-intent popups can keep them apart. The default is the one listed here. |

### Debug overlay

Written only when the debug overlay is open (`?debug=true`). Never present on a visitor page, and safe to clear at any time.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `debug-overlay-expanded`<br><sub>core/debug/DebugOverlay.ts:396 +1 more</sub> | `local` | none — stays until something clears it | Whether the debug overlay is expanded or collapsed.<br><br>**Clearing it:** The overlay opens collapsed next time. |
| `debug-overlay-active-panel`<br><sub>core/debug/DebugOverlay.ts:444 +2 more</sub> | `local` | none — stays until something clears it | Which debug panel was open — cart, campaign, events, storage.<br><br>**Clearing it:** The overlay opens on its default panel. |
| `debug-overlay-active-tab`<br><sub>core/debug/DebugOverlay.ts:445 +2 more</sub> | `local` | none — stays until something clears it | Which tab inside that panel was selected.<br><br>**Clearing it:** The panel opens on its first tab. |
| `debug-mini-cart-visible`<br><sub>core/debug/DebugOverlay.ts:186 +2 more</sub> | `local` | none — stays until something clears it | Whether the floating mini-cart readout is shown.<br><br>**Clearing it:** The mini-cart starts hidden. |
| `debug-mini-cart-height`<br><sub>core/debug/DebugOverlay.ts:1005 +1 more</sub> | `local` | none — stays until something clears it | The height the mini-cart panel was last dragged to, in pixels.<br><br>**Clearing it:** The mini-cart returns to its default height. |
| `debug-xray-active`<br><sub>core/debug/XrayStyles.ts:463 +2 more</sub> | `local` | none — stays until something clears it | Whether the x-ray overlay — which outlines every element the SDK has enhanced — is on.<br><br>**Clearing it:** X-ray starts off. |
| `debug-events-history`<br><sub>core/debug/panels/EventTimelinePanel.ts:234 +6 more</sub> | `local` | cleared wholesale after 2 hours, and only events from the last hour are kept on each read and write<br>via `STORAGE_EXPIRY_HOURS` | A rolling log of SDK events for the debug timeline, so a reload does not lose the sequence you were reading.<br><br>**Clearing it:** The event timeline starts empty. Events fired before you cleared it are gone — capture what you need before clearing. |
| `debug-events-expiry`<br><sub>core/debug/panels/EventTimelinePanel.ts:260 +3 more</sub> | `local` | holds the expiry timestamp for `debug-events-history` rather than having one<br>via `STORAGE_EXPIRY_HOURS` | The timestamp at which the stored event history should be dropped, rewritten 2 hours ahead each time it lapses.<br><br>**Clearing it:** The next overlay load treats the history as expired and clears it. |
| `debug-events-show-internal`<br><sub>core/debug/panels/EventTimelinePanel.ts:219 +1 more</sub> | `local` | none — stays until something clears it | Whether the timeline shows internal SDK events as well as the public ones.<br><br>**Clearing it:** The timeline hides internal events again. |
| `debug-events-view`<br><sub>core/debug/panels/EventTimelinePanel.ts:227 +1 more</sub> | `local` | none — stays until something clears it | Which timeline layout was selected — list or grouped.<br><br>**Clearing it:** The timeline returns to its default layout. |

### Declared but never used

A key that exists in the source and is never read or written. Listed so nobody spends an afternoon looking for it in devtools.

| Key | Lives in | Expires | What it holds |
|---|---|---|---|
| `next-config-state`<br><sub>core/storage.ts:146</sub> | — never written | n/a | Nothing. `CONFIG_STORAGE_KEY` is exported from `core/storage.ts` and no code reads or writes it — the config store has no persistence at all.<br><br>**Clearing it:** Nothing to clear. If you are hunting for a persisted config value, `next_selected_currency` is the one the config store actually mirrors. |

## Keys the scan cannot name

Every key above is read out of the source, so a key that leaves the code loses its row automatically. These ones cannot be: the key is a function parameter, and only the callers know the real names. They are written by hand and anchored to a line of source the drift test checks, so they cannot outlive the code either.

| Key | Lives in | Expires | What it holds | Why it is hand-written |
|---|---|---|---|---|
| `{attributionParameter}`<br>e.g. `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `affid`, `aff`, `subaffiliate1`, `sub1`, `gclid`, `fbclid`, `clickid` | `session` | none — gone when the tab closes | Each attribution parameter found in the URL, mirrored to storage under its own name so it survives navigation to checkout. Twenty-two names in all: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `affid`, `aff`, `subaffiliate1`–`subaffiliate5`, `sub1`–`sub5`, `gclid`, `fbclid`, `clickid`, `evclid`.<br><br>**Clearing it:** The order goes out with that parameter empty, so the click cannot be credited. The page behaves normally, which is why this is usually noticed in a payout report rather than in QA.<br><br>⚠️ Read priority is URL, then sessionStorage, then localStorage, then the `next-attribution` blob — so a value can come back from a copy you did not clear. The last step in that chain never resolves: nothing writes `next-attribution` to localStorage. Clear the URL parameter and both stores. | the write is `sessionStorage.setItem(key, value)` inside `getStoredValue(key)`, and the real names only exist at its call sites<br><sub>core/attribution/attribution-collector.ts</sub> |

## Cautions

- **Renaming a key silently resets live sessions.** A cart mid-funnel is keyed by the old name, so the rename reads as an empty cart with no error anywhere. Add a new key and migrate on read; never rename one in place.
- **A key written to both stores is not cleared by clearing one.** `evclid` and `next_funnel_name` are each written to sessionStorage *and* localStorage, and the attribution collector reads whichever it finds first. Symptom: you cleared the value, reloaded, and it came back. Fix: clear both, or call the store action that does (`clearPersistedFunnel()`). Note that `next-attribution` is **not** in this group — it is sessionStorage only, and the collector's localStorage reads of that name are dead branches nothing writes.
- **`SDKInitializer.clearAllStorage()` clears less than its name promises.** It sweeps keys starting `next-` or `_next` from both stores — which means every key using an **underscore** after `next` survives: `next_selected_currency`, `next_selected_country`, `next_selected_locale`, `next_funnel_name`, `next_prospect_cart`, `next_utm_data`, `next_v2_pending_events`, `next_country_*` and `nextDataLayer_*`. So do `analytics_*`, `visitor_id`, `user_data`, `session_id`, `evclid`, `tn_tag_*`, `upsells_*` and every `debug-*` key. Symptom: you "cleared all storage" and the page still comes up in EUR. Fix: for a genuinely clean first visit, clear both stores in devtools rather than calling this.
- **Expiry is checked on read, never on a timer.** A stale entry sits in storage until something looks at it. Reading storage directly in devtools therefore shows entries the SDK already considers dead — trust the timestamp inside the value, not its presence.
- **Two keys named `session_id` and `analytics_session_id` are different sessions.** One belongs to the user-data collector, one to the event pipeline, and they change at different moments. Do not correlate them.
- **The 365-day `next_user_data` cookie mirrors `user_data`.** Clearing sessionStorage does not remove identity fields; they reappear from the cookie on the next page. Clear cookies too when testing a fresh visitor.
