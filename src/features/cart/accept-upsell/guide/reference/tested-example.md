---
title: "Features/Cart/Accept Upsell/Tested Example"
group: "Features"
category: "Accept Upsell"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## An accept button that adds one offer to an order already paid for

```html
<!-- The order this page adds to is loaded from the `?ref_id=` parameter the
     checkout forwards, so the page is only reachable from a completed order.
     Until that order is in place the button carries `disabled` and the
     `next-disabled` class, so a visitor cannot accept an offer that has
     nowhere to go. -->
<div data-next-display="order.number">…</div>

<button
  data-next-action="accept-upsell"
  data-next-package-id="2"
  data-next-quantity="2"
>
  Add 2 Triple Packs to my order
</button>
```

Taken from `e2e/fixtures/accept-upsell.html`, which `e2e/accept-upsell.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [accept-upsell's overview](../overview.md).
