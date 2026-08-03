---
title: "Features/Cart/Coupon/Tested Example"
group: "Features"
category: "Coupon"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A coupon input with an apply button

```html
<button data-next-action="add-to-cart" data-next-package-id="1">
  Add to cart
</button>

<div data-next-coupon="input">
  <input type="text" data-next-coupon="input" placeholder="Coupon code" />
  <button data-next-coupon="apply">Apply</button>
</div>
```

Taken from `e2e/fixtures/coupon.html`, which `e2e/coupon.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [coupon's overview](../overview.md).
