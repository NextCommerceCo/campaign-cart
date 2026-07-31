---
title: "Core/Reference/Analytics Events"
group: "Core"
category: "Core Reference"
---

# Analytics events

<!-- Generated. Do not edit by hand: edit src/docs/content/analytics-events.ts
     (prose) or the analytics source (facts), then run `npm run docs:reference`. -->

Every analytics event the SDK can fire, what triggers it, what it carries, and which of your tags will see it. Event names are the canonical `dl_*` names — the same strings you put in `blockedEvents` and the same strings that land in `window.NextDataLayer`.

There are **35** canonical events. **19** carry a field schema, which is checked only when debug mode is on and only ever logged — it never blocks an event (`analytics/index.ts:293-301`). What can stop an event before it is pushed is the separate always-on rule set in `analytics/config.ts`, which checks a handful of required fields per event rather than the whole schema. So a payload missing a schema field still ships; read the field tables as the shape to aim for, not a guarantee. **7** are declared but never fired by any SDK feature — they are listed so a page can push them and so they can be blocked, not because the SDK produces them.

## Nothing fires until you turn it on

The config store has no `analytics` block by default and **no meta tag creates one** — only `window.nextConfig.analytics` does. Until it exists, `config.analytics?.enabled` is `undefined`, the analytics boot returns at its first check, and the page fires **zero** events. A page with a GTM container on it and no `analytics` block sends nothing, and the only trace is one info log: `Analytics disabled in configuration`.

The second half is equally counter-intuitive: **providers are optional.** With `enabled: true` and no provider configured, every event is still built, validated, enriched and pushed to `window.NextDataLayer`. Providers are forwarders on top of that array, not the thing that produces it — so your own script can read the array and be the only consumer.

```html
<script>
  window.nextConfig = {
    apiKey: "{YOUR_CAMPAIGN_API_KEY}",
    analytics: {
      enabled: true,   // without this, nothing below runs
      mode: "auto",    // "manual" stops the automatic view/cart events
      debug: false,
      providers: {}    // valid: events still reach window.NextDataLayer
    }
  };
</script>
```

Verify it in the console — `window.NextDataLayer` grows as you interact, and `window.NextAnalytics.getStatus()` reports `initialized: true` with the provider list:

```js
window.NextAnalytics.getStatus();
// { initialized: true, debugMode: false, providers: ["gtm"],
//   eventsTracked: 4, ignored: false }
```

`mode: "auto"` is what fires view, cart and checkout events from page activity. In `"manual"` mode the meta-tag controls and your own `next.trackCustomEvent()` calls are the only sources — the vocabulary is identical either way.

## The vocabulary

Grouped the way the source groups it. Every name is exact — these are the strings that land in `window.NextDataLayer` and the strings `blockedEvents` matches.

### Commerce

