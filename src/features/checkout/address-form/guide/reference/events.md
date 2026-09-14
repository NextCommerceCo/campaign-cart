---
title: "Features/Checkout/Address Form/Events"
group: "Features"
category: "Address Form"
---

# Events

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Subscribe with `next.on('<event>', handler)`. Payloads are the exact shapes declared on `EventMap`, which is where these descriptions come from.

## `address:fields-rendered`

**When:** The address block built its fields for a country, so anything that scanned the form earlier has to look again. Carries the checkout-field names it rendered, in the order that country writes them.

**Payload:**

| Field | Type | Description |
|---|---|---|
| `form` | `'shipping' \| 'billing'` |  |
| `country` | `string` |  |
| `fields` | `string[]` |  |
