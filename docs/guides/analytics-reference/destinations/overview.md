---
title: 'Overview'
group: 'Analytics Reference/Destinations'
order: 0.2
---

# Destinations

[Tracking events](/analytics) are the SDK's own contract: storefront-style names, and the SDK's
own objects as `data`. A destination takes them and remaps them to its vendor's format. Four are
built in: the SDK sends to them itself, each from a chunk that loads only when it is on. Any other
vendor is a few lines of page script on `next.analytics.on`. Each event's page shows what every
destination gets for it.

| Destination                   | Built in | On by default | Config key                         | Loads                          | Vendor docs                                                                                                      |
| ----------------------------- | -------- | ------------- | ---------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| [GTM](gtm.md)                 | Yes      | Yes           | `destinations.gtm`                 | Nothing more                   | [Elevar data layer](https://docs.getelevar.com/docs/view-all-event-triggers-and-data-layer-variables)            |
| [GA4](ga4.md)                 | Yes      | No            | `destinations.ga4`                 | `ga4-*.js`, about 2 KB         | [GA4 events](https://developers.google.com/analytics/devguides/collection/ga4/reference/events?client_type=gtag) |
| [Meta pixel](meta.md)         | Yes      | No            | `destinations.meta`                | `meta-*.js`, about 2 KB        | [Meta Pixel standard events](https://developers.facebook.com/docs/meta-pixel/reference#standard-events)          |
| [RudderStack](rudderstack.md) | Yes      | No            | `destinations.rudderstack`         | `rudderstack-*.js`, about 3 KB | [RudderStack ecommerce spec](https://www.rudderstack.com/docs/event-spec/ecommerce-events-spec/)                 |
| Any other vendor              | No       |               | A [listener](#by-hand) on the page | Nothing                        |                                                                                                                  |

The SDK never loads a vendor's tag: GTM, `gtag`, the Meta pixel's base code and RudderStack's
JavaScript SDK snippet are the page's own. A destination that is on without its tag logs one
warning.

The Meta destination sends `PageView` itself, as 0.4.x did. A page that keeps
`fbq('track', 'PageView')` in its pixel base code sends it twice: remove that line.

The `checkout_*` events carry the Checkout and `checkout_completed` the Order as `next.on` does,
with the shopper's `user` and addresses. GTM, GA4 and Meta leave them out; RudderStack sends the
`identify()` 0.4.x sent, with the email, name, phone and address; a listener picks what its vendor
gets.

## Config

```html
<script>
  window.nextConfig = {
    analytics: {
      destinations: {
        gtm: { enabled: true },
        ga4: { enabled: true },
        meta: { enabled: true, storeName: 'shop' },
        rudderstack: { enabled: true },
      },
    },
  };
</script>
```

| Setting                                  | Effect                                                                        |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| `analytics.enabled: false`               | No analytics at all: no chunk loads and `next.analytics.on` receives nothing  |
| `destinations.gtm.enabled: false`        | Nothing on `window.dataLayer`; pushes still reach `window.NextDataLayer`      |
| `destinations.ga4.enabled: true`         | Tracking events go to `gtag`                                                  |
| `destinations.meta.enabled: true`        | Tracking events go to `fbq`; `storeName` sets an order's `Purchase` `eventID` |
| `destinations.rudderstack.enabled: true` | Tracking events go to `rudderanalytics`, as 0.4.x sent them                   |

The 0.4.x keys still work under `destinations`, which wins when both are set:

| 0.4.x                                     | Reads as                                                          |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `analytics.providers.gtm.enabled`         | `destinations.gtm.enabled`                                        |
| `analytics.providers.facebook.enabled`    | `destinations.meta.enabled`                                       |
| `nextConfig.storeName`                    | `destinations.meta.storeName`                                     |
| `analytics.providers.rudderstack.enabled` | `destinations.rudderstack.enabled`                                |
| `analytics.providers.custom`              | Nothing: the SDK logs a warning. Send from a [listener](#by-hand) |

## By hand

A custom endpoint is not built in. A listener sends each tracking event to it:

```js
next.analytics.on('*', (event) => {
  fetch('https://collect.example.com/events', { method: 'POST', keepalive: true, body: JSON.stringify(event) });
});
```

A listener also remaps the tracking events to any other vendor's format:

```js
next.analytics.on('*', ({ event_type, event_id, data }) => {
  if (event_type === 'page_viewed') return;
  const lines = Array.isArray(data) ? data : (data.lines ?? data.cart?.lines ?? [data]);
  vendor.track(event_type, { id: event_id, value: data.total ?? data.cart?.total, items: lines });
});
```

It can go anywhere on the page once `window.next` exists: `next.analytics.on` first replays the
events the page already sent, so a script that runs late misses nothing. A script that can run
before the SDK has set `window.next` queues itself in `window.nextReady` (see the
[JavaScript API](../../javascript-api.md)):

```js
(window.nextReady ||= []).push((next) => next.analytics.on('*', (event) => vendor.track(event.event_type, event.data)));
```

## Checking it

Open the page with `?debug=1`: the debug panel's **Analytics** tab lists each event this page sent,
with its `data`, and each destination it reached.
