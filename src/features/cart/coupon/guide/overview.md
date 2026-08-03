---
title: "Features/Cart/Coupon/Overview"
group: "Features"
category: "Coupon"
---

# Coupon

> Category: `cart`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Lets a visitor type a discount code, see the codes already on their cart, and take
one off again. It owns the whole coupon area of a page: the input, the apply
button, the list of applied codes, and the success or error message.

## Concept

The feature is a thin layer over the cart's coupon operations. It does not decide
whether a code is valid — the cart does, by asking the API. The feature's job is
to turn one container of markup into a working coupon UI:

1. On init it looks inside its container for the parts it needs: an input, a
   button, a display area, and inside that display area a **card template**.
2. Typing a code and pressing Enter, or clicking the button, hands the code to the
   cart. The button is disabled while the answer is pending.
3. The cart answers accepted or rejected. Accepted codes are re-rendered as a list
   by cloning the card template once per code. Rejected codes produce a message.
4. Each rendered card carries its own remove button, wired to remove that code.

The important idea is the **template clone**: you write one coupon card in your
markup and mark it `data-template`. The feature hides that card and stamps out a
copy per applied code. You are not writing a card per code, and you are not
writing any JavaScript to render them.

## Business logic

- A code is applied through the cart's coupon operation, so the cart's totals,
  discount lines, and any dependent display update on their own afterwards.
- Applying is blocked while a previous attempt is still in flight — the apply
  button gets `next-disabled` — so a visitor cannot double-submit a code.
- Removal is immediate and does not ask for confirmation.
- Messages are transient: each one removes itself after 5 seconds.
- The three parts the feature needs — input, button, display — are located by
  falling back through several selectors, so existing markup usually works without
  being rewritten. If they cannot all be found the feature logs a warning and does
  nothing at all rather than half-working.

## Decisions

- We render applied codes by cloning a template in the page rather than building
  markup in TypeScript, because the coupon card has to match each campaign's
  design and a hardcoded structure would force every page to override it.
- We locate the input and button by fallback rather than by one required
  attribute, because coupon markup predates this feature and existing pages should
  keep working.
- We keep validation in the cart layer, not here, so a code applied through
  `next.cart` behaves the same as one typed into this UI.
- We fail silently-but-loudly — a warning log and no behaviour — when the markup
  is incomplete, rather than throwing, because a broken coupon box should not take
  down the rest of a checkout page.

## Limitations

- Does not validate the code format locally. Every attempt is a round trip, so a
  typo costs a request.
- Does not support more than one coupon area on a page. The display and message
  elements are looked up document-wide as a fallback, so two areas can fight over
  the same targets.
- Does not show which discount a code produced. The amount lives in the cart's
  totals; render it with the cart summary rather than expecting it here.
- Does not restore a removed code. Removal is immediate and there is no undo.

## Reference

- [Attributes](./reference/attributes.md) — the markup contract, generated from
  the feature manifest
- [Events](./reference/events.md) — `coupon:applied`, `coupon:removed`,
  `coupon:validation-failed`
