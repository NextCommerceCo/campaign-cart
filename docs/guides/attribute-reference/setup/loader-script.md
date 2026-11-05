---
title: 'Loader script'
group: 'Attribute Reference/Setup'
order: 101
---

# Loader script

The script tag that starts the SDK. It names the campaign and the funnel, adds the SDK's
stylesheet (`campaign-cart.css`) to the page, and fetches the campaign while the page is still
being parsed.

```html
<script type="module" src=".../loader.js" data-campaign="pk_…" data-funnel="my-funnel"></script>
```

## Attributes

| Attribute       | Means                                                                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data-campaign` | The campaign's API key. Without it the SDK does not start, logs an error and sets `html[data-next-error="config"]`                                                                                                               |
| `data-funnel`   | The storage scope: the cart, checkout fields and visit are kept per campaign and funnel, so two funnels on one domain never share a cart. Without it, the first folder of the page's path is used (`/vip/checkout.html` → `vip`) |

Every page of one funnel uses the same `data-campaign` and `data-funnel`. `?currency=EUR` on the
URL asks the campaign for that currency (see [URL parameters](url-parameters.md)).

The loader creates `window.nextReady` if the page has not: a queue for scripts that run before the
SDK, called with `window.next` once the page is ready (see the
[JavaScript API](../../javascript-api.md)).

## Set by the SDK

| On       | Set                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `<html>` | `data-next-ready` once the page shows the campaign's values ([Page state](page-state.md))                                                                                      |
| `<html>` | `data-next-error`: `config` (no campaign key), `load` (the SDK code failed to load), `campaign` (the campaign could not be loaded and there was no copy saved in this browser) |
| `<head>` | A `<link rel="stylesheet">` to `campaign-cart.css`, next to `loader.js`                                                                                                        |

## 0.4.x

| 0.4.x                                                    | Now                                 |
| -------------------------------------------------------- | ----------------------------------- |
| `window.nextConfig.apiKey`, `<meta name="next-api-key">` | Still read. Use `data-campaign`     |
| `window.nextConfig.funnel`, `<meta name="next-funnel">`  | Still read. Use `data-funnel`       |
| `window` event `next:ready` when the code has loaded     | Still sent                          |
| `window.dataLayer`                                       | Still created before the SDK starts |

## Events

[sdk.ready](/event-reference/sdk/sdk.ready) once the campaign is in, and
[sdk.error](/event-reference/sdk/sdk.error) when it fails; see the
[SDK lifecycle](../../event-reference/sdk/lifecycle.md).
