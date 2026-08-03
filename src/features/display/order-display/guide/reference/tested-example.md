---
title: "Features/Display/Order Display/Tested Example"
group: "Features"
category: "Order Display"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Order values on a receipt page

```html
<!-- OrderDisplayEnhancer auto-loads the order from the ?ref_id URL param. -->
<span id="order-number" data-next-display="order.number">?</span>
<span id="order-total" data-next-display="order.total">?</span>
<a id="order-status" data-next-display="order.statusUrl">Status</a>
```

Taken from `e2e/fixtures/order-display.html`, which `e2e/order-display.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [order-display's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
