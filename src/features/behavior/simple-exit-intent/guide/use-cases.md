---
title: "Features/Behavior/Simple Exit Intent/Use Cases"
group: "Features"
category: "Simple Exit Intent"
---

# Use Cases

Where one last offer at the moment of leaving is worth showing, and where the
guess behind it is too weak to build on.

## A last-chance discount for a desktop visitor heading for the tab bar

> Effort: lightweight

**When:** Desktop visitors reach the offer, do not buy, and leave. The clearest
moment to intervene is the pointer travelling up out of the viewport towards the
address bar or a browser tab.

**Why this enhancer:** On desktop that gesture is a real signal, and the feature
reads it conservatively — the pointer must leave the document itself, within 10px
of the top edge, before anything shows. An image and a button are enough to ship:

```js
window.nextReady.push(() => {
  next.exitIntent({
    image: 'https://cdn.example.com/exit-offer.jpg',
    actionButtonText: 'Claim 10% off',
    action: () => next.applyCoupon('COMEBACK10'),
    maxTriggers: 1,
    useSessionStorage: true,
    disableOnMobile: true,
  });
});
```

**Watch out for:** Acceptance and rejection are different events, and which one
means "accepted" depends on how the popup was built. For this image-and-button
popup the accept signal is `exit-intent:clicked`; the close button emits
`exit-intent:closed`, and the backdrop or the Escape key emits
`exit-intent:dismissed`. Counting `closed` as a rejection while your visitors are
dismissing by backdrop will show close to zero rejections and make the offer look
better than it is. Track `clicked` against `dismissed`.

---

## A branded popup that applies a coupon on accept

> Effort: moderate

**When:** Marketing wants the exit offer to look like the rest of the page —
headline, terms, a styled button — rather than a flat image, and accepting it
should put the discount in the cart with no further steps.

**Why this enhancer:** `template` names a `<template>` element already on the
page, so the popup body is your markup. A button inside it opts into the accept
behaviour with an attribute, and `data-coupon-code` applies the code through the
cart with no callback of your own:

```html
<template data-template="exit-offer">
  <div class="exit-offer">
    <h2>Before you go — 10% off</h2>
    <p>Applies to your current cart. One use per customer.</p>
    <button data-exit-intent-action="apply-coupon" data-coupon-code="STAY10">
      Apply my discount
    </button>
  </div>
</template>
```

```js
window.nextReady.push(() => {
  next.exitIntent({
    template: 'exit-offer',
    showCloseButton: true,
    overlayClosable: true,
    maxTriggers: 1,
  });
});
```

**Watch out for:** `data-exit-intent-action` is matched on its **value**, and only
three are wired: `apply-coupon` (which also needs `data-coupon-code`), `custom`
(which runs the `action` callback you passed), and `close`. A bare
`data-exit-intent-action` with no value, or any other word, gets no click handler
at all — the symptom is a button that looks right, does nothing, and logs nothing.
Give it one of the three values, and use `custom` whenever the accept step is your
own code.

Two more things fail quietly here: `template` is the **name** of a template
element, not HTML, so a missing element logs
`Exit intent template not found: <template data-template="{templateName}">` and
the feature never arms itself. And passing neither `image` nor `template` logs
`Exit intent requires either an image URL or a template name` and returns. Both
lines mean no visitor will ever see the popup.

---

## An exit offer for mostly-mobile traffic

> Effort: moderate

**When:** Most of the traffic is on phones, where there is no pointer to watch, and
the team still wants an offer before the visit ends.

**Why this enhancer:** `mobileScrollTrigger` substitutes a scroll-depth proxy —
once the visitor has scrolled at least halfway down the page, the offer may fire.
Mobile needs both switches, because touch devices are excluded by default:

```js
window.nextReady.push(() => {
  next.exitIntent({
    image: 'https://cdn.example.com/exit-offer-mobile.jpg',
    disableOnMobile: false,
    mobileScrollTrigger: true,
    maxTriggers: 1,
    useSessionStorage: true,
  });
});
```

**Watch out for:** `disableOnMobile` defaults to **true**, and it is checked before
anything is wired up. Setting `mobileScrollTrigger: true` on its own leaves the
feature disabled on exactly the devices you were targeting; with debug mode on the
only trace is `Exit intent disabled on mobile device`. Set both options as above.
Then judge the result honestly: halfway down the page is a reading position as
often as a leaving one, so this fires at people who were still shopping.

---

## Testing it without fighting the caps

> Effort: lightweight

**When:** You are checking the popup in QA and it refuses to appear a second time.

**Why this enhancer:** Three separate guards stop repeat showings: `maxTriggers`
(default 1), a fixed 30-second cooldown after a trigger, and the session record
that survives a reload. Loosen them for the test run and restore the production
values afterwards:

```js
window.nextReady.push(() => {
  next.exitIntent({
    image: 'https://cdn.example.com/exit-offer.jpg',
    maxTriggers: 5,
    useSessionStorage: false,
  });
});
```

**Watch out for:** The session record is read once, when the feature loads, using
the default key `next-exit-intent-dismissed` — before your `sessionStorageKey`
option has been applied. So a custom key stores the count but does not restore it
on the next page load, and the popup can show again in the same session. The fix
is to keep the default key unless you are running two independent popups, and to
clear that key (or use `next.disableExitIntent()`) rather than relying on a custom
one to reset state.

---

## When NOT to use this

### Creating urgency during the visit

**Why not:** This only appears on the way out, at most once or twice, so it cannot
carry a message the visitor needs while they are deciding.

**Use instead:** [`timer`](../../../display/timer/guide/overview.md) — a countdown
that is visible the whole time.

### Letting a customer enter a code they already have

**Why not:** The popup applies a code you chose. It has no input, no validation,
and no error state for a code that does not apply.

**Use instead:** [`coupon`](../../../cart/coupon/guide/overview.md) — a real code
entry field with its own feedback.

### Offering an add-on to someone who is still shopping

**Why not:** An interrupt over the whole page is the wrong shape for "would you
also like this", and it fires at most once per session, so most visitors never see
it.

**Use instead:**
[`accept-upsell`](../../../cart/accept-upsell/guide/overview.md) — an in-page
offer the visitor accepts when they are ready.

## Next steps

- [get-started.md](./get-started.md) — the call, with every option
- [reference/events.md](./reference/events.md) — all five events and their
  payloads
- [reference/logs.md](./reference/logs.md) — the exact lines quoted above
- [glossary.md](./glossary.md) — the terms used here
