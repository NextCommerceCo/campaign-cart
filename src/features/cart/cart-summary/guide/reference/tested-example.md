---
title: "Features/Cart/Cart Summary/Tested Example"
group: "Features"
category: "Cart Summary"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A summary with a custom template

```html
<button data-next-action="add-to-cart" data-next-package-id="1">
  Add to cart
</button>

<!-- A custom template replaces the default summary rows. The {subtotal} /
     {total} / {itemCount} tokens are substituted on every cart change. -->
<div data-next-cart-summary>
  <template>
    <div class="row">
      <span>Subtotal</span>
      <span id="subtotal">{subtotal}</span>
    </div>
    <div class="row">
      <span>Total</span>
      <span id="total">{total}</span>
    </div>
    <div class="row">
      <span>Items</span>
      <span id="item-count">{itemCount}</span>
    </div>
  </template>
</div>
```

Taken from `e2e/fixtures/cart-summary.html`, which `e2e/cart-summary.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [cart-summary's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
