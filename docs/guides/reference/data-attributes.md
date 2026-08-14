---
title: "Reference/Data Attributes"
group: "Reference"
category: "Reference"
---

# Data attributes

Every attribute a production funnel page uses, grouped by what you are building. This is the working set drawn from the shipped starter templates (the attributes on real checkout, upsell, and receipt pages) with the value syntax each one takes.

How to read this page: sections run in funnel order, and each starts with a minimal skeleton (real template markup stripped to its attributes) showing which attribute sits on which element. The [Building Pages guides](../pages/checkout-page.md) show the same markup assembled in full, and [How it works](../start-here/how-it-works.md) explains the three kinds of markup these tables mix: activation attributes, display bindings, and template tokens.

## Displaying live values

| Attribute | Description |
|---|---|
| `data-next-display` | Replaces the element's text whenever the value changes |
| `data-next-format` | Overrides how that value is written |
| `data-next-show` | Shows the element while a condition is true |
| `data-next-hide` | Hides the element while a condition is true |
| `data-next-await` | Holds children hidden until the SDK's scan finishes |

Reach for `data-next-display` whenever a number or label has to stay in step with the cart or the order. You write no JavaScript: the element's text is replaced every time the value changes.

Use whichever of `data-next-show` and `data-next-hide` reads more naturally. `data-next-hide="cart.isEmpty"` beats `data-next-show="!cart.isEmpty"`. Set one or the other on an element, not both. A condition that fails to parse is logged and the element is left visible, so a typo does not silently hide content.

### Example

Below is an example that binds the cart total to a span, shows one block only when the cart has items, hides another when it is empty, and holds a price block invisible until the SDK has finished its scan.

```html
<span data-next-display="cart.total" data-next-format="currency">$0.00</span>
<div data-next-show="cart.hasItems">You have items in your cart</div>
<div data-next-hide="cart.isEmpty">Ready to check out</div>
<div data-next-await="">
  <span data-next-display="bundle.main.price" data-next-format="currency"
    >$0.00</span
  >
</div>
```

### Paths and conditions

| Attribute | Description |
|---|---|
| `data-next-display` | A dotted path, e.g. `cart.total` |
| `data-next-show` | A condition, e.g. `cart.hasItems` |
| `data-next-hide` | A condition, e.g. `param.banner=='n'` |

A path's first segment names the object it reads from, listed below. The `param` form reads URL parameters captured at boot.

### Formatting

`data-next-format` defaults to `auto`, which infers the format from the value and the path: money paths render as currency, booleans as yes/no. Set it only when that inference is wrong.

| Value | Description |
|---|---|
| `auto` | Infer from the value and the path (the default) |
| `currency` | Money, in the campaign's currency and locale |
| `number` | A plain number with locale grouping |
| `percentage` | A percentage |
| `boolean` | A true or false value |
| `date` | A date |
| `text` | Verbatim, with no formatting |

Inference does not reach `bundle.<selectorId>.*` bindings written outside a card, so set `data-next-format="currency"` on those or they render a raw number.

### Modifiers

These sit alongside `data-next-display` and change the value before it is written.

| Attribute | Description |
|---|---|
| `data-hide-if-zero` | Hides a savings row rather than showing `$0.00` |
| `data-hide-if-false` | Hides a badge rather than showing `No` |
| `data-hide-zero-cents` | Writes `$49` instead of `$49.00`, keeping real cents |
| `data-multiply-by` | Shows a per-unit price as a pack total |
| `data-divide-by` | Shows a per-unit price from a pack total |

A discount row that disappears at zero, and a pack price shown per unit.

```html
<span data-next-display="cart.totalDiscount" data-hide-if-zero="true"></span>
<span
  data-next-display="package.price"
  data-divide-by="3"
  data-hide-zero-cents="true"
></span>
```

### Waiting for the scan

`data-next-await` stops visitors seeing `-` placeholders flash before prices load.

The SDK adds `next-display-ready` to `<html>` when its scan finishes. The hiding is done by `next-core.css`, so the attribute does nothing without that stylesheet on the page.

## What a display path can read

The first segment of a path names one of these objects. The same paths work in `data-next-show` and `data-next-hide` conditions.

### The cart object

The live cart. Used on [Checkout](../pages/checkout-page.md) pages.

