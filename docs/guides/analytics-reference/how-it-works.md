---
title: 'How analytics works'
group: 'Analytics Reference'
order: 0.1
---

# How analytics works

The SDK turns what happens on a page into [tracking events](/analytics): `product_added_to_cart`,
`checkout_started`, `checkout_completed`. They are the SDK's own contract, named in the storefront
style, and each carries the same object the SDK's [events](/events) carry. It builds them from
those events, so they come at the same moments, and hands each one to `next.analytics.on` and to
the [destinations](destinations/overview.md) that are on: GTM, GA4 and the Meta pixel are built in;
any other vendor remaps them from a listener.

![Tracking events across a funnel: the landing page sends page_viewed, product_viewed or product_list_viewed, and the cart events; the checkout sends checkout_started, checkout_contact_info_submitted, checkout_shipping_address_submitted, checkout_shipping_method_submitted, checkout_payment_info_submitted and checkout_completed; an upsell page sends upsell_viewed, upsell_skipped and upsell_completed for the page before; the receipt sends upsell_completed and any checkout_completed still owed](tracking-funnel.svg)

## When it loads

Analytics is its own 5 KB chunk, loaded when the browser is idle after `sdk.ready`, so it never
holds up the first price. Events the page sent before it loaded are not lost: it reads them back
in order, then follows new ones.

```js
next.analytics.on('checkout_completed', (event) => {});
next.analytics.on('*', (event) => {});
```

A listener gets every event of its name this page has sent, then each new one, whether it was
added before analytics loaded or long after. `next.analytics.on` returns a function that removes
the listener.

## The event

```js
next.analytics.on('product_added_to_cart', (event) => {
  event.event_type; // 'product_added_to_cart'
  event.object; // 'cart_line'
  event.data; // the CartItem: package_id, product_title, sku, price, quantity, …
  event.context; // the page, campaign, session, attribution and browser
});
```

The envelope is the one `next.on` hands out, plus `context`:

| Field         | Value                                                                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `event_id`    | Unique, a UUID v4 as 32 hex digits; the order number on `checkout_completed` and `ref_id-US1` on `upsell_completed`, so a tag can drop a repeat |
| `event_type`  | The name, such as `'checkout_completed'`                                                                                                        |
| `object`      | What `data` is: `cart_line`, `cart`, `checkout`, `order`, `upsell`, `promotion`, `product`, `products`, `page`                                  |
| `data`        | The event's object, on its page in the [Analytics Reference](/analytics): a Cart, a CartItem, the Checkout, the Order, …                        |
| `created_at`  | ISO time                                                                                                                                        |
| `session_id`  | The campaign session, a UUID v4 as 32 hex digits                                                                                                |
| `sdk_version` | The SDK version                                                                                                                                 |
| `context`     | The same on every event, and what [`next.context()`](../javascript-api.md) returns                                                              |

`context` has `page_location` and `page_referrer` (without their query string), `page_title`, the
`campaign` (`id`, `name`, `currency`, `language`), the campaign `session_id`, the `attribution`
(UTM parameters, affiliate and click ids, `landing_page`, `fbp`, `fbc`) and the `browser`
(`user_agent`, `language`, `device_type`). The shopper's details are not in `context`: the
`checkout_*` events carry them in their Checkout and `checkout_completed` in its Order, as `next.on`
does.

## Once, even across pages

A funnel spans several pages, and a shopper can leave a page before analytics loaded on it. The
SDK keeps track of what it already sent, so each event comes once:

| Event                                                                                                                              | Sent                                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `checkout_started`, `checkout_shipping_address_submitted`, `checkout_shipping_method_submitted`, `checkout_payment_info_submitted` | Once per checkout. `checkout_started` not sent on the page that started the checkout comes on its next page |
| `checkout_contact_info_submitted`                                                                                                  | Once, when the contact details save an Open Cart (`user.created`)                                           |
| `checkout_completed`                                                                                                               | Once per order in this browser: a reload of the receipt does not send it again                              |
| `checkout_completed` owed                                                                                                          | When the checkout page was left before analytics sent it, on the next page's `order.loaded`                 |
| `upsell_completed`                                                                                                                 | Once per accepted upsell, on the `order.loaded` of the page after the upsell                                |
| `upsell_viewed`                                                                                                                    | Once per upsell page                                                                                        |

`product_added_to_cart` and `product_removed_from_cart` compare the priced cart with what earlier
events in the tab already reported, on `sdk.ready` and after each price update, one event per
line. An add on a page that was left before analytics loaded is still sent on the next page. A
cart filled before the page loaded (a default bundle, `forcePackageId`, `forceBundleId`, a redirect
from an add-to-cart button) sends `product_added_to_cart` at the cart price. A bundle change sends
`product_removed_from_cart` for the old lines, at the price they were added, and
`product_added_to_cart` for the new ones. `first_in_session` is `true` on the first
`product_added_to_cart` of the tab, for tags that should send only one AddToCart.

## Turning parts off

Analytics and GTM are on by default, GA4, the Meta pixel and RudderStack off; `nextConfig.analytics` turns
analytics off or one destination on or off, and nothing for a destination that is off loads. See
[Destinations](destinations/overview.md#config).

## Debugging

`?debug=1` opens the debug panel. Its Analytics tab shows which destinations are on and what reached
each, the funnel steps the tab has sent, and each tracking event this page sent, newest first, with
what it carried, the logo of each place it reached and any problem on its row; open one for what
`next.analytics.on`, each data layer, GA4, Meta and RudderStack got. **Config** opens Page config,
which tries another `nextConfig.analytics` on the tab and copies the block for the page.

Every event, and every one the SDK chose not to send, is also a debug log line with its reason:

```js
next.log.level = 'debug';
// analytics product_added_to_cart sent: Added since the last report: Starter ×1
// analytics checkout_started not sent: Already sent for this checkout
next.log.entries().filter((entry) => entry.message.startsWith('analytics '));
```
