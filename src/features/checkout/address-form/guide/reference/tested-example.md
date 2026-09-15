---
title: "Features/Checkout/Address Form/Tested Example"
group: "Features"
category: "Address Form"
---

# Tested Example

<!-- Generated from the fixture's `docs:example` region. Do not edit by hand:
     edit the fixture, then run `npm run docs:reference`. -->

## A country-driven address block

```html
<!-- The container is empty: the SDK builds the fields a country collects, in
     the order that country writes them. Everything else on the form is
     ordinary checkout markup. -->
<form data-next-checkout>
  <div class="form-group">
    <label for="fname">First name</label>
    <input type="text" id="fname" data-next-checkout-field="fname" />
  </div>
  <div class="form-group">
    <label for="lname">Last name</label>
    <input type="text" id="lname" data-next-checkout-field="lname" />
  </div>
  <div class="form-group">
    <label for="email">Email</label>
    <input
      type="text"
      id="email"
      data-next-checkout-field="email"
      name="email"
    />
  </div>

  <div data-next-address="shipping"></div>

  <button type="submit">Place order</button>
</form>
```

Taken from `e2e/fixtures/address-form.html`, which `e2e/address-form.spec.ts` boots the real SDK against on every `npm run test:e2e`. If this markup stopped working, that spec would fail — which is the whole reason it lives here rather than being written out by hand.

The snippet is a fragment, not a whole page — it leaves out the `<meta name="next-api-key">` and the SDK `<script>` tag that every campaign page needs. For those, see [address-form's overview](../overview.md).

The `id` attributes are how the test finds elements. They carry no meaning for the SDK — drop them, or use your own.
