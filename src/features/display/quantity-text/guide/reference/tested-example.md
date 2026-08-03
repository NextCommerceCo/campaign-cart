---
title: "Features/Display/Quantity Text/Tested Example"
group: "Features"
category: "Quantity Text"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Text that reflows with the quantity

```html
<!--
  Template combines all three substitution forms:
  {qty} -> quantity, {qty*3} -> quantity x3, {item|items} -> singular/plural.
  Default quantity is 1 with no upsell control, so this renders statically.
-->
<div data-next-package-id="2">
  <span id="qty-text" data-next-quantity-text="{qty} {item|items}, get {qty*3}"
    >placeholder</span
  >
</div>
```

Taken from `e2e/fixtures/quantity-text.html`, which `e2e/quantity-text.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [quantity-text's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
