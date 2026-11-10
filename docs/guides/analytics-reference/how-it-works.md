---
title: 'How analytics works'
group: 'Analytics Reference'
order: 0.1
---

# How analytics works

When a shopper does something that matters (sees a product, adds it to the cart, starts the
checkout, pays), the SDK sends a **tracking event**. Your tags receive it: GTM is on by default,
GA4, the Meta pixel and RudderStack can be turned on, and your own code can listen too.

![What the shopper does on each page and the tracking event the SDK sends: on the landing page page_viewed, product_viewed and product_added_to_cart; on the checkout page checkout_started, checkout_contact_info_submitted, checkout_shipping_address_submitted, checkout_shipping_method_submitted, checkout_payment_info_submitted and checkout_completed; on an upsell page upsell_viewed, upsell_completed and upsell_skipped](tracking-funnel.svg)

## The events

| When the shopper                          | Tracking event                                       | GTM gets                                  |
| ----------------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| Opens a page                              | `page_viewed`                                        | `dl_user_data`                            |
| Sees one product, or a list               | `product_viewed`, `product_list_viewed`              | `dl_view_item`, `dl_view_item_list`       |
| Adds a product, or removes one            | `product_added_to_cart`, `product_removed_from_cart` | `dl_add_to_cart`, `dl_remove_from_cart`   |
| Opens the checkout with a cart            | `checkout_started`                                   | `dl_begin_checkout`                       |
| Enters contact details                    | `checkout_contact_info_submitted`                    | `dl_generate_lead`                        |
| Enters a valid shipping address           | `checkout_shipping_address_submitted`                | `dl_add_shipping_info`                    |
| Gets a shipping method, after the address | `checkout_shipping_method_submitted`                 | none: the address already sent it         |
| Submits the payment                       | `checkout_payment_info_submitted`                    | `dl_add_payment_info`                     |
| Pays                                      | `checkout_completed`                                 | `dl_purchase`                             |
| Sees an upsell offer                      | `upsell_viewed`                                      | `dl_viewed_upsell`                        |
| Accepts it, or declines it                | `upsell_completed`, `upsell_skipped`                 | `dl_upsell_purchase`, `dl_skipped_upsell` |

Each event has a page in the [Analytics Reference](/analytics) with what it carries and an example.
Each group has a diagram of when its events are sent: [pages](pages/lifecycle.md),
[carts](carts/lifecycle.md), [checkout](checkout/lifecycle.md), [orders](orders/lifecycle.md),
[upsells](upsells/lifecycle.md) and [promotions](promotions/lifecycle.md).

## Listen to an event

```js
next.analytics.on('checkout_completed', (event) => {
  event.event_type; // 'checkout_completed'
  event.data; // the order: lines, total, currency, …
  event.context; // the page, campaign, session and attribution
});

next.analytics.on('*', (event) => {}); // every event
```

A listener added late still gets the events this page already sent, in order.

| Field        | What it is                                                                     |
| ------------ | ------------------------------------------------------------------------------ |
| `event_type` | The name, such as `'checkout_completed'`                                       |
| `data`       | The cart, cart line, checkout, order or upsell the event is about              |
| `context`    | The same on every event: page, campaign, session, attribution (UTM, click ids) |
| `event_id`   | Unique. The order number on `checkout_completed`, so a tag can drop a repeat   |

`event.object`, `created_at`, `session_id` and `sdk_version` are there too, as on
[`next.on`](/events) events.

## Each event comes once

- **Checkout events** come once per checkout, also across the steps of a multi-step checkout and
  after a reload.
- **`checkout_completed`** comes once per order. Reloading the receipt does not send it again.
- **`upsell_completed`** comes once per accepted upsell, on the page after it.
- **A page left early loses nothing.** Analytics loads when the browser is idle, so it never slows
  the first price; an event it had no time to send goes out on the next page.
- **`product_added_to_cart`** comes once per product added. A bundle change sends a remove for the
  old products and an add for the new ones. `first_in_session` is `true` on the first add of the
  tab; the Meta destination sends `AddToCart` for that one only.

## Turn it on or off

GTM is on by default; GA4, the Meta pixel and RudderStack are off until `nextConfig.analytics`
turns them on. See [Destinations](destinations/overview.md#config).

## See what was sent

Open the page with `?debug=1`. The Analytics tab lists each event, what it carried and where it
went, and says why an event was not sent.

```js
next.log.level = 'debug';
// analytics checkout_started not sent: Already sent for this checkout
```
