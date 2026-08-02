---
title: "Core/Reference/Errors"
group: "Core"
category: "Core Reference"
---

# Errors

<!-- Generated from src/docs/content/core-errors.ts, checked against the throw sites in
     src/core. Do not edit by hand: edit core-errors.ts, then run
     `npm run docs:reference`. -->

Every error the SDK's own machinery can raise — 20 of them — at the exact message, so a console line can be matched to a cause. Each feature documents its own throws in its own `guide/reference/errors.md`.

**Recoverable** means a retry or a corrected input gets past it with no code change. **Fatal** means it happens every time until the markup, code, or configuration changes.

The **Caught** row is the one to read first. Most of these are caught inside the SDK, which decides what a visitor is left with: an element that stays plain markup, a fallback country, a lost analytics event. Where it says nothing catches it, the error reaches your own `await` or `.catch()`.

## At a glance

Fatal first, since those recur for every visitor until something changes.

| Error | Type | Thrown by |
|---|---|---|
| `API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey` | Fatal | `sdk-initializer.ts` |
| `Invalid package ID: {idStr}` | Fatal | `sdk-initializer.ts` |
| `Invalid quantity: {quantityStr}` | Fatal | `sdk-initializer.ts` |
| `Invalid shipping ID: {forceShippingId}` | Fatal | `sdk-initializer.ts` |
| `Required attribute {name} not found on element` | Fatal | `base/base-enhancer.ts` |
| `Element is required` | Fatal | `base/base-enhancer.ts` |
| `No order found. Upsells can only be added after order completion.` | Fatal | `next-commerce.upsells.ts` |
| `Either packageId or items array must be provided` | Fatal | `next-commerce.upsells.ts` |
| `No test cards available` | Fatal | `test-mode.ts` |
| `{name}: data-next-display attribute is required` | Fatal | `base/base-display-enhancer.ts` |
| `Failed to fetch location data: {statusText}` | Recoverable | `country-service.ts` |
| `Failed to fetch states for {countryCode}: {statusText}` | Recoverable | `country-service.ts` |
| `Order does not support post-purchase upsells or is currently processing.` | Recoverable | `next-commerce.upsells.ts` |
| `Failed to add upsell - no updated order returned` | Recoverable | `next-commerce.upsells.ts` |
| `HTTP {status}: {statusText}` | Recoverable | `analytics/providers/custom-adapter.ts` |
| `Facebook Pixel load timeout` | Recoverable | `analytics/providers/facebook-adapter.ts` |
| `Facebook dispatch failed: {message}` | Recoverable | `analytics/providers/facebook-adapter.ts` |
| `NextCampaign SDK load failed` | Recoverable | `analytics/providers/next-campaign-adapter.ts` |
| `NextCampaign dispatch failed: {message}` | Recoverable | `analytics/providers/next-campaign-adapter.ts` |
| `RudderStack load timeout` | Recoverable | `analytics/providers/rudderstack-adapter.ts` |

## Which parts can throw

Every part of `src/core`, and whether it raises anything of its own. "Nothing" is a real answer — it means a failure there shows up as a log line rather than as a thrown error, and [logs.md](./logs.md) is the page to read.

