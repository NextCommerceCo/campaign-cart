---
title: "Features/Display/Display Core/Get Started"
group: "Features"
category: "Display Core"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `display-core` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- `campaignStore` — package and product values come from campaign data; before it loads a binding renders its placeholder.

## Turn it on

Put `data-next-display` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-display]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-display` | `string (namespaced path)` | The value to show, written as `{namespace}.{path}` — for example `cart.total` or `package.101.price`. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `{name} initialized with path: {displayPath}` under `DisplayEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