| Path | Description |
|---|---|
| `cart.total` | Grand total, after shipping and discounts |
| `cart.subtotal` | Lines before shipping and discounts |
| `cart.shipping` | Shipping charge |
| `cart.totalQuantity` | Units in the cart |
| `cart.totalDiscountPercentage` | Discount as a share of subtotal |

### The package object

The loaded campaign. Used on selector and bump cards. The short forms are scoped by the surrounding card's `data-next-package-id`.

| Path | Description |
|---|---|
| `package.name` | Product title |
| `package.image` | Product image URL |
| `package.<refId>.name` | Title of a named package |

### The bundle object

One bundle selector's calculated pricing. Used for headlines outside the cards, on [Checkout](../pages/checkout-page.md) and [Upsell](../pages/upsell-page.md) pages.

| Path | Description |
|---|---|
| `bundle.<selectorId>.price` | Selected tier's price |
| `bundle.<selectorId>.originalPrice` | Price before discount |
| `bundle.<selectorId>.discountPercentage` | Discount as a percentage |

### The shipping object

The selected shipping method. Used on [Checkout](../pages/checkout-page.md) pages.

| Path | Description |
|---|---|
| `shipping.isFree` | True when shipping costs nothing |

### The param object

URL parameters captured at boot. Used on any page, in conditions.

| Path | Description |
|---|---|
| `param.<name>` | One URL parameter's value |

### The order object

The completed order, loaded from `?ref_id=`. Used on [Receipt](../pages/receipt-page.md) and [Upsell](../pages/upsell-page.md) pages.

| Path | Description |
|---|---|
| `order.number` | Confirmation number |
| `order.total` | Amount the customer paid |
| `order.subtotal` | Lines before tax and shipping |
| `order.tax` | Tax charged |
| `order.shipping` | Shipping charged |
| `order.currency` | Currency code |
| `order.paymentMethod` | How it was paid, as a name (`Credit Card`, `iDEAL`, `SEPA Direct Debit`) rather than the API's code |
| `order.shippingMethod` | Chosen shipping method |
| `order.customer.name` | Full name |
| `order.customer.email` | Email address |
| `order.shippingAddress.line1` | Street address |
| `order.shippingAddress.line2` | Apartment or suite |
| `order.shippingAddress.city` | City |
| `order.shippingAddress.state` | State or province |
| `order.shippingAddress.postcode` | Postal code |
| `order.shippingAddress.country` | Country |

`order.billingAddress.*` carries the same fields as `order.shippingAddress.*`, plus `.name`.

## The bundle selector

One container, one card per tier; clicking a card writes that tier's lines to the cart. Used on checkout pages and, in select mode, on [upsell pages](../pages/upsell-page.md). Assembled in full in the [Checkout guide](../pages/checkout-page.md):

```html
<div
  data-next-bundle-selector
  data-next-selector-id="main"
  data-next-selection-mode="swap"
  data-next-include-shipping="true"
  data-next-await=""
>
  <div
    data-next-bundle-card
    data-next-bundle-id="qty-1"
    data-next-bundle-items='[{"packageId":1,"quantity":1}]'
    data-next-selected="true"
    role="button"
  >
    <span data-next-bundle-display="price">-</span>
  </div>
</div>
```

**On the container**

| Attribute | Description |
|---|---|
| `data-next-bundle-selector` | Marks the container |
| `data-next-selector-id` | Names the selector, e.g. `main` |
| `data-next-selection-mode` | `swap` (default) or `select` |
| `data-next-include-shipping` | Card prices include shipping |
| `data-next-bundles` | Auto-renders cards from a template |

`data-next-bundles` takes a JSON array of `{id,title,imageSrc,items,…}` and stamps one card per entry from a single `<template>`, using `{bundle.*}` tokens.

```html
<div
  data-next-bundle-selector
  data-next-selector-id="main"
  data-next-bundles='[{"id":"qty-1","title":"Buy 1","items":[{"packageId":1,"quantity":1}]}]'
>
  <template>
    <div data-next-bundle-card data-next-bundle-id="{bundle.id}">
      {bundle.title}
    </div>
  </template>
</div>
```

**On a card**

| Attribute | Description |
|---|---|
| `data-next-bundle-card` | Marks one selectable tier |
| `data-next-bundle-id` | Names the card, e.g. `qty-2` |
| `data-next-bundle-items` | The card's cart lines, as JSON |
| `data-next-bundle-vouchers` | Coupon codes, as JSON |
| `data-next-selected` | The card selected on load |
| `data-next-shipping-id` | Per-card shipping method |
| `data-next-package-id` | Scopes `package.*` paths in the card |
| `data-next-bundle-display` | The card's calculated pricing |