| Part | Console prefix | Throws |
|---|---|---|
| `analytics/config.ts` | `[AnalyticsConfig]` | nothing |
| `analytics/data-layer-manager.ts` | `[NextDataLayer]` | nothing |
| `analytics/events/ecommerce-events.ts` | `[EcommerceEvents]` | nothing |
| `analytics/events/event-builder.ts` | `[EventBuilder]` | nothing |
| `analytics/events/user-events.ts` | `[UserEvents]` | nothing |
| `analytics/index.ts` | `[NextAnalytics]` | nothing |
| `analytics/providers/custom-adapter.ts` | `[Custom]` | 1 — `HTTP {status}: {statusText}` |
| `analytics/providers/facebook-adapter.ts` | `[Facebook]` | 2 — `Facebook Pixel load timeout`, `Facebook dispatch failed: {message}` |
| `analytics/providers/next-campaign-adapter.ts` | `[NextCampaign]` | 2 — `NextCampaign SDK load failed`, `NextCampaign dispatch failed: {message}` |
| `analytics/providers/provider-adapter.ts` | `[{ProviderName}]` | nothing |
| `analytics/providers/rudderstack-adapter.ts` | `[RudderStack]` | 1 — `RudderStack load timeout` |
| `analytics/tracking/auto-event-listener.ts` | `[AutoEventListener]` | nothing |
| `analytics/tracking/list-attribution-tracker.ts` | `[ListAttributionTracker]` | nothing |
| `analytics/tracking/meta-tag-controller.ts` | `[MetaTagController]` | nothing |
| `analytics/tracking/pending-events-handler.ts` | `[PendingEventsHandler]` | nothing |
| `analytics/tracking/user-data-tracker.ts` | `[UserDataTracker]` | nothing |
| `analytics/tracking/view-item-list-tracker.ts` | `[ViewItemListTracker]` | nothing |
| `analytics/user-data-storage.ts` | `[UserDataStorage]` | nothing |
| `analytics/validation/event-validator.ts` | `[EventValidator]` | nothing |
| `attribute-scanner.ts` | `[AttributeScanner]` | nothing |
| `attribution/attribution-collector.ts` | `[AttributionCollector]` | nothing |
| `attribution/utm-transfer.ts` | `[UtmTransfer]` | nothing |
| `base/attribute-parser.ts` | `[AttributeParser]` | nothing |
| `base/base-display-enhancer.ts` | `[{DisplayEnhancerClassName}]` | 1 — `{name}: data-next-display attribute is required` |
| `base/base-enhancer.ts` | `[{EnhancerClassName}]` | 2 — `Required attribute {name} not found on element`, `Element is required` |
| `base/display-error-boundary.ts` | `[DisplayErrorBoundary]` | nothing |
| `base/display-value-validator.ts` | `[DisplayValueValidator]` | nothing |
| `base/dom-observer.ts` | `[DOMObserver]` | nothing |
| `country-service.ts` | `[CountryService]` | 2 — `Failed to fetch location data: {statusText}`, `Failed to fetch states for {countryCode}: {statusText}` |
| `debug/country-selector.ts` | `[CountrySelector]` | nothing |
| `debug/currency-selector.ts` | `[CurrencySelector]` | nothing |
| `debug/debug-module.ts` | `[DebugModule]` | nothing |
| `debug/debug-overlay/debug-overlay.ts` | `[DebugOverlay]` | nothing |
| `debug/locale-selector.ts` | `[LocaleSelector]` | nothing |
| `debug/upsell-selector.ts` | `[UpsellSelector]` | nothing |
| `monitoring/error-handler.ts` | `[ErrorHandler]` | nothing |
| `next-commerce.analytics.ts` | `[NextCommerce]` | nothing |
| `next-commerce.attribution.ts` | `[NextCommerce]` | nothing |
| `next-commerce.cart.ts` | `[NextCommerce]` | nothing |
| `next-commerce.events.ts` | `[NextCommerce]` | nothing |
| `next-commerce.popups.ts` | `[NextCommerce]` | nothing |
| `next-commerce.upsells.ts` | `[NextCommerce]` | 4 — `No order found. Upsells can only be added after order completion.`, `Order does not support post-purchase upsells or is currently processing.`, `Either packageId or items array must be provided`, `Failed to add upsell - no updated order returned` |
| `next-commerce.url-params.ts` | `[NextCommerce]` | nothing |
| `rendering/template-renderer.ts` | `[TemplateRenderer]` | nothing |
| `sdk-initializer.ts` | `[SDKInitializer]` | 4 — `API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey`, `Invalid package ID: {idStr}`, `Invalid quantity: {quantityStr}`, `Invalid shipping ID: {forceShippingId}` |
| `storage.ts` | `[StorageManager]` | nothing |
| `test-mode.ts` | — logs nothing | 1 — `No test cards available` |

## `API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `sdk-initializer.ts` — logs under `[SDKInitializer]` |
| Cause | Boot reached the campaign load with no API key in the config store — neither the `next-api-key` meta tag nor `window.nextConfig.apiKey` was set before the loader ran. |
| Caught | `SDKInitializer.initialize()` catches it, logs `SDK initialization failed:`, retries up to three times, then gives up. Every price, product name, and cart total stays at its placeholder, because none of them exist without campaign data. |

**Fix:** Add the key to the page head, above the SDK loader script:

```html
<meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}" />
<!-- the SDK loader script goes after this -->
```

Or set it in configuration, again before the loader:

