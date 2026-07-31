---
title: "Features/Display/Timer/Tested Example"
group: "Features"
category: "Timer"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A countdown that reveals an expiry message

```html
<!-- 2-second countdown, persisted under localStorage key next-timer-e2e. -->
<div id="timer" data-next-timer data-duration="2" data-persistence-id="e2e">
  <span data-next-timer-display>--:--</span>
</div>

<!-- Revealed by the enhancer when the timer above expires. -->
<div
  id="expired"
  data-next-timer-expired
  data-persistence-id="e2e"
  style="display: none"
>
  Offer expired
</div>
```

Taken from `e2e/fixtures/timer.html`, which `e2e/timer.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [timer's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