| Event | What it records | Fired by the SDK |
|---|---|---|
| [`dl_view_item_list`](#dl_view_item_list) | Product list / collection impression | yes |
| [`dl_view_item`](#dl_view_item) | Product detail view | yes |
| [`dl_select_item`](#dl_select_item) | Product clicked from a list | yes |
| [`dl_view_search_results`](#dl_view_search_results) | Search results viewed | yes |
| [`dl_search`](#dl_search) | Search performed (Meta Search) | **no** |
| [`dl_add_to_cart`](#dl_add_to_cart) | Item added to cart | yes |
| [`dl_remove_from_cart`](#dl_remove_from_cart) | Item removed from cart | yes |
| [`dl_add_to_wishlist`](#dl_add_to_wishlist) | Item added to wishlist | **no** |
| [`dl_view_cart`](#dl_view_cart) | Cart viewed | yes |
| [`dl_begin_checkout`](#dl_begin_checkout) | Checkout started | yes |
| [`dl_add_shipping_info`](#dl_add_shipping_info) | Shipping info added | yes |
| [`dl_add_payment_info`](#dl_add_payment_info) | Payment info added | yes |
| [`dl_purchase`](#dl_purchase) | Main order purchase | yes |
| [`dl_refund`](#dl_refund) | Order refunded (adapter-mapped) | **no** |
| [`dl_view_promotion`](#dl_view_promotion) | Promotion impression | **no** |
| [`dl_select_promotion`](#dl_select_promotion) | Promotion clicked | **no** |

### Identity

| Event | What it records | Fired by the SDK |
|---|---|---|
| [`dl_user_data`](#dl_user_data) | User + cart context (fired first) | yes |
| [`dl_sign_up`](#dl_sign_up) | Account sign-up | yes |
| [`dl_login`](#dl_login) | Account login | yes |
| [`dl_subscribe`](#dl_subscribe) | Subscription created | yes |
| [`dl_start_trial`](#dl_start_trial) | Trial started (Meta StartTrial) | **no** |

### Post-purchase offers

| Event | What it records | Fired by the SDK |
|---|---|---|
| [`dl_viewed_upsell`](#dl_viewed_upsell) | Upsell offer viewed | yes |
| [`dl_accepted_upsell`](#dl_accepted_upsell) | Upsell accepted | **no** |
| [`dl_skipped_upsell`](#dl_skipped_upsell) | Upsell skipped | yes |
| [`dl_upsell_purchase`](#dl_upsell_purchase) | Accepted upsell in GA4 purchase format | yes |

### Cart lifecycle

| Event | What it records | Fired by the SDK |
|---|---|---|
| [`dl_cart_updated`](#dl_cart_updated) | Cart contents changed | yes |
| [`dl_package_swapped`](#dl_package_swapped) | Selected package swapped | yes |

### Navigation

| Event | What it records | Fired by the SDK |
|---|---|---|
| [`dl_page_view`](#dl_page_view) | Page view (SPA-aware) | yes |
| [`dl_route_changed`](#dl_route_changed) | Client-side route change | yes |

### Engagement

| Event | What it records | Fired by the SDK |
|---|---|---|
| [`dl_scroll_depth`](#dl_scroll_depth) | Scroll-depth milestone | yes |
| [`dl_exit_intent_shown`](#dl_exit_intent_shown) | Exit-intent popup shown | yes |
| [`dl_exit_intent_accepted`](#dl_exit_intent_accepted) | Exit-intent offer accepted | yes |
| [`dl_exit_intent_dismissed`](#dl_exit_intent_dismissed) | Exit-intent popup dismissed | yes |
| [`dl_exit_intent_closed`](#dl_exit_intent_closed) | Exit-intent popup closed | yes |
| [`dl_exit_intent_action`](#dl_exit_intent_action) | Exit-intent custom action | yes |

## Declared but never fired

These names are part of the vocabulary — validated, mapped by providers, blockable — yet nothing in the SDK builds them. A tag waiting for one of these will wait forever, which is the most expensive way to find this out.

| Event | Why it is in the vocabulary |
|---|---|
| `dl_search` | Declared for Meta's Search event and for `blockedEvents` completeness; no SDK feature builds it. |
| `dl_add_to_wishlist` | No wishlist feature exists in the SDK; the name is reserved so GTM and Meta mappings are ready if a page pushes it. |
| `dl_refund` | Reserved so a page or a server-side tag can push a refund under the canonical name; GTM already shapes it as GA4 ecommerce. |
| `dl_view_promotion` | Reserved for pages that report their own banner or offer impressions; GTM has the GA4 promotion field mapping ready. |
| `dl_select_promotion` | Reserved for pages that report their own promotion clicks. |
| `dl_start_trial` | No trial feature exists in the SDK; the Meta mapping is ready for a page that pushes the name. |
| `dl_accepted_upsell` | Superseded by `dl_upsell_purchase`. The name, its field schema and its Meta mapping all survive, so a tag written against it never fires — track `dl_upsell_purchase` instead. |

## Payload reference

One entry per event: when it fires, where the SDK builds it, which destinations receive it, and every field with what it means to the business. Types are read from the validation schema, so they are the types the pipeline enforces.

## Commerce events

### `dl_view_item_list`

**Fires when:** A group of offers becomes visible — a package selector or product grid scrolls into view, or a `next-analytics-view-item-list` meta tag names the packages to report on page load.

**Reaches:** GTM (verbatim), RudderStack `Product List Viewed`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createViewItemListEvent`

RudderStack sends the whole list as a `products[]` array. Meta has no name for a list impression, so it skips this event.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.item_list_id` | `string` | no | Identifier of the on-page list the shopper was looking at, so a click can be attributed to the list that produced it. |
| `ecommerce.item_list_name` | `string` | no | Human-readable name of that list — what appears in reports. |
| `ecommerce.impressions` | `Product[]` | no | Deprecated copy of `items`, kept so Elevar-era tags keep working. Read `items` in new tags; this field will not gain new data. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

> ⚠️ It fires once per list per page. Re-rendering the list does not fire it again, so a list rebuilt by your own code will be missing from reports — fire it yourself with `next.trackViewItemList()` if you rebuild lists dynamically.

### `dl_view_item`

**Fires when:** A single offer is presented as the focus of the page, or a `next-analytics-view-item` meta tag names the package.

**Reaches:** GTM (verbatim), Meta `ViewContent`, RudderStack `Product Viewed`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createViewItemEvent`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

### `dl_select_item`

**Fires when:** The shopper picks one offer out of a list.

**Reaches:** GTM (verbatim), RudderStack `Product Clicked`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createSelectItemEvent`

Meta has no name for a list click, so it skips this event. The list the offer was chosen from travels with it.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.item_list_id` | `string` | no | Identifier of the on-page list the shopper was looking at, so a click can be attributed to the list that produced it. |
| `ecommerce.item_list_name` | `string` | no | Human-readable name of that list — what appears in reports. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

### `dl_view_search_results`

**Fires when:** A page of search results is shown to the shopper.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createViewSearchResultsEvent`

Meta's search event is `dl_search`, which the SDK never fires — so search results reach your GTM container and nowhere else.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `search_term` | `string` | yes | Exactly what the shopper typed into the search box. |
| `ecommerce` | `object` | no | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.item_list_name` | `string` | no | Human-readable name of that list — what appears in reports. |
| `ecommerce.impressions` | `Product[]` | no | Deprecated copy of `items`, kept so Elevar-era tags keep working. Read `items` in new tags; this field will not gain new data. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

### `dl_search`

**Nothing in the SDK builds this event.** Declared for Meta's Search event and for `blockedEvents` completeness; no SDK feature builds it.

**If your page pushes it:** a shopper searched, and the results view should be reported to Meta as `Search`.

**Reaches:** GTM (verbatim), Meta `Search`

Mapped by Meta to `Search`. GTM forwards it if you push it.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_add_to_cart`

**Fires when:** A package is added to the cart — an add-to-cart button, a selector in swap mode, or a quantity increase.

**Reaches:** GTM (verbatim), Meta `AddToCart`, RudderStack `Product Added`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createAddToCartEvent`

Becomes Meta `AddToCart` and RudderStack `Product Added`. RudderStack reports only the **first** line of `items`, per its spec, so a multi-line add is under-reported there while GTM sees every line.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

> ⚠️ Pairing a swap-mode package selector with a separate add-to-cart action writes the cart twice and fires this event twice. Use one or the other on a given selector.

### `dl_remove_from_cart`

**Fires when:** A line leaves the cart — a remove control, or a quantity decrease that reaches zero.

**Reaches:** GTM (verbatim), Meta `RemoveFromCart` (custom), RudderStack `Product Removed`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createRemoveFromCartEvent`

`RemoveFromCart` is a Meta *custom* event rather than a standard one, so it will not appear in Meta's standard-event reporting until you define it there.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

### `dl_add_to_wishlist`

**Nothing in the SDK builds this event.** No wishlist feature exists in the SDK; the name is reserved so GTM and Meta mappings are ready if a page pushes it.

**If your page pushes it:** a shopper saved an offer for later, on a page that implements its own wishlist.

**Reaches:** GTM (verbatim), Meta `AddToWishlist`

Mapped by Meta to `AddToWishlist`, and treated as GA4 ecommerce by GTM.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_view_cart`

**Fires when:** The cart contents are shown — a cart page loads, or a cart panel opens.

**Reaches:** GTM (verbatim), Meta `ViewCart` (custom), RudderStack `Cart Viewed`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createViewCartEvent`

`ViewCart` is a Meta custom event. RudderStack correlates cart and checkout events by the analytics session id, which it sends as `cart_id`.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

### `dl_begin_checkout`

**Fires when:** The shopper reaches checkout with a non-empty cart, or submits the first checkout step.

**Reaches:** GTM (verbatim), Meta `InitiateCheckout`, RudderStack `Checkout Started`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createBeginCheckoutEvent`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.checkout_id` | `string` | no | Identifier grouping the steps of one checkout attempt, so start → shipping → payment can be joined. |
| `ecommerce.checkout_step` | `number` | no | Which step of checkout this is, counting from 1. Lets you measure drop-off between steps. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

### `dl_add_shipping_info`

**Fires when:** A shipping method is chosen or confirmed during checkout.

**Reaches:** GTM (verbatim), Meta `AddShippingInfo` (custom), RudderStack `Checkout Step Completed`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createAddShippingInfoEvent`

RudderStack reports it as checkout `step: 2` — its spec has no shipping event, so shipping is modelled as a numbered step. `AddShippingInfo` is a Meta custom event.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.shipping_tier` | `string` | no | Name of the shipping method chosen, as the shopper saw it. |
| `shipping_tier` | `string` | no | Name of the shipping method the shopper chose, duplicated at the top level for tags that read it there. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

### `dl_add_payment_info`

**Fires when:** Payment details are accepted by the form — after validation, before the order is created.

**Reaches:** GTM (verbatim), Meta `AddPaymentInfo`, RudderStack `Payment Info Entered`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createAddPaymentInfoEvent`

RudderStack reports it as checkout `step: 3`.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.payment_type` | `string` | no | Payment method chosen, as the shopper saw it. |
| `payment_type` | `string` | no | Payment method the shopper chose (card, PayPal, …), duplicated at the top level for tags that read it there. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

### `dl_purchase`

**Fires when:** An order is created successfully — the main conversion.

**Reaches:** GTM (verbatim), Meta `Purchase`, RudderStack `Order Completed`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createPurchaseEvent`

Becomes Meta `Purchase` and RudderStack `Order Completed`. Meta gets an `eventID` of `{storeName}-{orderNumber}` when a store name is configured, which is what lets Meta deduplicate this browser event against a server-side copy of the same order. RudderStack recomputes `total` as value + tax + shipping and also calls `identify()` from the event's user properties.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.transaction_id` | `string` | yes | The order reference. This is the key ad platforms and the store both deduplicate on, so it must be the same string everywhere for one order. |
| `ecommerce.affiliation` | `string` | no | Which storefront the sale is credited to. Main orders carry the store name; post-purchase upsells carry `Upsell`, which is how you separate the two revenue streams. |
| `ecommerce.tax` | `number` | no | Tax charged on the order, reported apart from `value`. |
| `ecommerce.shipping` | `number` | no | Shipping charged on the order, reported apart from `value`. |
| `ecommerce.discount` | `number` | no | Total taken off the order across all lines, as a positive amount. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

> ⚠️ Validation requires `ecommerce.value` to be truthy, so a zero-value order — a 100% discount, a free trial — is dropped before it reaches the data layer and no provider ever sees it. Check the order total first when a conversion is missing.
>
> ⚠️ Reporting `value` as item revenue means it excludes tax and shipping by design. A GA4 revenue figure that looks low against the store's own total is usually this, not a lost event.

### `dl_refund`

**Nothing in the SDK builds this event.** Reserved so a page or a server-side tag can push a refund under the canonical name; GTM already shapes it as GA4 ecommerce.

**If your page pushes it:** an order was refunded. Refunds happen in the back office, so this is a server-side or tag-side push rather than a page event.

**Reaches:** GTM (verbatim)

GTM treats it as ecommerce and adds `transaction_id`, `tax` and `shipping`. No other provider maps it.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_view_promotion`

**Nothing in the SDK builds this event.** Reserved for pages that report their own banner or offer impressions; GTM has the GA4 promotion field mapping ready.

**If your page pushes it:** a banner or promotional offer was shown to the shopper.

**Reaches:** GTM (verbatim)

GTM shapes `creative_name`, `creative_slot`, `promotion_id` and `promotion_name` for it — but only on the non-`dl_` path.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_select_promotion`

**Nothing in the SDK builds this event.** Reserved for pages that report their own promotion clicks.

**If your page pushes it:** the shopper clicked a banner or promotional offer.

**Reaches:** GTM (verbatim)

Same GA4 promotion shaping as `dl_view_promotion` in GTM.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

## Identity events

### `dl_user_data`

**Fires when:** First, before any other event, at the start of every page in auto mode — and again on every client-side route change. It establishes who the shopper is and what is in the cart so later events can be attributed.

**Reaches:** GTM (verbatim), Meta `PageView`, RudderStack (own handler)

**Built at:** `core/analytics/DataLayerManager.ts › DataLayerManager.formatUserDataEvent`, `core/analytics/index.ts › NextAnalytics.invalidateContext`, `core/analytics/tracking/UserDataTracker.ts › UserDataTracker.trackUserData`

Meta treats it as `PageView`. RudderStack turns it into an `identify()` call — and **skips it entirely for a guest**, because there is no email or user id to identify. GTM receives it like any other event.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `user_properties` | `UserProperties` | yes | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |
| `ecommerce` | `object` | no | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue of the current cart: price × quantity summed, excluding tax and shipping. `0` on an empty cart. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | A snapshot of the whole cart at this moment — not the line the shopper acted on. See [Product lines](#product-lines). |
| `ecommerce.cart_contents` | `Product[]` | no | Deprecated copy of the cart lines, kept for Elevar-era tags. Read `items` instead. |

> ⚠️ The boot sequence waits 100 ms after firing this before starting the other trackers, so it is always first in the array. Code that pushes its own events during boot can land ahead of it and lose that ordering guarantee.

### `dl_sign_up`

**Fires when:** An account is created. On a campaign page this is driven by your own code calling `next.trackSignUp(email)` — no feature fires it.

**Reaches:** GTM (verbatim), Meta `CompleteRegistration`, RudderStack `Signed Up`

**Built at:** `core/analytics/events/UserEvents.ts › UserEvents.createSignUpEvent`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |
| `method` | `string` | no | How the shopper identified themselves, e.g. `email`. Always `email` today, since that is the only route the SDK offers. |

### `dl_login`

**Fires when:** A shopper signs in, via `next.trackLogin(email)`. Campaign pages have no login form of their own.

**Reaches:** GTM (verbatim), Meta `Login` (custom), RudderStack `Logged In`

**Built at:** `core/analytics/events/UserEvents.ts › UserEvents.createLoginEvent`

`Login` is a Meta custom event, not a standard one.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |
| `method` | `string` | no | How the shopper identified themselves, e.g. `email`. Always `email` today, since that is the only route the SDK offers. |

### `dl_subscribe`

**Fires when:** A subscription is created — a recurring package is purchased or a trial converts.

**Reaches:** GTM (verbatim), Meta `Subscribe` (custom)

**Built at:** `core/analytics/events/UserEvents.ts › UserEvents.createSubscribeEvent`

`Subscribe` is a Meta custom event. RudderStack has no mapping for it, so subscriptions never reach that destination.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | no | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.subscription_id` | `string` | no | Identifier of the subscription created, for joining the sign-up to later renewals. |
| `ecommerce.subscription_status` | `string` | no | Where the new subscription stands — active, trialling, pending. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

> ⚠️ Validation requires a top-level `lead_type` on this event, which is not part of its field schema. An event built only from the schema is dropped before the push — supply `lead_type` when you build one by hand.

### `dl_start_trial`

**Nothing in the SDK builds this event.** No trial feature exists in the SDK; the Meta mapping is ready for a page that pushes the name.

**If your page pushes it:** a shopper started a trial — Meta's StartTrial, for pages that sell trials.

**Reaches:** GTM (verbatim), Meta `StartTrial` (custom)

Mapped by Meta to `StartTrial`, a custom event.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

## Post-purchase offers events

### `dl_viewed_upsell`

**Fires when:** A post-purchase offer becomes visible on the upsell page, after the original order is already paid for.

**Reaches:** GTM (verbatim), Meta `ViewedUpsell` (custom), RudderStack `Upsell Viewed`

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handleUpsellViewed`

Both vendor names are custom events, outside either vendor's standard set — define them at the destination before reporting on them.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `order_id` | `string` | yes | The order the offer belongs to — the original purchase, not the upsell being viewed. |
| `upsell` | `object` | yes | The post-purchase offer this event is about. Present only on the offer events, which do not use the `ecommerce` block. |
| `upsell.package_id` | `string` | yes | Package being offered after the order. |
| `upsell.package_name` | `string` | yes | Display name of that offer, as shown to the shopper. |
| `upsell.price` | `number` | no | Price shown on the offer, per unit. |
| `upsell.currency` | `string` | no | Currency the offer price is stated in. |

### `dl_accepted_upsell`

**Nothing in the SDK builds this event.** Superseded by `dl_upsell_purchase`. The name, its field schema and its Meta mapping all survive, so a tag written against it never fires — track `dl_upsell_purchase` instead.

**If your page pushes it:** a post-purchase offer was accepted. The SDK reports that as `dl_upsell_purchase` instead, in GA4 purchase shape, so upsell revenue lands in the same reports as the main order.

**Reaches:** GTM (verbatim), Meta `AcceptedUpsell` (custom)

Mapped by Meta to `AcceptedUpsell`, and validated as if it fired. No RudderStack mapping.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `order_id` | `string` | yes | The order the offer belongs to — the original purchase, not the upsell being viewed. |
| `upsell` | `object` | yes | The post-purchase offer this event is about. Present only on the offer events, which do not use the `ecommerce` block. |
| `upsell.package_id` | `string` | yes | Package being offered after the order. |
| `upsell.package_name` | `string` | no | Display name of that offer, as shown to the shopper. |
| `upsell.quantity` | `number` | no | How many units the shopper accepted. |
| `upsell.value` | `number` | yes | Revenue actually added by accepting the offer, across all units — the figure to sum for incremental upsell revenue. |
| `upsell.currency` | `string` | no | Currency the offer price is stated in. |

> ⚠️ Blocking or listening for `dl_accepted_upsell` has no effect, in either direction: nothing produces it. Use `dl_upsell_purchase` in `blockedEvents` and in your tags.

### `dl_skipped_upsell`

**Fires when:** The shopper declines a post-purchase offer and moves on.

**Reaches:** GTM (verbatim), Meta `SkippedUpsell` (custom), RudderStack `Upsell Skipped`

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handleUpsellSkipped`

Both vendor names are custom events, outside either vendor's standard set.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `order_id` | `string` | yes | The order the offer belongs to — the original purchase, not the upsell being viewed. |
| `upsell` | `object` | yes | The post-purchase offer this event is about. Present only on the offer events, which do not use the `ecommerce` block. |
| `upsell.package_id` | `string` | no | Package being offered after the order. |
| `upsell.package_name` | `string` | no | Display name of that offer, as shown to the shopper. |

### `dl_upsell_purchase`

**Fires when:** A post-purchase offer is accepted and charged. This is the revenue event for upsells — a second transaction against the same shopper.

**Reaches:** GTM (verbatim), RudderStack `Order Completed`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createAcceptedUpsellEvent`

RudderStack sends it as a second `Order Completed`. Meta has no mapping for it, so accepted upsells do **not** reach the Meta Pixel as purchases — a real gap if you optimise Meta campaigns on total revenue.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event` | `string` | yes | The canonical event name. Your GTM container matches on this string verbatim; the other providers rename it. |
| `ecommerce` | `object` | yes | The GA4 commerce block: which lines this event is about and what they are worth. |
| `ecommerce.currency` | `string` | no | Currency every amount in this event is stated in, taken from the loaded campaign. Falls back to `USD` when no campaign has loaded. |
| `ecommerce.value` | `number` | no | Item revenue for this event: the sum of price × quantity across the lines, **excluding tax and shipping**. Those are reported separately so this figure stays comparable across the funnel. |
| `ecommerce.coupon` | `string` | no | Discount code applied to the order when the event fired. Absent when the shopper entered none, or when an offer price was applied without a code. |
| `ecommerce.items` | `Product[]` | no | The lines this event is about. See [Product lines](#product-lines). |
| `ecommerce.transaction_id` | `string` | yes | The upsell's own order reference, `{order}-US{n}` — deliberately different from the original order id so the two purchases are not deduplicated into one. |
| `ecommerce.affiliation` | `string` | no | Always `Upsell` here, which is how upsell revenue is separated from the main order in reports. |
| `ecommerce.tax` | `number` | no | Tax charged on the order, reported apart from `value`. |
| `ecommerce.shipping` | `number` | no | Shipping charged on the order, reported apart from `value`. |
| `upsell_metadata` | `object` | no | Which offer in the sequence produced this second purchase, so post-purchase revenue can be traced back to the original order. |
| `upsell_metadata.original_order_id` | `string` | no | The first order — the one the shopper had already paid for when the offer appeared. |
| `upsell_metadata.upsell_number` | `number` | no | Position of this offer in the post-purchase flow, counting from 1. Tells you whether shoppers accept the second offer as readily as the first. |
| `upsell_metadata.package_id` | `string` | no | Package that was accepted. |
| `upsell_metadata.package_name` | `string` | no | Display name of the accepted package. |
| `user_properties` | `UserProperties` | no | Who the shopper is. See [User properties](#user-properties) — mostly empty before checkout. |

> ⚠️ It is queued rather than pushed on the page where it happens, because that page redirects immediately. Expect it in the data layer of the *next* page, roughly 200 ms after boot.

## Cart lifecycle events

### `dl_cart_updated`

**Fires when:** The cart contents change for any reason — a line added, removed, or its quantity changed. A snapshot event, fired alongside the specific one.

**Reaches:** GTM (verbatim), RudderStack `Cart Viewed`

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createCartUpdatedEvent`

RudderStack maps it to `Cart Viewed`, the same name it uses for `dl_view_cart`, so the two are indistinguishable downstream unless you block one. Meta has no mapping.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_package_swapped`

**Fires when:** A selector in swap mode replaces one package with another in a single step, rather than removing and adding.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/events/EcommerceEvents.ts › EcommerceEvents.createPackageSwappedEvent`, `core/analytics/tracking/AutoEventListener.ts › handlePackageSwapped`

No vendor models a swap as one action, so neither Meta nor RudderStack maps it — a swap is visible to your GTM container only.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

> ⚠️ Validation requires `ecommerce.items_removed` and `ecommerce.items_added`, which are not in any field schema. An event built without both is dropped before the push.

## Navigation events

### `dl_page_view`

**Fires when:** A page is shown, including client-side navigations that never reload the document.

**Reaches:** GTM (verbatim), Meta `PageView`, RudderStack (own handler), NextCampaign `page_view`

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handlePageView`

The only event NextCampaign forwards. RudderStack turns it into a `page()` call plus a `{PageType} Page View` track event, and sends it **once per page load** — a second page view in the same load is skipped as a duplicate. Meta maps it to `PageView`.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_route_changed`

**Fires when:** The URL changes without a document load — a single-page navigation.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handleRouteChanged`

Redundant with `dl_page_view`, which fires for the same navigation — report on one of the two, not both.

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

## Engagement events

### `dl_scroll_depth`

**Fires when:** The shopper scrolls past a threshold named in the `next-analytics-scroll-tracking` meta tag. Each threshold fires once per page.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/tracking/MetaTagController.ts › scrollHandler`

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_exit_intent_shown`

**Fires when:** An exit-intent popup is displayed because the shopper moved to leave.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handleExitIntentShown`

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_exit_intent_accepted`

**Fires when:** The shopper takes the offer in an exit-intent popup.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handleExitIntentClicked`

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_exit_intent_dismissed`

**Fires when:** The shopper declines an exit-intent popup — the explicit "no thanks" path, as opposed to closing it.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handleExitIntentDismissed`

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_exit_intent_closed`

**Fires when:** The shopper closes an exit-intent popup without answering it, e.g. the X or the overlay.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handleExitIntentClosed`

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

### `dl_exit_intent_action`

**Fires when:** A custom action inside an exit-intent popup runs — anything the popup defines beyond accept, dismiss and close.

**Reaches:** GTM (verbatim)

**Built at:** `core/analytics/tracking/AutoEventListener.ts › handleExitIntentAction`

No field schema is declared for this event, so validation only checks that it has a name. Treat its payload as whatever the code that builds it puts there.

## User properties

Who the shopper is, as far as this page knows. Almost everything here is empty until the checkout form has been filled in, so an event fired on a landing page carries little more than `visitor_type`.

| Field | Type | Meaning |
|---|---|---|
| `visitor_type` | `string` | Whether the shopper is signed in. `guest` on every campaign page — the SDK has no account concept, so this is effectively a constant. |
| `customer_id` | `string` | The store's identifier for a known customer. Present only after an order exists. |
| `customer_email` | `string` | Email the shopper typed into checkout. The value ad platforms match on, so its absence is why a conversion may go unattributed. |
| `customer_phone` | `string` | Phone number from checkout, unformatted as entered. |
| `customer_first_name` | `string` | Given name from the billing details. |
| `customer_last_name` | `string` | Family name from the billing details. |
| `customer_address_city` | `string` | City from the billing address. |
| `customer_address_province` | `string` | State or province name from the billing address. |
| `customer_address_province_code` | `string` | Short state/province code, for platforms that require the abbreviation rather than the full name. |
| `customer_address_country` | `string` | Country name from the billing address. |
| `customer_address_country_code` | `string` | Two-letter country code — the form most ad platforms expect. |
| `customer_address_zip` | `string` | Postal code from the billing address. |
| `customer_order_count` | `number` | How many orders this shopper has placed before, for separating new customers from repeat ones. |
| `customer_total_spent` | `number` | Lifetime spend to date, in the campaign currency. Absent for a first-time shopper. |
| `customer_tags` | `string` | Free-form labels the store has attached to the customer, comma-separated. |

## Product lines

One line of the offer, in GA4 item shape. The SDK builds these from the campaign's packages, so `item_id` is the package reference rather than a bare product id.

| Field | Type | Meaning |
|---|---|---|
| `item_id` | `string` | The package identifier the shopper acted on — what ties an event back to the campaign offer. |
| `item_name` | `string` | Display name of the package, as shown on the page. |
| `affiliation` | `string` | Which storefront the line is credited to. |
| `coupon` | `string` | Discount code applied to this line specifically. |
| `currency` | `string` | Currency this line's price is stated in. |
| `discount` | `number` | Amount taken off this line per unit — the difference between the compare-at price and what is being charged. |
| `index` | `number` | Where the line sat in the list the shopper was looking at, counted from 0. Lets you tell a first-position click from a fifth. |
| `item_brand` | `string` | Brand or product name behind the package. |
| `item_category` | `string` | Top-level grouping, set to the campaign name so events can be split per funnel. |
| `item_category2` | `string` | Second grouping level, when the catalog uses one. |
| `item_category3` | `string` | Third grouping level, when the catalog uses one. |
| `item_category4` | `string` | Fourth grouping level, when the catalog uses one. |
| `item_category5` | `string` | Fifth grouping level, when the catalog uses one. |
| `item_list_id` | `string` | Identifier of the list this line was shown in. |
| `item_list_name` | `string` | Human-readable name of that list. |
| `item_variant` | `string` | Which variant was chosen — size, colour, flavour. Empty when the package has no variants. |
| `item_image` | `string` | Image URL for the line, for platforms that show a thumbnail. |
| `location_id` | `string` | Physical or logical location the sale is attributed to. |
| `price` | `number` | Per-unit price actually being charged, after any offer discount — not the compare-at price. |
| `quantity` | `number` | How many units of the package this line covers. |

## See also

- [Analytics providers](./analytics-providers.md) — what each destination does with these events, and what to do when one receives nothing.
- [`useConfigStore`](../../../state/config/guide/reference/state-reference.md) — the `analytics` block that decides whether any of this runs.
