---
title: "Features/Display/Timer/Use Cases"
group: "Features"
category: "Timer"
---

# Use Cases

Situations where a page shows a deadline, and the deadline has to mean something —
survive a reload rather than restarting at ten minutes every time.

## A flash-sale countdown on a landing page

> Effort: lightweight

**When:** The offer is presented as time-limited — "this price is held for 10 minutes"
— and the countdown must not reset when the visitor reloads or navigates back.

**Why this enhancer:** The start time is stored under the key you give it, so the clock
resumes where it left off:

```html
<div data-next-timer data-duration="600" data-persistence-id="flash-sale"
     data-format="mm:ss">
  Price held for <span data-next-timer-display>10:00</span>
</div>
```

**Watch out for:** `data-persistence-id` defaults to `default-timer`, so **every timer
that omits it shares one deadline**. Two offers on the same page without ids will show
the same remaining time, and the second will look like it started early. Give every
distinct offer its own id.

---

## Revealing an "offer expired" state

> Effort: lightweight

**When:** When the clock reaches zero the page should stop advertising the deal and say
so instead.

**Why this enhancer:** Expiry is handled by revealing another element rather than by
rewriting the countdown, so the two states can be laid out and styled independently.
The timer hides itself and any matching expired element appears:

```html
<div data-next-timer data-duration="600" data-persistence-id="flash-sale">
  Price held for <span data-next-timer-display>10:00</span>
</div>

<div data-next-timer-expired data-persistence-id="flash-sale"
     style="display: none">
  This offer has expired — the standard price now applies.
</div>
```

**Watch out for:** Expired elements are matched **document-wide by persistence id**, so
the id on the expired element must be the same string as the timer's. A mismatch means
the timer vanishes and nothing replaces it — a hole in the page. Also author the
expired element hidden (`style="display: none"` as above): the feature reveals it, it
does not hide it on load.

---

## The same clock in two places

> Effort: lightweight

**When:** The countdown appears in a sticky header and again next to the buy button,
and the two must show the same number.

**Why this enhancer:** Sharing a persistence id is the supported way to share a
deadline — both timers read the same stored start time, so they agree without any
coordination:

```html
<div data-next-timer data-duration="900" data-persistence-id="checkout-hold">
  <span data-next-timer-display>15:00</span> left
</div>

<div data-next-timer data-duration="900" data-persistence-id="checkout-hold">
  Reserved for <span data-next-timer-display>15:00</span>
</div>
```

**Watch out for:** Only three formats are understood — `mm:ss`, `hh:mm:ss`, and `ss`.
Anything else silently falls back to `mm:ss`, so a countdown written as
`data-format="h:mm"` renders as minutes and seconds with no warning. Keep the
`data-duration` values identical too: a shared id with different durations means each
element counts to a different zero.

---

## Reacting to expiry in your own code

> Effort: moderate

**When:** Expiry has to do more than swap a message — send an analytics event, or
redirect the visitor to the standard-price page.

**Why this enhancer:** It emits `timer:expired` once, carrying the persistence id, so
you can tell which deadline fired:

```js
window.nextReady.push(() => {
  next.on('timer:expired', payload => {
    if (payload.persistenceId === 'flash-sale') {
      window.location.href = '/standard-price';
    }
  });
});
```

**Watch out for:** The countdown is presentational only. Nothing about the offer
changes when it expires — the price a visitor sees and the price they are charged are
unaffected. If the deadline has to be real, enforce it server-side; otherwise a
visitor who clears site data gets a fresh window.

---

## When NOT to use this

### A fixed calendar deadline

**Why not:** Durations are per visitor and counted from the moment that visitor first
saw the timer, so "the sale ends Friday at 23:59" cannot be expressed. Two visitors
arriving an hour apart get windows that end an hour apart.

**Use instead:** nothing in the SDK covers a shared calendar deadline. Render the
end time from your own page template and enforce it server-side.

### Making the offer itself disappear

**Why not:** The timer hides only its own element and reveals matching expired
elements. It does not know which prices, buttons, or sections the deadline governs.

**Use instead:** put the whole offer inside the expired element's counterpart in your
layout, or drive the change from
[`conditional-display`](../../../display/conditional-display/guide/overview.md) and the
`timer:expired` event above.
