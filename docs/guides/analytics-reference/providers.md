---
title: 'Providers'
group: 'Analytics Reference'
order: 0.15
---

# Providers

The SDK sends its tracking events to four places of its own. It loads no vendor tag: GTM, `gtag`
and the Meta pixel are the page's own scripts, and GA4, Meta or any other vendor gets the events
through [a listener](sending-events.md).

| Provider                                      | Gets                                                                | Turned off by                           |
| --------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------- |
| `next.analytics.on`                           | Every event as `{ name, id, time, params, context }`                | `analytics.enabled: false`              |
| GTM (`window.dataLayer`)                      | Every event as a 0.4.x `dl_*` push, after `{ ecommerce: null }`     | `providers.gtm.enabled: false`          |
| `window.NextDataLayer`                        | The same `dl_*` pushes, without the `{ ecommerce: null }`           | `analytics.enabled: false`              |
| NEXT campaign script                          | `config({ apiKey })`, then one `page_view` with `{ title, url }`    | `providers.nextCampaign.enabled: false` |
| GA4, Meta pixel, any other vendor             | Nothing from the SDK: [a listener](sending-events.md) sends them on | —                                       |
| `providers.facebook`, `rudderstack`, `custom` | No longer built in: the SDK logs a warning and sends nothing        | —                                       |

The `dl_*` pushes and their fields are on [dataLayer (0.4.x)](data-layer.md); an event's `params`
on its page in the [Analytics Reference](/analytics). No provider gets the shopper's name, email,
phone or address.

## Loading

Nothing for a provider loads unless it is on:

| Part                                                              | Loads                                                                                                     |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Analytics chunk (events, `dataLayer` and `NextDataLayer`)         | When the browser is idle after `sdk.ready`; never with `analytics.enabled: false`                         |
| NEXT campaign script, `campaigns.apps.29next.com/js/v1/campaign/` | Added by the analytics chunk, only with `providers.nextCampaign` on; not added again when the page has it |
| GTM, `gtag`, Meta pixel                                           | Never by the SDK: the page's own tags                                                                     |

## Config

Every provider is on by default. The 0.4.x `nextConfig.analytics` turns them off:

```html
<script>
  window.nextConfig = {
    analytics: {
      enabled: true,
      providers: {
        gtm: { enabled: false },
        nextCampaign: { enabled: false },
      },
    },
  };
</script>
```

| Setting                                 | Effect                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------- |
| `analytics.enabled: false`              | No analytics at all: the chunk does not load and `next.analytics.on` receives nothing |
| `providers.gtm.enabled: false`          | Nothing on `window.dataLayer`; pushes still reach `window.NextDataLayer`              |
| `providers.nextCampaign.enabled: false` | The NEXT campaign script is not added to the page                                     |
