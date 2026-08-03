---
title: "Features/Checkout/Express Checkout Container/Events"
group: "Features"
category: "Express Checkout Container"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `express-checkout:initialized`

**When:** An express payment button — PayPal, Apple Pay, or Google Pay — rendered and is ready to click. Fires once per available method, so a page offering all three sees it three times.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `method` | `'paypal' \| 'apple_pay' \| 'google_pay'` | Which express method became available. |
| `element` | `HTMLElement` | The container the button was rendered into. |
