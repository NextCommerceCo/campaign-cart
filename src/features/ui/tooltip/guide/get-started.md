---
title: "Features/UI/Tooltip/Get Started"
group: "Features"
category: "Tooltip"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `tooltip` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```

## Turn it on

Put `data-next-tooltip` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-tooltip]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-tooltip` | `string` | The text to show. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### A tooltip on a button

```html
<!-- delay=0 so the tooltip shows immediately on hover/focus. -->
<button
  id="target"
  data-next-tooltip="Helpful text"
  data-next-tooltip-placement="top"
  data-next-tooltip-delay="0"
>
  Hover me
</button>
```

This is the markup `e2e/fixtures/tooltip.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `Tooltip enhancer initialized` under `TooltipEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.
- It sets `next-tooltip--visible`: on the tooltip while it is shown. Animate from this rather than from the element being inserted. Watch that class in the element inspector — it is the quickest check that state is tracking.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
