---
title: "Features/Checkout/Checkout Form/Overview"
group: "Features"
category: "Checkout Form"
---

# Checkout Form

> Category: `checkout`
> Last reviewed: 2026-08-03
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
- Payment methods are declared in markup with short names, written with
  underscores like everywhere else the SDK names one (`credit_card`, `paypal`,
  `apple_pay`, …); `-` is accepted and case is ignored. The SDK translates them
  to the API's names, so the two vocabularies never have to be reconciled by
  hand.
- **A method the SDK does not recognise is passed through, not replaced.** It is
  sent to the orders API as written and logged as
  `Payment method "…" is not one the SDK knows`, because the API is what decides
  whether it can charge that way — so a method the platform gains after this SDK
  release still works, and a typo comes back as an API error naming it rather
  than as a card form the shopper did not ask for.
- **A redirect method skips tokenization and nothing else.** iDEAL, Bancontact,
  SEPA, TWINT, Swish, Affirm, Link and Klarna collect no payment details here, so
  the form validates, captures the shopper's details and creates the order as
  usual — and then sends the shopper to the `payment_complete_url` the
  API answered with. That URL always wins over a success URL of your own, because
  the order it belongs to has not been paid for yet.
- **Shipping choices come from the campaign, not from the SDK.** A
  `input[name="shipping_method"]` radio carries a shipping method's `ref_id`, and
  choosing it stores that campaign entry's code and price — so a total on screen
  is a total the order will charge. A value the campaign does not list selects
  nothing and logs `Shipping method … is not one this campaign offers`, because
  the campaign cannot price it.
- **A multi-step form is gated by its step number.** Steps 1, 2 and 3 have their
  own rules; any other number is checked against step 2 (contact details and the
  shipping address) rather than waved through, and a step number that is not a
  whole number above zero is read as step 1.
- The order is created **once**, after tokenization succeeds. A declined payment
  produces `payment:error` and no order.
- After the order is created the visitor is redirected using the URL the API
  returns. When that URL is missing, `order:redirect-missing` fires — otherwise
  they would sit on a checkout page for an order that already succeeded.
- **The pay button is borrowed, not owned.** It is disabled while the order is
  being placed and put back exactly as it was when the attempt ends — so a button
  your page holds shut until terms are accepted stays shut, and a button that was
  clickable is clickable again after a decline. Give the control a `<button>` or
  an `<input type="submit">`; an `<a>` or a `<div>` cannot be disabled, so it is
  ignored rather than pretended to be held.
- **A "no" is remembered too.** An unticked marketing checkbox comes back
  unticked on reload, not reset to whatever the markup ships. A box the visitor
  never touched is left as the page wrote it.
- The separate billing address survives a reload **as a whole** — the answer goes
  back on the checkbox and the stored address goes back into the fields, so what
  the order will carry is what the visitor can read. Nothing is put back while
  "billing is the shipping address" is ticked, which keeps an address left over
  from an earlier order off a shared browser's screen.
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
- Does not announce that an order was created. Express and standard checkout both
  finish through `order:completed`, which the order store emits on the page the
  shopper lands on next — see
  [the order store's events](../../../../state/order/guide/reference/events.md).

## Reference

- [Attributes](./reference/attributes.md) — field names, payment methods,
  structural components
- [Events](./reference/events.md) — the full sequence, and which one to track a
  purchase on
- Related: [prospect-cart](../../prospect-cart/guide/overview.md) captures the
  visitor as a lead before they finish;
  [checkout-review](../../checkout-review/guide/overview.md) plays their entries
  back to them
