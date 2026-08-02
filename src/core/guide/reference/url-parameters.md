---
title: "Core/Reference/URL Parameters"
group: "Core"
category: "Core Reference"
---

# URL Parameters

<!-- Generated from the core contract lists. Do not edit by hand:
     edit src/docs/content/url-parameters.ts, then run `npm run docs:reference`. -->

The SDK acts on **40 query parameters**. They are the configuration surface with no trace in the markup: nothing on the page mentions them, so grepping a template never finds them, and adding one to a link changes what the page does.

**4 of them are not safe on a link you publish** — they change what a real visitor gets or what reaches a real API. They are marked 🔴 in the tables below, with the reason on their own row: `debugger`, `test`, `reset`, `forcePackageId`.

**4 are sticky** (marked 📌): the SDK copies the value into storage, so the effect continues on later page loads after you take the parameter out of the URL. When a page behaves as though a parameter is still set, it is.

## `?debug` and `?debugger` are different switches

They are one letter apart and they do unrelated things, which is the most common confusion on these pages:

| You want | Use | What you get |
|---|---|---|
| Console output on a live page | `?debug=true` | Un-suppresses the `debug`, `info`, and `warn` lines the production bundle normally drops. No UI. |
| The on-page debug panel | `?debugger=true` | The overlay with the cart, campaign, order, checkout, and analytics panels — **and test mode**, silently. |

Neither the `next-debug` meta tag nor `window.nextConfig.debug` opens the overlay: they raise the log level and expose `window.nextDebug`, nothing more. Only `?debugger=true` or `window.nextConfig.debugger = true` opens it. See [meta tags](./meta-tags.md).

## How to read the tables

| Mark | Meaning |
|---|---|
| ⚠️ | A trap worth reading before you use the parameter. |
| 🔴 | Changes what a real visitor gets, or what reaches a real API. Never leave it on a link you publish. |
| 📌 | Sticky: the value is copied into storage, so removing it from the URL does **not** undo it for the rest of the session. |
| ✍︎ | The SDK puts this parameter on URLs it builds for the visitor. |

## Currency and country

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `currency` 📌 | `string (3-letter currency code)` | the currency detected from the visitor's location | Loads the campaign priced in this currency and shows every price in it. Highest priority of all the currency sources — it beats a currency the visitor picked earlier and the one detected from their location.<br>⚠️ The value is copied into session storage under `next_selected_currency`, so it keeps applying to later page loads **without** the parameter, for the rest of the tab. That is deliberate — it stops a checkout from drifting to another currency mid-funnel — but it means deleting the parameter does not undo the test, and neither does `?reset=true`, which only clears keys spelled `next-…`. Load the page once with the currency you want, or open a new tab. A currency the campaign does not price in falls back with a `currency:fallback` event rather than failing. |
| `country` 📌 | `string (2-letter country code)` | the country detected from the visitor's location | Overrides the detected country: it loads that country's address rules — state list, the label and format of the postcode field — and pre-selects it as the shipping destination.<br>⚠️ It does **not** change the currency, despite the two normally moving together; use `?currency=` for that, and expect a page showing Canadian address fields with US prices if you set only one. Like the currency it is remembered for the tab (`next_selected_country`) and `?reset=true` does not clear it. A country the campaign does not ship to is rejected with a warning and the dropdown keeps the detected one, so a link that seems ignored is usually a shipping-coverage problem. |

Add to any page URL:

```text
?currency=EUR
?country=CA
```

## Debugging

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `debug` | `'true'` | off | Un-suppresses logging. The production bundle drops every `debug`, `info`, and `warn` line unless this is set; with it, the SDK narrates what it is doing in the console. That is all it does.<br>⚠️ It does **not** open the debug overlay — that is `?debugger=true`, one letter apart, and mixing them up is the single most common confusion on these pages. If you wanted the panel and got only console output, you used this one. Safe to leave on a link: it changes nothing a visitor sees and nothing that is sent. |
| `debugger` 🔴 ✍︎ | `'true'` | off | Opens the on-page debug overlay — cart, campaign, order, checkout, and analytics panels, plus the currency, country, and upsell pickers — and turns logging all the way up. This is the parameter you want when you mean "show me the debug panel".<br>🔴 **Do not leave this on a link that ships.**<br>⚠️ It also silently puts the page into **test mode**, the same state as `?test=true`, so a debugging session on a live page is one Konami code away from posting a real test order. See `test` below before using it on production. It is also the only way in: neither the `next-debug` meta tag nor `window.nextConfig.debug` opens the overlay — those only raise the log level. `window.nextConfig.debugger = true` is the equivalent for a page you cannot add a parameter to. |

