---
title: "Features/Checkout/Express Checkout Container/Overview"
group: "Features"
category: "Express Checkout Container"
---

# Express Checkout Container

> Category: `checkout`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Renders the express payment buttons — PayPal, Apple Pay, Google Pay, Link — for whichever
of them the campaign and the visitor's device actually support.

## Concept

You supply an empty container; the SDK fills it. That split exists because the set
of available methods is not knowable when you write the page: Apple Pay depends on
the device, and which methods are enabled at all depends on the campaign.

So the feature's contract is two elements — the container it activates on, and a
child it injects buttons into — and one event per method that turns out to be
available. That event is how you know whether to reveal the section at all: an
"Express checkout" heading above nothing looks broken, and it is a common bug on
non-Apple devices.

## Business logic

- The feature activates on `data-next-express-checkout="container"` and injects into
  the `"buttons"` child.
- Without a `"buttons"` child it logs `No buttons container found with
  data-next-express-checkout="buttons"` and renders nothing — the usual cause of an
  empty express section.
- `express-checkout:initialized` fires **once per available method**, so a page
  offering all four sees it four times.
- Each generated button carries `data-next-express-checkout="{method}"` and
  `data-action="submit"`, so individual methods can be styled.
- **Link is the one method offered both ways.** As a button here it behaves like
  the other three — no form, straight to Link to pay. It can also be a radio in
  the [checkout form](../../checkout-form/guide/use-cases.md), which validates the
  form and captures the shopper's details before sending them. Offer whichever
  suits the page; offering both means the same method appears twice.
- Completion and failure are **not** express-specific: an express order finishes
  through `order:completed` and fails through `payment:error`, exactly like a
  standard checkout.

## Decisions

- We inject buttons rather than asking you to write them, because a button written
  for a method the device does not support is worse than no button.
- We fire one event per method instead of a single "ready" event, so a page can
  reveal its section as soon as anything is available rather than waiting for a
  count it cannot predict.
- We route completion through `order:completed` rather than an express-specific
  event, so purchase tracking is written once and covers both paths. The
  `express-checkout:completed` and `:failed` names exist on `EventMap` but are never
  emitted — they are marked deprecated there.

## Limitations

- Does not decide which methods are available. That comes from the campaign and the
  device.
- Does not style the buttons beyond what each provider allows; their branding rules
  constrain this.
- Does not provide a fallback when no method is available — hide your own section.
- Does not collect shipping or contact details itself; the provider's sheet does,
  and the order is created from what it returns.

## Reference

- [Attributes](./reference/attributes.md) — the two elements, and the generated
  button attributes
- [Events](./reference/events.md) — `express-checkout:initialized`
- Related: [checkout-form](../../checkout-form/guide/overview.md) for the standard
  path
