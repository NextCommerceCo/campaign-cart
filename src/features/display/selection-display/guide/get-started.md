---
title: "Features/Display/Selection Display/Get Started"
group: "Features"
category: "Selection Display"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `selection-display` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- [`package-selector`](../../../cart/package-selector/guide/overview.md) is on the page — it shows whatever the named selector currently has selected, so a `selection.*` binding resolves to nothing without one on the page.

## Turn it on

Put `data-next-display` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-display]`.

### Showing whichever package is currently selected

```html
<!-- Package selector with two cards; no card pre-selected. -->
<div data-next-package-selector data-next-selector-id="sel1">
  <div data-next-selector-card data-next-package-id="1">Single</div>
  <div data-next-selector-card data-next-package-id="2">Triple</div>
</div>

<!-- Reflects the currently selected package in the sel1 selector. -->
<span id="sel-name" data-next-display="selection.sel1.name">?</span>
<span id="sel-price" data-next-display="selection.sel1.price">?</span>
```

This is the markup `e2e/fixtures/selection-display.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `SelectionDisplayEnhancer initialized:` under `SelectionDisplayEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
