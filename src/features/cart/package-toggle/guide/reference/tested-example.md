---
title: "Features/Cart/Package Toggle/Tested Example"
group: "Features"
category: "Package Toggle"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## An add-on the visitor turns on and off

```html
<div data-next-package-toggle>
  <div data-next-toggle-card data-next-package-id="1">Add / remove Widget</div>
</div>

<span data-next-display="cart.totalQuantity">0</span>
```

Taken from `e2e/fixtures/package-toggle.html`, which `e2e/package-toggle.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [package-toggle's overview](../overview.md).
