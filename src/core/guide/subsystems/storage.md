---
title: "Core/Storage"
group: "Core"
category: "Core Subsystems"
---

# Storage and expiry

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

A campaign is several pages — landing, checkout, upsell, receipt — and each one is a
fresh page load that starts with nothing. This part of the engine is why the second page
already knows what the visitor put in their cart, which currency they are shopping in,
and which ad sent them: it writes that state into the browser's own sessionStorage and
localStorage on one page and reads it back on the next. Nobody configures it. What you
need from it is the ability to answer two questions when something comes back wrong —
*was this meant to survive?* and *how long was it meant to stay valid?* Every key, its
store, its expiry and what the visitor loses if it goes is listed in
[storage keys](../reference/storage-keys.md); this page is the model behind that list.

## Concept

Three questions, asked in this order, resolve nearly every storage report. None of them
is about the storage code — they are about *who wrote the entry*.

**1. Which browser store?** That decides what the visitor keeps.

- `sessionStorage` is **one tab**. Close it, or open the campaign in a second tab, and
  the entry is not there. The cart, the campaign cache, the checkout form, the order and
  the attribution record all live here — so "the cart emptied itself" is very often "the
  visitor opened a new tab".
- `localStorage` survives the tab, the browser restart, and your test run. Country
  reference data, the analytics `visitor_id`, the data-layer session and the debug
  overlay's own preferences live here — and so does a **second copy** of a few
  attribution values, which is why clearing one store does not always clear a value.

**2. Who wrote it?** That decides whether the entry has a documented shape.

- Five stores persist themselves through Zustand's `persist` middleware, one key each.
  Their reference pages carry a **Survives** column that says, field by field, what comes
  back after a reload — that is where a field's shape and meaning live, not here:
  [cart](../../../state/cart/guide/reference/state-reference.md),
  [checkout](../../../state/checkout/guide/reference/state-reference.md),
  [order](../../../state/order/guide/reference/state-reference.md),
  [attribution](../../../state/attribution/guide/reference/state-reference.md),
  [parameter](../../../state/parameter/guide/reference/state-reference.md).
- The [campaign](../../../state/campaign/guide/reference/state-reference.md) store does
  **not** use `persist`. It writes its own cache entry per currency, by hand.
- The [config](../../../state/config/guide/reference/state-reference.md) store persists
  nothing at all; it mirrors the resolved currency into a key of its own.
- Everything else — roughly forty more keys — is written by core services with direct
  `sessionStorage.setItem` calls: the attribution collector, analytics, the country
  service, the boot sequence, the debug overlay.

**3. What expiry did that writer choose?** Each writer chose its own, and there is no
shared one. That is the single most expensive assumption a reader can bring to this
subsystem, so it has its own section below.

```
page load
   │
   ├─► 5 stores, via Zustand `persist`   ──► sessionStorage, one key each
   │      cart, checkout, order,               next-cart-state, next-checkout-store,
   │      attribution, parameter               next-order, next-attribution, next-url-params
   │
   ├─► campaign store, by hand           ──► sessionStorage, one key per currency
   │                                           next-campaign-cache_{CURRENCY}
   │
   ├─► config store                      ──► persists nothing of its own; mirrors the
   │                                         resolved currency into next_selected_currency
   │
   └─► core services, direct calls       ──► sessionStorage and localStorage
          attribution collector, analytics,    ~40 further keys, no store behind them
          country service, boot, debug overlay
```

`core/storage.ts` is the file this subsystem is named after, and it is worth knowing how
little of the picture it covers. It exports one live helper — a `sessionStorageManager`
that wraps `getItem`/`setItem` in a try/catch and JSON — and it is called from **15**
places. Direct `sessionStorage.*` and `localStorage.*` calls appear **186** times across
**35** files. So there is no storage layer to configure or instrument: there is a browser
API, called from wherever the data was needed, and a thin convenience wrapper over part
of it.

## There is no shared expiry

