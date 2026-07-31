---
title: "Features/Checkout/Prospect Cart/Overview"
group: "Features"
category: "Prospect Cart"
---

# Prospect Cart

> Category: `checkout`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Records a visitor as a lead the moment they type an email or phone number into
checkout, so an abandoned checkout can still be followed up.

## Concept

A visitor who fills in their email and then leaves has told you two useful things:
what they wanted, and how to reach them. This feature captures that pair before the
order exists.

It is started by the checkout form rather than by an attribute of its own, and it
watches the same fields the form does. Its whole configuration is one question:
**how much intent is enough** to count someone as a lead? Trigger early and you
catch more people, including some who typed two characters by accident. Trigger
late and you record fewer, better leads.

That trade-off is `data-trigger-on`, and it is the only decision most integrations
need to make.

## Business logic

- Options go on the `<form data-next-checkout>` element, because that is what
  starts the feature.
- `data-trigger-on` chooses the threshold: `formStart`, `emailEntry` (the default),
  `phoneEntry`, `emailAndPhone`, or `manual`.
- A phone number only counts once it has at least `data-min-phone-digits` digits
  (default 7), so a half-typed number does not create a prospect.
- The email and phone inputs are found through their `data-next-checkout-field`
  names, with legacy `os-checkout-field`, `name="phone"`, and `type="tel"` accepted
  as fallbacks — so existing forms usually work unchanged.
- `data-prospect-config` sets everything at once as JSON, including the two options
  with no attribute of their own: `includeUtmData` and `sessionTimeout`. Individual
  attributes override matching keys.
- Malformed config JSON is logged and **ignored entirely**, including the parts that
  parsed — so a typo silently falls back to defaults rather than half-applying.

## Decisions

- We let the checkout form start it rather than giving it its own attribute, because
  it has no meaning without a checkout form to watch.
- We default to `emailEntry` rather than `formStart`, because a lead with no contact
  detail is not a lead.
- We require a minimum digit count for phone instead of treating any input as
  entered, since a partial number is unreachable.
- We accept the legacy field-name attributes so turning this on does not require
  rewriting an existing checkout.

## Limitations

- Does not send anything to the visitor. It records the prospect; outreach is
  handled elsewhere.
- Does not deduplicate across sessions beyond its session window.
- Does not validate that an email is deliverable — only that it looks like one.
- Does not ask for consent. Whether recording a contact detail before purchase is
  permitted, and what your form must say, depends on your jurisdiction. Decide that
  before choosing an early trigger.

## Reference

- [Attributes](./reference/attributes.md) — triggers, field overrides, JSON config
- The form that starts it:
  [checkout-form](../../checkout-form/guide/overview.md)