### Example

Below is an example that builds a two-for tier: it swaps the cart to that tier on click, prices the card with its own shipping method and a voucher, pre-selects it on load, and renders its discounted price.

```html
<div
  data-next-bundle-selector
  data-next-selector-id="main"
  data-next-selection-mode="swap"
  data-next-include-shipping="true"
  data-next-await=""
>
  <div
    data-next-bundle-card
    data-next-bundle-id="qty-2"
    data-next-bundle-items='[{"packageId":1,"quantity":2}]'
    data-next-bundle-vouchers='["UP50"]'
    data-next-shipping-id="2"
    data-next-package-id="1"
    data-next-selected="true"
    role="button"
  >
    <span data-next-bundle-display="price">-</span>
  </div>
</div>
```

### Selection mode

Values `data-next-selection-mode` accepts.

| Value | Description |
|---|---|
| `swap` | Replaces the previous card's cart lines |
| `select` | Updates the visual state only |

`swap` is the default. Under `select`, a separate add-to-cart button performs the cart write. A selector inside `data-next-upsell-context` is forced to `select`.

### Item flags

Set these inside `data-next-bundle-items`, alongside `packageId` and `quantity`.

| Flag | Description |
|---|---|
| `"configurable":true` | The shopper picks variants for this item |
| `"noSlot":true` | Hidden free gift, kept out of the slot list |

### Voucher codes

A code in `data-next-bundle-vouchers` is priced into the card and applied when the card is chosen, so the discount shown is the discount charged.

The codes must already exist in the Campaigns App.

### Display values

Values `data-next-bundle-display` accepts. All but `hasDiscount` write a number into the element.

| Value | Description |
|---|---|
| `price` | Total after every discount |
| `originalPrice` | Compare-at total, before discounts |
| `unitPrice` | Per-unit price at the card's quantity |
| `originalUnitPrice` | Per-unit compare-at price |
| `discountAmount` | Discount the pricing API applied |
| `discountPercentage` | Discount as a share of `originalPrice` |
| `hasDiscount` | Toggles visibility when a discount exists |

### Quantity stepper

Available from SDK 0.4.18. Put `data-next-bundle-qty-for="<selectorId>"` on a block outside the cards.

| Attribute | Description |
|---|---|
| `data-next-quantity-increase` | the plus button |
| `data-next-quantity-decrease` | the minus button |
| `data-next-quantity-display` | the readout |
| `data-next-quantity` | a card, as its starting quantity |
| `data-next-min-quantity` | a card, as its floor |
| `data-next-max-quantity` | a card, as its ceiling |

The stepper block sits outside the cards and drives the selector named in `data-next-bundle-qty-for`.

```html
<div data-next-bundle-qty-for="main">
  <button data-next-quantity-decrease>-</button>
  <span data-next-quantity-display>1</span>
  <button data-next-quantity-increase>+</button>
</div>
<div
  data-next-bundle-card
  data-next-quantity="1"
  data-next-min-quantity="1"
  data-next-max-quantity="5"
></div>
```

### Multi-variant selectors

| Attribute | Description |
|---|---|
| `data-next-bundle-slots-for` | Names the selector the slots belong to |
| `data-next-bundle-slot-template-id` | The template stamped per slot |
| `data-next-variant-selectors` | Where the SDK injects the pickers |

The slots block names its selector and the template each slot stamps.

```html
<div
  data-next-bundle-slots-for="main"
  data-next-bundle-slot-template-id="slot-tpl"
>
  <div data-next-variant-selectors></div>
</div>
```

The SDK injects a native `<select data-next-variant-code>` into the variant-selectors element.

## Checkout form

One `<form>` owns everything: fields bind to the order by name, payment methods pair a section with a form body, and the SDK manages the named containers. Assembled field group by field group in the [Checkout guide](../pages/checkout-page.md):

```html
<form data-next-checkout="form">
  <input data-next-checkout-field="fname">
  <select data-next-checkout-field="country"></select>
  <input data-next-checkout-field="address1">
  <div data-next-component="location" class="next-hidden">
    <input data-next-checkout-field="city">
  </div>
  <div data-next-checkout-field="cc-number"></div>
  <button type="submit">Complete Order</button>
</form>
```

