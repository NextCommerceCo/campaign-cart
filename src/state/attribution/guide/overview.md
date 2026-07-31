---
title: "State/Attribution/Overview"
group: "State"
category: "Attribution Store"
---

# useAttributionStore

> Last reviewed: 2026-07-31
> Owner: platform

The attribution store records where a visitor came from, so the order they place
can be credited to the right campaign, partner, or ad. It reads the tracking
parameters off the landing URL — `utm_source`, `utm_campaign`, `affiliate`,
`gclid` and the rest — holds them for the whole session, and hands them to the
API when the order is created. Without it an order arrives with no source, which
means no commission for the partner who sent it and no way to tell which ad paid
for itself. Field-by-field detail lives in
[reference/state-reference.md](./reference/state-reference.md).

## Concept

Attribution is **collected early on every page, and resolved per parameter: the URL wins,
and anything the URL does not carry survives from the previous page.** So a visitor who
browses for twenty minutes and reaches the checkout through an internal link with no
parameters keeps everything they arrived with — which is the common case, and the reason
this reads as "collect once". But a *tagged* link partway through the session overwrites
the parameters it carries, and writes them back to storage.

That makes it **last-touch per parameter, with carry-over**, not first-touch.
`AttributionCollector.getStoredValue()` (`core/attribution/attribution-collector.ts › AttributionCollector.getStoredValue`)
checks the URL, then sessionStorage, then localStorage, then the persisted blob, and mirrors
a URL hit back into sessionStorage on the way out. `getFunnelName()` (`:183`) is the most
emphatic version: `?funnel=` always wins and logs `🔄 Funnel override: "old" -> "new"`.

Two consequences worth holding on to:

- Sending a visitor to a second campaign through a tagged link **re-credits** those
  parameters. If you need the original source, capture it yourself on the first page.
- `first_visit_timestamp` is the one field that behaves like first-touch, and it does not
  survive a new tab — the collector recovers it from `localStorage["next-attribution"]`, and
  this store only ever writes that key to sessionStorage.

```
landing URL ?utm_source=facebook&affiliate=partner7
        │
        ▼
AttributionCollector          reads the URL, the referrer, the meta tags,
        │                     and the device
        ▼
useAttributionStore           held in sessionStorage under `next-attribution`
        │
        ▼
getAttributionForApi()        flattened onto the order at checkout
```

Two consequences follow from that shape, and both surprise people:

- **A bare link preserves; a tagged link replaces.** A visitor who arrives from an
  ad, leaves, and comes back through a link with no parameters keeps the ad's
  attribution, because nothing overwrote it. Come back through a *different*
  tagged link and those parameters are re-credited to the new source.
- **A new tab is a new session.** The store lives in sessionStorage, so opening
  the site in a second tab starts collection over — and the second tab may
  attribute differently from the first.

`metadata` is the extension point. Anything not covered by the named fields goes
in there as a key-value bag, including whatever `os-tracking-tag` or
`data-next-tracking-tag` meta tags the page carries.

## Business logic

- Collection runs during SDK boot, before any enhancer initialises, so the values
  are present by the time a page can act on them.
- Named parameters are read from the URL query string. A parameter that is absent
  is left empty rather than guessed at.
- `funnel` and the Everflow click id are **also** mirrored to `localStorage`
  under their own keys, so they outlive the session — unlike everything else here.
- `getAttributionForApi()` flattens the store into the shape the order endpoint
  expects and forwards **the whole `metadata` object**, not a filtered subset.
- The five `subaffiliate1`–`subaffiliate5` slots are pass-through: the SDK gives
  them no meaning and does not validate them. Whatever the partner puts in the
  link arrives on the order.

## Decisions

- **We collect at boot rather than at checkout**, because the checkout page is
  usually reached from an internal link that no longer carries the parameters. Late
  collection would attribute most orders to nothing.
- **We chose sessionStorage over localStorage** for the main record so a shared or
  public browser does not credit a second visitor's order to the first visitor's
  affiliate. The cost is that a new tab looks like a new visit.
- **We chose an open `metadata` bag over a fixed field list** because every
  network wants a different identifier, and shipping a schema change per partner
  does not scale. The cost is collisions — see Limitations.
- **We forward metadata wholesale** rather than allow-listing keys, so a new
  partner integration needs no SDK release. This puts the privacy decision on
  whoever configures the tags, which is why the fields carrying personal data are
  called out explicitly in the reference.

## Limitations

- **`first_visit_timestamp` does not survive a session, despite looking like it
  should.** `AttributionCollector` falls back to reading
  `localStorage['next-attribution']`, but the store only ever writes
  sessionStorage — so that key is never populated and every new tab reports a
  first visit. Do not build returning-visitor logic on it; write your own
  localStorage marker if you need cross-session truth.
- **`metadata` keys are not namespaced or protected.** A tracking tag named
  `device`, `domain`, `referrer`, or `timestamp` overwrites the SDK's own value
  silently, and the overwritten value is what reaches the order. Prefix your
  custom tags.
- **It holds personal data and forwards all of it.** `metadata` carries the
  visitor's IP as `user_ip`, the full user agent as `device`, and click
  identifiers (`fbclid`, `gclid`, `everflow_transaction_id`) that identify a
  click and therefore a person. Anyone deciding what to send to a third-party
  analytics provider needs to read
  [reference/state-reference.md](./reference/state-reference.md) first.
- **It does not attribute per order line.** Attribution is per session, so a
  post-purchase upsell added twenty minutes later carries the same source as the
  original order.
- **It does not deduplicate or validate.** Two conflicting `utm_source` values in
  one URL resolve to whichever the query parser returns; a misspelled affiliate id
  is stored and submitted as given.
- **It does not survive a domain change.** sessionStorage is per origin, so a
  funnel that moves the visitor to a different domain loses attribution unless the
  parameters are carried in the link — which is what
  [the parameter store](../../parameter/guide/reference/state-reference.md) does.
