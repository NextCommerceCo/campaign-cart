---
title: "Reference/Data Attributes"
group: "Reference"
category: "Reference"
---

# Data attributes

Every attribute a production funnel page uses, grouped by what you are building. This is the working set drawn from the shipped starter templates (the attributes on real checkout, upsell, and receipt pages) with the value syntax each one takes.

How to read this page: sections run in funnel order, and each starts with a minimal skeleton (real template markup stripped to its attributes) showing which attribute sits on which element. The [Building Pages guides](../pages/checkout-page.md) show the same markup assembled in full, and [How it works](../start-here/how-it-works.md) explains the three kinds of markup these tables mix: activation attributes, display bindings, and template tokens.

## Displaying live values

| Attribute | Value | What it does |
|---|---|---|
| `data-next-display` | a dotted path, e.g. `cart.total` | Binds the element's text to one live value. Namespaces: `cart.*`, `order.*`, `package.*`, `bundle.<selectorId>.*`, `shipping.*`, `param.*`. |
| `data-next-format` | `currency` \| `percentage` \| `address` \| `phone` | Forces formatting on a display binding. Required on remote `bundle.<selectorId>.*` bindings, which otherwise render raw numbers. |
| `data-next-show` | a condition, e.g. `cart.hasItems`, `order.hasTax`, `shipping.isFree` | Shows the element only while the condition is true. |
| `data-next-hide` | a condition, e.g. `cart.isEmpty`, `param.banner=='n'` | Hides the element while the condition is true. The `param.*` form reads URL parameters captured at boot. |
| `data-next-await` | none | Holds the element's children invisible until the SDK finishes its scan (`next-display-ready` on `<html>`), so visitors never see `-` placeholders. Needs `next-core.css`. |

What a display path can point at, by namespace. The same namespaces work in `data-next-show` / `data-next-hide` conditions:

| Namespace | Paths the templates use | The value comes from | Where you use it |
|---|---|---|---|
| `cart.*` | `cart.total`, `cart.subtotal`, `cart.shipping`, `cart.totalQuantity`, `cart.totalDiscountPercentage` | the live cart | [Checkout](../pages/checkout-page.md) |
| `package.*` | `package.name`, `package.image`, `package.<refId>.name` | the loaded campaign; the short forms are scoped by the surrounding card's `data-next-package-id` | selector and bump cards |
| `bundle.<selectorId>.*` | `bundle.<selectorId>.price`, `.originalPrice`, `.discountPercentage` | that bundle selector's calculated pricing | headlines outside the cards, on [Checkout](../pages/checkout-page.md) and [Upsell](../pages/upsell-page.md) pages |
| `shipping.*` | `shipping.isFree` (a condition) | the selected shipping method | [Checkout](../pages/checkout-page.md) |
| `param.*` | `param.<name>` (conditions) | URL parameters captured at boot | any page |
| `order.*` | `order.number`, `order.total`, `order.subtotal`, `order.tax`, `order.shipping`, `order.currency`, `order.paymentMethod`, `order.shippingMethod`, `order.customer.name` / `.email`, `order.shippingAddress.line1/.line2/.city/.state/.postcode/.country`, `order.billingAddress.*` (same fields plus `.name`) | the completed order, loaded from `?ref_id=` | [Receipt](../pages/receipt-page.md) and [Upsell](../pages/upsell-page.md) |

## The bundle selector

One container, one card per tier; clicking a card writes that tier's lines to the cart. Used on checkout pages and, in select mode, on [upsell pages](../pages/upsell-page.md). Assembled in full in the [Checkout guide](../pages/checkout-page.md):

```html
<div data-next-bundle-selector data-next-selector-id="main" data-next-selection-mode="swap" data-next-include-shipping="true" data-next-await="">
  <div data-next-bundle-card data-next-bundle-id="qty-1" data-next-bundle-items='[{"packageId":1,"quantity":1}]' data-next-selected="true" role="button">
    <span data-next-bundle-display="price">-</span>
  </div>
</div>
```