| Attribute | Description |
|---|---|
| `data-next-checkout` | Marks the checkout root, on a real `<form>` |
| `data-next-checkout-field` | Binds one input to the order |
| `data-next-component` | Names a container the SDK manages |
| `data-next-payment-method` | One payment method section |
| `data-next-payment-form` | That method's expandable form body |
| `data-next-express-checkout` | Where wallet buttons are injected |
| `data-next-checkout-step` | Where a multi-step form submits next |
| `data-next-step-number` | Which step of a multi-step form this is |
| `data-next-checkout-review` | Reads back what an earlier step collected |
| `data-next-coupon` | A coupon entry field |

### Example

Below is an example that collects a name and a city, reveals the city group once the address is filled, mounts a hosted card field, injects the wallet buttons, takes a coupon, and submits step one of a multi-step flow.

```html
<form data-next-checkout="form">
  <input data-next-checkout-field="fname">
  <div data-next-component="location" class="next-hidden">
    <input data-next-checkout-field="city">
  </div>
  <div data-next-payment-method="credit">
    <div data-next-payment-form="credit">
      <div data-next-checkout-field="cc-number"></div>
    </div>
  </div>
  <div data-next-express-checkout="container">
    <div data-next-express-checkout="buttons"></div>
  </div>
  <div data-next-coupon="input"></div>
  <form
    data-next-checkout-step="/checkout/payment/"
    data-next-step-number="1"
  ></form>
  <span
    data-next-checkout-review="email"
    data-next-enhancer="checkout-review"
  ></span>
</form>
```

### Field names

The SDK finds inputs by `data-next-checkout-field`, not by their `name` attribute, so your markup structure is up to you. The names are fixed.

| Group | Names |
|---|---|
| Contact | `fname`, `lname`, `email`, `phone` |
| Address | `country`, `address1`, `address2`, `city`, `province`, `postal` |
| Card | `cc-number`, `cvv`, `exp-month`, `exp-year` |
| Consent | `accepts_marketing` |

`cc-number` and `cvv` are the exception to writing your own inputs. Leave them as empty `<div>`s and the SDK mounts hosted card fields into them, so no card number passes through your page.

### Managed containers

Values `data-next-component` accepts.

| Value | Description |
|---|---|
| `shipping-form` | The shipping field group |
| `shipping-field-row` | One row inside that group |
| `location` | The city, state, and postal group |
| `<method>-error` | Where one method's errors render |
| `<method>-error-text` | The error message inside it |
| `express-error` | Where express errors render |
| `express-error-text` | The error message inside it |
| `scroll-hint` | The scroll affordance |

`location` carries `class="next-hidden"`. The SDK reveals it the moment the street address has a value, and never hides it again.

### Payment methods

Values `data-next-payment-method` and `data-next-payment-form` both accept. Pair a section with a form body of the same value.

| Value | Description | Shopper enters payment details on your page |
|---|---|---|
| `credit_card` | Card | yes, in the hosted card fields |
| `paypal` | PayPal | no |
| `apple_pay` | Apple Pay | no |
| `google_pay` | Google Pay | no |
| `klarna` | Klarna | no |
| `affirm` | Affirm | no |
| `bancontact` | Bancontact | no |
| `giropay` | Giropay | no |
| `ideal` | iDEAL | no |
| `link` | Link | no |
| `sepa_debit` | SEPA Direct Debit | no |
| `sofort` | Sofort | no |
| `swish` | Swish | no |
| `twint` | TWINT | no |

Names are written with underscores, and `-` and any casing are also accepted, so `apple_pay` and `apple-pay` select the same method. `credit`, `card` and `card_token` are accepted for the card. SEPA Direct Debit answers to `sepa_debit` alone: the platform's payment-methods guide calls the same method `sepa_direct`, and that name is refused so a page cannot reach the API under two identifiers.

Every method whose last column reads "no" has nothing to reveal, so its `data-next-payment-form` can be empty. The form still validates and captures the shopper's details, then the order is created and the shopper is sent to that provider to pay.

A value that is not in this table is sent to the orders API under that name, lower-cased with `_` for `-`, rather than treated as a card, so a method the platform adds can be offered before the SDK names it. A misspelling therefore produces a refused order: the console line `Payment method "…" is not one the SDK knows` names the value, so check for it once after adding a method.

Values `data-next-express-checkout` accepts.

| Value | Description |
|---|---|
| `container` | The express checkout block |
| `buttons` | Where the SDK injects the wallet buttons |

