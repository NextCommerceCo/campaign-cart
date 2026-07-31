---
title: "Features/Behavior/Simple Exit Intent/Attributes"
group: "Features"
category: "Simple Exit Intent"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Shows one last offer when the visitor looks like they are leaving — pointer heading for the tab bar, or a fast scroll up on mobile.

Turned on from JavaScript — `next.exitIntent({ … })` — not by an attribute in your markup.

## Read from other elements

These are not placed on the element this feature is bound to — look for them on inputs elsewhere in the page, or on a linked selector.

| Name | Values | Meaning |
|---|---|---|
| `data-exit-intent-action` | — | Put on a button inside your `template` to make it the accept action. Clicking it runs the `action` callback, applies `data-coupon-code` if present, and closes the popup. |
| `data-coupon-code` | — | Put alongside `data-exit-intent-action` to apply a discount code when the visitor accepts, without writing the apply call yourself. |

## Set by the feature

Written to the element as state changes. Read these from CSS or tests instead of inferring state from the rendered text.

| Name | Values | Meaning |
|---|---|---|
| `data-exit-intent` | `overlay`, `popup`, `close` | Set by the feature on the parts it builds, so you can style them: `overlay` on the backdrop, `popup` on the panel, `close` on the close button. |

## Turning it on

No activating attribute — it is started from JavaScript:

```js
next.exitIntent({
  template: `
    <h2>Wait — 10% off</h2>
    <p>Use code STAY10 at checkout.</p>
    <button data-exit-intent-action data-coupon-code="STAY10">
      Apply my discount
    </button>
  `,
  action: () => console.log('offer accepted'),
  maxTriggers: 1,
  disableOnMobile: false,
  mobileScrollTrigger: true,
  useSessionStorage: true,
  overlayClosable: true,
  showCloseButton: true,
});

next.disableExitIntent();  // stop watching
```

| Option | Meaning |
|---|---|
| `image` | Show a single clickable image instead of a template |
| `template` | HTML for the popup body |
| `action` | Called when the visitor accepts; may be async |
| `maxTriggers` | How many times the popup may appear at all |
| `disableOnMobile` | Skip mobile entirely, where exit intent is guesswork |
| `mobileScrollTrigger` | On mobile, treat a fast scroll up as leaving |
| `useSessionStorage` / `sessionStorageKey` | Remember that it fired, so a reload does not re-show it |
| `overlayClosable` | Let a click on the backdrop dismiss it |
| `showCloseButton` | Render the built-in close button |
| `imageClickable` | Make the image itself the accept action |
| `actionButtonText` | Label for the generated action button |

Pass either `image` or `template`, not both.

## Which event to use

Five events fire around one popup, and they are often mistaken for one another:

| Event | Fires when |
|---|---|
| `exit-intent:shown` | The popup appeared |
| `exit-intent:action` | The visitor **accepted** — this is the conversion signal |
| `exit-intent:clicked` | The visitor clicked the popup content, e.g. a clickable image |
| `exit-intent:dismissed` | The visitor rejected it — close button, backdrop, or Escape |
| `exit-intent:closed` | The popup left the page, for any reason at all |

`exit-intent:closed` fires alongside `dismissed` **and** after `action`, so
counting it as a rejection overstates dismissals. Track `action` against
`dismissed`.
