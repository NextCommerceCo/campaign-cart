---
title: "Features/Cart/Add to Cart/Tested Example"
group: "Features"
category: "Add to Cart"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A button that adds one fixed package

```html
<!-- Direct add-to-cart button bound to a fixed package. -->
<button data-next-action="add-to-cart" data-next-package-id="1">
  Add to cart
</button>

<!-- Live cart values, updated by the SDK. -->
<span data-next-display="cart.totalQuantity">0</span>
```

Taken from `e2e/fixtures/add-to-cart.html`, which `e2e/add-to-cart.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [add-to-cart's overview](../overview.md).
