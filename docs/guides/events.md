---
title: 'Reference/Events'
group: 'Reference'
category: 'Reference'
---

# Events

`next.on(name, (data, event) => …)`. `'*'` receives every event. Each name is `namespace.action`,
with one dot: the namespace is the thing that changed, the action what happened to it, as in Next
Commerce webhooks. `user.created` is the user the store keeps for marketing, saved with the Cart the
`cart.abandoned` webhook sends later. `order.paid` comes once per order: on the checkout for an
order paid at once, else on the page after the payment gateway.

`event` is the envelope, shaped like a webhook's:

```js
next.on('order.paid', (data, event) => {
  event.event_id; // a UUID v4 as 32 hex digits, unique
  event.event_type; // 'order.paid'
  event.object; // 'order'
  event.data; // same as data
  event.created_at; // ISO time
  event.session_id; // the campaign session, a UUID v4 as 32 hex digits
  event.sdk_version;
});
```

Events come in order, once each. `next.on` first calls the listener with the events of that name
this page has already sent, then with each new one, so a script that loads late misses nothing.
The page keeps its last 100 events; past that, the oldest price updates go first (`cart.updated`,
`cart.calculating`, `cart.calculated`, `selector.calculating`, `selector.calculated`), then the
SDK's internal events, then the rest; `sdk.ready` and the newest event always stay. `ready` is the same
event as `sdk.ready`.

`next.snapshot()` returns what the page shows now: `campaign`, `cart`, `checkout` on a checkout
page, `order` once one has loaded, and `selectors`, the same objects the events carry. `sdk.ready`
carries the snapshot at that moment.

An event's data is the object its namespace names, and `object` is that namespace: `selector.*`
carry the Selector (with every option of a bundle or offer selector in `options`), `cart.*` the
Cart (`cart.added` and `cart.removed` add the `changes` one change made), `coupon.*` the `code`,
`checkout.*` the Checkout (its `id`, the same across steps, reloads and a return from a payment
gateway, its `step`, the same Cart as `cart`, and `user`, `shipping_address`,
`billing_same_as_shipping`, `billing_address` and `payment_method` once the shopper has entered
them), `user.*` the User, `address.*` the Address with its `type`, `shipping.selected` the
ShippingMethod, `payment.*` the Payment (with the order's `ref_id` for a payment at a gateway),
`order.*` the Order, `upsell.*` the Upsell and `promotion.*` the Promotion. `sdk.error` is a
Failure (`code`, `message`, `status`, `decline_code`) with the `action` that failed; every
`*.failed` event carries one as `error`.

`sdk.error` comes whenever the SDK or the API could not do a step. When that failure changes what
the shopper sees, the step's own event follows it: `checkout.failed`, `upsell.failed`, or
`coupon.denied` with `reason: 'check_failed'`. A payment that is not taken is not an SDK failure:
a declined card or upsell, or a shopper back from a gateway unpaid, sends `payment.failed` alone.

## Event Reference

A group whose events follow a lifecycle starts with a page that draws it, such as the cart's, and
names the events it covers, including those of other namespaces that come with it.
Each event has its own page with its fields and an example, generated from `EventMap` in
`src/engine/events.ts`. The `user` and `address` events are checked when the shopper leaves a
field (its `change`), not on each key.

<!-- event-index -->

## 0.4.x names

0.4.x names still work and get the payload they had, each at the moment 0.4.43 sent it:
`cart:updated`, `cart:item-added`, `bundle:selection-changed`, `shipping:method-changed`,
`coupon:validation-failed`, `exit-intent:*`, `campaign:loaded`, `checkout:started` (once a page,
where `checkout.started` is once per checkout), `order:completed`, `upsell:*`, `payment:error` and
the rest in `src/compat/`. A 0.4.x name reaches only a listener added before the event, except the
few 0.4.x pages listen for late, such as `campaign:loaded` and `checkout:started`. `fomo:*` and
`profile:*`, features the SDK no longer has, are accepted and never fire. Other names log a warning
and never fire. DOM events kept for page scripts: `next:initialized`, `next:ready` (window) and
`next:prospect-cart-created` (checkout form).

## Analytics

`next.analytics.on('add_to_cart', (event) => …)` receives one tracking event by its GA4 name;
`next.analytics.on('*', …)` receives every one. They arrive once the analytics chunk has loaded
(on idle after `sdk.ready`), including those sent before the listener was added. Forward them to
any vendor from here.

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

Names and `params` follow GA4 ecommerce; `update_cart`, `upsell_purchase`,
`view_upsell` and `skip_upsell` have no GA4 equivalent. `items` carry GA4 item fields (`item_id`,
`item_name`, `item_variant`, `price`, `discount`, `quantity`, `index`, …). `id` is unique per
event, and is the transaction id for `purchase` and `upsell_purchase`. `context` has
`page_location` and `page_referrer` (without their query string), the
`campaign` (`id`, `name`, `currency`, `language`), the campaign `session_id`, the `attribution`
(UTM parameters, affiliate and click ids, `landing_page`, `fbp`, `fbc`) and the `browser`
(`user_agent`, `language`, `device_type`). `next.context()` returns the same object, for a script
that sends `next.on` events on. No personal data is sent.

`generate_lead` is sent on `user.created`. `begin_checkout`, `add_shipping_info` and
`add_payment_info` are sent once per checkout (its `id`): `begin_checkout` on `checkout.started`,
or on the checkout's next page when the page that started it was left before analytics loaded;
`add_shipping_info` on `address.entered` for the shipping address or on `shipping.selected`,
whichever comes first; `add_payment_info` on the first `checkout.submitted` (for a card, once it
is tokenized). `purchase` is sent on `order.paid`, or on the next page's `order.loaded` when the
checkout page was left before analytics sent it, and `upsell_purchase` for each accepted upsell on
the `order.loaded` of the page after it.

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
`dl_view_promotion` / `dl_select_promotion`; `_closed` is its × button, `_dismissed` Esc or the
overlay, and a close after a click, or the page removing it, sends neither. No personal data is
sent. Each push carries
`campaign_id`, `campaign_name`, `campaign_currency`, `campaign_language`, `campaign_api_key` and
`campaign_session_id` at the top level, as 0.4.30 did. `dl_add_to_cart` carries
`first_in_session` at the top level. The purchase
events use the transaction id as `event_id`, as 0.4.x did. `nextConfig.analytics.providers.gtm.enabled: false`
keeps events out of `dataLayer` (only `NextDataLayer`).