Add to any page URL:

```text
?debug=true
?debugger=true
```

## Test orders

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `test` 🔴 ✍︎ | `'true'` | off | Marks the page as being in test mode, which lets the test-card helpers fill the checkout form with a known card number. `?debugger=true` turns it on too, and the Konami code (↑↑↓↓←→←→BA) both turns it on and writes this parameter into the address bar.<br>🔴 **Do not leave this on a link that ships.**<br>⚠️ The Konami listener is attached the moment the SDK loads, on **every** page including production, and it does not check whether test mode is on first. Typing that sequence on a live checkout fills a hard-coded address (`Test Order, Test Address 123, Tempe AZ 85281`) and posts `card_token: "test_card"` to the real order endpoint — a real API call that creates a real record. Do not demo a checkout page to anyone playing with the arrow keys, and treat any order with that address as a test artefact. There is no way to opt a page out short of a code change. |

Add to any page URL:

```text
?test=true
```

## Resetting a session

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `reset` 🔴 ✍︎ | `'true'` | off | Clears the SDK's stored state before anything else loads, then removes itself from the URL so a refresh does not clear the page again. The way out of a session wedged by an earlier test.<br>🔴 **Do not leave this on a link that ships.**<br>⚠️ It clears less than the name promises. The sweep only removes keys beginning `next-` or `_next`, which covers the cart, order, attribution, and campaign cache — but the remembered currency (`next_selected_currency`), country (`next_selected_country`), funnel (`next_funnel_name`), the analytics `analytics_ignore` flag, and `evclid` are all spelled with an underscore and **survive**. So a session stuck in the wrong currency, or silently untracked, is not fixed by this parameter; open a new tab instead. It does wipe a **real** visitor's cart if it reaches one, so never leave it on a published link or a redirect target — and because it strips itself from the address bar, a screenshot of the URL will not show that it ran. |

Add to any page URL:

```text
?reset=true
```

## Forcing a page into a state

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `forcePackageId` 🔴 | `string — {ID} or {ID}:{QTY}, comma-separated` | — | Empties the cart and puts the listed packages in it, with an optional quantity after a colon (default 1). Made for jumping straight to a checkout or upsell page with a known cart instead of clicking through the funnel.<br>🔴 **Do not leave this on a link that ships.**<br>⚠️ The clear happens first and unconditionally, so a visitor who reaches a link carrying this loses whatever they had in their cart. A package id that is not in the campaign is skipped with a warning and the rest still load — so a partially wrong link gives a partially filled cart rather than an error. A malformed id or a quantity of zero abandons the whole operation, leaving the cart empty. |
| `forceShippingId` | `number (a shipping method ref_id)` | — | Selects a shipping method by its campaign id, so you can test a specific rate — free shipping, expedited — without going through the picker.<br>⚠️ It is applied after the campaign loads, which means it overwrites a method the visitor already chose. An id that is not in the campaign is ignored with a warning and the existing selection stays, so a link that appears to do nothing is usually a stale id: the log lists the ids that do exist. |
| `forceBundleId` | `string — {BUNDLE} or {SELECTOR}:{BUNDLE}, comma-separated` | — | Pre-selects a bundle card, overriding the card marked `data-next-selected`. Scope it to one selector with `{SELECTOR_ID}:{BUNDLE_ID}` when the page has several; an unscoped value applies to the first selector that has a card with that id.<br>⚠️ When the bundle id matches no card, the selector logs a warning and falls back to its normal default — so a typo shows up as "the page ignored my link", not as an error. Malformed comma-separated entries are dropped in silence. |

Add to any page URL:

```text
?forcePackageId=123:2,124
?forceShippingId=3
?forceBundleId=tier-selector:premium
```

