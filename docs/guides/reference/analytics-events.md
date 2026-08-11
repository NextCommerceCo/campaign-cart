---
title: "Reference/Analytics Events"
group: "Reference"
category: "Reference"
---

# Analytics events

The SDK reports funnel activity as `dl_*` events — view, add-to-cart, checkout, purchase, upsell — pushed to its own `window.NextDataLayer` array and forwarded to whichever providers you configure. This page is the full event vocabulary, what fires automatically, the money event in detail, and the traps that produce wrong numbers.

## Nothing fires until you turn it on

There is no default analytics setup and no meta tag creates one — only `window.nextConfig.analytics` does. Without it, the page sends zero events and the only trace is one info log: `Analytics disabled in configuration`.

```html
<script>
  window.nextConfig = {
    apiKey: "{YOUR_CAMPAIGN_API_KEY}",
    analytics: {
      enabled: true,
      mode: "auto",
      debug: false,
      providers: {}
    }
  };
</script>
```

Providers are optional. With `enabled: true` and no providers, every event is still built, validated, and pushed to `window.NextDataLayer` — providers are forwarders on top of that array, so your own script can read it and be the only consumer. `mode: "auto"` fires the view, cart, and checkout events from page activity; in `"manual"` mode your own `next.trackCustomEvent()` calls are the only source, with the same vocabulary.

Verify in the console: `window.NextDataLayer` grows as you interact, and `window.NextAnalytics.getStatus()` reports `initialized: true` with the provider list.

## The vocabulary

Every name is exact — these are the strings that land in `window.NextDataLayer` and the strings `blockedEvents` must match. "Auto" means the SDK fires it itself in auto mode.

**Commerce**

| Event | What it records | Auto |
|---|---|---|
| `dl_view_item_list` | Product list / collection impression | yes |
| `dl_view_item` | Product detail view | yes |
| `dl_select_item` | Product clicked from a list | yes |
| `dl_view_search_results` | Search results viewed | yes |
| `dl_search` | Search performed | **never fires** |
| `dl_add_to_cart` | Item added to cart | yes |
| `dl_remove_from_cart` | Item removed from cart | yes |
| `dl_add_to_wishlist` | Item added to wishlist | **never fires** |
| `dl_view_cart` | Cart viewed | yes |
| `dl_begin_checkout` | Checkout started | yes |
| `dl_add_shipping_info` | Shipping info added | yes |
| `dl_add_payment_info` | Payment info added | yes |
| `dl_purchase` | The main order purchase | yes |
| `dl_refund` | Order refunded | **never fires** |
| `dl_view_promotion` | Promotion impression | **never fires** |
| `dl_select_promotion` | Promotion clicked | **never fires** |

**Identity**

| Event | What it records | Auto |
|---|---|---|
| `dl_user_data` | User + cart context, fired first on a page | yes |
| `dl_sign_up` | Account sign-up | yes |
| `dl_login` | Account login | yes |
| `dl_subscribe` | Subscription created | yes |
| `dl_start_trial` | Trial started | **never fires** |

**Post-purchase offers**

| Event | What it records | Auto |
|---|---|---|
| `dl_viewed_upsell` | Upsell offer viewed | yes |
| `dl_accepted_upsell` | Upsell accepted | **never fires** — superseded by `dl_upsell_purchase` |
| `dl_skipped_upsell` | Upsell skipped | yes |
| `dl_upsell_purchase` | Accepted upsell, in GA4 purchase format with `affiliation: "Upsell"` | yes |

**Cart lifecycle, navigation, engagement**

| Event | What it records | Auto |
|---|---|---|
| `dl_cart_updated` | Cart contents changed | yes |
| `dl_package_swapped` | Selected package swapped | yes |
| `dl_page_view` | Page view, SPA-aware | yes |
| `dl_route_changed` | Client-side route change | yes |
| `dl_scroll_depth` | Scroll-depth milestone | yes |
| `dl_exit_intent_shown` / `_accepted` / `_dismissed` / `_closed` / `_action` | Exit-intent popup lifecycle | yes |

