---
title: "Features/Cart/Bundle Selector/Tested Example"
group: "Features"
category: "Bundle Selector"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Two bundles, one pre-selected

```html
<!-- Two bundles referencing RICH_CAMPAIGN package ref_ids. Bundle A is the
     pre-selected default (swap mode auto-applies it on load). -->
<div data-next-bundle-selector data-next-selector-id="bundles">
  <div
    data-next-bundle-card
    data-next-bundle-id="bundle-a"
    data-next-selected="true"
    data-next-bundle-items='[{"packageId":1,"quantity":1}]'
  >
    Bundle A — single widget
  </div>
  <div
    data-next-bundle-card
    data-next-bundle-id="bundle-b"
    data-next-bundle-items='[{"packageId":1,"quantity":1},{"packageId":3,"quantity":1}]'
  >
    Bundle B — widget + subscription
  </div>
</div>

<span data-next-display="cart.itemCount">0</span>
```

Taken from `e2e/fixtures/bundle-selector.html`, which `e2e/bundle-selector.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [bundle-selector's overview](../overview.md).
