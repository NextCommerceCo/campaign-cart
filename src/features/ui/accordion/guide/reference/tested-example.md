---
title: "Features/UI/Accordion/Tested Example"
group: "Features"
category: "Accordion"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A collapsible FAQ row, closed on load

```html
<!-- Closed-by-default accordion. Defaults: open-text "Hide", close-text
     "Show", toggle-class "next-expanded". -->
<div data-next-accordion="faq1" data-initial-state="closed">
  <div data-next-accordion-trigger="faq1">
    <span data-next-accordion-text="faq1">Show</span>
  </div>
  <div data-next-accordion-panel="faq1">
    <p>Frequently asked answer body.</p>
  </div>
</div>
```

Taken from `e2e/fixtures/accordion.html`, which `e2e/accordion.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [accordion's overview](../overview.md).
