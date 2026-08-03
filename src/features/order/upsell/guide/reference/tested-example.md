---
title: "Features/Order/Upsell/Tested Example"
group: "Features"
category: "Upsell"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A post-purchase offer with an accept button

```html
<!-- An upsell can only be added to an order that is already loaded. The SDK
     loads it from the ?ref_id query parameter the order page is opened with,
     so this page must be reached from a completed order, not visited cold. -->
<div data-next-display="order.number">…</div>

<!-- Direct-mode upsell: a single package with an accept button. -->
<div data-next-upsell="offer" data-next-package-id="1">
  <span data-next-display="package.name">Widget</span>
  <button data-next-upsell-action="add">Add to order</button>
</div>
```

Taken from `e2e/fixtures/upsell.html`, which `e2e/upsell.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [upsell's overview](../overview.md).
