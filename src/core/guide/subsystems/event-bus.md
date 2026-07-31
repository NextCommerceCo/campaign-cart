---
title: "Core/Subsystems/Event Bus"
group: "Core"
category: "Core Subsystems"
---

# Event bus

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

The event bus is how your own code hears what the SDK did — an item added, the cart
recalculated, a coupon rejected, an order completed. Features announce each of those
moments by name, and a page subscribes with `next.on('cart:item-added', handler)`
instead of polling the cart or wrapping the SDK's methods. It is also how the SDK talks
to itself: analytics, display features, and the debug overlay are all subscribers on the
same bus, which is why an event you can read is an event the SDK itself acts on.

## Concept

One process-wide publisher/subscriber registry, typed by a single catalog. The full
catalog is the `EventMap` interface in `src/types/global.ts` — 73 names, each with the
exact payload shape your handler receives — and it is the only place events are declared
or described. Every feature's `guide/reference/events.md` is generated from those same
comments, so a name has one description wherever you read it.

Three properties decide how it behaves in practice:

- **Delivery is synchronous and fire-and-forget.** `emit` walks the handlers in the
  order they subscribed, calls each one immediately, and returns. There is no queue, no
  buffer, and no replay: a handler registered after the event fired never sees it.
- **One bad handler cannot break the others.** Each call is wrapped, so a handler that
  throws is logged and the remaining handlers still run — including the feature's own
  internal subscribers.
- **Subscription is by name and function identity.** Subscribing the same function twice
  registers it once; `next.off()` needs the same function reference, so an inline arrow
  can never be removed.

### There are two channels, and knowing which one carries an event is the whole game

Most events travel on the bus. A few travel as DOM `CustomEvent`s instead, and the two
are not interchangeable — `next.on()` for a DOM-only event registers a handler that
never fires, with no error and no log to explain it.

| Event | Bus (`next.on`) | DOM | How to subscribe |
|---|---|---|---|
| Everything else in `EventMap` | yes | no | `next.on('cart:updated', fn)` |
| `bundle:price-updated`<br>`selector:price-updated`<br>`toggle:price-updated` | **no** | dispatched on the card element and bubbles to `document` | `document.addEventListener('selector:price-updated', fn)` |
| `checkout:location-fields-shown`<br>`checkout:billing-location-fields-shown` | yes | also dispatched on the **form element**, without bubbling | `next.on(…)`, or `form.addEventListener(…)` on the form itself |
| `next:ready`, `next:display-ready`, `next:initialized` | **no** — not in `EventMap` at all | dispatched on `window` | `window.addEventListener('next:initialized', fn)` — see [boot sequence](../reference/boot-sequence.md) |

The three price events are the trap worth memorising: they are declared in `EventMap`,
so TypeScript accepts `next.on('selector:price-updated', …)` and compiles it, and the
handler is dead. Their `EventMap` comment says so in place; when in doubt, that comment
is the answer to "which channel carries this".

## Business logic

- **A name declared in `EventMap` is not a promise that something emits it.** 16 of the
  73 are declared and emitted by nothing in this build. Each one is marked
  `@deprecated` in `src/types/global.ts` with the name to use instead —
  `campaign:loaded`, `checkout:express-started`, `config:updated`,
  `selector:action-completed`, `shipping:method-selected`, `message:displayed`,
  `checkout:express-completed`, `checkout:express-failed`, `express-checkout:error`,
  `express-checkout:started`, `express-checkout:failed`,
  `express-checkout:completed`, `express-checkout:redirect-missing`,
  `address:location-fields-shown`, `offer:selected`, `offer:applied`.
- **How to check before you rely on an event.** Every feature declares the events it
  emits in its manifest, and `src/tests/docs/featureReference.test.ts` fails if a
  declared event is not emitted in that feature's source; the engine declares its own
  the same way in `src/core/docs/core-subsystems.ts`, checked by
  `src/tests/docs/coreSubsystems.test.ts`. So the generated
  `guide/reference/events.md` pages are the live list: **an event that appears on no
  feature's events page and in no subsystem's `emits` is emitted by nothing.** The
  `@deprecated` tag on the `EventMap` entry is the same answer, one file earlier.
