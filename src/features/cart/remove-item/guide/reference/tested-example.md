---
title: "Features/Cart/Remove Item/Tested Example"
group: "Features"
category: "Remove Item"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A remove button for one cart line

```html
<button data-next-action="add-to-cart" data-next-package-id="1">
  Add to cart
</button>

<button data-next-remove-item data-package-id="1">Remove</button>

<span data-next-display="cart.totalQuantity">0</span>
<span data-next-display="cart.itemCount">0</span>
```

Taken from `e2e/fixtures/remove-item.html`, which `e2e/remove-item.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [remove-item's overview](../overview.md).