The SDK injects one button per express method the campaign lists, for PayPal, Apple Pay, Google Pay and Link. Apple Pay is left out on Android. `paymentConfig.expressCheckout` sets the order through `methodOrder`, and its `methods` block is read only when the campaign lists no express methods at all.

Link is the one method offered both ways. As an express button it goes straight to Link; as a radio it validates the form and captures the shopper's details first. A page carrying both shows Link twice.

### Multi-step checkout

| Attribute | Description |
|---|---|
| `data-next-checkout-step` | The next step's URL |
| `data-next-step-number` | `1`, `2`, and so on |

Values `data-next-checkout-review` accepts.

| Value | Description |
|---|---|
| `email` | The email collected earlier |
| `phone` | The phone number collected earlier |
| `address` | The shipping address collected earlier |
| `shippingMethod.name` | The chosen shipping method |

It needs `data-next-enhancer="checkout-review"` on the same element.

### Coupon field

Values `data-next-coupon` accepts.

| Value | Description |
|---|---|
| (empty) | The container wrapping the whole coupon area |
| `input` | The text input the visitor types into |
| `apply` | The apply button |
| `display` | The element listing applied codes |
| `messages` | The element showing success and error text |

`apply` is optional: the first `<button>` in the container is used when it is absent. These configure the field.

| Attribute | Description |
|---|---|
| `data-auto-apply` | Applies a code as soon as it is entered |
| `data-placeholder` | The field's placeholder text |
| `data-button-text` | The apply button's label |

The container wraps the input, the apply button, and both output areas.

```html
<div data-next-coupon>
  <input
    data-next-coupon="input"
    data-placeholder="Discount code"
    data-auto-apply="true">
  <button data-next-coupon="apply" data-button-text="Apply">Apply</button>
  <div data-next-coupon="display"></div>
  <div data-next-coupon="messages"></div>
</div>
```

## Order bumps

A checkbox-style add-on inside the checkout form: the whole card toggles its package in and out of the cart. Assembled in the [Checkout guide](../pages/checkout-page.md):

```html
<div data-next-package-toggle data-next-await="">
  <div
    data-next-toggle-card
    data-next-package-id="5"
    data-next-is-upsell="true"
    data-next-package-sync="1"
  >
    <span data-next-toggle-display="price">-</span>
  </div>
</div>
```

**On the container**

| Attribute | Description |
|---|---|
| `data-next-package-toggle` | Marks the bump container |

**On a card**

| Attribute | Description |
|---|---|
| `data-next-toggle-card` | One toggleable card |
| `data-next-package-id` | The package the card adds |
| `data-next-is-upsell` | Reports the line as an upsell |
| `data-next-package-sync` | Matches quantity to another package |
| `data-next-toggle-display` | The bump's pricing |
| `data-next-toggle-image` | Swaps in the package image |
| `data-next-toggle-container` | Moves state classes to a wrapper |

Clicking anywhere on the card adds or removes its package.

### Example

Below is an example that offers a warranty as an order bump: it reports the line as an upsell, keeps its quantity matched to package 1, shows a per-unit price, and puts the selected styling on a wrapper rather than the card.

```html
<div data-next-package-toggle data-next-await="">
  <div data-next-toggle-container>
    <div
      data-next-toggle-card
      data-next-package-id="7"
      data-next-is-upsell="true"
      data-next-package-sync="1"
    >
      <span data-next-toggle-display="unitPrice">-</span>
      <img data-next-toggle-image alt="">
    </div>
  </div>
</div>
```

### Quantity sync

`data-next-package-sync` takes one or more package ids, e.g. `1` or `101,102`.

It keeps the bump's quantity equal to the combined quantity of those packages' cart lines, so one warranty per bottle stays one warranty per bottle. When every synced package leaves the cart, the bump goes with it.

### Display values

Values `data-next-toggle-display` accepts.

| Value | Description |
|---|---|
| `price` | Line total after discounts |
| `originalPrice` | Line total before discounts |
| `unitPrice` | Per-unit price |
| `originalUnitPrice` | Per-unit price before discounts |

The per-unit values stay stable across tiers; the line totals scale with the synced quantity. Pick one style per card rather than mixing them.

### State container

`data-next-toggle-container` goes on an ancestor of the card. It puts the card's state classes on that wrapper instead of the card itself.