**Seven names never fire.** `dl_search`, `dl_add_to_wishlist`, `dl_refund`, `dl_view_promotion`, `dl_select_promotion`, `dl_start_trial`, and `dl_accepted_upsell` are part of the vocabulary — validated, provider-mapped, blockable — but nothing in the SDK builds them. They exist so a page or server-side tag can push them under the canonical name. A GTM tag waiting on one of them waits forever; for accepted upsells, track `dl_upsell_purchase`.

## `dl_purchase` — the one that pays the bills

It fires on the page opened with `?ref_id=` that fetched a **paid** order — the success page, never the checkout page. Once per order: the SDK remembers reported `transaction_id`s in `localStorage`, and every payment method (card, 3-D Secure, PayPal, Apple Pay, Google Pay) reports from the page the shopper lands on after payment completes.

What that means for your funnel:

- **Your success page must load the SDK and keep `?ref_id=` on its URL.** The SDK appends `ref_id` to the success URL itself, so this holds unless the page strips it or redirects somewhere the SDK is not installed. Confirm `dl_purchase` fires there once, with the real order number, before trusting any conversion count.
- **`ecommerce.value` is item revenue only** — tax and shipping are separate fields by design. A GA4 revenue figure that looks low against the store's own totals is usually this, not a lost event.
- **`ecommerce.transaction_id` is the order reference** — the key every ad platform deduplicates on.
- **Zero-value orders report normally** (`value: 0` with a real transaction id) — full discounts and free trials count as conversions.
- **A failed redirect payment does not report.** Both `success_url` and `payment_failed_url` come back carrying `?ref_id=`, but nothing reports on the failure leg.
- **Meta deduplication needs `storeName`.** With `window.nextConfig.storeName` set, the Meta event carries `eventID: "{storeName}-{orderNumber}"`, which is what lets Meta deduplicate the browser event against a server-side copy of the same order.

## Providers

| Provider | Config key | Needs | Gets |
|---|---|---|---|
| NextCampaign | `analytics.providers.nextCampaign` | the campaign `apiKey` | Page views only, reported to the campaign analytics platform. |
| GTM | `analytics.providers.gtm` | nothing | Every event, pushed verbatim to `window.dataLayer` and `window.ElevarDataLayer`. |
| Facebook | `analytics.providers.facebook` | `settings.pixelId` | 19 mapped events via `fbq` — `dl_purchase` becomes `Purchase`, and so on. |
| RudderStack | `analytics.providers.rudderstack` | the page's `rudderanalytics` SDK | 18 events renamed to the RudderStack ecommerce spec — `dl_purchase` becomes `Order Completed`. |
| Custom | `analytics.providers.custom` | `settings.endpoint` | Every event, POSTed to your endpoint, batched with retries. |

Each provider accepts `blockedEvents: ["dl_page_view"]` to suppress names it would otherwise forward. Matching is verbatim against the canonical name — `"purchase"` blocks nothing, `"dl_purchase"` does.

## Manual tracking

`next.trackCustomEvent(name, data)` sends anything under your own name, and the `track*` methods cover standard events the SDK cannot see — an add-to-cart your own code performed, a hand-built checkout. The full method list, with the double-reporting traps, is in the [JavaScript API](./javascript-api.md).

## Cautions

- **The GTM provider does not load GTM.** Its `containerId` setting is never read; enabling it only wires events to `window.dataLayer`. Without the GTM snippet on the page, events pile up in the array and nothing reports them — add the container script yourself, the way the starter templates do in their base layout.
- **GTM pushes every event to two arrays.** A tag listening on both `dataLayer` and `ElevarDataLayer` counts everything twice — pick one.
- **NextCampaign fires its own extra page view** on window load, in addition to the mapped `dl_page_view` — expect two per page on that platform. It is also the one provider that loads a remote script, authenticated by your `apiKey`.
- **`next-page-type` decides which funnel step events land on.** A missing or mistyped page type files the page's events under the wrong step — set it on every page ([Getting Started](../start-here/getting-started.md)).
- **Do not hand-fire what auto mode already fires.** `trackPurchase` on the receipt or `trackBeginCheckout` next to the built-in form doubles the numbers.