- **You cannot subscribe before boot finishes, so events emitted during boot are
  unobservable from the page.** `window.next` is published at boot step 12, and the bus
  has no replay — so `currency:fallback` and `sdk:url-parameters-processed`, both
  emitted while the campaign loads at step 5, have already fired by the time a page
  handler could exist. Read the resulting state instead:
  `useConfigStore.getState().currencyFallbackOccurred` for the first, the parameter
  store for the second. A page that bundles the SDK rather than loading it can
  `import { EventBus }` and subscribe at import time, which is early enough.
- **Payloads are snapshots, not live views.** `cart:updated` hands you the whole cart as
  it was at that moment, not a delta and not a reference that keeps updating. Treat the
  payload as read-only and re-read the store if you need the current value.
- **A misspelled name is silent, not an error.** `on()` creates a bucket for whatever
  string it is given. TypeScript catches the typo; an inline script on a landing page
  does not, and the symptom is a handler that never fires.
- **Handler errors become SDK errors.** A throw inside your handler is caught and
  logged through `console.error`, which the [error handler](./error-handling.md)
  observes — so your own broken handler can surface as an `error:occurred` event.
- **There is no teardown.** Handlers live until `next.off()` removes them. On a page
  that swaps views, keep the reference and unsubscribe, or handlers accumulate and your
  code runs several times per event.

## Decisions

- **We chose one typed `EventMap` over free-form string events** so a misspelled name
  fails type-check and every payload is documented in one place. That catalog is also
  what generates the per-feature event references, so the description a subscriber
  reads cannot drift from the declaration.
- **We chose fire-and-forget delivery over a replayable backlog** because payloads are
  snapshots of a moment — cart totals, an order, a selected package. Replaying one into
  a late subscriber would hand it state the page has already moved past; reading the
  store is the correct answer for code that arrives late.
- **We chose to catch handler errors inside `emit` rather than let them propagate**
  because the emitter is usually a feature mid-operation. A page handler that throws
  must not abort the add-to-cart that announced it.
- **We chose to leave the price signals on DOM `CustomEvent`s** rather than move them
  onto the bus, because their consumers key off the element the price landed on and DOM
  bubbling carries that element for free, where a global bus would have to re-derive it.
  The cost is the two-channel confusion above, which is why each one says so in its own
  `EventMap` comment.
- **We chose to mark unemitted events `@deprecated` in place instead of deleting them**
  because `EventMap` is exported from `src/index.ts`: removing a key is a breaking
  change for a TypeScript consumer. The tag names the replacement and costs no runtime
  behaviour.

## Limitations

- **No `once`, no wildcard, no pattern matching.** Unsubscribe yourself inside the
  handler if you want a single delivery.
- **`on()` returns nothing** — there is no unsubscribe handle. Keep the function
  reference for `next.off()`.
- **No introspection.** There is no public way to list subscribers or to ask whether an
  event has ever fired. `removeAllListeners` exists on the bus class but is not on the
  `next` facade.
- **No ordering or priority control between subscribers**, and no way to stop
  propagation to later handlers.
- **Single page, single frame.** Nothing crosses tabs, windows, or iframes, and the
  registry is not persisted — a page load starts with no subscribers.
- **Nothing before boot completes**, as above: no replay and no way to register from a
  loader-script page until `window.next` exists.
- **DOM-only events are declared in `EventMap` like every other event**, so the type
  system will not stop you from subscribing to one through `next.on()`.

## See also

- [JavaScript API › Reacting to what happens](../reference/javascript-api.md) —
  `next.on()` and `next.off()` with runnable examples, and how they differ from
  `registerCallback`.
- `EventMap` in the SDK reference — the full catalog of 73 events with every payload
  field, generated from `src/types/global.ts`.
- [Boot sequence](../reference/boot-sequence.md) — the `window` lifecycle events, and
  why `next:initialized` rather than `next:ready` is the signal to build on.
- [Error capture](./error-handling.md) — what happens to an error thrown inside a
  handler.
- [Analytics](./analytics.md) — the SDK's own largest subscriber: bus events are what it
  turns into ecommerce events.
- [The SDK engine](../overview.md) — how this subsystem sits with the rest.
