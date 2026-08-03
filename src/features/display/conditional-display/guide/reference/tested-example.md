---
title: "Features/Display/Conditional Display/Tested Example"
group: "Features"
category: "Conditional Display"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Showing one element while the cart has items, and another while it is empty

```html
<button data-next-action="add-to-cart" data-next-package-id="1">
  Add to cart
</button>

<!-- Shown only when the cart has items. -->
<div id="show-when-items" data-next-show="cart.hasItems">Cart has items</div>

<!-- Hidden when the cart has items (i.e. shown while empty). -->
<div id="hide-when-items" data-next-hide="cart.hasItems">Your cart is empty</div>
```

Taken from `e2e/fixtures/conditional-display.html`, which `e2e/conditional-display.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [conditional-display's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
