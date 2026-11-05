---
title: 'GTM'
group: 'Analytics Reference/Providers'
order: 0.21
---

# GTM

Built in. Each standard event is pushed to `dataLayer` in the 0.4.x Elevar format, for GTM
containers and forwarders built on it. The SDK does not load GTM: the container is the page's own
tag. The format is **deprecated, and still sent**; new code listens with `next.analytics.on` (see
[Providers](overview.md)).

## Where pushes go

1. `window.NextDataLayerTransformFn(event)`, when the page defines it, gets each push first and
   returns the push to send. A falsy return drops it; an error logs and drops it.
2. The push goes to `window.NextDataLayer`.
3. Then to `window.dataLayer`, after `{ ecommerce: null }` so GTM clears the previous ecommerce
   object.

`nextConfig.analytics.providers.gtm.enabled: false` keeps pushes out of `dataLayer`: they reach
`NextDataLayer` only. `nextConfig.analytics.enabled: false` turns tracking off altogether.

## Names

<!-- gtm-events -->

`dl_purchase` is pushed once per order, only once it is paid.

## Fields on every push

| Field                                                                                                               | Is                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `event`                                                                                                             | The `dl_*` name                                                                         |
| `event_id`                                                                                                          | The tracking event's `id`; the transaction id on `dl_purchase` and `dl_upsell_purchase` |
| `event_time`                                                                                                        | Its ISO time                                                                            |
| `page_location`, `page_title`, `page_referrer`                                                                      | The page, without the query string                                                      |
| `campaign_id`, `campaign_name`, `campaign_currency`, `campaign_language`, `campaign_api_key`, `campaign_session_id` | At the top level, as 0.4.30 sent them                                                   |
| `attribution`                                                                                                       | UTM parameters, affiliate and click ids, landing page                                   |
| `user_properties`                                                                                                   | `{ visitor_type: 'guest' }`, in the Elevar format                                       |
| `ecommerce`                                                                                                         | The event's `params`, on ecommerce events                                               |
| `_metadata`                                                                                                         | `{ source: 'NextDataLayer', version }`                                                  |

Some events add 0.4.x fields of their own:

| Push                                     | Adds                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `dl_user_data`                           | `cart_total`, and the cart as `ecommerce`                                                   |
| `dl_add_to_cart`                         | `first_in_session` at the top level, outside `ecommerce`                                    |
| `dl_cart_updated`                        | `cart_total`, and `cart` (`currency`, `items`, `total_items`, `total_value`)                |
| `dl_begin_checkout`                      | `cart_total`                                                                                |
| `dl_add_shipping_info`                   | `shipping_tier`, `event_category: 'ecommerce'`, `event_value`, and `ecommerce.currencyCode` |
| `dl_add_payment_info`                    | `payment_type`, `event_category: 'ecommerce'`, `event_value`                                |
| `dl_purchase` / `dl_upsell_purchase`     | `pageType: 'purchase'` / `'upsell'`; the upsell's details as `upsell_metadata`              |
| `dl_viewed_upsell` / `dl_skipped_upsell` | `order_id`, `page_path` (viewed), and `upsell` with `package_id` and `package_name`         |
| `dl_generate_lead`                       | `currency`, `value` and `lead_source` at the top level                                      |

## GA4 names instead

A container built on GA4 names can get the standard events as they are, with each event's
`ecommerce` cleared first:

```js
next.analytics.on('*', ({ name, id, params }) => {
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event: name, event_id: id, ecommerce: params });
});
```

Doing both sends each event twice to the container. Turn the `dl_*` pushes off with
`providers.gtm.enabled: false` (they still reach `window.NextDataLayer`).

## Exit-intent popup

The popup of `next.exitIntent()` pushes `dl_view_promotion` and `dl_select_promotion` like any
promotion, and its 0.4.x events too, with `event_category: 'engagement'`, `event_action`,
`event_label` and `exit_intent`:

| Push                       | When                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| `dl_exit_intent_shown`     | It opens                                                           |
| `dl_exit_intent_accepted`  | Its image is clicked                                               |
| `dl_exit_intent_action`    | A close or apply-coupon button, or a custom action once it has run |
| `dl_exit_intent_dismissed` | Esc or the overlay closes it                                       |
| `dl_exit_intent_closed`    | Its × button closes it                                             |

A close after a click, or the page removing the popup, sends neither `_dismissed` nor `_closed`.
These have no `next.analytics.on` event; use `promotion.*` with `next.on`.
