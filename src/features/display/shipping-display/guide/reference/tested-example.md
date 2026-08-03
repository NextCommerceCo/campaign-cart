---
title: "Features/Display/Shipping Display/Tested Example"
group: "Features"
category: "Shipping Display"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Two shipping methods, each showing its own values

```html
<!-- Standard shipping (ref_id 1, $5.99). -->
<div data-next-shipping-id="1">
  <span id="s1-cost" data-next-display="shipping.cost">?</span>
  <span id="s1-name" data-next-display="shipping.name">?</span>
  <span id="s1-free" data-next-display="shipping.isFree">?</span>
</div>

<!-- Free shipping (ref_id 2, $0.00). -->
<div data-next-shipping-id="2">
  <span id="s2-cost" data-next-display="shipping.cost">?</span>
  <span id="s2-name" data-next-display="shipping.name">?</span>
  <span id="s2-free" data-next-display="shipping.isFree">?</span>
</div>
```

Taken from `e2e/fixtures/shipping-display.html`, which `e2e/shipping-display.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [shipping-display's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
