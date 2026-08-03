---
title: "Features/Checkout/Express Checkout Container/Use Cases"
group: "Features"
category: "Express Checkout Container"
---

# Use Cases

`express-checkout-container` is for offering the wallet buttons — PayPal, Apple
Pay, Google Pay — as a way to buy without filling in a form. You supply an empty
container; the SDK decides which buttons the campaign and the device actually
support and injects them.

## A wallet shortcut above the checkout form

> Effort: moderate

**When:** The checkout page has the full form, and you want returning or mobile
visitors to be able to skip it. The wallet buttons sit at the top under a heading
like "Express checkout", with a divider and the form below.

**Why this enhancer:** Which methods to show is not knowable when you write the
page — Apple Pay depends on the visitor's device and browser, and the enabled set
comes from the campaign. The container asks both, renders only what will work, and
hides itself when nothing will.

```html
<div data-next-express-checkout="container">
  <p>Express checkout</p>
  <div data-next-express-checkout="buttons"></div>
</div>
```

**Watch out for:** This is a **second, independent order path**, not a shortcut
through the form. A visitor who part-fills the form and then taps a wallet button
gets an order built from what the provider's sheet returned, so anything the form
collected that the provider does not supply is missing from that order. If a field
matters for fulfilment, do not rely on the form to collect it while the wallet
buttons are also on the page.

---

## A one-tap buy button on a landing page with no form

> Effort: moderate

**When:** A short landing page with one offer, aimed at mobile traffic. The goal is
to go from "add to cart" to paid in one tap, with no checkout page at all.

**Why this enhancer:** The wallet collects contact, address, and payment inside the
provider's own sheet, so the page needs no fields. The buttons are wired to the
current cart, so pairing them with an add-to-cart control is the whole flow.

**Watch out for:** The buttons create an order from the cart, so an empty cart makes
them fail rather than being hidden. The feature disables every button and adds the
`next-cart-empty` class while the cart is empty — style that class as visibly
disabled, or a visitor taps a live-looking button and nothing happens. Reaching the
order call with an empty cart produces
`Cannot create express order with empty cart`; see
[reference/errors.md](./reference/errors.md).

---

## Revealing an "Express checkout" section only when a wallet is available

> Effort: lightweight

**When:** Your layout has a heading, a divider, or an "or pay by card" separator
around the buttons. On a device that supports none of the methods, that furniture
would sit above nothing.

**Why this enhancer:** `express-checkout:initialized` fires **once per available
method**, so a page offering all three sees it three times. Use the first one to
reveal your own surrounding furniture rather than guessing from the device.

```js
window.nextReady.push(() => {
  next.on('express-checkout:initialized', payload => {
    document.querySelector('.express-divider').hidden = false;
    console.log('express method available:', payload.method);
  });
});
```

**Watch out for:** The container element hides *itself* when no button was created,
but it cannot hide markup outside it — a sibling heading or divider stays visible
and the section reads as broken. The other cause of an empty section is a missing
child: with no `data-next-express-checkout="buttons"` element inside the container
the feature logs
`No buttons container found with data-next-express-checkout="buttons"` and renders
nothing. Add the child, and hang your own furniture off the event above.

---

## When NOT to use this

### Hand-writing your own PayPal or Apple Pay button

**Why not:** An element whose `data-next-express-checkout` value is a method name
rather than `container` is skipped — the console shows
`Skipping individual express checkout button - managed by container` — so the button
renders but its click does nothing. Attaching this feature to such an element
directly throws
`ExpressCheckoutContainerEnhancer can only be used on container elements`. Each
provider also has branding rules the injected buttons already follow.

**Use instead:** the container itself, with an empty
`data-next-express-checkout="buttons"` child. Style the generated buttons through
the `data-next-express-checkout="{method}"` attribute the feature sets on each one —
see [reference/attributes.md](./reference/attributes.md).

### Taking an order that needs details the wallet does not collect

**Why not:** The order is built from what the provider's sheet returns. There is no
way to add a field to that sheet, so a campaign that must capture something extra
cannot capture it here.

**Use instead:**
[`checkout-form`](../../../checkout/checkout-form/guide/overview.md) — you name the
fields, so anything the campaign needs can be part of the order.

### Selling an add-on after payment has been taken

**Why not:** These buttons create a **new** order from the cart. On a
post-purchase page the payment is already taken and there is no cart to submit.

**Use instead:**
[`accept-upsell`](../../../cart/accept-upsell/guide/overview.md) — adds the package
to the existing order using the stored payment method, so the visitor is not asked
to pay a second time.
