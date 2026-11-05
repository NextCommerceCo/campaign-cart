---
title: 'Events'
group: 'Event Reference'
order: 0
---

# Events

```js
next.on('order.paid', (data, event) => {
  console.log(data.ref_id);
});

next.on('*', (data, event) => {}); // every event
```

## Names

Each name is `namespace.action`, as in Next Commerce webhooks:

- **namespace**: the thing that changed (`cart`, `checkout`, `order`, …)
- **action**: what happened to it (`added`, `started`, `paid`, …)

Two to know:

- `user.created`: the user the store keeps for marketing, saved with the Cart the `cart.abandoned`
  webhook sends later.
- `order.paid`: once per order. On the checkout when paid at once, else on the page after the
  payment gateway.

## The envelope

`event` is shaped like a webhook:

| Field         | Value                                            |
| ------------- | ------------------------------------------------ |
| `event_id`    | Unique, a UUID v4 as 32 hex digits               |
| `event_type`  | The name, such as `'order.paid'`                 |
| `object`      | The namespace, such as `'order'`                 |
| `data`        | Same as `data`                                   |
| `created_at`  | ISO time                                         |
| `session_id`  | The campaign session, a UUID v4 as 32 hex digits |
| `sdk_version` | The SDK version                                  |

## What `data` holds

`data` is the object the namespace names.

| Events              | `data`                                                                               |
| ------------------- | ------------------------------------------------------------------------------------ |
| `selector.*`        | The Selector; a bundle or offer selector lists every option in `options`             |
| `cart.*`            | The Cart; `cart.added` and `cart.removed` add `changes`, the one change made         |
| `coupon.*`          | The `code`                                                                           |
| `checkout.*`        | The Checkout (see below)                                                             |
| `user.*`            | The User                                                                             |
| `address.*`         | The Address, with its `type`                                                         |
| `shipping.selected` | The ShippingMethod                                                                   |
| `payment.*`         | The Payment; a payment at a gateway adds the order's `ref_id`                        |
| `order.*`           | The Order                                                                            |
| `upsell.*`          | The Upsell                                                                           |
| `promotion.*`       | The Promotion                                                                        |
| `sdk.error`         | A Failure (`code`, `message`, `status`, `decline_code`) and the `action` that failed |
| `*.failed`          | Carries the Failure as `error`                                                       |

The Checkout has:

- `id`: the same across steps, reloads and a return from a payment gateway
- `step`
- `cart`: the same Cart as `cart.*`
- `user`, `shipping_address`, `billing_same_as_shipping`, `billing_address`, `payment_method`: once
  the shopper has entered them

## Late listeners miss nothing

- Events come in order, once each.
- `next.on` first replays the events of that name this page already sent, then each new one.
- The page keeps its last 100 events. Past that it drops, in order:
  1. the oldest price updates (`cart.updated`, `cart.calculating`, `cart.calculated`,
     `selector.calculating`, `selector.calculated`)
  2. the SDK's internal events
  3. the rest
- `sdk.ready` and the newest event always stay. `ready` is the same event as `sdk.ready`.

## Snapshot

`next.snapshot()` returns what the page shows now, as the same objects the events carry:

- `campaign`, `cart`, `selectors`
- `checkout`, on a checkout page
- `order`, once one has loaded

`sdk.ready` carries the snapshot at that moment.

## Errors

| Situation                                                | Events                                                                                    |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| The SDK or the API could not do a step                   | `sdk.error`                                                                               |
| …and it changes what the shopper sees                    | then `checkout.failed`, `upsell.failed`, or `coupon.denied` with `reason: 'check_failed'` |
| A declined card or upsell, or back from a gateway unpaid | `payment.failed` only (not an SDK failure)                                                |

## Event Reference

- A group whose events follow a lifecycle starts with a page that draws it, such as the cart's. It
  lists the events it covers, including other namespaces that come with it.
- Each event has its own page with its fields and an example, generated from `EventMap` in
  `src/engine/events.ts`.
- `user` and `address` events are checked when the shopper leaves a field (its `change`), not on
  each key.

<!-- event-index -->

## 0.4.x names

0.4.x names still work, with the payload 0.4.43 sent and at the same moment: `cart:updated`,
`cart:item-added`, `bundle:selection-changed`, `shipping:method-changed`,
`coupon:validation-failed`, `exit-intent:*`, `campaign:loaded`, `checkout:started`,
`order:completed`, `upsell:*`, `payment:error` and the rest in `src/compat/`.

- A 0.4.x name reaches only listeners added before the event. Exceptions, which 0.4.x pages listen
  for late: `campaign:loaded`, `checkout:started`, and a few more.
- `checkout:started` comes once a page; `checkout.started` once per checkout.
- `fomo:*` and `profile:*` are accepted and never fire; the SDK no longer has those features.
- Any other name logs a warning and never fires.
- DOM events kept for page scripts: `next:initialized`, `next:ready` (on `window`) and
  `next:prospect-cart-created` (on the checkout form).

## Analytics

```js
next.analytics.on('add_to_cart', (event) => {}); // one event, by its GA4 name
next.analytics.on('*', (event) => {}); // every one
```

- Arrive once the analytics chunk loads (on idle after `sdk.ready`), including those sent earlier.
- Forward them to any vendor from here.
- No personal data is sent.