```html
<script>
  window.nextConfig = { apiKey: '{YOUR_CAMPAIGN_API_KEY}' };
</script>
```

Setting it *after* the loader is too late — the campaign request has already been made.

---

## `Invalid package ID: {idStr}`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `sdk-initializer.ts` — logs under `[SDKInitializer]` |
| Cause | The `forcePackageId` URL parameter contains something that is not a positive whole number — a typo, a template token that was never substituted (`forcePackageId={{package}}`), or a stray separator such as `forcePackageId=12,,13`. |
| Caught | The `forcePackageId` handler catches it and logs `Error processing forcePackageId parameter:`. Boot continues, and **no** package from that parameter is added — including the ones that parsed correctly, because the whole list is parsed before anything is added. |

**Fix:** Write the parameter as `id` or `id:quantity`, comma-separated:

```text
?forcePackageId=42
?forcePackageId=42:2,57:1
```

If the link is generated by an ad platform or an email tool, check that the token was substituted before the click.

---

## `Invalid quantity: {quantityStr}`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `sdk-initializer.ts` — logs under `[SDKInitializer]` |
| Cause | The quantity half of a `forcePackageId` entry is not a positive whole number — `?forcePackageId=42:0` or `?forcePackageId=42:two`. |
| Caught | Same as `Invalid package ID` — caught by the `forcePackageId` handler, logged as `Error processing forcePackageId parameter:`, and no package from the parameter reaches the cart. |

**Fix:** Use a whole number of 1 or more (`?forcePackageId=42:2`). To put nothing in the cart, leave the parameter off rather than passing a quantity of `0`.

---

## `Invalid shipping ID: {forceShippingId}`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `sdk-initializer.ts` — logs under `[SDKInitializer]` |
| Cause | The `forceShippingId` URL parameter is not a positive whole number. |
| Caught | The `forceShippingId` handler catches it and logs `Error processing forceShippingId parameter:`. Boot continues with whatever shipping method the cart already had, which on a fresh session is none. |

**Fix:** Pass the shipping method `ref_id` as a number — `?forceShippingId=3`. The available ids are listed in the debug log `Available shipping methods:` and in the campaign data under `shipping_methods`.

---

## `Required attribute {name} not found on element`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `base/base-enhancer.ts` — logs under `[{EnhancerClassName}]` |
| Cause | A feature asked for an attribute it cannot work without and the element does not carry it, or carries it empty (`data-next-package-id=""` counts as missing). Every feature inherits this check from the shared base class, so the message can come from any of them — the logger prefix in the console tells you which. |
| Caught | `AttributeScanner` catches it, logs `Failed to initialize {type} enhancer:` with the element, and destroys the half-built feature. That element stays plain markup: a button does nothing on click, a display element keeps its placeholder text. The rest of the page is enhanced normally. |

**Fix:** Add the named attribute to the element. Which attributes a feature requires is in its own `guide/reference/attributes.md` — the required ones are listed first there. Check for an empty value as well as a missing one, since both raise this.

---

## `Element is required`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `base/base-enhancer.ts` — logs under `[{EnhancerClassName}]` |
| Cause | A feature was constructed with no element. Markup cannot cause this — `AttributeScanner` only ever constructs a feature for an element it found — so it means code built one by hand and passed a `null` from a `querySelector` that matched nothing. |
| Caught | Nothing in core catches it: it propagates to whoever called the constructor. |

**Fix:** Resolve the element before constructing, and stop if it is not there:

```ts
const el = document.querySelector<HTMLElement>('[data-next-checkout]');
if (!el) return; // nothing to enhance
new CheckoutFormEnhancer(el);
```

In almost every case the better answer is to add the feature's `data-next-*` attribute to the markup and let `AttributeScanner` construct it.

---

## `No order found. Upsells can only be added after order completion.`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `next-commerce.upsells.ts` — logs under `[NextCommerce]` |
| Cause | `next.addUpsell()` was called with no order in the order store. Either the page is not a post-purchase page, or it is one but the order has not finished loading yet. |
| Caught | Nothing catches it — it rejects the promise `next.addUpsell()` returned, so your own `catch` sees it. |

**Fix:** Call it only after the order is loaded. On a receipt or upsell page the SDK loads the order from the `ref_id` URL parameter during boot, so waiting for `next:ready` is enough:

