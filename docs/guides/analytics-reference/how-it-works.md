---
title: 'How analytics works'
group: 'Analytics Reference'
order: 0.1
---

# How analytics works

The SDK turns what happens on a page into tracking events named like GA4's: `add_to_cart`,
`begin_checkout`, `purchase`. It builds them from its own [events](/events), so they come at the
same moments, and sends each one to `next.analytics.on` and to the 0.4.x [dataLayer](data-layer.md)
for GTM; the NEXT campaign script gets a `page_view`. The SDK sends nothing to GA4, Meta or any
other vendor itself; [Providers](providers.md) lists what each gets and
[Sending events on](sending-events.md) shows how to reach the rest.

![Tracking events across a funnel: the landing page sends page_view, view_item or view_item_list, and the cart events; the checkout sends begin_checkout, generate_lead, add_shipping_info, add_payment_info and purchase; an upsell page sends view_upsell, skip_upsell and upsell_purchase for the page before; the receipt sends upsell_purchase and any purchase still owed](tracking-funnel.svg)

## When it loads

Analytics is its own 5 KB chunk, loaded when the browser is idle after `sdk.ready`, so it never
holds up the first price. Events the page sent before it loaded are not lost: it reads them back
in order, then follows new ones.

```js
next.analytics.on('purchase', (event) => {});
next.analytics.on('*', (event) => {});
```

A listener gets every event of its name this page has sent, then each new one, whether it was
added before analytics loaded or long after. `next.analytics.on` returns a function that removes
the listener.

## The event

```js
next.analytics.on('add_to_cart', (event) => {
  event.name; // 'add_to_cart'
  event.id; // a UUID v4 as 32 hex digits
  event.time; // ISO time
  event.params; // the GA4 parameters: currency, value, items, …
  event.context; // the page, campaign, session, attribution and browser
});
```

| Field     | Is                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `name`    | The GA4 name. `update_cart`, `upsell_purchase`, `view_upsell` and `skip_upsell` have no GA4 equivalent |
| `id`      | Unique per event; the transaction id on `purchase` and `upsell_purchase`, so a tag can drop a repeat   |
| `params`  | The event's own fields, on its page in the [Analytics Reference](/analytics)                           |
| `context` | The same on every event, and what [`next.context()`](../javascript-api.md) returns                     |

`context` has `page_location` and `page_referrer` (without their query string), the `campaign`
(`id`, `name`, `currency`, `language`), the campaign `session_id`, the `attribution` (UTM
parameters, affiliate and click ids, `landing_page`, `fbp`, `fbc`) and the `browser`
(`user_agent`, `language`, `device_type`). No event carries the shopper's name, email, phone or
address.

## Once, even across pages

A funnel spans several pages, and a shopper can leave a page before analytics loaded on it. The
SDK keeps track of what it already sent, so each event comes once:

| Event                                                     | Sent                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `begin_checkout`, `add_shipping_info`, `add_payment_info` | Once per checkout. `begin_checkout` not sent on the page that started the checkout comes on its next page |
| `purchase`                                                | Once per order in this browser: a reload of the receipt does not send it again                            |
| `purchase` owed                                           | When the checkout page was left before analytics sent it, on the next page's `order.loaded`               |
| `upsell_purchase`                                         | Once per accepted upsell, on the `order.loaded` of the page after the upsell                              |
| `view_upsell`                                             | Once per upsell page                                                                                      |
| `generate_lead`                                           | When the contact details save an Open Cart (`user.created`)                                               |

`add_to_cart` and `remove_from_cart` compare the priced cart with what earlier events in the tab
already reported, on `sdk.ready` and after each price update. An add on a page that was left
before analytics loaded is still sent on the next page. A cart filled before the page loaded (a
default bundle, `forcePackageId`, `forceBundleId`, a redirect from an add-to-cart button) sends
`add_to_cart` at the cart price. A bundle change sends `remove_from_cart` for the old lines, at the
price they were added, and `add_to_cart` for the new ones. `first_in_session` is `true` on the
first `add_to_cart` of the tab, for tags that should send only one AddToCart.

## Turning parts off

Everything is on by default; `nextConfig.analytics` turns analytics or one provider off, and
nothing for a provider that is off loads. See [Providers](providers.md).

## Debugging

`?debug=1` opens the debug panel. Its Analytics tab shows the GA4 funnel checked off across the
tab's pages and each event this page sent, with its params and what each data layer got.

Every event, and every one the SDK chose not to send, is also a debug log line with its reason:

```js
next.log.level = 'debug';
// analytics add_to_cart sent: Added since the last report: Starter ×1
// analytics begin_checkout not sent: Already sent for this checkout
next.log.entries().filter((entry) => entry.message.startsWith('analytics '));
```
