---
title: "Features/Checkout/Express Checkout Container/Tested Example"
group: "Features"
category: "Express Checkout Container"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A container the SDK fills with express-payment buttons

```html
<!-- The container injects express-payment buttons into the [buttons] child
     based on the campaign's available_express_payment_methods. -->
<div data-next-express-checkout="container">
  <div data-next-express-checkout="buttons"></div>
</div>
```

Taken from `e2e/fixtures/express-checkout-container.html`, which `e2e/express-checkout-container.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [express-checkout-container's overview](../overview.md).