## Loading an order

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `ref_id` ✍︎ | `string (order reference)` | — | Loads that order when the page opens, which is what makes a receipt page show its totals and an upsell page know what was bought. The SDK appends it for you to the success, upsell, and decline URLs it redirects to, so a well-configured funnel never needs it written by hand.<br>⚠️ It is an order reference in a URL a visitor can edit, so anything it renders is visible to anyone holding the link — do not put an order-lookup page behind it and assume privacy. If a receipt page is blank, check that the redirect actually carried this parameter: the SDK only appends it when the target URL does not already have one. |
| `order_ref_id` | `string (order reference)` | — | An alternative spelling of `ref_id`, read only when `ref_id` is absent. Present for links built by older tooling.<br>⚠️ The SDK never writes this form, only `ref_id`, so a page reached through the SDK's own redirects will always carry the other one. Use `ref_id` in anything new. |

Add to any page URL:

```text
?ref_id={ORDER_REF}
?order_ref_id={ORDER_REF}
```

## Analytics

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `ignore` 📌 | `'true'` | off | Stops analytics entirely for this visitor: no provider is initialised and no event is sent. Use it so your own testing, QA, and demo traffic does not land in the reports.<br>⚠️ The flag is copied into session storage on first sight, so it keeps suppressing analytics on every later page in the tab **without** the parameter. That is what makes it useful across a funnel, and it is also the trap: a tester who loads one page with it and then does real work in the same tab records nothing, and there is no on-page sign that tracking is off. Open a fresh tab to get tracking back. |
| `category` | `string` | — | Names the list a product view or click should be attributed to, when the page is a category listing whose URL path does not already say so.<br>⚠️ The URL **path** is checked first — a path containing `/collections/…`, `/category/…`, `/search`, `/tag/…` or `/brand/…` wins and this parameter is never consulted. So on a page whose path already matches one of those patterns, setting it has no effect. |
| `collection` | `string` | — | The same list attribution as `category`, for pages that call the grouping a collection. Read after `category`.<br>⚠️ With both present `category` wins. As with `category`, a path that already matches a known listing pattern takes precedence over either. |
| `q` | `string` | — | Marks the page as search results and puts the search text in the reported list name. Read together with `query` and `search`, whichever is present.<br>⚠️ All three spellings produce the same list id, `search_results`, so reports cannot tell them apart — pick one across the site if you want the search term to be comparable. |
| `query` | `string` | — | A second accepted spelling of the search term, read after `q`.<br>⚠️ Presence alone is enough: `?query=` with an empty value still reports the page as search results, with an empty term. |
| `search` | `string` | — | A third accepted spelling of the search term, read after `query`.<br>⚠️ Same caveat as the other two — the value is only used for the list *name*, so it never affects which products are reported. |

Add to any page URL:

```text
?ignore=true
?category=summer-sale
?collection=bestsellers
?q=protein+powder
?query=protein+powder
?search=protein+powder
```

