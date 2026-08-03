---
title: "Features/UI/Scroll Hint/Tested Example"
group: "Features"
category: "Scroll Hint"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A hint that hides once the list is scrolled

```html
<div class="cart-items">
  <div data-next-component="scroll-hint" data-next-scroll-target="#list">
    Scroll for more items
  </div>
  <div id="list">
    <div class="row">Row 1</div>
    <div class="row">Row 2</div>
    <div class="row">Row 3</div>
    <div class="row">Row 4</div>
    <div class="row">Row 5</div>
    <div class="row">Row 6</div>
  </div>
</div>
```

Taken from `e2e/fixtures/scroll-hint.html`, which `e2e/scroll-hint.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [scroll-hint's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
