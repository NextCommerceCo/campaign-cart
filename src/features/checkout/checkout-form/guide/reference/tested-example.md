---
title: "Features/Checkout/Checkout Form/Tested Example"
group: "Features"
category: "Checkout Form"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A minimal checkout form

```html
<!-- A minimal checkout form. Wrap each field in a .form-group: validation
     errors are styled on that wrapper, so a field without one cannot show
     its error state. -->
<form data-next-checkout>
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
  <button type="submit">Complete order</button>
</form>
```

Taken from `e2e/fixtures/checkout-form.html`, which `e2e/checkout-form.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [checkout-form's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
