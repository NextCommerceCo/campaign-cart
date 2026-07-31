---
title: "State/Parameter/Overview"
group: "State"
category: "Parameter Store"
---

# useParameterStore

> Last reviewed: 2026-07-31
> Owner: platform

The parameter store remembers the query string a visitor arrived with, and keeps
it available for the rest of the funnel. Campaign funnels span several pages — a
landing page, a checkout, one or two upsells — and each navigation would
otherwise drop whatever the original link carried. This store holds those values
so a later page can still read them, and so they can be reattached to outbound
links. It is also what makes a page's content depend on the link that opened it.
Field-by-field detail lives in
[reference/state-reference.md](./reference/state-reference.md).

## Concept

One flat `key → value` map, **merged forward** rather than replaced.

```
/lp?utm_source=fb&mode=advanced
        │  boot: capture the URL, merge over what is stored
        ▼
useParameterStore.params = { utm_source: 'fb', mode: 'advanced' }
        │
        │  navigate to /checkout  (link carries nothing)
        ▼
preserveQueryParams() reattaches them → /checkout?utm_source=fb&mode=advanced
        │
        ▼
params still readable on the checkout page
```

The merge direction is the thing to hold onto: **the newest value for a key wins,
and a key nobody mentions again survives**. A parameter picked up on page one is
still there on page four, which is the whole point, but it also means a stale
value never expires on its own.

Two doors read this store. From markup, `data-next-show="param.mode == 'advanced'"`
makes a block conditional on the link — that lives in
[conditional-display](../../../features/display/conditional-display/guide/overview.md).
From JavaScript, `next.getParam()` and its siblings read and write the same map.

## Business logic

- The current URL is captured during SDK boot and merged over whatever
  sessionStorage already held.
- Parameters are only readable **after** boot has processed the URL, which is
  announced by `sdk:url-parameters-processed`. Anything reading earlier sees an
  empty map — including a conditional that evaluates during the first DOM scan.
- `preserveQueryParams()` defaults to `'all'`: on an outbound navigation it merges
  the stored map with the current URL's parameters, current values winning, and
  appends the result to the target URL. It also merges any newly seen parameters
  back into the store as a side effect.
- Writing through `next.setParam()` updates the store and re-evaluates every
  conditional that depends on that key.
- Values are stored as strings, exactly as they appeared. No decoding, coercion,
  or validation happens.

## Decisions

- **We merge forward rather than replace on each page**, because a funnel's later
  pages are usually reached from links that carry nothing. Replacing would lose
  attribution and any link-driven page configuration at the first hop.
- **We default `preserveQueryParams` to `'all'` rather than an allow-list**, so a
  new tracking parameter works across a funnel with no code change. The cost is
  that everything propagates, including things that should not — see Limitations.
- **We chose sessionStorage over localStorage** so a shared browser does not apply
  one visitor's link parameters to the next visitor's session.
- **We keep this separate from
  [the attribution store](../../attribution/guide/reference/state-reference.md)**
  even though both read the URL: attribution is a fixed set of fields that go to
  the order, while this is an open map that drives page behaviour. Merging them
  would send arbitrary page state to the order API.

## Limitations

- **Nothing is readable before `sdk:url-parameters-processed`.** A page that reads
  `next.getParam()` at the top of a script gets `null`. Wait for the event, or use
  `window.nextReady`.
- **Everything stored is copied onto outbound links.** Because the default is
  `'all'`, a campaign link built with `?email=` or `?first_name=` puts personal
  data into sessionStorage and then onto the checkout and upsell URLs, where it
  lands in that page's storage too. Keep personal data out of campaign links, or
  `clearParam()` before navigating.
- **`getAllParams()` returns the store's object by reference.** Mutating the result
  edits state without notifying subscribers, so a conditional bound to a parameter
  will not re-evaluate. Copy it first — `{ ...next.getAllParams() }` — and use
  `next.setParam()` to change anything.
- **Values never expire.** A stale parameter from the first page of a funnel is
  still applied on the last one. Clear it explicitly when a step should end its
  effect.
- **It does not survive a domain change.** sessionStorage is per origin, so a
  funnel that crosses domains keeps only what the link itself carries.
- **No types.** Every value is a string, so `?qty=2` is `"2"` and
  `?flag=false` is the truthy string `"false"`. Compare against strings in
  conditions, and convert in JavaScript.
