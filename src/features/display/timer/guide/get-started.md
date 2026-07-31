---
title: "Features/Display/Timer/Get Started"
group: "Features"
category: "Timer"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `timer` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```

## Turn it on

Put `data-next-timer` on the element. Nothing registers the feature in JavaScript — the attribute in your markup is the whole wiring step, matched by `[data-next-timer]`. It is also registered against `[data-next-timer-display]` and `[data-next-timer-expired]`.

These attributes are required:

| Attribute | Type | What it does |
|---|---|---|
| `data-next-timer` | `boolean (presence)` | Marks the element as a countdown timer. |
| `data-duration` | `number (seconds)` | How long the countdown runs, in seconds. |

Everything else is optional — see [attributes.md](./reference/attributes.md).

### A countdown that reveals an expiry message

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

This is the markup `e2e/fixtures/timer.html` uses, so it is known to work against the current SDK. See [tested-example.md](./reference/tested-example.md).

## Check it worked

- With `?debug=true` on the URL, the console shows `Initialized timer: {duration}s, persistence: {persistenceId}` under `TimerEnhancer`. No line means the feature never activated — check the activating attribute is spelled exactly as above.
- It emits `timer:expired`. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('timer:expired', payload => console.log(payload));
  });
  ```

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
