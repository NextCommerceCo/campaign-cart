---
title: "Features/Checkout/Checkout Form/Use Cases"
group: "Features"
category: "Checkout Form"
---

# Use Cases

`checkout-form` is the feature to reach for whenever a campaign page has to take
an order from fields the visitor fills in. Below are the situations it is actually
used for, and the ones that look like a fit but are not.

## A one-page checkout on a campaign landing page

> Effort: lightweight

**When:** The page shows the offer, the cart contents, and the order fields
together. The visitor never navigates — they pick a package, fill in contact and
address details, enter a card, and press one button.

**Why this enhancer:** This is the whole job of the feature. You write the layout,
name each input with `data-next-checkout-field`, and it does validation, card
tokenization, order creation, and the redirect afterwards. Card number and CVV are
never inputs you own — the SDK inserts hosted payment fields for them.

**Watch out for:** The activating selector is `form[data-next-checkout]`. Putting
the attribute on a wrapper `<div>` throws
`CheckoutFormEnhancer must be applied to a form element`, and the symptom on the
page is a checkout that looks correct but where the button does nothing. Fix it by
moving the attribute onto the `<form>` element itself. See
[reference/errors.md](./reference/errors.md).

---

## A checkout split across several pages

> Effort: moderate

**When:** The campaign wants contact details on one page, shipping on the next,
and payment last — usually to cut the perceived length of a long form.

**Why this enhancer:** Each page carries its own form, and
`data-next-checkout-step` turns submit into "validate this step, then navigate"
instead of "create the order". The value of that attribute **is the URL of the
next page**, and `data-next-step-number` says which step this one is. Query
parameters (currency, country, UTM values) are carried into the next URL, so the
session survives the hop.

```html
<form
  data-next-checkout
  data-next-checkout-step="/checkout/shipping"
  data-next-step-number="1"
>
  <input data-next-checkout-field="email" type="email" />
  <input data-next-checkout-field="fname" />
  <input data-next-checkout-field="lname" />
  <button data-next-checkout-submit>Continue to shipping</button>
</form>
```

**Watch out for:** Because the attribute value is a URL, giving it a step _name_
(`data-next-checkout-step="contact"`) sends the visitor to a relative path called
`contact` and they land on a 404 with a full cart. Set it to the real path of the
next page. With `?debug=true` the console confirms the form read it, logging
`Multi-step checkout detected` with the resolved next URL.

---

## Letting the visitor choose between card and PayPal

> Effort: moderate

**When:** The campaign accepts more than one payment method and wants the choice
inside the form rather than as an express shortcut above it.

**Why this enhancer:** `data-next-checkout-payment` marks each choice and names
the method in markup spelling (`credit_card`, `paypal`, `apple_pay`,
`google_pay`, `klarna`, and the redirect methods below); the SDK translates those to the API's
names, so you never reconcile the two vocabularies by hand. Errors from the card fields and from PayPal each get
their own container, so a decline appears next to the method that produced it
rather than at the top of the page.

```html
<label>
  <input type="radio" name="payment" data-next-checkout-payment="credit_card" /> Card
</label>
<label>
  <input type="radio" name="payment" data-next-checkout-payment="paypal" />
  PayPal
</label>

<div data-next-component="credit-error">
  <span data-next-component="credit-error-text"></span>
</div>
<div data-next-component="paypal-error"></div>
```

To reveal a method's own fields when it is chosen, wrap each choice in an element
carrying `data-next-payment-method` with the same method name and put the fields
in a `data-next-payment-form` child inside it. The feature expands that child for
the selected method and collapses it for the others — so card fields are not in
the tab order while PayPal is chosen — and stamps `data-next-payment-state`
(`expanded` / `collapsed`) on it, which is what to animate from.

**Watch out for:** The card path needs the hosted payment fields to have finished
loading. Enabling the pay button before then produces
`Credit card service is not ready` on a slow connection, and the visitor sees a
form that refuses to submit for no visible reason. Gate the button on
`checkout:spreedly-ready`, and disable it while a submit is in flight — repeated
bursts are what produce `Too many requests. Please wait a moment and try again.`

---

## Offering iDEAL, Bancontact, SEPA, TWINT, Swish, Affirm or Link

> Effort: lightweight

**When:** The campaign sells where a local method is how people expect to pay — a
Dutch shopper reaching for iDEAL, a Belgian one for Bancontact — or wants a
pay-over-time option such as Affirm. None of these has an express button, so a
radio inside the form is the only way to offer them.

**Why this enhancer:** These are **redirect methods**: there is nothing to collect
on your page, because the shopper approves the payment at the provider. Add the
radio with the method's name and the form does the rest — it validates and
captures the shopper's details exactly as it does for a card, creates the order
with that method on it, and sends the shopper to the payment page the API answers
with. That capture is the point of the radio flow: an express button takes the
shopper away before you have their address.

```html
<div data-next-payment-method="ideal">
  <label>
    <input type="radio" name="payment_method" value="ideal" /> iDEAL
  </label>
  <!-- Nothing to reveal — the provider collects the payment details -->
  <div data-next-payment-form></div>
</div>
```

The full list is `affirm`, `bancontact`, `giropay`, `ideal`, `klarna`, `link`,
`sepa_debit`, `sofort`, `swish`, `twint`; see [reference/attributes.md](./reference/attributes.md) for all
of them.

