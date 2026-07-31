---
title: "Features/Cart/Cart Item List/Tested Example"
group: "Features"
category: "Cart Item List"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A cart line list using the built-in row template

```html
<button id="add-1" data-next-action="add-to-cart" data-next-package-id="1">
  Add Single Widget
</button>
<button id="add-2" data-next-action="add-to-cart" data-next-package-id="2">
  Add Triple Pack
</button>

<!-- No template child → the enhancer uses its built-in default item
     template, which itself carries data-next-quantity / data-next-remove-item
     buttons that the list self-enhances. -->
<div data-next-cart-items></div>
```

Taken from `e2e/fixtures/cart-item-list.html`, which `e2e/cart-item-list.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [cart-item-list's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
