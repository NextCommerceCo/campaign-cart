---
title: "Features/Checkout/Prospect Cart/Glossary"
group: "Features"
category: "Prospect Cart"
---

# Glossary

Domain terms used across the `prospect-cart` guide.

## Abandoned checkout

A visitor who reached the checkout, gave enough contact detail to be recorded, and
left without an order being created. Recovering them is the entire reason this
feature exists.

---

## Accepts marketing

Whether the visitor agreed to be contacted about offers. It is sent with the
prospect and read from a checkbox named
`data-next-checkout-field="accepts_marketing"`. **With no such checkbox on the form
it is sent as `true`** — so on a market that requires explicit opt-in, the checkbox
is not optional.

---

## Attribution

Where the visit came from — UTM values, referrer, landing page, device — captured
alongside the prospect so a recovered sale can be credited to the click that
started it. The prospect is stamped with the checkout funnel (`CH01`) when the visit
carries no funnel of its own.

---

## E.164

The international phone format, `+14155550123`: country code, then the number, no
spaces or punctuation. A captured phone number is stored this way when the SDK's
phone input is active, because a number in local notation cannot be dialled from
elsewhere.

---

## Prospect

A visitor recorded as a lead — contact details plus their cart — before any order
exists. A prospect is not a customer and nothing has been charged.

---

## Prospect cart

The record itself: the cart lines, the contact details, the currency, and the
[attribution](#attribution), created through the cart API. No address is sent with
it, by design — address collection belongs to the order.

---

## Session window

How long a recorded prospect stays valid, in minutes — `sessionTimeout`, 30 by
default, settable only through `data-prospect-config`. It is kept in session storage
and restored on the next page, so a visitor moving between checkout pages is
recorded once rather than once per page. Past the window the stored record is
discarded and a fresh one can be created.

---

## Trigger

How much intent counts as enough to record a prospect, set with `data-trigger-on`.
This is the feature's one real decision: an early trigger (`formStart`) catches more
visitors including accidental ones, a late one (`emailAndPhone`) records fewer,
better leads. See [reference/attributes.md](./reference/attributes.md) for the full
set.

---

## UTM data

The `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, and `utm_content`
parameters that identify the ad or link a visitor arrived through. They are read
from the current URL and from what earlier pages in the session stored, so the
credit survives a visitor landing on one page and checking out on another.
