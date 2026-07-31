---
title: "Features/Checkout/Checkout Form/Overview"
group: "Features"
category: "Checkout Form"
---

# Checkout Form

> Category: `checkout`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Turns a plain HTML form into a working checkout. You write the markup and name each
input; the feature validates it, collects the card details without them touching
your page, creates the order, and sends the visitor on to the next step.

## Concept

The form is the source of truth for layout, and the feature is the source of truth
for behaviour. It never generates your fields — it finds them.

Everything hinges on **naming**. An input becomes part of the order because it
carries `data-next-checkout-field="email"`, not because of where it sits or what
it is called in HTML. That is what lets a campaign lay a checkout out however it
likes and still submit a correct order.

Card details are the deliberate exception. The card number and CVV are never
inputs you own: the SDK inserts hosted payment fields for them, and what comes
back to your code is a token. That means no card number passes through your
markup, your handlers, or SDK code — which is what keeps a campaign page out of
scope for handling raw card data.

The country group is the other piece of built-in behaviour. Country, state, and
postcode live together inside one container and are revealed as a unit once a
country is known, because the state list and postcode format depend on it. The
billing equivalent is **cloned** from the shipping one rather than hand-written, so
the two can never drift apart.

## Business logic

- **Only a real `<form>` activates.** The feature is registered against
  `form[data-next-checkout]`.
- **Field names are fixed**, not free text — see the reference. An unrecognised
  name is not part of the order at all.
- Some fields are optional by default. `data-next-required="true"` forces
  validation on one; phone is the usual case.
- Payment methods are declared in markup with short names (`credit`, `paypal`,
  `apple-pay`, …). The SDK translates them to the API's names, so the two
  vocabularies never have to be reconciled by hand.
- The order is created **once**, after tokenization succeeds. A declined payment
  produces `payment:error` and no order.
- After the order is created the visitor is redirected using the URL the API
  returns. When that URL is missing, `order:redirect-missing` fires — otherwise
  they would sit on a checkout page for an order that already succeeded.
- Legacy `os-checkout-*` attributes are still read as fallbacks, so forms written
  before this convention keep working.

## Decisions

- We find fields rather than render them, because every campaign's checkout looks
  different and a generated form would be overridden immediately.
- We use hosted fields for card data rather than our own inputs, so raw card
  numbers never enter page or SDK code.
- We reveal country, state, and postcode as a group because a state list is
  meaningless before a country is chosen, and a postcode's validation depends on
  it.
- We clone the billing location group from the shipping one instead of asking for
  it twice, so a change to the shipping markup cannot leave billing behind.
- We keep the legacy attribute names working rather than requiring a migration,
  because a half-migrated checkout is worse than a consistent old one.

## Limitations

- Does not lay out or style anything. No fields appear that you did not write.
- Does not support more than one checkout form on a page.
- Does not own payment method availability — which methods exist comes from the
  campaign and the visitor's device, not from your markup.
- Does not retry a declined payment. It reports the failure and leaves the form
  ready for another attempt.
- Does not have express-specific completion events. Express and standard checkout
  both finish through `order:completed`.

## Reference

- [Attributes](./reference/attributes.md) — field names, payment methods,
  structural components
- [Events](./reference/events.md) — the full sequence, and which one to track a
  purchase on
- Related: [prospect-cart](../../prospect-cart/guide/overview.md) captures the
  visitor as a lead before they finish;
  [checkout-review](../../checkout-review/guide/overview.md) plays their entries
  back to them
