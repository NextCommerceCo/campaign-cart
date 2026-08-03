---
title: "Features/Checkout/Prospect Cart/Use Cases"
group: "Features"
category: "Prospect Cart"
---

# Use Cases

`prospect-cart` records a visitor as a lead — their contact details plus what was
in their cart — before they finish paying, so an abandoned checkout can still be
followed up. It has no attribute of its own: the checkout form starts it, and every
option goes on that same `<form data-next-checkout>`.

## Recovering abandoned checkouts by email

> Effort: requires backend changes

**When:** Traffic reaches the checkout page, fills in the contact block, and a
meaningful share of it leaves before paying. You want an address to send a recovery
email to, and a record of what they were about to buy.

**Why this enhancer:** The default trigger, `emailEntry`, records the lead as soon
as the contact block is valid — no button, no consent step, nothing the visitor has
to do. The cart contents, the currency, and the campaign attribution (UTM values,
referrer, landing page) are captured with it, so the follow-up can name the product
and keep the credit for the original click.

```html
<form data-next-checkout data-trigger-on="emailEntry">
  <input data-next-checkout-field="email" type="email">
  <input data-next-checkout-field="fname">
  <input data-next-checkout-field="lname">
</form>
```

**Watch out for:** `emailEntry` does **not** mean "email alone". Creation also
requires a valid first **and** last name — each at least two characters of letters,
spaces, hyphens, or apostrophes. A checkout that collects only an email therefore
never records a prospect, and the only sign is a debug line saying it is waiting for
a valid name. If your form has no name fields, either add them or use
`data-trigger-on="formStart"`, which does not gate on them.

Nothing is captured while the cart is empty either — the console warns
`No items in cart, skipping prospect cart creation`. Put the checkout after the
cart is filled, not before.

---

## Capturing a phone number for SMS follow-up

> Effort: requires backend changes

**When:** The campaign's recovery channel is SMS rather than email, or the market is
one where visitors give a phone number more readily than an address.

**Why this enhancer:** `data-trigger-on="phoneEntry"` moves the threshold to the
phone field, and the number is captured in E.164 form when the SDK's phone input is
active, so it is dialable rather than however the visitor typed it.

```html
<form data-next-checkout
      data-trigger-on="phoneEntry"
      data-min-phone-digits="9">
  <input data-next-checkout-field="phone" type="tel">
  <input data-next-checkout-field="fname">
  <input data-next-checkout-field="lname">
</form>
```

**Watch out for:** `data-min-phone-digits` is only the fallback rule, used when the
SDK's phone input is not on the page; with it active, that input's own validity check
decides. The default is 7, which accepts a partial number in countries with longer
ones — raise it for a single-market campaign. A value that is not a positive number
is ignored with the warning `Invalid data-min-phone-digits value, using default:`,
so a typo silently leaves you on 7.

---

## Recording only the best-quality leads

> Effort: lightweight

**When:** The follow-up costs money per lead, or the sales team works the list by
hand, so a half-interested visitor is worse than no record.

**Why this enhancer:** `data-trigger-on="emailAndPhone"` requires both contact
details to be valid before anything is recorded. It produces the fewest prospects and
the highest share of reachable ones. The opposite end, `formStart`, records a lead on
any interaction at all — including a visitor who focused one field and left.

**Watch out for:** Marketing consent defaults to **opt in**. The payload's
`accepts_marketing` flag is read from a checkbox named
`data-next-checkout-field="accepts_marketing"`, and when that checkbox is absent the
flag is sent as `true`. If the campaign's market requires explicit opt-in, put the
checkbox on the form so an unticked box records `false`:

```html
<label>
  <input type="checkbox" data-next-checkout-field="accepts_marketing">
  Email me about offers
</label>
```

Recording a contact detail before the visitor has agreed to buy is a jurisdiction
question as much as a code one — decide it before choosing an early trigger.

---

## Reacting to a capture in your own code

> Effort: lightweight

**When:** You want your own tag, pixel, or CRM call to run at the moment the lead is
recorded, rather than polling for it.

**Why this enhancer:** It dispatches a DOM event on the checkout form —
`next:prospect-cart-created`, with the created cart in `event.detail` — and it
bubbles, so a document-level listener is enough. A second event closes the loop:
`next:prospect-cart-converted` fires when the order is created and the record is
cleared, which is how you stop a recovery sequence for someone who has already
bought.

```js
document.addEventListener('next:prospect-cart-created', event => {
  console.log('prospect recorded', event.detail.prospectCart.email);
});
```

**Watch out for:** These are DOM events dispatched on the form, not SDK events.
`next.on('next:prospect-cart-created', handler)` will never see them, which is the
usual reason a listener appears not to fire — listen on the element or the document
instead. Also
expect **one** per session: the record is kept in session storage and restored on
the next page, so a visitor who moves between checkout pages is captured once, not
once per page.

---

## When NOT to use this

### Measuring how many visitors reach checkout

**Why not:** This feature creates a record through the API for each lead. Using it
as a counter sends traffic-volume writes to the cart API, and it fires only when the
contact fields are valid — so it undercounts arrivals by design.

**Use instead:** the checkout form's own events —
[`checkout-form` events](../../../checkout/checkout-form/guide/reference/events.md)
has `checkout:started` for a submit attempt and `order:completed` for a purchase.

### Capturing an email outside a checkout

**Why not:** It is started by the checkout form and reads that form's fields. On a
page with no `<form data-next-checkout>` it never runs, so a newsletter box or an
exit popup gets nothing.

**Use instead:** there is no standalone lead-capture feature in the SDK. Either put
the visitor in front of a real checkout —
[`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — or post your
own capture form to your own endpoint.

### Turning the record into an order

**Why not:** A prospect is a lead, not a purchase. Nothing is charged, no address is
even sent with it, and the record is cleared once a real order is created.

**Use instead:**
[`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — it creates the
order and marks the prospect converted as part of the same submit.

### Creating the prospect from your own JavaScript

**Why not:** `data-trigger-on="manual"` switches off every automatic trigger, and
this build exposes no public handle to the feature instance — so `manual` leaves it
loaded and nothing ever creates a record.

**Use instead:** keep an automatic trigger and narrow it instead — `emailAndPhone`
for fewer, better leads, or `data-auto-create="false"` if what you actually want is
the feature off.