Ten independent expiry windows exist, ranging from five minutes to a year, each written
next to the code that needed it. Two are inline literals rather than named constants, and
one is declared twice in two files. The window-by-window table, with the constant and the
file that owns each, is in
[storage keys → There is no shared expiry mechanism](../reference/storage-keys.md#there-is-no-shared-expiry-mechanism).

What matters here is the consequence, which the table cannot state for you:

- **"The cache is 10 minutes" is true of the campaign and wrong about everything else.**
  Symptom: a change that should have expired is still visible, or an entry you expected
  to persist has gone. Fix: look up the specific key before reasoning about it.
- **Changing "how long the SDK caches things" is never one edit.** There is no setting,
  no config field, and no `next.*` method that moves any of these windows. Fix: change
  the constant in the file that owns that key, and update its row in the reference in the
  same change.
- **Expiry is checked on read, never on a timer.** A stale entry sits in storage until
  some code looks at it and throws it away. Symptom: devtools shows an entry the SDK has
  already decided is dead — most visibly with the order, whose 15-minute window is only
  evaluated when the store rehydrates on a page load. Fix: trust the timestamp inside the
  value, not the presence of the key.

## Business logic

**What triggers a write.** Store writes happen on every state change the store's
`partialize` covers, synchronously, as part of the update. Service writes happen at the
moment the service has the value — the attribution collector during boot step 4, the
country service when a response lands, analytics when an event is built. See the
[boot sequence](../reference/boot-sequence.md) for the order.

**What triggers a read.** Store reads happen once, at store creation — which is module
import time, before the boot sequence starts. That is why the cart is not trustworthy
until boot step 7 (`waitForStoreRehydration`) has finished recalculating totals: the raw
items are back sooner than the totals are. Code that reads the cart earlier sees an
incomplete cart, not an error. Fix: read it from a `window.nextReady` callback, as
[the section landing page](../overview.md#the-one-thing-to-get-right) shows.

**Only what `partialize` lists is written.** Adding a field to a store does not persist
it. Symptom: a field that is correct on the page you set it on and empty after a reload.
Fix: add it to that store's `partialize` and to its state reference's **Survives**
column, in the same change. The exception is the attribution store, which has no
`partialize` at all and therefore writes its whole state — including fields you meant to
be runtime-only.

**Writes fail silently.** A browser with storage blocked or a quota exceeded produces a
logged error and a `false` return value, never a thrown exception, and no caller checks
the return value. Symptom: the SDK works on the page in front of you and every page after
it starts from scratch — classically Safari with cross-site tracking restrictions, or a
tab with a very large cart. Fix: reproduce with storage disabled in devtools and look for
`Failed to store value for key` in the console rather than for a crash.

**Renaming a key is a destructive change to live traffic.** A visitor mid-funnel is keyed
by the old name, so a rename reads as an empty cart with no error anywhere — and the cart
key, `next-cart-state`, is the one whose loss a shopper definitely notices. Fix: add a
new key and migrate on read; never rename in place. `src/state/cart/cart.state-manifest.ts`
records the same rule next to the code.

**Clearing is narrower than it looks.** `?reset=true` (and the `clearAllStorage()` behind
it) sweeps keys that start `next-` or `_next`. Every key spelled with an **underscore**
after `next` survives it — including the currency lock, the funnel name and the country
cache — as do all the `analytics_*`, `debug-*`, `evclid`, `user_data` and `visitor_id`
entries. Symptom: you reset the page and it still comes up in EUR. Fix: clear both stores
in devtools when you need a genuinely first-time visitor. The full survivor list is in the
[storage keys cautions](../reference/storage-keys.md#cautions).

**Nothing is synchronised across tabs, and nothing notifies on change.** sessionStorage
is per-tab by definition, so two tabs on the same campaign hold two separate carts that
never reconcile. For the keys with no store behind them there is also no subscription
mechanism: a value written there does not notify anything, so code that depends on it has
to read it at the moment it needs it rather than react to it.

**Assumptions this subsystem makes.** That `sessionStorage` and `localStorage` exist and
are writable; that every stored value round-trips through `JSON.stringify`; and that the
tab is the right boundary for a purchase. The last one is a product decision, not a
technical limit — see below.

## Decisions

- **We chose sessionStorage over localStorage for the cart, campaign, checkout and
  order** because a cart resumed days later is priced from a campaign that may no longer
  offer those packages or that currency, and showing a shopper a stale total is worse
  than showing them an empty cart. The cost is real and accepted: a new tab is a new
  shopper.
- **We chose a per-key expiry over one shared TTL** because the data genuinely has
  different shelf lives — a country list changes on the order of years, an order matters
  for minutes — and one window would have to be the shortest of them. The cost is that
  "how long does the SDK cache things" has no single answer, which is why the reference
  page leads with that fact.
- **We chose to key the campaign cache by currency** rather than invalidating the cache
  when the currency changes, because a single session legitimately visits more than one
  currency (a `?currency=` test, the debug country selector) and invalidation would throw
  away the entry it is about to want back.
- **We chose to let writes fail rather than throw** because a browser with storage
  blocked should still be able to complete a purchase on the page it is on. The cost is
  that the failure is invisible until the next page load.
- **We kept `core/storage.ts` as a thin wrapper rather than growing it into a storage
  layer** — most code calls the browser directly. This is worth naming as a decision
  because it is what forecloses the obvious features: there is nowhere to put a central
  expiry sweep, a central clear, a quota policy, or a change notification, because there
  is no single door the writes go through.

## Limitations

- **Does not synchronise across tabs, windows, or devices.** There is no server-side
  cart. Two tabs are two carts; a phone and a laptop are two carts.
- **Does not version or migrate stored data.** An entry written by an older SDK is read
  as-is by a newer one. A field that changed shape between releases is a wrong value, not
  a rejected one.
- **Does not encrypt or obscure anything.** Everything above is plain JSON in devtools.
  The checkout store deliberately filters card details out before writing, and that
  filter is the only protection — do not add a field carrying payment details to it.
- **Does not expose expiry as configuration.** No meta tag, no `window.nextConfig` field
  and no `next.*` method changes any of the ten windows. The single exception is the
  bundle-price cache, which accepts a per-call `ttl`.
- **Does not manage quota.** Nothing measures how much has been written, prunes old
  entries, or degrades when the store is full — the per-bundle price entries in
  particular accumulate for the life of the tab.
- **Does not notify.** For the forty-odd keys with no store behind them there is no
  subscription and no event; `onStorageChange` exists in `core/storage.ts` and is called
  from nowhere, so do not reach for it expecting cross-tab updates.
- **Does not give you a public API.** There is no `next.storage.*`. Reading or clearing an
  entry from page code means calling `sessionStorage` yourself, against the key names in
  the [reference](../reference/storage-keys.md).
