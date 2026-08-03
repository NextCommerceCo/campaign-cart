---
title: "Features/Behavior/Simple Exit Intent/Overview"
group: "Features"
category: "Simple Exit Intent"
---

# Exit Intent

> Category: `behavior`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Shows one last offer when the visitor looks like they are leaving — pointer heading
for the tab bar on desktop, a fast scroll up on mobile.

## Concept

Like the FOMO popup, this has **no activating attribute**: it is started with
`next.exitIntent({…})`, and the popup's contents are HTML you pass in.

The interesting design problem is that "leaving" is a guess. On desktop it is a
reasonable one — the pointer exiting through the top of the viewport is a real signal.
On mobile there is no pointer, so the proxy is a quick upward scroll, which is much
weaker. That is why mobile behaviour is a separate switch rather than assumed.

Because the popup can only usefully appear once or twice, the feature keeps count and
can remember across a reload. Getting that wrong is how a single offer becomes an
irritation.

Your template opts into the accept action by putting `data-exit-intent-action` on a
button. The feature runs your callback, applies a coupon code if the button names one,
and closes.

## Business logic

- Started with `next.exitIntent(options)`; stopped with `next.disableExitIntent()`.
- Pass either `image` or `template`, not both.
- `maxTriggers` caps appearances; `useSessionStorage` (with `sessionStorageKey`)
  remembers that it fired so a reload does not re-show it.
- `disableOnMobile` skips mobile entirely; `mobileScrollTrigger` enables the
  scroll-up proxy when you do want mobile.
- `overlayClosable` and `showCloseButton` control how it can be dismissed;
  `imageClickable` makes an image popup itself the accept action.
- `data-exit-intent-action` on a button in your template makes it the accept control.
  `data-coupon-code` beside it applies that code on accept.
- The feature stamps `data-exit-intent` on the parts it builds — `overlay`, `popup`,
  `close` — for styling.
- **Five events fire around one popup.** `exit-intent:closed` fires alongside
  `dismissed` **and** after `action`, so counting it as a rejection overstates
  dismissals. Track `action` against `dismissed`.

## Decisions

- We treat mobile as opt-in rather than inferring exit intent there by default,
  because the signal is a guess and a wrong guess interrupts someone who was still
  shopping.
- We keep the popup's content entirely yours, since an exit offer is a design and
  copy decision.
- We support session persistence rather than only an in-page counter, because a
  reload is the cheapest way for a visitor to re-trigger an offer.
- We handle the coupon application from an attribute so the common case — "here is
  10% off" — needs no callback code.

## Limitations

- Cannot detect intent reliably on mobile. There is no pointer; the scroll proxy will
  have false positives.
- Cannot prevent leaving, and does not try to. No dialogs that block navigation.
- Does not A/B test or rotate offers.
- Cannot be turned on from markup.
- Fires at most `maxTriggers` times per session window — it is not a persistent
  banner.

## Reference

- [Attributes](./reference/attributes.md) — the options, the template hooks, and the
  event guide
- [Events](./reference/events.md) — all five, and which one means "accepted"
