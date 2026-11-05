---
title: 'Sending events on'
group: 'Analytics Reference'
order: 0.2
---

# Sending events on

The SDK has no built-in GA4, Meta or RudderStack tag. It sends its tracking events to
`next.analytics.on`, to GTM through the 0.4.x `dataLayer` (see [dataLayer (0.4.x)](data-layer.md)),
and to the NEXT analytics script. Any other vendor is a few lines of page script on
`next.analytics.on`. `nextConfig.analytics.providers.facebook`, `rudderstack` and `custom` are no
longer read: the SDK logs a warning and sends nothing for them.

Each event is `{ name, id, time, params, context }`; see [How analytics works](how-it-works.md) and
each event's page in the [Analytics Reference](/analytics) for its `params`.

## GA4 with gtag

Event names and `params` already follow GA4 ecommerce, so they go to `gtag` as they are. `purchase`
and `upsell_purchase` carry their `transaction_id`.

```js
next.analytics.on('*', ({ name, params }) => gtag('event', name, params));
```

`update_cart`, `upsell_purchase`, `view_upsell` and `skip_upsell` are not GA4 standard events:
GA4 records them as custom events. Leave out the ones a property does not want:

```js
const SKIP = new Set(['update_cart', 'view_upsell', 'skip_upsell']);
next.analytics.on('*', ({ name, params }) => SKIP.has(name) || gtag('event', name, params));
```

## GTM

GTM already gets every event as a 0.4.x `dl_*` push on `dataLayer`. A container built on GA4 names
can get those instead, with each event's `ecommerce` cleared first:

```js
next.analytics.on('*', ({ name, id, params }) => {
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event: name, event_id: id, ecommerce: params });
});
```

Doing both sends each event twice to the container. Turn the `dl_*` pushes off with
`nextConfig.analytics.providers.gtm.enabled: false` (they still reach `window.NextDataLayer`).

## Meta pixel

Map the GA4 names to Meta's standard events. `eventID` is the event's `id`, so a server-side
Conversions API event with the same id is counted once.

```js
const META = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  generate_lead: 'Lead',
  purchase: 'Purchase',
};

next.analytics.on('*', ({ name, id, params }) => {
  const event = META[name];
  if (!event) return;
  const items = params.items ?? [];
  fbq(
    'track',
    event,
    {
      value: params.value,
      currency: params.currency,
      content_ids: items.map((item) => item.item_id),
      contents: items.map((item) => ({ id: item.item_id, quantity: item.quantity })),
      content_type: 'product',
    },
    { eventID: id },
  );
});
```

`add_to_cart` has `first_in_session: true` on the first add in the browser, for a pixel that should
count one AddToCart per shopper: `if (name === 'add_to_cart' && !params.first_in_session) return;`.

## Where the script goes

Anywhere on the page, once `window.next` exists. `next.analytics.on` first replays the events the
page already sent, so a script that runs late misses nothing. The analytics code loads when the page
is idle after `sdk.ready`, so the first events arrive after that.

A script that can run before the SDK has set `window.next` waits for it:

```js
const withNext = (fn) =>
  window.next ? fn(window.next) : document.addEventListener('next:initialized', () => fn(window.next), { once: true });

withNext((next) => next.analytics.on('*', ({ name, params }) => gtag('event', name, params)));
```

## Checking it

Open the page with `?debug=1`: the debug panel's **Analytics** tab lists each event this page sent,
with its params, and each place it reached (NextDataLayer, GTM dataLayer, NEXT analytics, GA4).
