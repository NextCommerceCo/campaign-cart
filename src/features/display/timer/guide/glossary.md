---
title: "Features/Display/Timer/Glossary"
group: "Features"
category: "Timer"
---

# Glossary

Terms used in this feature's guide.

## Expired element

An element carrying `data-next-timer-expired` and a persistence id. It is revealed when
the timer with that id reaches zero, and it is how the expired state is expressed —
the countdown hides itself rather than rewriting its own content. Expired elements are
matched across the whole page, so one can sit anywhere.

---

## Offer window

The stretch of time an offer is presented as being available for — the ten minutes a
held price lasts. Here it is a **duration per visitor**, counted from the moment that
visitor first saw the timer, not a calendar deadline shared by everyone.

---

## Persistence id

The name a countdown is stored under, set with `data-persistence-id` and defaulting to
`default-timer`. It is the identity of the deadline rather than of the element: two
timers with the same id share one window, and an expired element finds its timer by
matching it. Also the value carried on the `timer:expired` event.
