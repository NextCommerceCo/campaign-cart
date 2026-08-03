---
title: "Features/Checkout/Prospect Cart/Tested Example"
group: "Features"
category: "Prospect Cart"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## Capturing an abandoned cart from a part-filled form

```html
<!-- There is no prospect-cart attribute of its own: you turn it on with two
     attributes on the checkout form. With trigger-on="emailEntry" the cart is
     captured as soon as email and both names are valid and the cart has items
     — so an abandoned checkout is still recorded. The form then fires a
     next:prospect-cart-created DOM event you can listen for. -->
<form data-next-checkout data-auto-create="true" data-trigger-on="emailEntry">
  <div class="form-group">
    <label for="email">Email</label>
    <input
      type="text"
      id="email"
      data-next-checkout-field="email"
      name="email"
    />
  </div>
  <div class="form-group">
    <label for="fname">First name</label>
    <input
      type="text"
      id="fname"
      data-next-checkout-field="fname"
      name="fname"
    />
  </div>
  <div class="form-group">
    <label for="lname">Last name</label>
    <input
      type="text"
      id="lname"
      data-next-checkout-field="lname"
      name="lname"
    />
  </div>
</form>
```

Taken from `e2e/fixtures/prospect-cart.html`, which `e2e/prospect-cart.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [prospect-cart's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
