---
title: 'Reference/Events'
group: 'Reference'
category: 'Reference'
---

# Events

`next.on(name, (data, event) => …)`. `'*'` receives every event. Each name is `namespace.action`,
with one dot: the namespace is the thing that changed, the action what happened to it, as in Next
Commerce webhooks. `contact.entered` creates the Cart the `cart.abandoned` webhook sends later, and
`order.created` is the Order of the `order.created` webhook.

`event` is the envelope, shaped like a webhook's:

```js
next.on('order.created', (data, event) => {
  event.event_id; // a UUID v4 as 32 hex digits, unique
  event.event_type; // 'order.created'
  event.object; // 'order'
  event.data; // same as data
  event.created_at; // ISO time
  event.campaign; // { id, name, currency, language }, once the campaign has loaded
  event.session_id; // the campaign session, a UUID v4 as 32 hex digits
  event.sdk_version;
});
```

Events come in order, once each on the page. Only `sdk.ready` (alias `ready`) reaches listeners
added after it fired; for anything else read `next.getState()`.

The checkout steps (`checkout.*`, `contact.*`, `address.*`, `shipping.selected`,
`payment.selected`) carry the Checkout, and their `object` is `checkout`: the Cart, plus
`contact`, `shipping_address`, `billing_address` and `payment_method` once the shopper has entered
them. `cart.*` events carry the Cart alone.

## Event Reference

A group whose events follow a lifecycle starts with a page that draws it, such as the cart's.
Each event has its own page with its fields and an example, generated from `EventMap` in
`src/engine/events.ts`. The `contact`, `address`, `shipping` and `payment` events are checked when
the shopper leaves a field (its `change`), not on each key.

<!-- event-index -->

## 0.4.x names

0.4.x names still work and get the payload they had: `cart:updated`, `bundle:selection-changed`,
`shipping:method-changed`, `coupon:validation-failed`, `exit-intent:*` (each only for the moment it
meant), `campaign:loaded`, `checkout:started`, `order:completed`, `upsell:*`, `payment:error` and
the rest of `LEGACY_EVENTS` in `src/compat/legacy.ts`. `fomo:*` and `profile:*`, features the SDK no
longer has, are accepted and never fire. Other names log a warning and never fire. DOM events kept
for page scripts: `next:initialized`, `next:ready` (window) and `next:prospect-cart-created`
(checkout form).

## Analytics

`next.analytics.on('add_to_cart', (event) => …)` receives one tracking event by its GA4 name;
`next.analytics.on('*', …)` and `next.on('analytics', …)` receive every one. They arrive once the
analytics chunk has loaded (on idle after `sdk.ready`), including those sent before the listener
was added. Forward them to any vendor from here.

| `name`                                   | `params`                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `page_view`                              | `page_location`, `page_title`, `page_referrer`                                                           |
| `generate_lead`                          | `currency`, `value` (the cart), `lead_source: 'checkout'`                                                |
| `view_promotion`, `select_promotion`     | `promotion_id` (the `source`), `creative_name` (the template, or the image)                              |
| `view_item`, `remove_from_cart`          | `currency`, `value`, `items`                                                                             |
| `add_to_cart`                            | `currency`, `value`, `items`, `first_in_session`                                                         |
| `view_item_list`                         | `currency`, `items`, `item_list_id`, `item_list_name`                                                    |
| `update_cart`, `begin_checkout`          | the cart: `currency`, `value`, `items`, `coupon?`, `shipping?`                                           |
| `add_shipping_info` / `add_payment_info` | the cart plus `shipping_tier` / `payment_type`                                                           |
| `purchase`                               | `currency`, `transaction_id`, `value`, `tax`, `shipping`, `affiliation`, `items`, `coupon?`, `discount?` |
| `upsell_purchase`                        | as `purchase`, plus `upsell: { original_order_id, upsell_number, package_id, package_name }`             |
| `view_upsell` / `skip_upsell`            | `order_id`, `page_path`, `currency` / `order_id`, `package_id?`, `package_name?`                         |

Names and `params` follow GA4 ecommerce; `update_cart`, `upsell_purchase`,
`view_upsell` and `skip_upsell` have no GA4 equivalent. `items` carry GA4 item fields (`item_id`,
`item_name`, `item_variant`, `price`, `discount`, `quantity`, `index`, …). `id` is unique per
event, and is the transaction id for `purchase` and `upsell_purchase`; `purchase` is sent once, only
when paid. `context` has `page_location`, `page_title`, `page_referrer`, `campaign` (as in the
envelope), `attribution` and `session_id`. No personal data is sent.

`generate_lead` is sent once, on `contact.entered`. `add_shipping_info` is sent once, after
`checkout.started`, on `address.entered` for the shipping address or on `shipping.selected`. `add_payment_info` is sent once, on the first `checkout.submitted` that
passes its checks (for a card, once it is tokenized).

`add_to_cart` and `remove_from_cart` compare the priced cart with what earlier events in the tab
already reported, on `sdk.ready` and after each server calculation, so an add on a page that was
left before analytics loaded is still sent on the next page. A cart filled before the page
loaded (a default bundle, `forcePackageId`, `forceBundleId`, a redirect from an add-to-cart button)
sends `add_to_cart` at the cart price; a bundle change sends `remove_from_cart` for the old lines,
at the price they were added, and `add_to_cart` for the new ones. `first_in_session` is `true` on
the first `add_to_cart` of the tab, for tags that send only one AddToCart.

## dataLayer (deprecated)

Use `next.analytics.on`. Each analytics event is still pushed in the 0.4.x Elevar format, with
the same `id` as `event_id`, for GTM containers and forwarders that read it. Analytics pushes 0.4.x `dl_*` events through `window.NextDataLayerTransformFn` (return a
falsy value to drop one) into `window.NextDataLayer`, then into `dataLayer` after
`{ ecommerce: null }`: `dl_user_data`, `dl_view_item(_list)`, `dl_add_to_cart`,
`dl_remove_from_cart`, `dl_cart_updated`, `dl_begin_checkout`,
`dl_add_shipping_info`, `dl_add_payment_info`, `dl_purchase` (once, only when paid),
`dl_upsell_purchase`, `dl_viewed_upsell`, `dl_skipped_upsell`, `dl_generate_lead`,
`dl_view_promotion`, `dl_select_promotion`, `dl_exit_intent_shown` / `_accepted` / `_dismissed` /
`_closed` / `_action`. The exit-intent popup sends both its `dl_exit_intent_*` event and
`dl_view_promotion` / `dl_select_promotion`. No personal data is sent. Each push carries
`campaign_id`, `campaign_name`, `campaign_currency`, `campaign_language`, `campaign_api_key` and
`campaign_session_id` at the top level, as 0.4.30 did. `dl_add_to_cart` carries
`first_in_session` at the top level. The purchase
events use the transaction id as `event_id`, as 0.4.x did. `nextConfig.analytics.providers.gtm.enabled: false`
keeps events out of `dataLayer` (only `NextDataLayer`).
