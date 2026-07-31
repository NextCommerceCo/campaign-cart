---
title: "Core/Reference/Analytics Providers"
group: "Core"
category: "Core Reference"
---

# Analytics providers

<!-- Generated. Do not edit by hand: edit src/docs/content/analytics-events.ts
     (prose) or the analytics source (facts), then run `npm run docs:reference`. -->

Which destinations the SDK can forward events to, what each one does to an event on the way out, and how to find out where an event went. Five providers can be configured; a sixth file, `ProviderAdapter`, is the shared base class they all extend rather than a destination you can enable.

## The matrix

| Provider | Config key | Refuses to start without | Events it accepts | Where they go |
|---|---|---|---|---|
| [NextCampaign](#nextcampaign) | `analytics.providers.nextCampaign` | nothing | 1 of 35 | Reports page views to the 29Next campaign analytics platform, loading its own script. |
| [GTM](#gtm) | `analytics.providers.gtm` | nothing | all 35 | Forwards every event into Google Tag Manager, where your container decides what to do with it. |
| [Facebook](#facebook) | `analytics.providers.facebook` | `analytics.providers.facebook.settings.pixelId` | 19 of 35 | Sends mapped events to the Meta Pixel through `fbq`. |
| [RudderStack](#rudderstack) | `analytics.providers.rudderstack` | nothing | 18 of 35 | Sends events to RudderStack under its ecommerce spec names, via the page's `rudderanalytics` SDK. |
| [Custom](#custom) | `analytics.providers.custom` | `analytics.providers.custom.settings.endpoint` | all 35 | POSTs events to an endpoint of your own, batched, with retries. |

Every provider is optional. With `analytics.enabled: true` and no provider configured, events are still built, validated and pushed to `window.NextDataLayer` — see [Analytics events](./analytics-events.md).

## `blockedEvents` only reaches two providers

Only the GTM and Meta adapters are constructed with their provider config, so only those two receive a `blockedEvents` list. RudderStack, NextCampaign and Custom are constructed with no options at all — their blocked list is always empty, and a name you add there is silently ignored while the event keeps arriving.

The symptom is an event you believe you blocked still showing up at that destination, with the debug overlay reporting `sent` rather than `blocked`. Until the adapters accept the list, block such an event at the destination (a RudderStack transformation, a filter at your endpoint) rather than in SDK config.

Names are matched **verbatim** against the canonical event name, so `blockedEvents: ["purchase"]` blocks nothing — the event is `dl_purchase`.

## The `dl_` prefix: who sees it

One name, four different things done with it. The canonical name is `dl_*` everywhere inside the SDK — in `window.NextDataLayer`, in `blockedEvents`, in the debug overlay — and each provider decides what its own destination gets:

| Channel | What it receives | Why |
|---|---|---|
| `window.NextDataLayer` | `dl_purchase` | The SDK's own array. Always the canonical name. |
| GTM: `window.dataLayer` and `window.ElevarDataLayer` | `dl_purchase`, the whole event object unchanged | Elevar-compatible tags match on `dl_*`. GTM pushes the event verbatim to **both** arrays, preceded by an `{ ecommerce: null }` push to `window.dataLayer` so the previous event's ecommerce block cannot leak into this one. |
| Meta Pixel | `Purchase` | Renamed through a fixed table, not by trimming the prefix — nine of the mapped names are Meta *custom* events sent with `trackCustom`. |
| RudderStack | `Order Completed` | Renamed to the RudderStack ecommerce spec, again by table. |
| NextCampaign | `page_view` | The one name it maps. |

**GA4 field rules are picked by the stripped name, and only off the non-`dl_` path.** `GTMAdapter` returns as soon as it sees a `dl_` prefix, so its GA4 shaping (`value` only on value-bearing events, `item_list_*` on list events, promotion fields, `transaction_id`/`tax`/`shipping` on purchase and refund) applies to events pushed **without** the prefix — a plain `purchase` sent through `next.trackCustomEvent()`. Canonical `dl_*` events reach `window.dataLayer` in whatever shape the SDK built them, so the GA4 mapping is your GTM container's job, not the adapter's.

## Per provider

### NextCampaign

Reports page views to the 29Next campaign analytics platform, loading its own script.

**What it does to an event:** Maps page views to `page_view` with the document title and URL, and nothing else.

**What it drops:** Every event that is not a page view — recorded as `skipped` with the reason `NextCampaign only tracks page_view`, which is by design and not a misconfiguration.

Mapped names: `dl_page_view` → `page_view`. Everything else is skipped.

> ⚠️ It is the one provider that loads a remote script itself, using the campaign `apiKey`. With no `apiKey` it logs a warning and stays inert; if the script host is unreachable, every event records `failed` after the load timeout.
>
> ⚠️ It fires its own initial page view on window load, in addition to the mapped `dl_page_view`. Expect two page views per page on that platform.
>
> ⚠️ It ignores `blockedEvents` — see the note above the matrix.

### GTM

Forwards every event into Google Tag Manager, where your container decides what to do with it.

**What it does to an event:** None for canonical events: a `dl_*` event is pushed **verbatim** to `window.ElevarDataLayer` and to `window.dataLayer`, with an `{ ecommerce: null }` push in front of the second so the previous event's ecommerce block cannot bleed into this one. Events pushed without the `dl_` prefix take the other path and are reshaped to GA4 field rules.

**What it drops:** Nothing beyond `blockedEvents` — it forwards every name it is given.

GA4 ecommerce shaping exists for these names, but only on the non-`dl_` path (see the prefix section above):

`dl_add_to_cart`, `dl_add_to_wishlist`, `dl_remove_from_cart`, `dl_view_cart`, `dl_begin_checkout`, `dl_add_payment_info`, `dl_add_shipping_info`, `dl_purchase`, `dl_refund`, `dl_view_item`, `dl_view_item_list`, `dl_select_item`, `dl_select_promotion`, `dl_view_promotion`

> ⚠️ It needs no settings and its `containerId` is never read: enabling `gtm` only wires the adapter to `window.dataLayer`. If the container tag is not on the page, events pile up in the array and nothing reports them — add the GTM snippet separately.
>
> ⚠️ Every event is pushed to two arrays. A tag that listens on both `dataLayer` and `ElevarDataLayer` counts each event twice.

### Facebook

Sends mapped events to the Meta Pixel through `fbq`.

**What it does to an event:** Renames the event through a fixed table and rebuilds the payload into Meta parameters — `content_ids`, `contents`, `value`, `num_items`. Nine of the mapped names are Meta **custom** events dispatched with `trackCustom`, so they will not appear as standard events in Meta reporting until you define them there.

**What it drops:** Every event outside its table — including `dl_upsell_purchase`, so post-purchase revenue never reaches Meta.

Mapped names, read from the adapter:

| Canonical event | Meta event | Sent with |
|---|---|---|
| `dl_user_data` | `PageView` | `track` |
| `dl_page_view` | `PageView` | `track` |
| `dl_view_item` | `ViewContent` | `track` |
| `dl_add_to_cart` | `AddToCart` | `track` |
| `dl_remove_from_cart` | `RemoveFromCart` | `trackCustom` |
| `dl_begin_checkout` | `InitiateCheckout` | `track` |
| `dl_add_shipping_info` | `AddShippingInfo` | `trackCustom` |
| `dl_add_payment_info` | `AddPaymentInfo` | `track` |
| `dl_purchase` | `Purchase` | `track` |
| `dl_search` | `Search` | `track` |
| `dl_add_to_wishlist` | `AddToWishlist` | `track` |
| `dl_sign_up` | `CompleteRegistration` | `track` |
| `dl_login` | `Login` | `trackCustom` |
| `dl_subscribe` | `Subscribe` | `trackCustom` |
| `dl_start_trial` | `StartTrial` | `trackCustom` |
| `dl_view_cart` | `ViewCart` | `trackCustom` |
| `dl_viewed_upsell` | `ViewedUpsell` | `trackCustom` |
| `dl_accepted_upsell` | `AcceptedUpsell` | `trackCustom` |
| `dl_skipped_upsell` | `SkippedUpsell` | `trackCustom` |

> ⚠️ It never loads the pixel. Without the Meta base code on the page it waits 5 seconds per event, then records `failed` with a one-time warning — the mapped payload is kept so you can still verify the mapping.
>
> ⚠️ `Purchase` deduplication needs `storeName` in the loader config; without it no `eventID` is sent and a server-side copy of the same order will double-count.

### RudderStack

Sends events to RudderStack under its ecommerce spec names, via the page's `rudderanalytics` SDK.

**What it does to an event:** Renames to spec names (`Order Completed`, `Product Added`) and rebuilds the payload as spec objects: `products[]`, `revenue`/`subtotal` as item revenue and `total` as value + tax + shipping. Page views become a `page()` call plus a `{PageType} Page View` track. Purchases also trigger an `identify()`.

**What it drops:** Unmapped names, a second page view in the same page load, and — the one that surprises people — `dl_user_data` for any shopper with no email or user id, which is every visitor before checkout.

Mapped names, read from the adapter:

| Canonical event | RudderStack event |
|---|---|
| `dl_view_item` | `Product Viewed` |
| `dl_select_item` | `Product Clicked` |
| `dl_view_item_list` | `Product List Viewed` |
| `dl_add_to_cart` | `Product Added` |
| `dl_remove_from_cart` | `Product Removed` |
| `dl_view_cart` | `Cart Viewed` |
| `dl_cart_updated` | `Cart Viewed` |
| `dl_begin_checkout` | `Checkout Started` |
| `dl_add_shipping_info` | `Checkout Step Completed` |
| `dl_add_payment_info` | `Payment Info Entered` |
| `dl_purchase` | `Order Completed` |
| `dl_upsell_purchase` | `Order Completed` |
| `dl_viewed_upsell` | `Upsell Viewed` |
| `dl_skipped_upsell` | `Upsell Skipped` |
| `dl_sign_up` | `Signed Up` |
| `dl_login` | `Logged In` |

Handled outside the table: `dl_page_view`, `dl_user_data` — page views become a `page()` call, user data an `identify()`.

> ⚠️ Guest traffic produces no `identify()` at all, so a funnel that only ever sees anonymous visitors will look empty on the identity side while events still arrive.
>
> ⚠️ `dl_view_cart` and `dl_cart_updated` both arrive as `Cart Viewed`. If you need to tell them apart, block one of the two for this provider.
>
> ⚠️ Cart and checkout ids are the analytics session id, not a real cart id, because the SDK has no client-side cart identifier. They group a funnel correctly but do not join to anything server-side.
>
> ⚠️ It ignores `blockedEvents` — see the note above the matrix.

### Custom

POSTs events to an endpoint of your own, batched, with retries.

**What it does to an event:** Passes the event through your `transformFunction` (identity by default) and wraps a batch of up to 10 into one request body with a `batch_info` header block.

**What it drops:** Nothing by name. Without an `endpoint` the provider is never constructed at all.

> ⚠️ Delivery is deferred: an event is recorded as sent once it is queued, up to 5 seconds before the POST actually goes out. A `sent` status here means "queued", not "accepted by your endpoint" — check your endpoint's own logs to confirm receipt.
>
> ⚠️ A failed batch is **not** retried in practice. The retry queue is keyed on an event `id` that nothing in the pipeline sets (events carry `event_id`), so the `maxRetries: 3` setting never takes effect and a failed batch is lost after one error log. Treat this endpoint as best-effort and reconcile from your own side.
>
> ⚠️ It ignores `blockedEvents` — see the note above the matrix.

## When nothing arrives

An event can stop at any of these points, in this order. The first three happen before any provider is asked, so a provider that "receives nothing" is often not the provider's fault at all. Walk the list from the top.

| # | Stops here when | What you see | Fix |
|---|---|---|---|
| 1. **Analytics never started**<br>`core/analytics/index.ts › NextAnalytics.initialize` | `config.analytics.enabled` is not `true`. | One info log, `Analytics disabled in configuration`, and an empty or absent `window.NextDataLayer`. No provider is constructed, so the overlay shows *No analytics providers registered*. | Set `window.nextConfig.analytics.enabled = true` before the SDK loads. There is no meta tag for this. |
| 2. **Visit is being ignored**<br>`core/analytics/index.ts › NextAnalytics.shouldIgnoreAnalytics` | `?ignore=true` was on the URL at any point this session — the flag is stored in sessionStorage under `analytics_ignore` and outlives the parameter. | Log `Analytics ignored due to ignore parameter`, then `Event tracking skipped due to ignore flag` for each attempt. Nothing reaches the array. | Run `window.NextAnalyticsClearIgnore()` in the console, or open the page in a fresh session. |
| 3. **Validation dropped it**<br>`core/analytics/DataLayerManager.ts › DataLayerManager.push` | A field listed in `EVENT_VALIDATION_RULES` for that event is missing or falsy — for example `dl_add_to_cart` without `ecommerce.currency`, or `dl_purchase` without `ecommerce.value`. | An error log naming the field (`Missing required field for dl_add_to_cart: ecommerce.currency`) and **nothing in `window.NextDataLayer`** — the event is dropped before the push, so no provider is ever asked and the overlay has no row for it at all. | Fix the payload at the source, not the provider. An event missing here never existed as far as every downstream tag is concerned. |
| 4. **A transform returned null**<br>`core/analytics/DataLayerManager.ts › DataLayerManager.push` | `window.NextDataLayerTransformFn` is set and returned `null` for this event. | Debug log `Event filtered out by transform function`, no array entry, no provider call. | Return the event (or a modified copy) from your transform. Returning nothing filters it out. |
| 5. **Held for the next page**<br>`core/analytics/DataLayerManager.ts › DataLayerManager.push` | The event carries the internal `_willRedirect` flag — accepted upsell purchases do, because the page navigates immediately after. | Nothing on this page; the event appears on the *next* page once the pending-events handler replays it, about 200 ms after that page boots. | Look for it after the redirect. This is intended behaviour, not a loss — it prevents the duplicate that firing on both pages would create. |
| 6. **Provider never constructed**<br>`core/analytics/index.ts › NextAnalytics.initializeProviders` | The provider is `enabled` but its required setting is missing (Meta Pixel without `pixelId`, custom endpoint without `endpoint`). | One warning naming the exact config path — `Provider "facebook" is enabled but analytics.providers.facebook.settings.pixelId is missing — set it to enable facebook; skipping.` The provider is absent from `getStatus().providers` and from the overlay strip. | Supply the setting named in the warning. Until then the events flow to the data layer and to every other provider. |
| 7. **Blocked for this provider**<br>`core/analytics/providers/ProviderAdapter.ts › ProviderAdapter.trackEvent` | The event name is in that provider's `blockedEvents`, or the adapter was disabled at runtime with `setEnabled(false)`. | Overlay status **blocked**, with detail `blockedEvents` or `provider disabled`. Other providers still receive it. | Remove the name from `blockedEvents`. Match the canonical name exactly — `purchase` blocks nothing, `dl_purchase` does. |
| 8. **Provider has no mapping**<br>`core/analytics/providers/ProviderAdapter.ts › ProviderAdapter.trackEvent` | The adapter answers `notSupported` — NextCampaign for anything but a page view, RudderStack for a `dl_user_data` with no email or user id, Meta for an event outside its table. | Overlay status **skipped** with the reason spelled out (`NextCampaign only tracks page_view`, `no identifiable user (guest)`, `no Facebook mapping for this event`). No error, no log at warn level. | Nothing to fix if the reason is by design. If you need the event at that destination, add it to that adapter's mapping table. |
| 9. **Vendor script never loaded**<br>`core/analytics/providers/ProviderAdapter.ts › ProviderAdapter.trackEvent` | The destination's own snippet is missing, so `fbq` / `rudderanalytics` / the NextCampaign SDK never appears. Each adapter waits 5 seconds before giving up. | Overlay status **failed** after roughly 5 s, with the prepared payload still visible so you can check the mapping, plus a one-time warning carrying the fix (`Meta Pixel (fbq) not found — add the Meta Pixel base code to the page`). | Add the vendor snippet to the page. The SDK maps and reports the event but never loads the Meta or RudderStack script for you. |
| 10. **Dispatch threw**<br>`core/analytics/providers/ProviderAdapter.ts › ProviderAdapter.trackEvent` | The vendor call itself raised, or returned a rejected promise. | Overlay status **failed** with the error message. Every other provider still receives the event — the base class catches both throws and rejections so one broken destination cannot stop the loop. | Read the recorded error. A swallowed failure is invisible in the console at error level only for expected delivery problems, which are logged as warnings instead. |

## Finding out where an event went

The SDK records what every provider did with every event — in **all** builds, not only debug ones. `AnalyticsDebugTracker` keeps the last 250 deliveries as a ring buffer: provider, event name, status, the payload it was handed, the payload it actually dispatched, the error if it failed, and how long it took.

| Status | Meaning | What to do |
|---|---|---|
| `pending` | Dispatched, waiting on the vendor script or an async call. | Nothing yet. A row stuck here means the vendor never resolved. |
| `sent` | Handed to the destination. | Confirm the shape in `sentPayload` — this is the exact object the vendor received. |
| `blocked` | Suppressed by config: `blockedEvents`, or a disabled adapter. | Expected if you configured it; otherwise check the spelling of the blocked name. |
| `skipped` | The provider does not handle this event at all. | Read the reason. Usually by design. |
| `failed` | Dispatch was attempted and errored. | Read `error`; the attempted payload is kept so you can still verify the mapping. |

Read it from the debug overlay — **Analytics & Events** panel. The strip along the top lists every registered provider with a ready/waiting/paused icon; each event row carries one chip per provider tinted by its status, and the row's **Flow** tab shows the per-provider payloads side by side. Deliveries are matched to their event by `event_id`.

> ⚠️ There is no console API for this data. `analyticsDebug` is not exposed on `window`, so the overlay is the only reader — a page that cannot open the overlay cannot see delivery status, however faithfully it was recorded. Turn the overlay on with `?debugger=true` on the URL **before** reproducing the problem; the buffer only holds the last 250 deliveries.

> ⚠️ An event dropped by validation or by a transform never becomes a delivery record, because those happen **before** any provider is asked. An event that is missing from the overlay entirely is a data-layer problem, not a provider problem — walk the ladder above from the top.

## See also

- [Analytics events](./analytics-events.md) — every event, its payload, and which destination sees it under which name.
- [`useConfigStore`](../../../state/config/guide/reference/state-reference.md) — the `analytics` block, including the per-provider settings.