| Attribute | Value | What it does |
|---|---|---|
| `data-next-bundle-selector` | none | The container. One selected card at a time; the cart follows the selection. |
| `data-next-selector-id` | a name, e.g. `main` | The selector's identity. Tags its cart lines and names its `bundle.<id>.*` display namespace. |
| `data-next-selection-mode` | `swap` \| `select` | `swap` (the default): picking a card replaces the previous card's cart lines. `select`: picking only updates visual state, and an external add-to-cart button performs the cart write. Forced to `select` under `data-next-upsell-context`. |
| `data-next-include-shipping` | `true` | Card prices include the card's shipping method. |
| `data-next-bundle-card` | none | One selectable tier. |
| `data-next-bundle-id` | a name, e.g. `qty-2` | The card's identity. |
| `data-next-bundle-items` | JSON, e.g. `'[{"packageId":1,"quantity":2}]'` | The cart lines this card stands for. Multi-variant items add `"configurable":true`; a hidden free gift adds `"noSlot":true`. |
| `data-next-bundle-vouchers` | JSON, e.g. `'["UP50"]'` | Coupon codes that ride with the card: priced into it and applied when it is chosen. |
| `data-next-selected` | `true` | The default card. |
| `data-next-shipping-id` | a shipping `ref_id` | Per-card shipping method, applied when the card is chosen. |
| `data-next-package-id` | a package `ref_id` | Scopes short `package.*` display paths inside the card (and marks bump/upsell targets elsewhere). |
| `data-next-bundle-display` | `price` \| `originalPrice` \| `unitPrice` \| `originalUnitPrice` \| `discountAmount` \| `discountPercentage` \| `hasDiscount` | That card's calculated pricing, written by the SDK. `hasDiscount` toggles the element's visibility. |
| `data-next-bundles` | JSON array of `{id,title,imageSrc,items,…}` | Auto-renders cards from a single `<template>` using `{bundle.*}` tokens instead of hand-writing each card. |

Native quantity stepper (SDK 0.4.18+): `data-next-bundle-qty-for="<selectorId>"` on an external block, with `data-next-quantity-increase`, `data-next-quantity-decrease`, and `data-next-quantity-display` on its buttons and readout; the card carries `data-next-quantity="1"` as its seed plus `data-next-min-quantity` / `data-next-max-quantity`. Multi-variant selectors add `data-next-bundle-slots-for`, `data-next-bundle-slot-template-id`, and `data-next-variant-selectors`, into which the SDK injects native `<select data-next-variant-code>` pickers.

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

| Attribute | Value | What it does |
|---|---|---|
| `data-next-checkout` | `form` | The checkout root, on a real `<form>`. |
| `data-next-checkout-field` | a field name | Binds one input to the order. Names: `fname`, `lname`, `email`, `phone`, `country`, `address1`, `address2`, `city`, `province`, `postal`, `accepts_marketing`, and for payment `cc-number`, `cvv`, `exp-month`, `exp-year`. The two card fields are empty `<div>`s the SDK mounts hosted inputs into. |
| `data-next-component` | `shipping-form` \| `shipping-field-row` \| `location` \| `<method>-error` \| `<method>-error-text` \| `express-error` \| `express-error-text` \| `scroll-hint` | Named containers the SDK manages. `location` (with `class="next-hidden"`) wraps city/state/postal and is revealed the moment the street address (`address1`) has a value, then never hidden again. The `*-error` pairs are where payment errors render. |
| `data-next-payment-method` | `credit` \| `paypal` \| `klarna` \| `apple-pay` \| `google-pay` | One payment method section, with its radio input. |
| `data-next-payment-form` | same values | The method's expandable form body, paired with the section. |
| `data-next-express-checkout` | `container` \| `buttons` | Express checkout: the SDK injects wallet buttons into the `buttons` element. |
| `data-next-checkout-step` | the next step's URL | Multi-step checkout: where this step's form submits to. |
| `data-next-step-number` | `1`, `2`, … | Which step of a multi-step form this is. |
| `data-next-checkout-review` | `email` \| `phone` \| `address` \| `shippingMethod.name` | Read-back panel on a later step showing what an earlier step collected (with `data-next-enhancer="checkout-review"`). |
| `data-next-coupon` | `input` | A coupon entry field; `data-auto-apply="true"`, `data-placeholder`, and `data-button-text` configure it. |

