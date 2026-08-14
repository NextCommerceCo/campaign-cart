---
title: "Reference/Analytics Events"
group: "Reference"
category: "Reference"
---

# Analytics events

The SDK reports funnel activity as `dl_*` events (view, add-to-cart, checkout, purchase, upsell), pushed to its own `window.NextDataLayer` array and forwarded to whichever providers you configure. This page lists every event name, what fires automatically, the purchase event in detail, and the configuration mistakes that produce wrong numbers.

## Enabling analytics

There is no default analytics setup and no meta tag creates one. Only `window.nextConfig.analytics` does. Without it, the page sends zero events and the only trace is one info log: `Analytics disabled in configuration`.

```html
<script>
  window.nextConfig = {
    apiKey: '{YOUR_CAMPAIGN_API_KEY}',
    analytics: {
      enabled: true,
      mode: 'auto',
      debug: false,
      providers: {},
    },
  };
</script>
```

Providers are optional. With `enabled: true` and no providers, every event is still built, validated, and pushed to `window.NextDataLayer`. Providers are forwarders on top of that array, so your own script can read it and be the only consumer. `mode: "auto"` fires the view, cart, and checkout events from page activity. `"manual"` mode only switches those auto-trackers off: every `next.track*` method (`trackViewItem`, `trackPurchase`, `trackCustomEvent`, and the rest) still works and becomes your only source, with the same event names.

Verify in the console: `window.NextDataLayer` grows as you interact, and `window.NextAnalytics.getStatus()` reports `initialized: true` with the provider list.

## Event names

Every name is exact. These are the strings that land in `window.NextDataLayer`, and the strings `blockedEvents` must match verbatim: `"purchase"` blocks nothing, `"dl_purchase"` does.

### Commerce events

