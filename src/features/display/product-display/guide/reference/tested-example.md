---
title: "Features/Display/Product Display/Tested Example"
group: "Features"
category: "Product Display"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Package values, by explicit id and by ancestor context

```html
<!-- Package referenced by explicit id in the display path (package.1.*). -->
<span id="p1-name" data-next-display="package.1.name">?</span>
<span id="p1-price" data-next-display="package.1.price">?</span>
<img id="p1-image" data-next-display="package.1.image" alt="" />

<!-- Package referenced by ancestor context ([data-next-package-id]). -->
<div data-next-package-id="2">
  <span id="p2-name" data-next-display="package.name">?</span>
  <span id="p2-price" data-next-display="package.price">?</span>
</div>
```

Taken from `e2e/fixtures/product-display.html`, which `e2e/product-display.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [product-display's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
