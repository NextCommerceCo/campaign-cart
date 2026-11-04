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
  event.event_id; // 'evt_…', unique
  event.event_type; // 'order.created'
  event.object; // 'order'
  event.data; // same as data
  event.created_at; // ISO time
  event.sdk_version;
});
```

Events come in order, once each on the page. Only `sdk.ready` (alias `ready`) reaches listeners
added after it fired; for anything else read `next.getState()`.

### SDK

| Event       | Data                | When                                                                                                     |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `sdk.ready` | `lines`             | Once, when the campaign and the page's values are in. `ready` is the same event                          |
| `sdk.error` | `action`, `message` | An action failed: `load`, `calculate`, `quote`, `coupon`, `order`, `upsell`, `storage` (blocked or full) |

### Selectors

Bundle cards, upsell offer cards and toggles (bumps such as a warranty). `type` is `bundle`, `offer`
or `toggle`.

| Event                  | Data                                          | When                                                                                     |
| ---------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `selector.selected`    | `selector_id`, `type`, `card_id?`, `items`    | A card is picked, its quantity or a slot changed, or a toggle is switched on             |
| `selector.deselected`  | `selector_id`, `type`                         | A toggle is switched off                                                                 |
| `selector.calculating` | `selector_id`, `type`                         | Pricing the cards that have no quote yet starts                                          |
| `selector.calculated`  | `selector_id`, `type`, `quotes`, `from_cache` | Every card has a price. Quotes are kept 10 minutes, so a later page may get this at once |

### Carts

| Event              | Data                                                       | When                                                                                                                                                          |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cart.updated`     | `cart`                                                     | Lines, coupons or shipping changed, at once                                                                                                                   |
| `cart.calculating` | `lines`                                                    | Pricing starts; once for a burst of changes                                                                                                                   |
| `cart.added`       | `lines` (`package_id`, `quantity`, `unit_price`), `priced` | Packages the page added since the last price, net, just before `cart.calculated`. `priced: false` when pricing failed: `unit_price` is then the package price |
| `cart.removed`     | `lines`, `priced`                                          | Packages the page removed since the last price, at the price they had                                                                                         |
| `cart.calculated`  | `summary`                                                  | Server totals arrived                                                                                                                                         |

A `+ + −` within one price run sends one `cart.added` for the net change; `+` then `−` sends none.

### Coupons

| Event            | Data   | When                                                    |
| ---------------- | ------ | ------------------------------------------------------- |
| `coupon.applied` | `code` | A code was added to the cart                            |
| `coupon.removed` | `code` | A code was removed                                      |
| `coupon.denied`  | `code` | The server gives no discount for a code; it is not kept |

### Checkout

The checkout form's steps, in the order a shopper usually takes them. `contact`, `address`,
`shipping` and `payment` events are checked when the shopper leaves a field (the field's `change`),
not on each key.

| Event                | Data                                                 | When                                                                                                                                                                                                          |
| -------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkout.started`   | `lines`                                              | Once, when the checkout form is bound with a cart                                                                                                                                                             |
| `contact.entered`    | `email`, `first_name`, `last_name`, `phone?`, `cart` | Once per tab, when the store creates the Cart: a valid email and a first and last name are in. It is the Cart in the dashboard's Open Carts, later `cart.abandoned`                                           |
| `contact.updated`    | `email`, `first_name`, `last_name`, `phone?`         | The contact changed after `contact.entered` and is still valid. The Cart on the store keeps the first contact                                                                                                 |
| `address.entered`    | `type`, `country`                                    | Once per `type` (`shipping` or `billing`), when that address is valid: every field its country requires is filled and valid, and so is each optional one filled. `billing` only when it is a separate address |
| `address.updated`    | `type`, `country`                                    | The address changed after `address.entered` and is still valid                                                                                                                                                |
| `shipping.selected`  | `method_id`, `method?`                               | A shipping method was picked. A bundle card can set it on the landing page too                                                                                                                                |
| `payment.selected`   | `method`                                             | The payment method changed                                                                                                                                                                                    |
| `checkout.submitted` | `payment_method`, `valid`, `errors`                  | Each submit, once its checks ran: the fields, then the card tokenized. `valid: false` names what stopped it. A valid submit is followed by `order.created` or `order.failed`                                  |

### Orders

| Event           | Data                                               | When                                                                                                                  |
| --------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `order.created` | `order`                                            | The order was created                                                                                                 |
| `order.failed`  | `stage`, `code`, `message?`, `decline?`, `ref_id?` | `stage: 'order'`: the server refused it. `stage: 'payment'`: the shopper came back from a payment gateway that failed |
| `order.loaded`  | `order`, `purchase?`, `upsells?`                   | On post-purchase pages                                                                                                |

### Upsells

| Event             | Data                         | When                                       |
| ----------------- | ---------------------------- | ------------------------------------------ |
| `upsell.viewed`   | `ref_id`, `page`             | An offer was shown                         |
| `upsell.accepted` | `ref_id`, `lines`, `order`   | The offer was added; `order` is updated    |
| `upsell.skipped`  | `ref_id`, `package_id?`      | The shopper went on without it             |
| `upsell.failed`   | `ref_id`, `code`, `message?` | Adding the offer failed, such as a decline |

### Promotions

`source` names the promotion. The exit-intent popup (`next.exitIntent`) is `exit_intent`, the only
one so far.

| Event               | Data                                                           | When                                            |
| ------------------- | -------------------------------------------------------------- | ----------------------------------------------- |
| `promotion.viewed`  | `source`, `image_url?`, `template?`                            | The popup opened                                |
| `promotion.clicked` | `source`, `image_url?`, `template?`, `action?`, `coupon_code?` | The image was clicked, or a template action ran |
| `promotion.closed`  | `source`, `image_url?`, `template?`, `reason`                  | `reason: 'dismissed'` (Esc) or `'closed'`       |

### 0.4.x names

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
when paid. `context` has `page_location`, `page_title`, `page_referrer`, `campaign_name`,
`campaign_currency`, `campaign_language` and `attribution`. No personal data is sent.

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
`dl_upsell_purchase`, `dl_viewed_upsell`, `dl_skipped_upsell`, `dl_exit_intent_shown` /
`_accepted` / `_dismissed` / `_closed` / `_action`. `generate_lead`, `view_promotion` and
`select_promotion` have no `dl_*` event. No personal data is sent. `dl_add_to_cart` carries
`first_in_session` at the top level. The purchase
events use the transaction id as `event_id`, as 0.4.x did. `nextConfig.analytics.providers.gtm.enabled: false`
keeps events out of `dataLayer` (only `NextDataLayer`).