## Attribution

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `funnel` 📌 | `string` | a remembered funnel, then the `next-funnel` meta tag | Names the funnel this visit belongs to, and is the highest-priority source: it overrides both a funnel already remembered for this visitor and the page's `next-funnel` meta tag.<br>⚠️ It overwrites the remembered value in both session and local storage, so it keeps applying on later visits from the same browser even after the link is gone. That makes it the tool for correcting a mis-tagged visitor, and it also means one test link can permanently relabel your own browser. The override is logged, so the console tells you when it happened. |
| `affid` | `string` | — | The affiliate credited with the order. Remembered for the rest of the browser tab and sent with every order placed in it.<br>⚠️ It is held in session storage, so it is scoped to the tab: a visitor who arrives through an affiliate link and finishes the purchase in a *new* tab loses the credit. Unlike `funnel` and `evclid` it does not survive the tab closing. |
| `aff` | `string` | — | Short alias for `affid`, read only when `affid` is absent.<br>⚠️ With both on the link `affid` wins. That happens more often than it sounds: a network appends its own parameter to a URL that already had one, and the order is then credited to the value you did not expect. |
| `gclid` | `string` | — | The Google Ads click id, added automatically by Google when auto-tagging is on. Stored and sent with the order so a conversion can be matched back to the click.<br>⚠️ Nothing generates it for you; if it is missing from orders, the cause is upstream — auto-tagging off, or a redirect that dropped the query string. |
| `fbclid` | `string` | — | The Facebook click id, added by Facebook on outbound clicks. Recorded in the order's attribution metadata when present.<br>⚠️ It is recorded only when non-empty, so it is absent rather than blank on organic traffic — a report filtering on it will not see those orders at all. |
| `clickid` | `string` | — | A generic click id for tracking platforms that do not use one of the named parameters. Passed through to the order's attribution metadata unchanged.<br>⚠️ It is a single slot: a page reached through two networks that both use `clickid` keeps only the value in the current URL. Use the sub-affiliate slots when you need more than one. |
| `evclid` | `string` | — | The Everflow click id, sent with the order as its Everflow transaction id so the network can attribute the conversion.<br>⚠️ It is written to **local** storage rather than the session, so it persists across tabs and days — a browser that once opened an Everflow link keeps attributing orders to that click until storage is cleared. Worth knowing before you conclude an affiliate is over-credited. |
| `utm_source` | `string` | — | Which site or platform the visit came from. Stored on the attribution record and sent with the order.<br>⚠️ Remembered for the session on first sight, so a later page load without it keeps the original value — which is what makes multi-page funnels attribute correctly, and also why clearing it from a link does not clear it from the visitor. |
| `utm_medium` | `string` | — | What kind of link it was — cpc, email, social. Stored on the attribution record and sent with the order.<br>⚠️ Remembered for the session on first sight, so a later page load without it keeps the original value — which is what makes multi-page funnels attribute correctly, and also why clearing it from a link does not clear it from the visitor. |
| `utm_campaign` | `string` | — | Which marketing campaign the link belongs to. Stored on the attribution record and sent with the order.<br>⚠️ Remembered for the session on first sight, so a later page load without it keeps the original value — which is what makes multi-page funnels attribute correctly, and also why clearing it from a link does not clear it from the visitor. |
| `utm_content` | `string` | — | Which specific creative or link variant was clicked. Stored on the attribution record and sent with the order.<br>⚠️ Remembered for the session on first sight, so a later page load without it keeps the original value — which is what makes multi-page funnels attribute correctly, and also why clearing it from a link does not clear it from the visitor. |
| `utm_term` | `string` | — | The paid keyword the visit was bought against. Stored on the attribution record and sent with the order.<br>⚠️ Remembered for the session on first sight, so a later page load without it keeps the original value — which is what makes multi-page funnels attribute correctly, and also why clearing it from a link does not clear it from the visitor. |
| `subaffiliate1` | `string (max 225 characters)` | — | Sub-affiliate tracking slot 1 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.<br>⚠️ Values longer than 225 characters are **truncated**, not rejected, with a warning in the log — a long encoded payload arrives at the order silently cut short. Keep it short, or hash it. |
| `sub1` | `string (max 225 characters)` | — | Short alias for `subaffiliate1`, read only when the long form is absent.<br>⚠️ With both present `subaffiliate1` wins, so editing this one on a link that carries both appears to do nothing. |
| `subaffiliate2` | `string (max 225 characters)` | — | Sub-affiliate tracking slot 2 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.<br>⚠️ Values longer than 225 characters are **truncated**, not rejected, with a warning in the log — a long encoded payload arrives at the order silently cut short. Keep it short, or hash it. |
| `sub2` | `string (max 225 characters)` | — | Short alias for `subaffiliate2`, read only when the long form is absent.<br>⚠️ With both present `subaffiliate2` wins, so editing this one on a link that carries both appears to do nothing. |
| `subaffiliate3` | `string (max 225 characters)` | — | Sub-affiliate tracking slot 3 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.<br>⚠️ Values longer than 225 characters are **truncated**, not rejected, with a warning in the log — a long encoded payload arrives at the order silently cut short. Keep it short, or hash it. |
| `sub3` | `string (max 225 characters)` | — | Short alias for `subaffiliate3`, read only when the long form is absent.<br>⚠️ With both present `subaffiliate3` wins, so editing this one on a link that carries both appears to do nothing. |
| `subaffiliate4` | `string (max 225 characters)` | — | Sub-affiliate tracking slot 4 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.<br>⚠️ Values longer than 225 characters are **truncated**, not rejected, with a warning in the log — a long encoded payload arrives at the order silently cut short. Keep it short, or hash it. |
| `sub4` | `string (max 225 characters)` | — | Short alias for `subaffiliate4`, read only when the long form is absent.<br>⚠️ With both present `subaffiliate4` wins, so editing this one on a link that carries both appears to do nothing. |
| `subaffiliate5` | `string (max 225 characters)` | — | Sub-affiliate tracking slot 5 of 5, for an affiliate network that passes its own placement or creative ids through. Sent with the order.<br>⚠️ Values longer than 225 characters are **truncated**, not rejected, with a warning in the log — a long encoded payload arrives at the order silently cut short. Keep it short, or hash it. |
| `sub5` | `string (max 225 characters)` | — | Short alias for `subaffiliate5`, read only when the long form is absent.<br>⚠️ With both present `subaffiliate5` wins, so editing this one on a link that carries both appears to do nothing. |

