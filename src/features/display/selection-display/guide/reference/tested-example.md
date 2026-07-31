---
title: "Features/Display/Selection Display/Tested Example"
group: "Features"
category: "Selection Display"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Showing whichever package is currently selected

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

Taken from `e2e/fixtures/selection-display.html`, which `e2e/selection-display.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [selection-display's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
