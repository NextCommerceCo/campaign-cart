---
title: "Features/Checkout/Checkout Review/Tested Example"
group: "Features"
category: "Checkout Review"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Playing back what the visitor typed

```html
<!-- Reads the persisted checkout store's formData and renders each field as
     textContent. Empty fields get the next-review-empty class. -->
<div data-next-enhancer="checkout-review">
  <span data-next-checkout-review="email"></span>
  <span data-next-checkout-review="fname"></span>
  <span data-next-checkout-review="lname"></span>
  <span data-next-checkout-review="city"></span>
</div>
```

Taken from `e2e/fixtures/checkout-review.html`, which `e2e/checkout-review.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [checkout-review's overview](../overview.md).
