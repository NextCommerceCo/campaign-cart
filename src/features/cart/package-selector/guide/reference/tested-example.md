---
title: "Features/Cart/Package Selector/Tested Example"
group: "Features"
category: "Package Selector"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Two mutually exclusive cards

```html
<!-- Default mode is swap. Two mutually-exclusive cards. -->
<div data-next-package-selector data-next-selector-id="main">
  <div data-next-selector-card data-next-package-id="1">Single Widget</div>
  <div data-next-selector-card data-next-package-id="2">Triple Pack</div>
</div>

<span data-next-display="cart.totalQuantity">0</span>
```

Taken from `e2e/fixtures/package-selector.html`, which `e2e/package-selector.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [package-selector's overview](../overview.md).