Add to any page URL:

```text
?funnel=summer-bundle-2026
?affid={AFFILIATE_ID}
?aff={AFFILIATE_ID}
?gclid={GOOGLE_CLICK_ID}
?fbclid={FACEBOOK_CLICK_ID}
?clickid={CLICK_ID}
?evclid={EVERFLOW_CLICK_ID}
?utm_source={VALUE}
?utm_medium={VALUE}
?utm_campaign={VALUE}
?utm_content={VALUE}
?utm_term={VALUE}
?subaffiliate1={VALUE}
?sub1={VALUE}
?subaffiliate2={VALUE}
?sub2={VALUE}
?subaffiliate3={VALUE}
?sub3={VALUE}
?subaffiliate4={VALUE}
?sub4={VALUE}
?subaffiliate5={VALUE}
?sub5={VALUE}
```

## Written by the SDK

| Parameter | Values | Default | What it does |
|---|---|---|---|
| `payment_failed` ✍︎ | `'true'` | — | **Written by the SDK, not by you.** Added by the SDK to the fallback failure URL — the current page — when no `next-failure-url` meta tag is set. It is a signal for your page to explain that payment did not go through.<br>⚠️ Nothing in the SDK reads it, so a declined visitor comes back to a checkout form that looks exactly as it did before, with no message. Either handle this parameter in your own page code or set `next-failure-url` to a page that does. See [meta tags](./meta-tags.md). |

## Any other parameter is still captured

Every query parameter on the URL — not only the ones listed here — is copied into the parameter store at boot and forwarded onto links the SDK builds, so a flag you invent survives the whole funnel. That is how a condition like `data-next-show="param.seen == '1'"` works. Two things to know before relying on it: the values are always strings, and they are only readable after the SDK has processed the URL. Both are covered in the parameter store reference — [`useParameterStore`](../../../state/parameter/guide/reference/state-reference.md).

## Cautions

- **`?test=true` reaches the real order API.** Test mode fills a hard-coded address and posts `card_token: "test_card"` to the live order endpoint. Worse, the Konami listener that turns it on is attached on every page load in production and does not check whether test mode is already on — typing ↑↑↓↓←→←→BA on a live checkout creates a real order record. Treat any order addressed to *Test Order, Test Address 123, Tempe AZ 85281* as a test artefact.
- **`?debugger=true` implies test mode.** Debugging a live page therefore arms the above. Use it on staging, or accept the risk knowingly.
- **`?reset=true` clears less than it sounds like.** It only removes storage keys spelled `next-…`, so the remembered currency, country, funnel, the analytics ignore flag, and the Everflow click id all survive it. A session stuck in the wrong currency needs a new tab, not this parameter.
- **`?ignore=true` is invisible once set.** It writes a session flag, so analytics stays off for the rest of the tab with nothing in the URL to show it. If a QA session produced no events, this is the first thing to check.
- **`?forcePackageId` empties the cart first.** It is a testing tool, not a "pre-fill the cart" feature for campaigns — a real visitor who follows such a link loses what they had.

## Where these are read

Every parameter above, with the code that reads or writes it. Generated from the source, so a parameter could not be listed on this page unless the SDK touches it.