A name that is not on that list is sent to the API as written rather than
replaced, so a method the platform gains after this SDK release can be offered
straight away — as long as the API accepts it, the order is created and the
shopper is redirected exactly as above.

**Watch out for:** That pass-through means a typo is only caught by the API. The
console line `Payment method "…" is not one the SDK knows` is the early warning,
so check for it after adding a method — otherwise the first sign is a shopper
meeting a refused order. SEPA Direct Debit is the one to watch: the platform's
payment-methods guide calls it `sepa_direct` and the orders API field calls it
`sepa_debit`. Write either — plus plain `sepa` — and the order carries
`sepa_debit`.

---

## Collecting a billing address that differs from shipping

> Effort: lightweight

**When:** Card billing details do not match the delivery address — common for gift
orders and for corporate cards.

**Why this enhancer:** Mark the container to reveal with
`data-next-component="different-billing-address"` and the feature handles the
reveal and the mapping to the order's billing address. The country/state/postcode
group is **cloned** from the shipping one and stamped
`data-next-component="billing-location"`, so the two can never drift apart.

**Watch out for:** Because the billing location group is cloned, hand-writing a
second one leaves the page with two country/state/postcode groups, one of which
never populates its state list. Write the shipping group only, inside
`data-next-component="location"`, and let the clone happen.

A billing address that was asked for is now validated wherever the visitor pays
from — the single-page submit and step 3 of a multi-step checkout both check it,
and both treat "asked for a separate address, entered nothing" as a set of
missing fields rather than as a pass. On a multi-step checkout, put the billing
section on the step whose `data-next-step-number` is `3`, so the visitor can
answer the messages on the page that raises them.

The answer belongs to the checkout, not to the page. It is kept in the checkout
store and put back on `input[name="use_shipping_address"]` while the form boots,
so a visitor who asked for a separate billing address on step 1 lands on step 3
with the box already unticked and the section already open. Two consequences for
your markup:

- **Render the box ticked** — "billing is the shipping address" — and let the SDK
  untick it. A box that starts unticked is read as the page's own answer and is
  stored as "separate billing" for the rest of the checkout, because a stored
  ticked answer cannot be told apart from a visitor who never touched it.
- **A page with no box changes nothing.** The answer from the page that had one
  still stands, which is what lets a payment-only step build the order with the
  billing address collected earlier. It also means a step-3 page that drops the
  box cannot clear a half-filled billing address — keep the box and the section
  on that step.

The address the visitor typed comes back with the answer. The cloned billing
inputs are blank by construction — a clone would otherwise arrive holding the
shipping address — so the SDK types the stored billing address back into them
while the form boots, right after it does the same for the shipping fields. The
billing state list is rebuilt for the **stored billing** country first, so a
billing region that differs from the shipping one survives the reload. Two more
things to know:

- **Nothing is restored while the box is ticked.** A billing address left in the
  store by an earlier order is never written into the collapsed section, so a
  shared browser cannot show one visitor's address to the next.
- **A stored value with no field on the page is reported, not dropped.**
  `[Billing] Some stored billing values have no field` names it; the usual cause
  is an `address2` the shipping form never rendered, so the clone has nowhere to
  put it. Add the field to the shipping group if the order needs it.

---

## Making phone mandatory for fulfilment

> Effort: lightweight

**When:** The carrier or the fulfilment partner needs a phone number, so an order
without one cannot ship.

**Why this enhancer:** Phone is optional by default. `data-next-required="true"`
on the input adds it to validation, so the visitor cannot submit without it —
rather than the order failing later at fulfilment.

**Watch out for:** A phone number that is not in E.164 form is rejected by the
order API as `Invalid order data. Please check your information and try again.`,
which reads to the visitor as an unexplained refusal. Use the SDK's phone input so
the value is normalised before submit, and read the API response body to confirm
which field was rejected.

---

## When NOT to use this

### A one-tap purchase with no form at all

**Why not:** A wallet purchase collects contact and address details in the
provider's own sheet, so there are no fields for this feature to read. The two are
independent order paths — a visitor who part-fills the form and then taps a wallet
button creates the order through the wallet, and anything the form collected that
the wallet does not supply is lost.

**Use instead:**
[`express-checkout-container`](../../../checkout/express-checkout-container/guide/overview.md)
— renders the PayPal, Apple Pay, and Google Pay buttons and creates the order from
what the provider returns.

### Adding a product to an order that is already paid for

**Why not:** This feature creates a new order from the cart. On a post-purchase
page there is no cart to submit and the payment has already been taken.

**Use instead:** [`upsell`](../../../order/upsell/guide/overview.md) for the offer
itself and [`accept-upsell`](../../../cart/accept-upsell/guide/overview.md) for
the accept button — both write to the existing order using the stored payment
method.

### Showing what is in the cart beside the fields

**Why not:** This feature never renders your content. It finds inputs; it does not
produce line items or totals.

**Use instead:**
[`cart-summary`](../../../cart/cart-summary/guide/overview.md) for totals and
[`cart-item-list`](../../../cart/cart-item-list/guide/overview.md) for the lines.
Both pair well with a checkout — seeing the order beside the fields is what stops
a visitor leaving to go back and check.

### Playing the entered details back for confirmation

**Why not:** The form owns collection, not confirmation. Reading values out of the
inputs yourself duplicates state that already lives in the checkout store.

**Use instead:**
[`checkout-review`](../../../checkout/checkout-review/guide/overview.md) — mirrors
what the form collected, live, with no extra page step.
