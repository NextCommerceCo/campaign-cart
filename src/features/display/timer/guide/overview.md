---
title: "Features/Display/Timer/Overview"
group: "Features"
category: "Timer"
---

# Timer

> Category: `display`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Counts down to a deadline and survives a page reload, so an offer window means
something.

## Concept

The interesting part is not the counting — it is where the deadline lives.

A countdown that starts at page load is not a deadline, it is a decoration: reload
and the visitor has ten fresh minutes. This feature stores the **start time** in
`localStorage` under a key you choose, so the countdown resumes where it was. The
first time a visitor sees a timer, the clock starts; from then on it keeps running
whether the page is open or not.

That key is `data-persistence-id`, and it is the only thing you have to think
about. Two timers sharing an id share one deadline — useful for the same offer shown
in two places, and a bug when two different offers collide.

Expiry is handled by revealing other elements rather than by rewriting the timer's
own markup: any element anywhere carrying `data-next-timer-expired` and the matching
id appears when the clock hits zero.

## Business logic

- `data-duration` is required and counted in seconds from the visitor's first sight
  of that persistence id, not from each page load.
- Missing or non-numeric duration throws during init and the timer never starts.
- `data-persistence-id` defaults to `default-timer` — which means every timer that
  omits it shares one deadline.
- The formatted time goes into a `data-next-timer-display` child, or into the timer
  element's own text if there is no such child.
- `data-next-timer-expired` elements are matched **document-wide** by persistence id,
  so the expired state does not have to live near the countdown.
- `timer:expired` fires once, carrying the persistence id.
- Clearing site data resets the deadline.

## Decisions

- We persist the start time rather than the remaining time, because a stored
  remaining value would have to be written continuously and would drift.
- We use `localStorage` rather than session storage, so closing the tab does not
  hand back a fresh window.
- We reveal a separate expired element instead of replacing the timer's content, so
  the two states can be laid out and styled independently.
- We default the persistence id rather than requiring it, accepting that the default
  is shared — a timer that refuses to run without configuration would be worse for
  the common single-timer page.

## Limitations

- Does not enforce anything. The countdown is presentational: prices and offers are
  not changed when it expires. Enforce the deadline server-side if it matters.
- Does not survive a cleared browser store, or move between devices.
- Does not support a fixed calendar deadline — durations are per visitor, relative to
  first sight.
- Does not restart. Once expired for a given id, it stays expired.

## Reference

- [Attributes](./reference/attributes.md) — duration, persistence, format, expired
  elements
- [Events](./reference/events.md) — `timer:expired`
