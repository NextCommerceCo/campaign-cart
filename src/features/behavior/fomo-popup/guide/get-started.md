---
title: "Features/Behavior/FOMO Popup/Get Started"
group: "Features"
category: "FOMO Popup"
---

# Get Started

<!-- Generated from the feature manifest and its e2e fixture. Do not edit by
     hand: edit <feature>.manifest.ts or the fixture, then run
     `npm run docs:reference`. -->

Turning on `fomo-popup` on a page that already loads the SDK.

## Prerequisites

- The SDK is loaded and the page has an API key in its `<head>`:
  ```html
  <meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">
  ```
- `campaignStore` — the notifications name real packages from the campaign, so it waits for campaign data before showing anything.

## Turn it on

There is no attribute for this one — it is turned on from JavaScript, once the SDK is ready:

```js
window.nextReady.push(() => {
  next.fomo({
    // How long each notification stays up, and the gap before the next one.
    displayDuration: 5000,
    delayBetween: 12000,
    initialDelay: 3000,
    // Cap it on small screens, where notifications cover the buy button.
    maxMobileShows: 3,
    // Names shown per country. Leave it out to use the built-in list.
    customers: {
      US: ['Sarah from Austin, TX', 'Mike from Denver, CO'],
      GB: ['Emma from Manchester', 'Tom from Bristol'],
    },
  });
});
```

## Check it worked

- With `?debug=true` on the URL, look for `FomoPopupEnhancer` lines in the console. None at all means the feature never activated.
- It emits `fomo:shown`. Listen for one to confirm it is running:
  ```js
  window.nextReady.push(() => {
    next.on('fomo:shown', payload => console.log(payload));
  });
  ```
- It sets `next-fomo-show`: on the notification while it is on screen. Animate in and out from this class — the element itself persists between showings. Watch that class in the element inspector — it is the quickest check that state is tracking.

## Next steps

- [overview.md](./overview.md) — what it does and why it is built this way
- [reference/attributes.md](./reference/attributes.md) — every attribute
- [reference/events.md](./reference/events.md) — payloads you can hook
- [relations.md](./relations.md) — what it needs, and what breaks it
- [reference/errors.md](./reference/errors.md) and [reference/logs.md](./reference/logs.md) — when it does not work
