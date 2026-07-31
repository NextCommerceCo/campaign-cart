---
title: "Features/Behavior/FOMO Popup/Overview"
group: "Features"
category: "FOMO Popup"
---

# FOMO Popup

> Category: `behavior`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Rotates small social-proof notifications — "Sarah from Denver just bought this" — to
show a page has traffic.

## Concept

Unlike almost everything else in the SDK, this feature has **no markup contract at
all**. There is no attribute that turns it on: you call `next.fomo({…})` and pass it
the content to rotate. Adding markup will never make it appear.

What it rotates is entirely what you supply — a list of products and a list of
customer lines, grouped by country so the names suit the visitor's region. The feature
pairs them, times them, and animates them.

Which means the notifications are **generated, not observed**. Nothing here reads real
orders. That is the single most important thing to understand before using it.

## Business logic

- Started with `next.fomo(config)`; calling it again reconfigures the running popup
  rather than starting a second one.
- `items` are the products to mention, each with an image; `customers` maps a country
  code to the lines usable for visitors from there.
- `initialDelay`, `displayDuration`, and `delayBetween` control the rhythm, all in
  milliseconds.
- `maxMobileShows` caps how many appear on small screens, where an overlay costs more
  attention.
- `next-fomo-show` is toggled on the notification while it is on screen; the element
  itself persists between showings, so animate from that class.
- `fomo:shown` fires once per notification with the customer line, product, and image
  used.

## Decisions

- We take content from configuration rather than from live orders, because a campaign
  page usually has no access to a real order feed, and because a real feed on a
  low-traffic page would show nothing.
- We start it from JavaScript rather than an attribute, since its configuration is a
  structured list that does not fit in markup.
- We cap mobile showings by default, because the same notification density that is
  unobtrusive on a desktop is intrusive on a phone.
- We group customer lines by country so the social proof does not read as obviously
  foreign to the visitor.

## Limitations

- Does not reflect real purchases. Every notification comes from your configuration.
- Does not verify that anything it claims is true. **Presenting invented purchases as
  real is regulated in many markets** — check what yours allows before enabling this,
  and prefer wording that is defensible.
- Does not persist across page loads; the rotation restarts each time.
- Does not target by behaviour or segment beyond the country grouping.
- Cannot be turned on from markup, so a page-builder-only integration cannot enable
  it.

## Reference

- [Attributes](./reference/attributes.md) — the config options and the show class
- [Events](./reference/events.md) — `fomo:shown`