Use it when the element you style is not the element you click. The clickable area is always the whole `data-next-toggle-card`.

## Post-purchase upsells

Everything the visitor acts on sits inside the offer wrapper, and the first bundle selector inside it is the one that submits. Assembled in full in the [Upsell guide](../pages/upsell-page.md):

```html
<div data-next-upsell="offer" data-next-await="">
  <div
    data-next-bundle-selector
    data-next-upsell-context
    data-next-selector-id="upsell-bundle"
  >
    <div
      data-next-bundle-card
      data-next-bundle-id="1x"
      data-next-bundle-items='[{"packageId":3,"quantity":1}]'
      data-next-selected="true"
      role="button"
    ></div>
  </div>
  <a data-next-upsell-action="add" href="#">Add To My Order</a>
  <a data-next-upsell-action="skip" href="#">No Thanks</a>
</div>
```

| Attribute | Description |
|---|---|
| `data-next-upsell` | The offer wrapper, taking `offer` |
| `data-next-upsell-action` | Accepts or declines the offer |
| `data-next-upsell-context` | Puts a bundle selector in select mode |

### Example

Below is an example that presents one post-purchase offer: a bundle selector in select mode so clicks do not touch the cart, with a link that adds the tier to the paid order and a link that skips it.

```html
<div data-next-upsell="offer" data-next-await="">
  <div
    data-next-bundle-selector
    data-next-upsell-context
    data-next-selector-id="upsell"
  >
    <div
      data-next-bundle-card
      data-next-bundle-id="1x"
      data-next-selected="true"
    ></div>
  </div>
  <a data-next-upsell-action="add" href="#">Add To My Order</a>
  <a data-next-upsell-action="skip" href="#">No Thanks</a>
</div>
```

### Accepting and declining

Values `data-next-upsell-action` accepts.

| Value | Description |
|---|---|
| `add` | Submits the offer, then goes to the accept URL |
| `skip` | Goes to the decline URL, order untouched |

`add` submits the first bundle selector inside the wrapper.

### Upsell context

`data-next-upsell-context` goes on a bundle selector shown after checkout. It forces select mode, so clicking a tier stops writing to the cart.

## Receipt

The order's lines render from a named `<template>`; everything else on a receipt is an `order.*` display binding from [the order object](#the-order-object) above. Assembled in the [Receipt guide](../pages/receipt-page.md):

```html
<template id="order-item-template">
  <div>{item.quantity}x {item.name} {item.lineTotal}</div>
</template>
<div data-item-template-id="order-item-template" data-next-order-items=""></div>
```

| Attribute | Description |
|---|---|
| `data-next-order-items` | Renders the order's lines |
| `data-item-template-id` | Names the template each line stamps |

Each line is one stamp of the named `<template>`, using `{item.*}` tokens.

### Example

Below is an example that renders the purchased lines: a named template holding the row markup, and a list element that stamps it once per line on the order.

```html
<template id="order-item-template">
  <div>{item.quantity}x {item.name} {item.lineTotal}</div>
</template>
<div data-item-template-id="order-item-template" data-next-order-items=""></div>
```

## Cart summary and lists

