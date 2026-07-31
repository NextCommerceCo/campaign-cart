---
title: "Core/Reference/Meta Tags"
group: "Core"
category: "Core Reference"
---

# Meta Tags

<!-- Generated from the core contract lists. Do not edit by hand:
     edit src/docs/content/meta-tags.ts, then run `npm run docs:reference`. -->

The SDK reads **27 `<meta>` tags** from the page's `<head>`. Attributes configure one element; these configure the whole page — the API key it boots with, which funnel step the page is, where checkout sends the visitor, which analytics events fire. Add them to the `<head>`, above the SDK loader script.

The shortest page that works:

```html
<head>
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  <meta name="next-page-type" content="product">
  <script src="/next-campaign-cart.js" defer></script>
</head>
```

Everything else on this page is optional. Two of the 27 are marked 🚫: the code parses them and then ignores them, so they are documented here to stop you relying on them.

## How to read the tables

| Mark | Meaning |
|---|---|
| ⚠️ | A trap worth reading before you use the tag. |
| ↩︎ | An older spelling, read only when the current one is absent. |
| 🚫 | Parsed by the code and never acted on — setting it changes nothing. |
| ✍︎ | The SDK also writes this tag at runtime, so finding it on a page does not mean an author put it there. |

The code that reads each tag is listed at the end, under [where these are read](#where-these-are-read).

## Booting the SDK

| Tag | Type | Default | What it does |
|---|---|---|---|
| `next-api-key` **required** | `string` | — | The campaign's public API key. It is the one tag a page cannot run without: the SDK uses it to fetch the campaign — its packages, prices, and shipping methods — and nothing on the page enhances until that call returns.<br>⚠️ Missing or empty, initialization throws `API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey` and every price stays as its `{token}` placeholder. If you set both this tag and `window.nextConfig.apiKey`, **the tag wins** — configuration is loaded from `window` first and meta tags second, so a stale tag silently overrides the value your loader script computed. |
| `next-campaign-id` 🚫 | `string` | not set | **Does nothing today.** Kept for backwards compatibility. The campaign is identified by the API key alone, so this value is stored on the config store and read by nothing except the debug panel that displays it.<br>⚠️ It looks like it selects which campaign loads, and it does not — changing it has no effect on the data the page gets. Remove it rather than maintaining it; if a page loads the wrong campaign, the API key is what to check. |
| `next-page-type` | `product` \| `cart` \| `checkout` \| `upsell` \| `receipt` | product | Declares which funnel step this page is, so analytics events land on the right step and the post-purchase upsell tracking knows it is on an upsell page.<br>⚠️ On an upsell page this is what triggers the upsell page-view event — leave it off and the funnel shows purchases with no upsell views before them. It can also come from `window.nextConfig.pageType`; the tag wins over it. Anything outside the five values is passed through unvalidated and shows up in reports verbatim. |
| `next-page-name` | `string` | the document `<title>`, then the page type | A human-readable page name for RudderStack page and track calls, when the document title is not what you want reported.<br>⚠️ Only the RudderStack provider reads it. With GA4 or Facebook alone, setting it changes nothing. |
| `next-clear-cart` | `'true' \| 'false'` | false | Empties the cart every time this page loads, once the stored cart has finished rehydrating. Use it on the first page of a funnel so a visitor who comes back does not start with items from a previous visit.<br>⚠️ It runs on **every** load of the page, including a refresh and a back-navigation — a visitor who adds items and refreshes loses them. Only put it on entry pages, never on a cart, checkout, or upsell page. Only the exact string `true` enables it. |
| `next-spreedly-key` | `string` | the key that comes with the campaign data | The payment environment key used to mount the hosted credit-card fields. A fallback: the campaign response normally carries the right key, and that takes precedence.<br>⚠️ Because campaign data wins, setting this tag does not let you point a page at a different payment environment for testing — it only fills a gap when the campaign has no key. A wrong value here shows up as card fields that never appear. |
| `next-payment-env-key` ↩︎ | `string` | not set | The same payment environment key under an older name. Read only when `next-spreedly-key` is absent. Use `next-spreedly-key` instead.<br>⚠️ Setting both is not an error but the other tag always wins, so a page with both is a page where editing this one appears to do nothing. |

**`next-page-type` values**

| Value | What it means |
|---|---|
| `product` | A landing or offer page. |
| `cart` | A cart review page. |
| `checkout` | The page carrying the checkout form. |
| `upsell` | A post-purchase upsell page. Also what makes the upsell page-view event fire. |
| `receipt` | The order confirmation page. |

Copy-paste, then replace the `{TOKENS}`:

```html
<meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
<meta name="next-page-type" content="checkout">
<meta name="next-page-name" content="Summer Bundle — Offer">
<meta name="next-clear-cart" content="true">
<meta name="next-spreedly-key" content="{ENVIRONMENT_KEY}">
```

Left out on purpose: `next-campaign-id` (not implemented), `next-payment-env-key` (older spelling of `next-spreedly-key`). Pasting these either duplicates a setting the newer tag already covers, or configures nothing.

## Debugging

| Tag | Type | Default | What it does |
|---|---|---|---|
| `next-debug` | `'true' \| 'false'` | false | Turns on the SDK's debug boot: the log level drops to `debug` and the `window.nextDebug` helpers become available for poking at the stores from the console.<br>⚠️ It does **not** open the on-page debug overlay, and in a production build it does not restore the suppressed logs either — the production logger decides whether to print by looking at the URL and `window.nextConfig`, and never at this tag, so a page with only this tag stays silent. For the overlay and for logs on a live page use `?debugger=true`; for logs alone use `?debug=true`. See [URL parameters](./url-parameters.md). |

Copy-paste, then replace the `{TOKENS}`:

```html
<meta name="next-debug" content="true">
```

## Where the page goes next

| Tag | Type | Default | What it does |
|---|---|---|---|
| `next-success-url` ✍︎ | `string (path or absolute URL)` | `/success` on the current origin | Where a visitor lands after an order succeeds. It is also sent to the order API as the order's success URL, so an off-site payment method returns the visitor to the same place. The order reference is appended as `?ref_id=…`, which is what lets the receipt page load the order.<br>⚠️ A relative value is resolved against the current origin, so `receipt` and `/receipt` both work — but a value pointing at another domain sends the visitor off-site with the reference in the query string. The checkout enhancer also *writes* this tag when `setSuccessUrl()` is called, so reading the tag back does not prove an author set it. |
| `next-next-url` ↩︎ ✍︎ | `string (path or absolute URL)` | not set | The success destination under an older name. Read only when `next-success-url` is absent. Use `next-success-url` instead.<br>⚠️ With both present, `next-success-url` wins — so editing this tag on a page that has both looks like a no-op. Delete it and keep one. |
| `os-next-page` ↩︎ ✍︎ | `string (path or absolute URL)` | not set | The oldest spelling of the success destination, from before the `next-` prefix. Last in the fallback chain after `next-success-url` and `next-next-url`. Use `next-success-url` instead.<br>⚠️ Present on many older pages. It still works, so there is no urgency — but when you touch such a page, collapse all three into `next-success-url`, because a page with three copies of one URL drifts. |
| `next-failure-url` ✍︎ | `string (path or absolute URL)` | the current URL with `?payment_failed=true` appended | Where a visitor lands when payment fails. Sent to the order API as the order's failure URL, so a payment method that redirects away brings a declined visitor back here rather than dropping them.<br>⚠️ Without it the visitor comes back to the *current* URL with `?payment_failed=true` on it — which works, but nothing on the page reads that parameter, so unless you handle it yourself the visitor sees a checkout form with no explanation of what went wrong. |
| `os-failure-url` ↩︎ ✍︎ | `string (path or absolute URL)` | not set | The failure destination under its pre-`next-` name. Read only when `next-failure-url` is absent. Use `next-failure-url` instead.<br>⚠️ With both present `next-failure-url` wins, so this one is the copy that goes stale unnoticed. |
| `next-upsell-accept-url` | `string (path or absolute URL)` | not set | Where an upsell page goes after the visitor accepts the offer. A page-level fallback: an accept element with its own `data-next-url` uses that instead. The order reference is carried over as `?ref_id=…` so the next page can still load the order.<br>⚠️ With neither this tag nor `data-next-url`, accepting the upsell adds the item and leaves the visitor on the same page looking at an offer they already took. On a funnel of several upsell pages, set it on each one — it is per page, not global. |
| `next-upsell-decline-url` | `string (path or absolute URL)` | not set | Where an upsell page goes when the visitor declines. The same page-level fallback as the accept URL, for the skip path.<br>⚠️ Leaving it off is the more common mistake of the two, because declining is the path nobody tests — the visitor clicks "no thanks" and stays on the offer. Point it at the receipt. |

Copy-paste, then replace the `{TOKENS}`:

```html
<meta name="next-success-url" content="/receipt">
<meta name="next-failure-url" content="/checkout">
<meta name="next-upsell-accept-url" content="/upsell-2">
<meta name="next-upsell-decline-url" content="/receipt">
```

Left out on purpose: `next-next-url` (older spelling of `next-success-url`), `os-next-page` (older spelling of `next-success-url`), `os-failure-url` (older spelling of `next-failure-url`). Pasting these either duplicates a setting the newer tag already covers, or configures nothing.

## Attribution

| Tag | Type | Default | What it does |
|---|---|---|---|
| `next-funnel` | `string` | not set | Names the funnel this page belongs to, so orders can be reported per funnel. Last in a priority chain: a `?funnel=` parameter wins, then a funnel already remembered for this visitor, and only then this tag.<br>⚠️ Because a remembered value beats the tag, changing it does not affect a visitor who already has a funnel stored from an earlier page in the same browser — you will see the old name on their order while a fresh browser shows the new one. To retest, clear storage or load the page once with `?funnel=` set. |
| `data-next-tracking-tag` | `string (in data-tag-value, not content)` | not set | Attaches an arbitrary named value to every order placed from this page. Unlike every other tag here, the value lives in `data-tag-value` and the field name in `data-tag-name`; add `data-persist="true"` to carry it across later pages in the session. Repeat the tag once per value. A `data-tag-name` of `funnel_name` also supplies the funnel.<br>⚠️ A tag with `data-tag-name` but no `data-tag-value` is skipped in silence — if a value is missing from an order, check that you did not put it in `content`. This tag is also listed with the SDK-level attributes: see [SDK-level attributes](../../../../docs/sdk-attributes.md) for its element-side story. |
| `os-tracking-tag` ↩︎ | `string (in data-tag-value)` | not set | The pre-`next-` spelling of the custom tracking tag. Read with exactly the same rules, and both names are collected together rather than one overriding the other. Use `data-next-tracking-tag` instead.<br>⚠️ Because both spellings are collected, a page carrying the same `data-tag-name` under both names sends whichever the browser returns last — silently. Keep one spelling per field. |
| `os-facebook-pixel` | `string (pixel id)` | a pixel id scraped out of the page's own scripts | The Facebook pixel id to report with the order, so Facebook can match the conversion. Highest priority — when it is absent the SDK falls back to scanning the page's script tags for a pixel id.<br>⚠️ The fallback scan is a guess against page markup and will pick the wrong id on a page with more than one pixel. If Facebook attribution is wrong, set this tag explicitly rather than trusting the scan. |
| `facebook-pixel-id` | `string (pixel id)` | not set | An alternative name for the pixel id, read in the same selector as `os-facebook-pixel` with no ordering between them.<br>⚠️ Neither name wins over the other — the two are looked up in one selector, so with both present the browser decides. Pick one. |

Copy-paste, then replace the `{TOKENS}`:

```html
<meta name="next-funnel" content="summer-bundle-2026">
<meta name="data-next-tracking-tag" data-tag-name="funnel_name" data-tag-value="summer-bundle" data-persist="true">
<meta name="os-facebook-pixel" content="1234567890">
<meta name="facebook-pixel-id" content="1234567890">
```

Left out on purpose: `os-tracking-tag` (older spelling of `data-next-tracking-tag`). Pasting these either duplicates a setting the newer tag already covers, or configures nothing.

## Analytics

| Tag | Type | Default | What it does |
|---|---|---|---|
| `next-analytics-view-item` | `string — a package ref id, or url:{PARAM}` | not set | Fires a product-view event for one package, and **replaces** the SDK's own detection of what the page is showing. Use `content="url:pid"` to take the package id from a query parameter instead of hard-coding it. The optional `trigger` attribute delays the event: `time:2000` fires after two seconds, `view:{CSS_SELECTOR}` fires when that element scrolls into view.<br>⚠️ Because it replaces auto-detection, a wrong package id here means the page reports a product view for the wrong product rather than reporting none. An unknown package id, or a `url:` parameter missing from the URL, logs a warning and fires nothing — so a silent funnel with this tag set is the tag, not the analytics provider. An unrecognised `trigger` fires immediately. |
| `next-analytics-view-item-list` | `string — comma-separated package ref ids, or url:{PARAM}` | not set | Fires one product-list view event covering the listed packages, and replaces the SDK's own detection of which packages the page lists. `url:{PARAM}` reads the comma-separated list from a query parameter.<br>⚠️ Ids that match no package are dropped with a warning and the event still fires with the rest, so a partially wrong list under-reports quietly. If every id is wrong, nothing fires at all. Pair it with `next-analytics-list-id` / `next-analytics-list-name` or the list arrives unnamed. |
| `next-analytics-list-id` | `string` | not set | Sets the list id attributed to every product event on the page, so a click can be traced back to the list it came from.<br>⚠️ It is page-level: every event on the page gets the same list id, including events from elements that belong to a different list. On a page showing two distinct lists, leave it off and let per-element attribution work. |
| `next-analytics-list-name` | `string` | not set | The human-readable name shown next to the list id in reports. Page-level, like the id.<br>⚠️ A name with no id groups poorly in most report tools. Set both or neither. |
| `next-analytics-scroll-tracking` | `string — comma-separated percentages`<br>Numbers greater than 0 and up to 100; anything else is discarded | not set | Emits a scroll-depth event the first time the visitor passes each listed percentage of the page. Each threshold fires at most once, and the scroll listener removes itself once they have all been reached.<br>⚠️ Values outside 0–100 and non-numbers are dropped without a warning, so `content="25,50,fifty"` tracks two thresholds and looks like it tracks three. On a page shorter than the viewport there is nothing to scroll and no event ever fires. |
| `next-analytics-disable` 🚫 | `string — comma-separated event names` | not set | **Does nothing today.** Intended to stop the named analytics events from being sent. The value is parsed into the controller's config and the only method that consults it, `shouldBlockEvent()`, is called from nowhere — so the events still fire.<br>⚠️ This is the trap: the tag looks like it works, and a page carrying it sends every event anyway, which is how duplicate or unwanted conversions reach a provider. Two ways to suppress events that do work today: add `?ignore=true` to the URL, which sets a session-wide flag in `analytics/index.ts › NextAnalytics.checkAndSetIgnoreFlag` and is checked by `analytics/index.ts › NextAnalytics.shouldIgnoreAnalytics` before any provider initialises, or filter the event in your tag manager. Do **not** reach for `window.nextConfig.tracking` — that value is stored and read by nothing. Treat this tag as not implemented until `shouldBlockEvent()` has a caller. |
| `next-analytics-enable-only` 🚫 | `string — comma-separated event names` | not set | **Does nothing today.** Intended as the allow-list counterpart of `next-analytics-disable`: send these events and nothing else. It is parsed and never enforced for the same reason — the check that would apply it has no caller.<br>⚠️ A page with this tag sends its full event set, not the one event listed, which is the opposite of what the author asked for. Nothing looks wrong while it happens, because the extra events are valid ones. Use the same alternatives as `next-analytics-disable`. |

Copy-paste, then replace the `{TOKENS}`:

```html
<meta name="next-analytics-view-item" content="123" trigger="view:#offer">
<meta name="next-analytics-view-item-list" content="123,124,125">
<meta name="next-analytics-list-id" content="summer_offers">
<meta name="next-analytics-list-name" content="Summer Offers">
<meta name="next-analytics-scroll-tracking" content="25,50,75,100">
```

Left out on purpose: `next-analytics-disable` (not implemented), `next-analytics-enable-only` (not implemented). Pasting these either duplicates a setting the newer tag already covers, or configures nothing.

## Cautions

- **A meta tag beats `window.nextConfig`.** Configuration is loaded from `window.nextConfig` first and from meta tags second, so a leftover tag silently overrides the value your loader script computed. If a config value is not the one you set in JavaScript, search the page for a `<meta name="next-…">` before anything else.
- **Several tags come in two or three spellings and the newest always wins.** `next-success-url` / `next-next-url` / `os-next-page` are one setting, as are the two failure URLs and the two payment keys. Editing the older copy on a page that carries both looks like the SDK ignored you. Collapse them to one when you touch such a page.
- **Analytics tags that replace auto-detection replace it completely.** `next-analytics-view-item` and `next-analytics-view-item-list` switch the SDK's own detection off for that event. A wrong package id therefore reports the wrong product rather than falling back to the right one.
- **The debug tag is not the debug overlay.** `next-debug` raises the log level and exposes `window.nextDebug`; the panel needs `?debugger=true`. See [URL parameters](./url-parameters.md).

## Where these are read

Every tag above, with the code that reads it. This table is generated from the source, so a tag could not be listed on this page unless something reads it.

| Tag | Read by |
|---|---|
| `data-next-tracking-tag` | `AttributionCollector.getFunnelName` — `core/attribution/attribution-collector.ts`<br>`AttributionCollector.collectTrackingTags` — `core/attribution/attribution-collector.ts` |
| `facebook-pixel-id` | `AttributionCollector.getFacebookPixelId` — `core/attribution/attribution-collector.ts` |
| `next-analytics-disable` | `MetaTagController.initialize` — `core/analytics/tracking/MetaTagController.ts` |
| `next-analytics-enable-only` | `MetaTagController.initialize` — `core/analytics/tracking/MetaTagController.ts` |
| `next-analytics-list-id` | `MetaTagController.parseListContext` — `core/analytics/tracking/MetaTagController.ts` |
| `next-analytics-list-name` | `MetaTagController.parseListContext` — `core/analytics/tracking/MetaTagController.ts` |
| `next-analytics-scroll-tracking` | `MetaTagController.parseScrollThresholds` — `core/analytics/tracking/MetaTagController.ts` |
| `next-analytics-view-item` | `MetaTagController.parseViewItemConfig` — `core/analytics/tracking/MetaTagController.ts` |
| `next-analytics-view-item-list` | `MetaTagController.parseViewItemListConfig` — `core/analytics/tracking/MetaTagController.ts` |
| `next-api-key` | `loadFromMeta` — `state/config/config.state.ts` |
| `next-campaign-id` | `loadFromMeta` — `state/config/config.state.ts` |
| `next-clear-cart` | `loadFromMeta` — `state/config/config.state.ts` |
| `next-debug` | `loadFromMeta` — `state/config/config.state.ts` |
| `next-failure-url` | `CheckoutFormEnhancer.getFailureUrl` — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>*top level of the file* — `features/checkout/constants/selectors.ts`<br>`getFailureUrl` — `features/checkout/utils/url-utils.ts`<br>…and 1 more |
| `next-funnel` | `AttributionCollector.getFunnelName` — `core/attribution/attribution-collector.ts` |
| `next-next-url` | `CheckoutFormEnhancer.getNextPageUrlFromMeta` — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>`CheckoutFormEnhancer.getSuccessUrl` — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>*top level of the file* — `features/checkout/constants/selectors.ts`<br>…and 3 more |
| `next-page-name` | `RudderStackAdapter.getPageMetadata` — `core/analytics/providers/RudderStackAdapter.ts` |
| `next-page-type` | `RudderStackAdapter.getPageMetadata` — `core/analytics/providers/RudderStackAdapter.ts`<br>`UpsellSelector.checkIfUpsellPage` — `core/debug/UpsellSelector.ts`<br>`trackUpsellPageView` — `features/order/upsell/upsell.handlers.ts`<br>…and 1 more |
| `next-payment-env-key` | `loadFromMeta` — `state/config/config.state.ts` |
| `next-spreedly-key` | `loadFromMeta` — `state/config/config.state.ts` |
| `next-success-url` | `CheckoutFormEnhancer.getNextPageUrlFromMeta` — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>`CheckoutFormEnhancer.getSuccessUrl` — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>*top level of the file* — `features/checkout/constants/selectors.ts`<br>…and 3 more |
| `next-upsell-accept-url` | `resolveNextUrl` — `features/cart/package-toggle/package-toggle.handlers.ts`<br>`handleActionClick` — `features/order/upsell/upsell.handlers.ts`<br>`acceptBundleUpsell` — `features/cart/accept-upsell/accept-upsell.handlers.ts`<br>…and 1 more |
| `next-upsell-decline-url` | `handleActionClick` — `features/order/upsell/upsell.handlers.ts`<br>`acceptUpsell` — `features/cart/accept-upsell/accept-upsell.handlers.ts` |
| `os-facebook-pixel` | `AttributionCollector.getFacebookPixelId` — `core/attribution/attribution-collector.ts` |
| `os-failure-url` | `CheckoutFormEnhancer.getFailureUrl` — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>*top level of the file* — `features/checkout/constants/selectors.ts`<br>`getFailureUrl` — `features/checkout/utils/url-utils.ts`<br>…and 1 more |
| `os-next-page` | `CheckoutFormEnhancer.getNextPageUrlFromMeta` — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>`CheckoutFormEnhancer.getSuccessUrl` — `features/checkout/checkout-form/checkout-form.enhancer.ts`<br>*top level of the file* — `features/checkout/constants/selectors.ts`<br>…and 3 more |
| `os-tracking-tag` | `AttributionCollector.getFunnelName` — `core/attribution/attribution-collector.ts`<br>`AttributionCollector.collectTrackingTags` — `core/attribution/attribution-collector.ts` |
