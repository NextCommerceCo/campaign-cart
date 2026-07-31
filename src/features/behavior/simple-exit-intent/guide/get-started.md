---
title: "Features/Behavior/Simple Exit Intent/Get Started"
group: "Features"
category: "Simple Exit Intent"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `simple-exit-intent` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```

## Turn it on

There is no attribute for this one — it is turned on from JavaScript, once the SDK is ready:

```js
window.nextReady.push(() => {
  next.exitIntent({
    image: '/img/exit-offer.jpg',
    // Runs when the visitor clicks the image or the action button.
    action: () => next.applyCoupon('COMEBACK10'),
    actionButtonText: 'Claim 10% off',
    // Show it once per session rather than on every exit gesture.
    maxTriggers: 1,
    useSessionStorage: true,
    // Desktop only: there is no mouse-leave signal on touch devices.
    disableOnMobile: true,
  });
});
```

## Check it worked

- With `?debug=true` on the URL, look for `ExitIntentEnhancer` lines in the console. None at all means the feature never activated.
- It emits `exit-intent:shown`, `exit-intent:clicked`, `exit-intent:dismissed`, and more. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('exit-intent:shown', payload => console.log(payload));
  });
  ```

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