```ts
window.nextReady = window.nextReady || [];
window.nextReady.push(async next => {
  await next.addUpsell({ packageId: 42, quantity: 1 });
});
```

If the page has no `?ref_id=`, there is no order to add to and no amount of waiting will produce one.

---

## `Either packageId or items array must be provided`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `next-commerce.upsells.ts` — logs under `[NextCommerce]` |
| Cause | `next.addUpsell()` was called with neither `packageId` nor a non-empty `items` array — often an options object built from a variable that turned out to be `undefined`. |
| Caught | Nothing catches it — the promise rejects. |

**Fix:** Pass one package or a list of them:

```ts
await next.addUpsell({ packageId: 42, quantity: 1 });
await next.addUpsell({ items: [{ packageId: 42, quantity: 1 }, { packageId: 57 }] });
```

An `items: []` is treated as nothing provided, so guard an empty selection before calling.

---

## `No test cards available`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `test-mode.ts` — logs under `[SDK test mode]` |
| Cause | Test mode was asked for a card to fill the checkout form with and its list was empty. |
| Caught | Nothing catches it — it propagates to the caller, which is test-mode code, not a customer page. |

**Fix:** A shipped build cannot reach this: the card list is a constant with several entries. It guards against that list being emptied, so seeing it means `test-mode.ts` was edited. Restore an entry in `testCards`.

---

## `{name}: data-next-display attribute is required`

| | |
|---|---|
| Type | Fatal |
| Thrown by | `base/base-display-enhancer.ts` — logs under `[{DisplayEnhancerClassName}]` |
| Cause | An element was matched as a display binding but carries no `data-next-display` value to bind. Almost always the attribute is present with an empty value (`data-next-display=""`), or a templating step emitted the name without filling it in — a genuinely absent attribute would not have matched in the first place. |
| Caught | The base feature class catches it, logs it under the failing feature’s own prefix, and emits `error:occurred`. Only that element is affected: it keeps its placeholder text and never updates, while every other binding on the page works normally. |

**Fix:** Give the element a namespaced path, or remove the attribute if the element is not a display binding:

```html
<!-- was: <span data-next-display=""></span> -->
<span data-next-display="cart.total"></span>
```

The namespace before the dot decides which part of the SDK answers — see the display feature's [attributes reference](../../../features/display/display-core/guide/reference/attributes.md) for the full list.

---

## `Failed to fetch location data: {statusText}`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `country-service.ts` — logs under `[CountryService]` |
| Cause | The `/location` endpoint answered with a non-OK status. The visitor’s network, an ad blocker, or the service being briefly unavailable all produce this. |
| Caught | Caught in the same method: it logs `Failed to fetch location data:` and continues with the built-in fallback — country list from configuration, United States as the country. Checkout still works; the country dropdown is shorter than it should be and the detected country may be wrong. |

**Fix:** Nothing to change in the page. If it is not intermittent, check that the campaigns host is reachable from the visitor’s network and is not blocked by an extension, then reload — the result is cached in localStorage, so one good response fixes the session.

---

## `Failed to fetch states for {countryCode}: {statusText}`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `country-service.ts` — logs under `[CountryService]` |
| Cause | The `/countries/{code}/states` endpoint answered with a non-OK status while the visitor was picking a country. |
| Caught | Caught in the same method: it logs `Failed to fetch states for {countryCode}:` and returns an empty state list with default labels. The state field renders with no options, so a visitor in a country that requires a state cannot complete the address. |

**Fix:** Retry by re-selecting the country — a successful response is cached. If it persists for one country only, the country code being sent is likely not one the API knows; confirm it against the `available_shipping_countries` list in the campaign data.

---

## `Order does not support post-purchase upsells or is currently processing.`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `next-commerce.upsells.ts` — logs under `[NextCommerce]` |
| Cause | Two different situations share this message. Either the order came back with `supports_post_purchase_upsells: false` — the payment method or the campaign does not allow adding to a completed order — or another upsell request is still in flight. |
| Caught | Nothing catches it — the promise from `next.addUpsell()` rejects. |

**Fix:** For the in-flight case, wait for the previous call to settle and try again; disabling the accept button while a request is running prevents it. For the unsupported case, hide the upsell offer instead of letting a visitor accept something that cannot be added — read `supports_post_purchase_upsells` on the order, which boot logs as `Order supports upsells:`.

---