| `name`                                   | `params`                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `page_view`                              | `page_location`, `page_title`, `page_referrer`                                                           |
| `generate_lead`                          | `currency`, `value` (the cart), `lead_source: 'checkout'`                                                |
| `view_promotion`, `select_promotion`     | `promotion_id`, `promotion_name?`, `creative_name`: the Promotion's `id`, `name` and `creative`          |
| `view_item`, `remove_from_cart`          | `currency`, `value`, `items`                                                                             |
| `add_to_cart`                            | `currency`, `value`, `items`, `first_in_session`                                                         |
| `view_item_list`                         | `currency`, `items`, `item_list_id`, `item_list_name`                                                    |
| `update_cart`, `begin_checkout`          | the cart: `currency`, `value`, `items`, `coupon?`, `shipping?`                                           |
| `add_shipping_info` / `add_payment_info` | the cart plus `shipping_tier` / `payment_type`                                                           |
| `purchase`                               | `currency`, `transaction_id`, `value`, `tax`, `shipping`, `affiliation`, `items`, `coupon?`, `discount?` |
| `upsell_purchase`                        | as `purchase`, plus `upsell: { original_order_id, upsell_number, package_id, package_name }`             |
| `view_upsell` / `skip_upsell`            | `order_id`, `page_path`, `currency` / `order_id`, `package_id?`, `package_name?`                         |

### Fields on every event

- Names and `params` follow GA4 ecommerce. `update_cart`, `upsell_purchase`, `view_upsell` and
  `skip_upsell` have no GA4 equivalent.
- `items` carry GA4 item fields (`item_id`, `item_name`, `item_variant`, `price`, `discount`,
  `quantity`, `index`, …).
- `id` is unique per event; for `purchase` and `upsell_purchase` it is the transaction id.
- `context` (also returned by `next.context()`, for scripts that forward `next.on` events):

| Field                            | Value                                                                 |
| -------------------------------- | --------------------------------------------------------------------- |
| `page_location`, `page_referrer` | Without their query string                                            |
| `campaign`                       | `id`, `name`, `currency`, `language`                                  |
| `session_id`                     | The campaign session                                                  |
| `attribution`                    | UTM parameters, affiliate and click ids, `landing_page`, `fbp`, `fbc` |
| `browser`                        | `user_agent`, `language`, `device_type`                               |

### When each is sent

| Analytics event     | Sent on                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `generate_lead`     | `user.created`                                                                                |
| `begin_checkout`    | `checkout.started`, or the checkout's next page if the first was left before analytics loaded |
| `add_shipping_info` | `address.entered` for the shipping address, or `shipping.selected`, whichever comes first     |
| `add_payment_info`  | The first `checkout.submitted` (for a card, once it is tokenized)                             |
| `purchase`          | `order.paid`, or the next page's `order.loaded` if the checkout page was left before it sent  |
| `upsell_purchase`   | Each accepted upsell, on the `order.loaded` of the page after it                              |

`begin_checkout`, `add_shipping_info` and `add_payment_info` are sent once per checkout (its `id`).

### Add and remove

`add_to_cart` and `remove_from_cart` compare the priced cart with what the tab already reported,
on `sdk.ready` and after each server calculation. So:

- An add on a page left before analytics loaded is still sent on the next page.
- A cart filled before the page loaded (a default bundle, `forcePackageId`, `forceBundleId`, a
  redirect from an add-to-cart button) sends `add_to_cart` at the cart price.
- A bundle change sends `remove_from_cart` for the old lines, at the price they were added, then
  `add_to_cart` for the new ones.
- `first_in_session` is `true` on the tab's first `add_to_cart`, for tags that send only one
  AddToCart.

## dataLayer (deprecated)

Use `next.analytics.on`. Each analytics event is still pushed in the 0.4.x Elevar format for GTM
containers and forwarders that read it.

Flow: `window.NextDataLayerTransformFn` (return a falsy value to drop one) → `window.NextDataLayer`
→ `dataLayer`, after `{ ecommerce: null }`.

| Events                                                                      | Notes                                   |
| --------------------------------------------------------------------------- | --------------------------------------- |
| `dl_user_data`, `dl_generate_lead`                                          |                                         |
| `dl_view_item`, `dl_view_item_list`                                         |                                         |
| `dl_add_to_cart`, `dl_remove_from_cart`, `dl_cart_updated`                  | `dl_add_to_cart` has `first_in_session` |
| `dl_begin_checkout`, `dl_add_shipping_info`, `dl_add_payment_info`          |                                         |
| `dl_purchase`                                                               | Once, only when paid                    |
| `dl_upsell_purchase`, `dl_viewed_upsell`, `dl_skipped_upsell`               |                                         |
| `dl_view_promotion`, `dl_select_promotion`                                  |                                         |
| `dl_exit_intent_shown` / `_accepted` / `_dismissed` / `_closed` / `_action` | See below                               |

- `event_id` is the analytics event's `id`; for the purchase events, the transaction id, as 0.4.x did.
- Every push has `campaign_id`, `campaign_name`, `campaign_currency`, `campaign_language`,
  `campaign_api_key` and `campaign_session_id` at the top level, as 0.4.30 did.
- The exit-intent popup sends its `dl_exit_intent_*` event and `dl_view_promotion` /
  `dl_select_promotion`. `_closed` is its × button, `_dismissed` Esc or the overlay; a close after
  a click, or the page removing it, sends neither.
- No personal data is sent.
- `nextConfig.analytics.providers.gtm.enabled: false` keeps events out of `dataLayer` (only
  `NextDataLayer`).
