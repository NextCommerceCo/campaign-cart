---
title: 'Overview'
group: 'Analytics Reference/Providers'
order: 0.2
---

# Providers

[Tracking events](/analytics) are the SDK's own contract: storefront-style names, and the SDK's
own objects as `data`. A provider takes them and remaps them to its own format. Some are built in:
the SDK sends to them itself. The rest are a few lines of page script on `next.analytics.on`. Each
event's page shows what every provider gets for it.

| Provider                                                      | Built in | Gets                                                                                                           |
| ------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `next.analytics.on`                                           | Yes      | Every tracking event as `{ event_id, event_type, object, data, created_at, session_id, sdk_version, context }` |
| [GTM](gtm.md) (`dataLayer`, `NextDataLayer`)                  | Yes      | Every tracking event as a 0.4.x `dl_*` push                                                                    |
| [GA4](ga4.md)                                                 | No       | The tracking events remapped to GA4 ecommerce events, from a listener                                          |
| [Meta pixel](meta.md)                                         | No       | Six of them as Meta standard events, from a listener                                                           |
| `providers.facebook`, `rudderstack`, `custom` (0.4.x options) | No       | Nothing: the SDK logs a warning. Use a listener or GTM                                                         |

The `checkout_*` events carry the Checkout and `checkout_completed` the Order as `next.on` does, with the shopper's `user` and addresses; the built-in `dl_*` pushes leave them out, and a listener picks what its vendor gets.

## Loading

Nothing for a provider loads unless it is on:

| Part                                                            | Loads                                                                             |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Analytics chunk (tracking events, `dataLayer`, `NextDataLayer`) | When the browser is idle after `sdk.ready`; never with `analytics.enabled: false` |
| GTM, `gtag`, Meta pixel                                         | Never by the SDK: they are the page's own tags                                    |

## Config

Built-in providers are on by default. The 0.4.x `nextConfig.analytics` turns them off:

```html
<script>
  window.nextConfig = {
    analytics: {
      enabled: true,
      providers: {
        gtm: { enabled: false },
      },
    },
  };
</script>
```

| Setting                        | Effect                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `analytics.enabled: false`     | No analytics at all: the chunk does not load and `next.analytics.on` receives nothing |
| `providers.gtm.enabled: false` | Nothing on `window.dataLayer`; pushes still reach `window.NextDataLayer`              |

## Any other vendor

A listener remaps the tracking events to the vendor's format; [GA4](ga4.md) and [Meta pixel](meta.md)
are worked examples. It can go anywhere on the page once `window.next` exists: `next.analytics.on`
first replays the events the page already sent, so a script that runs late misses nothing. The
first events arrive once the analytics chunk has loaded.

A script that can run before the SDK has set `window.next` queues itself in `window.nextReady`
(see the [JavaScript API](../../javascript-api.md)):

```js
(window.nextReady ||= []).push((next) => next.analytics.on('*', (event) => vendor.track(event.event_type, event.data)));
```

## Checking it

Open the page with `?debug=1`: the debug panel's **Analytics** tab lists each event this page sent,
with its `data`, and each place it reached (NextDataLayer, GTM dataLayer, GA4).