## `Failed to add upsell - no updated order returned`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `next-commerce.upsells.ts` — logs under `[NextCommerce]` |
| Cause | The upsell request completed but the order store had no updated order to return. |
| Caught | Nothing catches it — the promise rejects. |

**Fix:** Treat this as "outcome unknown", not as a failure: the line may well have been added and the visitor charged. Re-read the order before offering a retry, or the visitor can be charged twice for the same upsell. If it reproduces, it is a backend contract problem rather than a markup one.

---

## `HTTP {status}: {statusText}`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `analytics/providers/custom-adapter.ts` — logs under `[Custom]` |
| Cause | The custom analytics endpoint answered a batch of events with a non-OK status. |
| Caught | Caught by the adapter, which logs `Error sending batch to custom endpoint:` and puts every event in the batch on its retry queue. After the configured number of attempts it gives up with `Failed to send event after {maxRetries} attempts:`. |

**Fix:** Check the endpoint URL and its response for the status in the message. Nothing on the page breaks — only the events for this one provider are lost, and only after the retries are exhausted.

---

## `Facebook Pixel load timeout`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `analytics/providers/facebook-adapter.ts` — logs under `[Facebook]` |
| Cause | `fbq` never appeared on the page within the adapter’s wait, so there was nothing to deliver the event to. The Meta Pixel base code is missing, or an extension blocked it. |
| Caught | Thrown as a `DispatchError`, which the shared adapter base treats as an expected delivery outcome: it logs the warn `Event "{event}" not delivered: Facebook Pixel load timeout` and records the payload it would have sent in the debug overlay. The visitor sees nothing. |

**Fix:** Add the Meta Pixel base code to the page, above the SDK loader. The adapter also warns once with the fix in it — `Meta Pixel (fbq) not found …`. If the pixel is present, check whether an ad blocker removed it before deciding the SDK is at fault.

---

## `Facebook dispatch failed: {message}`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `analytics/providers/facebook-adapter.ts` — logs under `[Facebook]` |
| Cause | `fbq` was on the page but threw when the event was handed to it. The message after the colon is whatever the pixel raised. |
| Caught | A `DispatchError`, so the adapter base logs `Event "{event}" not delivered: Facebook dispatch failed: …` and records the attempted payload. One provider failing never stops the others. |

**Fix:** Read the message after the colon — it comes from the pixel, not from the SDK. A parameter the pixel rejects is the usual cause; the attempted payload is in the debug overlay’s Provider Delivery panel (`?debug=true`).

---

## `NextCampaign SDK load failed`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `analytics/providers/next-campaign-adapter.ts` — logs under `[NextCampaign]` |
| Cause | The NextCampaign script never loaded, so its `page_view` could not be delivered. A missing API key or an unreachable campaigns host both produce this. |
| Caught | A `DispatchError`: the adapter base logs `Event "{event}" not delivered: NextCampaign SDK load failed` and keeps the prepared payload for the debug overlay. |

**Fix:** Confirm the API key is set (the adapter logs `API key from config store: found` when it is) and that `campaigns.apps.29next.com` is reachable. The adapter also warns once with the same fix — `NextCampaign SDK failed to load …`.

---

## `NextCampaign dispatch failed: {message}`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `analytics/providers/next-campaign-adapter.ts` — logs under `[NextCampaign]` |
| Cause | The NextCampaign script was loaded but threw when the event was handed to it. The text after the colon is its own message. |
| Caught | A `DispatchError`, logged by the adapter base as `Event "{event}" not delivered: NextCampaign dispatch failed: …`. |

**Fix:** Read the message after the colon; it comes from the NextCampaign script. The event payload that was attempted is in the debug overlay’s Provider Delivery panel (`?debug=true`).

---

## `RudderStack load timeout`

| | |
|---|---|
| Type | Recoverable |
| Thrown by | `analytics/providers/rudderstack-adapter.ts` — logs under `[RudderStack]` |
| Cause | `rudderanalytics` never appeared on the page within the adapter’s wait, so the event had nowhere to go. |
| Caught | A `DispatchError`: the adapter base logs `Event "{event}" not delivered: RudderStack load timeout` and records the descriptor it had prepared. |

**Fix:** Add the RudderStack JavaScript SDK snippet to the page, above the SDK loader. The adapter warns once with the same instruction — `rudderanalytics not found …`.
