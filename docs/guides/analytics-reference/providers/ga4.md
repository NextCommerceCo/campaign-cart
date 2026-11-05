---
title: 'GA4'
group: 'Analytics Reference/Providers'
order: 0.22
---

# GA4

Not built in: a listener sends the standard events to `gtag`. Their names and `params` already
follow GA4 ecommerce, so they go as they are, and `purchase` and `upsell_purchase` carry their
`transaction_id`.

```js
const SKIP = new Set(['page_view', 'update_cart', 'view_upsell', 'skip_upsell']);
next.analytics.on('*', ({ name, params }) => SKIP.has(name) || gtag('event', name, params));
```

`gtag('config', …)` already sends GA4's own `page_view`, so the listener leaves it out. GA4 records
the events that are not its own as custom events; leave out the ones a property does not want.

<!-- ga4-events -->

Through GTM instead, the container gets the [GTM](gtm.md) pushes.
