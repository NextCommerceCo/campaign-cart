---
title: "Features/Order/Order Item List/Tested Example"
group: "Features"
category: "Order Item List"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Order lines using the built-in row template

```html
<!-- Loaded with ?ref_id=test-order-ref so the SDK auto-loads the order.
     Left empty so the enhancer renders lines with its default template
     (.order-item / .order-item-name / .line-total). -->
<div data-next-order-items></div>
```

Taken from `e2e/fixtures/order-item-list.html`, which `e2e/order-item-list.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [order-item-list's overview](../overview.md).
