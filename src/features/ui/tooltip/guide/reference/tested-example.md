---
title: "Features/UI/Tooltip/Tested Example"
group: "Features"
category: "Tooltip"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A tooltip on a button

```html
<!-- delay=0 so the tooltip shows immediately on hover/focus. -->
<button
  id="target"
  data-next-tooltip="Helpful text"
  data-next-tooltip-placement="top"
  data-next-tooltip-delay="0"
>
  Hover me
</button>
```

Taken from `e2e/fixtures/tooltip.html`, which `e2e/tooltip.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [tooltip's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
