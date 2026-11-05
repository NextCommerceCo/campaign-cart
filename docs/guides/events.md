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

Tracking events have a listener of their own: `next.analytics.on`. They carry the same objects as
these events, in the same envelope plus a `context`. See the [Tracking events](/analytics),
[How analytics works](analytics-reference/how-it-works.md), and the
[Destinations](analytics-reference/destinations/overview.md) that get them: GTM, GA4, the Meta pixel
and any other vendor.