## Order bumps

A checkbox-style add-on inside the checkout form: the whole card toggles its package in and out of the cart. Assembled in the [Checkout guide](../pages/checkout-page.md):

```html
<div data-next-package-toggle data-next-await="">
  <div data-next-toggle-card data-next-package-id="5" data-next-is-upsell="true" data-next-package-sync="1">
    <span data-next-toggle-display="price">-</span>
  </div>
</div>
```

| Attribute | Value | What it does |
|---|---|---|
| `data-next-package-toggle` | none | The bump container. |
| `data-next-toggle-card` | none | One toggleable card. Clicking anywhere on it adds or removes its package. |
| `data-next-is-upsell` | `true` | Marks the bump's cart line as an upsell for reporting. |
| `data-next-package-sync` | package id(s), e.g. `1` or `101,102` | Keeps the bump's quantity equal to the combined quantity of the listed packages' cart lines. When every synced package leaves the cart, the bump is removed too. |
| `data-next-toggle-display` | `price` \| `originalPrice` \| `unitPrice` \| `originalUnitPrice` | The bump's pricing. Per-unit tokens stay stable across tiers; line totals scale with the synced quantity. |
| `data-next-toggle-image` | none (on an `<img>`) | The SDK swaps in the package image. |
| `data-next-toggle-container` | none (on an ancestor) | Puts the card's state classes on this wrapper instead of the card. Use it when the element you style is not the element you click; the clickable area is always the whole `data-next-toggle-card`. |

## Post-purchase upsells

Everything the visitor acts on sits inside the offer wrapper, and the first bundle selector inside it is the one that submits. Assembled in full in the [Upsell guide](../pages/upsell-page.md):

```html
<div data-next-upsell="offer" data-next-await="">
  <div data-next-bundle-selector data-next-upsell-context data-next-selector-id="upsell-bundle">
    <div data-next-bundle-card data-next-bundle-id="1x" data-next-bundle-items='[{"packageId":3,"quantity":1}]' data-next-selected="true" role="button"></div>
  </div>
  <a data-next-upsell-action="add" href="#">Add To My Order</a>
  <a data-next-upsell-action="skip" href="#">No Thanks</a>
</div>
```

| Attribute | Value | What it does |
|---|---|---|
| `data-next-upsell` | `offer` | The offer wrapper. Everything the visitor acts on sits inside it. |
| `data-next-upsell-action` | `add` \| `skip` | Accept or decline. `add` submits the first bundle selector inside the wrapper, then forwards to the accept URL; `skip` forwards to the decline URL. |
| `data-next-upsell-context` | none | On a bundle selector shown after checkout: forces select mode so tier clicks stop writing to the cart. |

## Receipt

The order's lines render from a named `<template>`; everything else on a receipt is an `order.*` display binding from the namespace table above. Assembled in the [Receipt guide](../pages/receipt-page.md):

```html
<template id="order-item-template">
  <div>{item.quantity}x {item.name} {item.lineTotal}</div>
</template>
<div data-item-template-id="order-item-template" data-next-order-items=""></div>
```

| Attribute | Value | What it does |
|---|---|---|
| `data-next-order-items` | none | Renders the order's lines, one per `<template>` stamp. |
| `data-item-template-id` | a `<template>` id | Which template the line list stamps, using `{item.*}` tokens. |