The live totals panel on checkout and upsell pages. The nesting that makes `{item.*}` work (the summary's own `<template>` holding a `data-summary-lines` list with its own `<template>` per line) is shown in [How it works](../start-here/how-it-works.md) and assembled in full in the [Checkout guide](../pages/checkout-page.md).

| Attribute | Description |
|---|---|
| `data-next-cart-summary` | The live order summary |
| `data-next-discounts` | A repeating list of discount rows |
| `data-next-quantity` | Cart-line quantity buttons |

`data-next-discounts` takes `offer` or `voucher`. `data-next-quantity` takes `increase` or `decrease`, targeted by a `data-package-id` on the same element.

### Example

Below is an example that renders a live totals panel: one row per cart line with quantity buttons, a list of applied vouchers, and the subtotal, shipping, and grand total beneath them.

```html
<div data-next-cart-summary>
  <template>
    <div data-summary-lines>
      <template>
        <div data-package-id="{item.packageId}">
          {item.quantity}x {item.name} {item.price}
          <button
            data-next-quantity="decrease"
            data-package-id="{item.packageId}"
          >
            -
          </button>
          <button
            data-next-quantity="increase"
            data-package-id="{item.packageId}"
          >
            +
          </button>
        </div>
      </template>
    </div>
    <ul data-next-discounts="voucher">
      <template><li>{discount.name} {discount.amount}</li></template>
    </ul>
    <div>{subtotal} {shipping} {total}</div>
  </template>
</div>
```

### Summary tokens

The summary's direct `<template>` is the layout.

| Token | Description |
|---|---|
| `{subtotal}` | Lines before shipping and discounts |
| `{shipping}` | Shipping charge |
| `{total}` | Grand total |
| `{currency}` | Currency symbol |
| `{discounts}` | Total discount amount |

There is no `{tax}` summary token.

### Cart line tokens

Available inside the `data-summary-lines` line template.

| Token | Description |
|---|---|
| `{item.quantity}` | Units on this line |
| `{item.name}` | Product title |
| `{item.variantName}` | Variant title |
| `{item.packageId}` | The line's package id |
| `{item.image}` | Package image URL |
| `{item.price}` | Line total after discounts |
| `{item.originalPrice}` | Line total before discounts |
| `{item.unitPrice}` | Per-unit price |
| `{item.originalUnitPrice}` | Per-unit price before discounts |
| `{item.frequency}` | Subscription frequency label |
| `{item.hasDiscount}` | `show` or `hide`, as a CSS class hook |

### Discount row tokens

Available inside a `data-next-discounts` template.

| Token | Description |
|---|---|
| `{discount.name}` | The discount's name |
| `{discount.amount}` | Amount taken off |
| `{discount.description}` | Longer description |
| `{discount.percentage}` | Discount as a percentage |

### Order line tokens

Available inside the receipt's `order-item-template`.

| Token | Description |
|---|---|
| `{item.quantity}` | Units on this line |
| `{item.name}` | Product title |
| `{item.image}` | Package image URL |
| `{item.id}` | The line's id |
| `{item.lineTotal}` | Line total |

A token only means something inside its owner's `<template>`. Anywhere else it stays on screen as literal text.

## UI helpers

| Attribute | Description |
|---|---|
| `data-next-accordion` | A collapsible section |
| `data-next-tooltip` | A hover tooltip, taking the text |
| `data-next-action` | A buy button that writes to the cart |

`data-next-action` takes `add-to-cart`, with `data-next-package-id` naming its target.

```html
<button data-next-action="add-to-cart" data-next-package-id="1">Buy now</button>
```

### Tooltip options

| Attribute | Description |
|---|---|
| `data-next-tooltip` | The text to show |
| `data-next-tooltip-placement` | Which side it opens on, default `top` |
| `data-next-tooltip-offset` | Gap in pixels, default `8` |
| `data-next-tooltip-delay` | Delay in milliseconds before it opens |

All four tooltip attributes on one element.

```html
<span
  data-next-tooltip="Helpful text"
  data-next-tooltip-placement="top"
  data-next-tooltip-offset="8"
  data-next-tooltip-delay="0"
></span>
```

### Accordion parts

`data-next-accordion` takes a name, e.g. `order-summary`. These share that name.

| Attribute | Description |
|---|---|
| `data-next-accordion-trigger` | the clickable header |
| `data-next-accordion-panel` | the collapsing body |
| `data-next-accordion-text` | the label that swaps |

Configure it with `data-open-text`, `data-close-text`, `data-toggle-class`, and `data-initial-state`. This is the mobile order-summary drawer on every starter checkout.

```html
<div data-next-accordion="faq1" data-initial-state="closed">
  <button data-next-accordion-trigger="faq1">
    <span data-next-accordion-text="faq1">Show</span>
  </button>
  <div data-next-accordion-panel="faq1">Panel body</div>
</div>
```

## Cautions

- **A mistyped attribute does nothing, silently.** The scanner matches exact names; `data-next-bundle-card` misspelled is inert markup with no warning. When something fails to come alive, diff your attribute spelling against these tables first.
- **Remote `bundle.*` display bindings need `data-next-format`.** Inside a card, `data-next-bundle-display` formats itself; outside one, `data-next-display="bundle.main.price"` renders an unformatted number until you add `data-next-format="currency"`.
- **A display path is not a template token.** `data-next-display="cart.total"` binds an element; `{total}` works only inside a list feature's `<template>`. Mixing them leaves a literal `{total}` on screen or a binding that never fills.
- **The legacy `os-*` attributes in the starter templates are carryover, not API.** They survive only as compatibility fallbacks for old pages and are not documented here. Copy the `data-next-*` attributes, never the `os-*` ones.