| Event | Description |
|---|---|
| [`dl_view_item_list`](#dl_view_item_list) | Product list / collection impression |
| [`dl_view_item`](#dl_view_item) | Product detail view |
| [`dl_select_item`](#dl_select_item) | Product clicked from a list |
| [`dl_view_search_results`](#dl_view_search_results) | Search results viewed |
| [`dl_add_to_cart`](#dl_add_to_cart) | Item added to cart |
| [`dl_remove_from_cart`](#dl_remove_from_cart) | Item removed from cart |
| [`dl_view_cart`](#dl_view_cart) | Cart viewed |
| [`dl_begin_checkout`](#dl_begin_checkout) | Checkout started |
| [`dl_add_shipping_info`](#dl_add_shipping_info) | Shipping info added |
| [`dl_add_payment_info`](#dl_add_payment_info) | Payment info added |
| [`dl_purchase`](#dl_purchase) | Main order purchase |

### Identity events

| Event | Description |
|---|---|
| [`dl_user_data`](#dl_user_data) | User + cart context (fired first) |
| [`dl_subscribe`](#dl_subscribe) | Subscription created |

### Post-purchase offer events

| Event | Description |
|---|---|
| [`dl_viewed_upsell`](#dl_viewed_upsell) | Upsell offer viewed |
| [`dl_skipped_upsell`](#dl_skipped_upsell) | Upsell skipped |
| [`dl_upsell_purchase`](#dl_upsell_purchase) | Accepted upsell in GA4 purchase format |

### Cart, navigation, and engagement events

| Event | Description |
|---|---|
| [`dl_cart_updated`](#dl_cart_updated) | Cart contents changed |
| [`dl_package_swapped`](#dl_package_swapped) | Selected package swapped |
| [`dl_page_view`](#dl_page_view) | Page view (SPA-aware) |
| [`dl_route_changed`](#dl_route_changed) | Client-side route change |
| [`dl_scroll_depth`](#dl_scroll_depth) | Scroll-depth milestone |
| [`dl_exit_intent_shown`](#dl_exit_intent_shown) | Exit-intent popup shown |
| [`dl_exit_intent_accepted`](#dl_exit_intent_accepted) | Exit-intent offer accepted |
| [`dl_exit_intent_dismissed`](#dl_exit_intent_dismissed) | Exit-intent popup dismissed |
| [`dl_exit_intent_closed`](#dl_exit_intent_closed) | Exit-intent popup closed |
| [`dl_exit_intent_action`](#dl_exit_intent_action) | Exit-intent custom action |

### Fired only by your code

These two have no automatic trigger. Call the method and the SDK builds the event.

| Event | Method |
|---|---|
| [`dl_sign_up`](#dl_sign_up) | `next.trackSignUp()` |
| [`dl_login`](#dl_login) | `next.trackLogin()` |

### Declared but never fired

These names are validated, provider-mapped, and blockable, but nothing in the SDK builds them. They exist so a page or a server-side tag can push them under the canonical name. A tag waiting on one waits forever.

| Event | Description |
|---|---|
| [`dl_search`](#dl_search) | Search performed (Meta Search) |
| [`dl_add_to_wishlist`](#dl_add_to_wishlist) | Item added to wishlist |
| [`dl_refund`](#dl_refund) | Order refunded (adapter-mapped) |
| [`dl_view_promotion`](#dl_view_promotion) | Promotion impression |
| [`dl_select_promotion`](#dl_select_promotion) | Promotion clicked |
| [`dl_start_trial`](#dl_start_trial) | Trial started (Meta StartTrial) |
| [`dl_accepted_upsell`](#dl_accepted_upsell) | Upsell accepted |

For accepted upsells, track `dl_upsell_purchase` instead of `dl_accepted_upsell`.

## Providers

Providers are forwarders on top of `window.NextDataLayer`. With `analytics.enabled: true` and none configured, every event is still built, validated, and pushed to that array, so your own script can read it and be the only consumer.

| Provider | Description |
|---|---|
| `nextCampaign` | Page views only, to the campaign analytics platform |
| `gtm` | Every event, verbatim to `window.dataLayer` |
| `facebook` | 19 mapped events via `fbq` |
| `rudderstack` | 18 events renamed to the RudderStack spec |
| `custom` | Every event, POSTed to your endpoint in batches |

Each is configured under `analytics.providers.<name>`.

### What each provider needs

| Provider | Required setting |
|---|---|
| `nextCampaign` | the campaign `apiKey` |
| `gtm` | nothing |
| `facebook` | `settings.pixelId` |
| `rudderstack` | the page's `rudderanalytics` SDK |
| `custom` | `settings.endpoint` |

### Renamed events

Two providers rename events on the way out. GTM and Custom send the canonical `dl_*` name.

**Meta**

| Canonical | Sent as |
|---|---|
| `dl_purchase` | `Purchase` |

**RudderStack**

| Canonical | Sent as |
|---|---|
| `dl_purchase` | `Order Completed` |

`dl_upsell_purchase` has no Meta mapping and is dropped, so upsell revenue never reaches Meta from the browser.

Each provider accepts `blockedEvents: ["dl_page_view"]` to suppress names it would otherwise forward. Matching is verbatim against the canonical name: `"purchase"` blocks nothing, `"dl_purchase"` does.

## Manual tracking

`next.trackCustomEvent(name, data)` sends anything under your own name, and the `track*` methods cover standard events the SDK cannot see: an add-to-cart your own code performed, a hand-built checkout. The full method list, with the double-reporting warnings, is in the [JavaScript API](./javascript-api.md).

## Cautions

- **The GTM provider does not load GTM.** Its `containerId` setting is never read; enabling it only wires events to `window.dataLayer`. Without the GTM snippet on the page, events pile up in the array and nothing reports them. Add the container script yourself, the way the starter templates do in their base layout.
- **GTM pushes every event to two arrays.** A tag listening on both `dataLayer` and `ElevarDataLayer` counts everything twice. Pick one.
- **NextCampaign fires its own extra page view** on window load, in addition to the mapped `dl_page_view`, so expect two per page on that platform. It is also the one provider that loads a remote script, authenticated by your `apiKey`.
- **`next-page-type` decides which funnel step events land on.** A missing or mistyped page type files the page's events under the wrong step. Set it on every page ([Getting Started](../start-here/getting-started.md)).
- **Do not hand-fire what auto mode already fires.** `trackPurchase` on the receipt or `trackBeginCheckout` next to the built-in form doubles the numbers.

## Payload reference

One section per event, with the payload it pushes to `window.NextDataLayer`.

Every payload below shows the fields the SDK actually populates. Item objects are typed by {@link ProductSchema} and the `user_properties` block by {@link UserPropertiesSchema}; both pages list the full set of fields the validator accepts, including ones no builder fills in.

Fields come from `core/analytics/schemas/index.ts › eventSchemas` for the 19 events that declare a schema. The rest are read from their builders, named in the section.

### dl_view_item_list

Product list / collection impression.

```json
{
  "event": "dl_view_item_list",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "item_list_id": "main",
    "item_list_name": "Bundles",
    "impressions": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ]
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_view_item

Product detail view.

```json
{
  "event": "dl_view_item",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ]
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_select_item

Product clicked from a list.

```json
{
  "event": "dl_select_item",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "item_list_id": "main",
    "item_list_name": "Bundles"
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_view_search_results

Search results viewed.

```json
{
  "event": "dl_view_search_results",
  "search_term": "widget",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "item_list_name": "Bundles",
    "impressions": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ]
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_search

Search performed (Meta Search).

Nothing in the SDK builds this event, so it has no payload. Push it yourself under this exact name if your page needs it.

### dl_add_to_cart

Item added to cart.

```json
{
  "event": "dl_add_to_cart",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ]
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_remove_from_cart

Item removed from cart.

```json
{
  "event": "dl_remove_from_cart",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ]
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_add_to_wishlist

Item added to wishlist.

Nothing in the SDK builds this event, so it has no payload. Push it yourself under this exact name if your page needs it.

### dl_view_cart

Cart viewed.

```json
{
  "event": "dl_view_cart",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ]
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_begin_checkout

Checkout started.

```json
{
  "event": "dl_begin_checkout",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "checkout_id": "",
    "checkout_step": 0
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_add_shipping_info

Shipping info added.

```json
{
  "event": "dl_add_shipping_info",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "shipping_tier": ""
  },
  "shipping_tier": "",
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_add_payment_info

Payment info added. Reported at whichever moment the shopper commits to the method they picked: for a card when the card fields are complete, for an express button when it is pressed, and for a method approved on the provider's own page (iDEAL, Klarna, SEPA Direct Debit and the rest) when the form is submitted, because nothing about paying was entered on your page. The card and form paths report once per page, so a second attempt after a refused order does not repeat it. An express button reports on every press.

```json
{
  "event": "dl_add_payment_info",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "payment_type": ""
  },
  "payment_type": "",
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_purchase

Fires on the page opened with `?ref_id=` that fetched a **paid** order: the success page, never the checkout page. Once per order, because the SDK remembers reported `transaction_id`s in `localStorage`, and every payment method (card, 3-D Secure, PayPal, Apple Pay, Google Pay) reports from the page the shopper lands on after payment completes.

- **Your success page must load the SDK and keep `?ref_id=` on its URL.** The SDK appends `ref_id` to the success URL itself, so this holds unless the page strips it or redirects somewhere the SDK is not installed. Confirm `dl_purchase` fires there once, with the real order number, before trusting any conversion count.
- **`ecommerce.value` is item revenue only.** Tax and shipping are separate fields by design. A GA4 revenue figure that looks low against the store's own totals is usually this, not a lost event.
- **`ecommerce.transaction_id` is the order reference**, the key every ad platform deduplicates on.
- **Zero-value orders report normally** (`value: 0` with a real transaction id). Full discounts and free trials count as conversions.
- **A failed redirect payment does not report.** Both `success_url` and `payment_failed_url` come back carrying `?ref_id=`, but nothing reports on the failure leg.
- **Meta deduplication needs `storeName`.** With `window.nextConfig.storeName` set, the Meta event carries `eventID: "{storeName}-{orderNumber}"`, which is what lets Meta deduplicate the browser event against a server-side copy of the same order.

```json
{
  "event": "dl_purchase",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "transaction_id": "E2E-CARD-1",
    "affiliation": "acme",
    "tax": 4.95,
    "shipping": 7.95,
    "discount": 10
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_refund

Order refunded (adapter-mapped).

Nothing in the SDK builds this event, so it has no payload. Push it yourself under this exact name if your page needs it.

### dl_view_promotion

Promotion impression.

Nothing in the SDK builds this event, so it has no payload. Push it yourself under this exact name if your page needs it.

### dl_select_promotion

Promotion clicked.

Nothing in the SDK builds this event, so it has no payload. Push it yourself under this exact name if your page needs it.

### dl_user_data

User + cart context (fired first).

```json
{
  "event": "dl_user_data",
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  },
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "cart_contents": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ]
  }
}
```

### dl_sign_up

Account sign-up.

```json
{
  "event": "dl_sign_up",
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  },
  "method": ""
}
```

### dl_login

Account login.

```json
{
  "event": "dl_login",
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  },
  "method": ""
}
```

### dl_subscribe

Subscription created.

```json
{
  "event": "dl_subscribe",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "subscription_id": "SUB-1",
    "subscription_status": "active"
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_start_trial

Trial started (Meta StartTrial).

Nothing in the SDK builds this event, so it has no payload. Push it yourself under this exact name if your page needs it.

### dl_viewed_upsell

Upsell offer viewed.

```json
{
  "event": "dl_viewed_upsell",
  "order_id": "",
  "upsell": {
    "package_id": "",
    "package_name": "",
    "price": 29.99,
    "currency": "USD"
  }
}
```

### dl_accepted_upsell

Upsell accepted.

```json
{
  "event": "dl_accepted_upsell",
  "order_id": "",
  "upsell": {
    "package_id": "",
    "package_name": "",
    "quantity": 2,
    "value": 59.98,
    "currency": "USD"
  }
}
```

### dl_skipped_upsell

Upsell skipped.

```json
{
  "event": "dl_skipped_upsell",
  "order_id": "",
  "upsell": {
    "package_id": "",
    "package_name": ""
  }
}
```

### dl_upsell_purchase

Accepted upsell in GA4 purchase format.

```json
{
  "event": "dl_upsell_purchase",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "coupon": "SAVE10",
    "items": [
      {
        "item_id": "1",
        "item_name": "Widget",
        "currency": "USD",
        "discount": 10,
        "index": 0,
        "item_brand": "Acme",
        "item_category": "Widgets",
        "item_list_id": "main",
        "item_list_name": "Bundles",
        "item_variant": "Blue",
        "item_image": "https://cdn.example.com/widget.jpg",
        "price": 29.99,
        "quantity": 2,
        "item_product_id": "101",
        "item_sku": "WIDGET-BLU",
        "item_variant_id": "2001"
      }
    ],
    "transaction_id": "E2E-CARD-1",
    "affiliation": "acme",
    "tax": 4.95,
    "shipping": 7.95
  },
  "upsell_metadata": {
    "original_order_id": "",
    "upsell_number": 0,
    "package_id": "",
    "package_name": ""
  },
  "user_properties": {
    "visitor_type": "guest",
    "customer_id": "1001",
    "customer_email": "jordan@example.com",
    "customer_phone": "+15555550123",
    "customer_first_name": "Jordan",
    "customer_last_name": "Chen",
    "customer_address_city": "Ottawa",
    "customer_address_province": "Ontario",
    "customer_address_province_code": "ON",
    "customer_address_country": "Canada",
    "customer_address_country_code": "CA",
    "customer_address_zip": "K2P 2L8",
    "customer_order_count": 3,
    "customer_total_spent": 189.94,
    "customer_tags": "vip"
  }
}
```

### dl_cart_updated

Cart contents changed.

```json
{
  "event": "dl_cart_updated",
  "user_properties": {},
  "cart_total": "59.98",
  "ecommerce": {
    "currency": "USD",
    "value": 59.98,
    "items": []
  }
}
```

### dl_package_swapped

Selected package swapped.

```json
{
  "event": "dl_package_swapped",
  "ecommerce": {
    "currency": "USD",
    "items": []
  },
  "event_category": "ecommerce",
  "event_action": "swap",
  "event_label": "Widget \u2192 Widget 2-pack",
  "swap_details": {
    "previous_package_id": 1,
    "new_package_id": 2,
    "price_difference": 29.99
  }
}
```

### dl_page_view

Page view (SPA-aware).

```json
{
  "event": "dl_page_view",
  "page": {
    "title": "Checkout",
    "url": "https://shop.example.com/checkout/",
    "path": "/checkout/",
    "referrer": "https://shop.example.com/"
  }
}
```

### dl_route_changed

Client-side route change.

```json
{
  "event": "dl_route_changed",
  "route": {
    "from": "/checkout/",
    "to": "/upsell-1/",
    "path": "/upsell-1/"
  }
}
```

### dl_scroll_depth

Scroll-depth milestone.

```json
{
  "event": "dl_scroll_depth",
  "user_properties": {},
  "scroll_depth": 52,
  "scroll_threshold": 50,
  "page_height": 4200,
  "viewport_height": 900
}
```

### dl_exit_intent_shown

Exit-intent popup shown.

```json
{
  "event": "dl_exit_intent_shown",
  "event_category": "engagement",
  "event_action": "exit_intent_shown",
  "event_label": "exit-intent",
  "exit_intent": {
    "image_url": "https://cdn.example.com/offer.png",
    "template": ""
  }
}
```

### dl_exit_intent_accepted

Exit-intent offer accepted.

```json
{
  "event": "dl_exit_intent_accepted",
  "event_category": "engagement",
  "event_action": "exit_intent_accepted",
  "event_label": "exit-intent",
  "exit_intent": {
    "image_url": "https://cdn.example.com/offer.png",
    "template": ""
  }
}
```

### dl_exit_intent_dismissed

Exit-intent popup dismissed.

```json
{
  "event": "dl_exit_intent_dismissed",
  "event_category": "engagement",
  "event_action": "exit_intent_dismissed",
  "event_label": "exit-intent",
  "exit_intent": {
    "image_url": "https://cdn.example.com/offer.png",
    "template": ""
  }
}
```

### dl_exit_intent_closed

Exit-intent popup closed.

```json
{
  "event": "dl_exit_intent_closed",
  "event_category": "engagement",
  "event_action": "exit_intent_closed",
  "event_label": "exit-intent",
  "exit_intent": {
    "image_url": "https://cdn.example.com/offer.png",
    "template": ""
  }
}
```

### dl_exit_intent_action

Exit-intent custom action.

```json
{
  "event": "dl_exit_intent_action",
  "event_category": "engagement",
  "event_action": "exit_intent_accept",
  "event_label": "EXIT10",
  "exit_intent": {
    "action": "accept",
    "coupon_code": "EXIT10"
  }
}
```