## Cart summary and lists

The live totals panel on checkout and upsell pages. The nesting that makes `{item.*}` work (the summary's own `<template>` holding a `data-summary-lines` list with its own `<template>` per line) is shown in [How it works](../start-here/how-it-works.md) and assembled in full in the [Checkout guide](../pages/checkout-page.md).

| Attribute | Value | What it does |
|---|---|---|
| `data-next-cart-summary` | none | The live order summary. Its direct `<template>` is the layout, interpolating `{subtotal}`, `{shipping}`, `{total}`, `{currency}`, `{discounts}`, and per-line `{item.*}` tokens inside a nested `data-summary-lines` template. There is no `{tax}` summary token. |
| `data-next-discounts` | `offer` \| `voucher` | A repeating list of discount rows, one `<template>` stamp per discount, with `{discount.name}`, `{discount.amount}`, `{discount.description}`. |
| `data-next-quantity` | `increase` \| `decrease` | Cart-line quantity buttons, targeted by a `data-package-id` on the same element. |

The template tokens the starter templates interpolate, by the template that owns them. A token only means something inside its owner's `<template>`; anywhere else it stays on screen as literal text:

| Tokens | What they render | Inside |
|---|---|---|
| `{item.quantity}`, `{item.name}`, `{item.variantName}`, `{item.packageId}` | The cart line's identity: quantity, product title, variant title, package id. | the `data-summary-lines` line template |
| `{item.price}`, `{item.originalPrice}`, `{item.unitPrice}`, `{item.originalUnitPrice}`, `{item.frequency}` | The cart line's pricing: discounted and compare-at, per line and per unit, plus the subscription frequency label. | the `data-summary-lines` line template |
| `{item.image}` | The package image URL. | the `data-summary-lines` line template |
| `{item.hasDiscount}` | A CSS class hook: `show` when the line has a discount, `hide` when it does not. | the `data-summary-lines` line template |
| `{subtotal}`, `{shipping}`, `{total}`, `{currency}`, `{discounts}` | The summary totals. | the cart summary's own `<template>` |
| `{discount.name}`, `{discount.amount}`, `{discount.description}`, `{discount.percentage}` | One discount row. | a `data-next-discounts` template |
| `{item.quantity}`, `{item.name}`, `{item.image}`, `{item.id}`, `{item.lineTotal}` | One purchased order line. | the receipt's `order-item-template` |

## UI helpers

| Attribute | Value | What it does |
|---|---|---|
| `data-next-accordion` | a name, e.g. `order-summary` | Collapsible section, with `data-next-accordion-trigger`, `data-next-accordion-panel`, and `data-next-accordion-text` sharing the name, and `data-open-text` / `data-close-text` / `data-toggle-class` / `data-initial-state` configuring it. The mobile order-summary drawer on every starter checkout. |
| `data-next-tooltip` | the tooltip text | Hover tooltip. The templates use it on the card-number and CVV field icons. |
| `data-next-action` | `add-to-cart` | A buy button that writes to the cart directly, with `data-next-package-id` for its target. |

## Cautions

- **A mistyped attribute does nothing, silently.** The scanner matches exact names; `data-next-bundle-card` misspelled is inert markup with no warning. When something fails to come alive, diff your attribute spelling against these tables first.
- **Remote `bundle.*` display bindings need `data-next-format`.** Inside a card, `data-next-bundle-display` formats itself; outside one, `data-next-display="bundle.main.price"` renders an unformatted number until you add `data-next-format="currency"`.
- **A display path is not a template token.** `data-next-display="cart.total"` binds an element; `{total}` works only inside a list feature's `<template>`. Mixing them leaves a literal `{total}` on screen or a binding that never fills.
- **The legacy `os-*` attributes in the starter templates are carryover, not API.** They survive only as compatibility fallbacks for old pages and are not documented here. Copy the `data-next-*` attributes, never the `os-*` ones.