| Parameter | Read by |
|---|---|
| `aff` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `affid` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `category` | `ListAttributionTracker.detectListFromUrl` *(has)* — `core/analytics/tracking/list-attribution-tracker.ts` |
| `clickid` | `AttributionCollector.collectMetadata` *(get)* — `core/attribution/attribution-collector.ts` |
| `collection` | `ListAttributionTracker.detectListFromUrl` *(has)* — `core/analytics/tracking/list-attribution-tracker.ts` |
| `country` | `SDKInitializer.initializeLocationAndCurrency` *(get)* — `core/sdk-initializer.ts`<br>`CheckoutFormEnhancer.initializeAddressManagement` *(get)* — `features/checkout/checkout-form/checkout-form.enhancer.ts` |
| `currency` | `SDKInitializer.initializeLocationAndCurrency` *(get)* — `core/sdk-initializer.ts`<br>`loadCampaign` *(get)* — `state/campaign/api.slice.ts` |
| `debug` | `AttributeScanner.constructor` *(get)* — `core/attribute-scanner.ts`<br>`DebugOverlay.constructor` *(get)* — `core/debug/debug-overlay.ts`<br>`EventTimelinePanel.constructor` *(get)* — `core/debug/panels/event-timeline-panel.ts`<br>…and 3 more |
| `debugger` | `DebugModule.initializeIfEnabled` *(get)* — `core/debug/debug-module.ts`<br>`DebugModule.enableDebugMode` *(set)* — `core/debug/debug-module.ts`<br>`DebugModule.disableDebugMode` *(delete)* — `core/debug/debug-module.ts`<br>…and 9 more |
| `evclid` | `AttributionCollector.handleEverflowClickId` *(has)* — `core/attribution/attribution-collector.ts` |
| `fbclid` | `AttributionCollector.collectMetadata` *(get)* — `core/attribution/attribution-collector.ts` |
| `forceBundleId` | `SDKInitializer.loadConfiguration` *(get)* — `core/sdk-initializer.ts` |
| `forcePackageId` | `SDKInitializer.loadConfiguration` *(get)* — `core/sdk-initializer.ts` |
| `forceShippingId` | `SDKInitializer.loadConfiguration` *(get)* — `core/sdk-initializer.ts` |
| `funnel` | `AttributionCollector.getFunnelName` *(has)* — `core/attribution/attribution-collector.ts` |
| `gclid` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `ignore` | `NextAnalytics.checkAndSetIgnoreFlag` *(get)* — `core/analytics/index.ts`<br>`NextAnalytics.shouldIgnoreAnalytics` *(get)* — `core/analytics/index.ts` |
| `order_ref_id` | `SDKInitializer.checkAndLoadOrder` *(get)* — `core/sdk-initializer.ts`<br>`OrderDisplayEnhancer.checkAndLoadOrderFromUrl` *(get)* — `features/display/order-display/order-display.enhancer.ts` |
| `payment_failed` | `CheckoutFormEnhancer.getFailureUrl` *(set)* — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>`getFailureUrl` *(set)* — `features/checkout/utils/url-utils.ts` |
| `q` | `ListAttributionTracker.detectListFromUrl` *(has)* — `core/analytics/tracking/list-attribution-tracker.ts` |
| `query` | `ListAttributionTracker.detectListFromUrl` *(has)* — `core/analytics/tracking/list-attribution-tracker.ts` |
| `ref_id` | `SDKInitializer.checkAndLoadOrder` *(get)* — `core/sdk-initializer.ts`<br>`navigatePreservingParams` *(has)* — `features/cart/package-toggle/package-toggle.handlers.ts`<br>`CheckoutFormEnhancer.handlePurchaseEvent` *(has)* — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>…and 5 more |
| `reset` | `SDKInitializer.loadConfiguration` *(get)* — `core/sdk-initializer.ts` |
| `search` | `ListAttributionTracker.detectListFromUrl` *(has)* — `core/analytics/tracking/list-attribution-tracker.ts` |
| `sub1` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `sub2` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `sub3` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `sub4` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `sub5` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `subaffiliate1` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `subaffiliate2` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `subaffiliate3` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `subaffiliate4` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `subaffiliate5` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `test` | `TestModeManager.checkUrlTestMode` *(get)* — `core/test-mode.ts`<br>`TestModeManager.activateKonamiCode` *(set)* — `core/test-mode.ts`<br>`TestModeManager.setTestMode` *(set)* — `core/test-mode.ts` |
| `utm_campaign` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `utm_content` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `utm_medium` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `utm_source` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
| `utm_term` | `AttributionCollector.collect` *(get)* — `core/attribution/attribution-collector.ts` |
