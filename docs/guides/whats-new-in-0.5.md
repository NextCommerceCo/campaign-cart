---
title: 'Start Here/What 0.5 improves'
group: 'Start Here'
category: 'Start Here'
order: 1
---

# What 0.5 improves

0.5 is a new SDK under the same attributes. One engine holds the campaign, cart, checkout and
order; the page's attributes, `window.next` and every listener read from it. A page built for
0.4.x keeps working (see [Migrating from 0.4.x](migrating-from-0.4.md)). What a new page gets:

- [**Less JavaScript**](#less-javascript): a landing page downloads 43 KB instead of 215 KB, and
  checkout code only on the checkout page.
- [**Prices sooner**](#prices-sooner): the campaign is requested before the SDK has finished
  downloading, and kept for the next page.
- [**One set of names**](#one-set-of-names): an attribute, `next.query()` and an event read the
  same object with the same fields.
- [**Events you can build on**](#events-you-can-build-on): one name per change, shaped like a
  webhook, replayed to a script that loads late.
- [**Errors that say what happened**](#errors-that-say-what-happened): which step failed, why,
  and what the SDK does next.
- [**Fewer things to learn**](#fewer-things-to-learn): one way to do each thing, and a reference
  page for each.

## Less JavaScript

![JavaScript a page downloads, gzip on one scale: a 0.4.x landing page 215 KB, a 0.5 landing page 43 KB, a 0.5 checkout page 72 KB](javascript-size.svg)

JavaScript a landing page downloads, gzip:

|                                         | 0.4.x      | 0.5                         |
| --------------------------------------- | ---------- | --------------------------- |
| Before the page shows prices            | 77 KB      | 36 KB                       |
| Tracking                                | 32 KB      | 7 KB, once the page is idle |
| Checkout and upsell code, on every page | 106 KB     | none                        |
| **Total**                               | **215 KB** | **43 KB**                   |

About **5× less** in all, and half as much before the first price. The 36 KB is the 1 KB
loader, the 25 KB core and 9 KB for the page's attributes. The 0.4.x core carried zustand,
decimal.js, and the debug overlay's highlight.js and FontAwesome; 0.5 has no runtime
dependencies. The rest loads only on the page that uses it:

| Code     | Loaded when                                     | gzip  |
| -------- | ----------------------------------------------- | ----- |
| checkout | the page has `form[data-next-checkout]`         | 29 KB |
| order    | an upsell or receipt page (`ref_id`, `order.*`) | 5 KB  |
| slots    | a bundle selector with variant slots            | 3 KB  |
| debug    | `?debug=1`                                      | 70 KB |

A checkout page with all of it downloads about 72 KB, a third of what every 0.4.x landing page
did. Each chunk has a size budget, and `npm run build` fails when one is passed.

## Prices sooner

- **The campaign is the first request.** The 1 KB loader sends it while the rest of the SDK is
  still downloading. 0.4.x asked a geo service first and waited up to 3 seconds for it; 0.5 looks
  a country up only where checkout needs it.
- **The campaign is kept for 10 minutes.** The next page, a reload or a new tab shows prices at
  once and updates them when the fresh campaign arrives.
- **A priced option is kept for 10 minutes too.** The next page, or a quantity the shopper
  picked before, shows its price without another round trip.
- **The page knows when values are in.** `html[data-next-ready]` marks the moment, so a price
  never flashes a placeholder; `html[data-next-error]` says loading failed (`config`, `load` or
  `campaign`), so the page can show its own message.

```css
html:not([data-next-ready]) .price {
  visibility: hidden;
}
```

## One set of names

Attributes, `next.query()`, `next.actions` and events read the same objects with the same
snake_case fields:

```html
<span data-next-query="cart.total"></span>
```

```js
await next.query('cart.total'); // 39
next.on('cart.calculated', (cart) => cart.total); // the same Cart
```

Five roles cover every attribute a page writes: objects, display, actions, inputs and widgets
(see [Attributes](attributes.md)). Every other attribute is a parameter named after a field of
the model: `data-next-shipping-id="3"` is `shipping_id: 3`. A page that uses only these names
never downloads the code for the 0.4.x ones.

## Events you can build on

- **One name per change, shaped like Next Commerce webhooks**: `cart.added`, `checkout.started`,
  `order.paid`. Each comes once, in order, in the same envelope (`event_id`, `event_type`,
  `data`, `created_at`, `session_id`). See [Events](events.md).
- **A script that loads late misses nothing.** `next.on` first replays the events this page
  already sent.
- **`order.paid` comes once per order**, however it was paid: on the checkout, or on the page
  after the payment gateway.
- **Every event has its own page** in the Event Reference, generated from the SDK's types with
  an example recorded from a real checkout, so the fields always match the shipped code.
- **Tracking events have their own listener**: `next.analytics.on('product_added_to_cart', fn)`,
  named in the storefront style and carrying the same objects as `next.on`, with a `context`. Each
  [destination](analytics-reference/destinations/overview.md) remaps them: GTM gets the 0.4.x
  `dl_*` pushes as before, and GA4, the Meta pixel and RudderStack are built in, off until turned on.

## Errors that say what happened

`sdk.error` names the step that failed (`cart.calculate`, `order.create`, …), the reason
(`network`, `timeout`, `declined`, …) and the HTTP status. Each lifecycle page in the Event
Reference lists the errors of its group and what the SDK does next.

The console stays quiet for shoppers: warnings and errors only, and `?debug=1` shows everything.
`next.log.entries()` keeps the last 200 entries whatever the level, and the debug panel shows the
cart, checkout, journey and tracking of the tab.

## Fewer things to learn

- **One way to do each thing.** A bundle selector for one-of-N picks, a toggle for an order
  bump, an offer for an upsell. All three are selectors and share the `selector.*` events.
- **Page UI stays the page's.** Countdowns, accordions, tooltips and popups are page code; the
  0.4.x ones keep working and are deprecated (see
  [Deprecated](migrating-from-0.4.md#deprecated)).
- **A page for each thing.** Every attribute has one in the Attribute Reference, every step of a
  funnel a guide in [Building Pages](building-pages/landing-and-presell.md), and every common
  task a [recipe](recipes/bundle-tiers.md) whose example is tested against the SDK.
