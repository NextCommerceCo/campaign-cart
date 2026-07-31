---
title: "Features/Behavior/FOMO Popup/Attributes"
group: "Features"
category: "FOMO Popup"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Rotates small social-proof notifications — "Sarah from Denver just bought this" — to show the page has traffic.

Turned on from JavaScript — `next.fomo({ … })` — not by an attribute in your markup.

## CSS classes

Toggled by the feature. Style these rather than tracking the same state yourself.

| Name | Values | Meaning |
|---|---|---|
| `next-fomo-show` | — | On the notification while it is on screen. Animate in and out from this class — the element itself persists between showings. |

## Turning it on

This feature has no activating attribute — it is started from JavaScript, so it
will not appear by adding markup:

```js
next.fomo({
  items: [
    { text: '3-Pack Bundle', image: 'https://cdn.example.com/pack3.jpg' },
    { text: 'Starter Kit',   image: 'https://cdn.example.com/starter.jpg' },
  ],
  customers: {
    US: ['Sarah from Denver', 'Mike from Austin'],
    CA: ['Emma from Toronto'],
  },
  initialDelay: 5000,
  displayDuration: 4000,
  delayBetween: 12000,
  maxMobileShows: 3,
});
```

| Option | Meaning |
|---|---|
| `items` | The products to mention, each with the image to show beside it |
| `customers` | Customer lines per country code, so the names suit the visitor's region |
| `initialDelay` | How long after load the first notification appears, in ms |
| `displayDuration` | How long each notification stays, in ms |
| `delayBetween` | Gap between notifications, in ms |
| `maxMobileShows` | Cap on notifications on small screens, where they cost more attention |

Calling `next.fomo()` again reconfigures the running popup rather than starting a
second one.

## Cautions

- The notifications are **generated from the options you pass**, not from real
  orders. Claiming a specific person bought something when nobody did is a
  misrepresentation in many markets — check what your jurisdiction allows before
  using real-looking names.
- On mobile the cap exists because these overlay the page. Raising
  `maxMobileShows` far above its default tends to cost more conversions than it
  wins.
