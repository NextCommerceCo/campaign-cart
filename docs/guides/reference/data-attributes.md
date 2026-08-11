---
title: "Reference/Data Attributes"
group: "Reference"
category: "Reference"
---

# Data attributes

Every attribute a production funnel page uses, grouped by what you are building. This is the working set drawn from the shipped starter templates — the attributes on real checkout, upsell, and receipt pages — with the value syntax each one takes. The [Building Pages guides](../pages/checkout-page.md) show them assembled in context.

## Displaying live values

| Attribute | Value | What it does |
|---|---|---|
| `data-next-display` | a dotted path, e.g. `cart.total` | Binds the element's text to one live value. Namespaces: `cart.*`, `order.*`, `package.*`, `bundle.<selectorId>.*`, `shipping.*`, `param.*`. |
| `data-next-format` | `currency` \| `percentage` \| `address` \| `phone` | Forces formatting on a display binding. Required on remote `bundle.<selectorId>.*` bindings, which otherwise render raw numbers. |
| `data-next-show` | a condition, e.g. `cart.hasItems`, `order.hasTax`, `shipping.isFree` | Shows the element only while the condition is true. |
| `data-next-hide` | a condition, e.g. `cart.isEmpty`, `param.banner=='n'` | Hides the element while the condition is true. The `param.*` form reads URL parameters captured at boot. |
| `data-next-await` | none | Holds the element's children invisible until the SDK finishes its scan (`next-display-ready` on `<html>`), so visitors never see `-` placeholders. Needs `next-core.css`. |

Display paths the starter templates use, by namespace: `cart.total`, `cart.subtotal`, `cart.shipping`, `cart.totalQuantity`, `cart.totalDiscountPercentage` · `package.name`, `package.image`, `package.<refId>.name` · `bundle.<selectorId>.price`, `.originalPrice`, `.discountPercentage` · `order.number`, `order.total`, `order.subtotal`, `order.tax`, `order.shipping`, `order.currency`, `order.paymentMethod`, `order.shippingMethod`, `order.customer.name`, `order.customer.email`, `order.shippingAddress.line1/.line2/.city/.state/.postcode/.country`, `order.billingAddress.*` (same fields plus `.name`).

## Selling packages — the bundle selector

| Attribute | Value | What it does |
|---|---|---|
| `data-next-bundle-selector` | none | The container. One selected card at a time; the cart follows the selection. |
| `data-next-selector-id` | a name, e.g. `main` | The selector's identity — tags its cart lines and names its `bundle.<id>.*` display namespace. |
| `data-next-selection-mode` | `swap` | Picking a card replaces the previous card's cart lines. |
| `data-next-include-shipping` | `true` | Card prices include the card's shipping method. |
| `data-next-bundle-card` | none | One selectable tier. |
| `data-next-bundle-id` | a name, e.g. `qty-2` | The card's identity. |
| `data-next-bundle-items` | JSON, e.g. `'[{"packageId":1,"quantity":2}]'` | The cart lines this card stands for. Multi-variant items add `"configurable":true`; a hidden free gift adds `"noSlot":true`. |
| `data-next-bundle-vouchers` | JSON, e.g. `'["UP50"]'` | Coupon codes that ride with the card — priced into it and applied when it is chosen. |
| `data-next-selected` | `true` | The default card. |
| `data-next-shipping-id` | a shipping `ref_id` | Per-card shipping method, applied when the card is chosen. |
| `data-next-package-id` | a package `ref_id` | Scopes short `package.*` display paths inside the card (and marks bump/upsell targets elsewhere). |
| `data-next-bundle-display` | `price` \| `originalPrice` \| `unitPrice` \| `originalUnitPrice` \| `discountAmount` \| `discountPercentage` \| `hasDiscount` | That card's calculated pricing, written by the SDK. `hasDiscount` toggles the element's visibility. |
| `data-next-bundles` | JSON array of `{id,title,imageSrc,items,…}` | Auto-renders cards from a single `<template>` using `{bundle.*}` tokens instead of hand-writing each card. |

Native quantity stepper (SDK 0.4.18+): `data-next-bundle-qty-for="<selectorId>"` on an external block, with `data-next-quantity-increase`, `data-next-quantity-decrease`, and `data-next-quantity-display` on its buttons and readout; the card carries `data-next-quantity="1"` as its seed plus `data-next-min-quantity` / `data-next-max-quantity`. Multi-variant selectors add `data-next-bundle-slots-for`, `data-next-bundle-slot-template-id`, and `data-next-variant-selectors`, into which the SDK injects native `<select data-next-variant-code>` pickers.

## Checkout form

| Attribute | Value | What it does |
|---|---|---|
| `data-next-checkout` | `form` | The checkout root, on a real `<form>`. |
| `data-next-checkout-field` | a field name | Binds one input to the order. Names: `fname`, `lname`, `email`, `phone`, `country`, `address1`, `address2`, `city`, `province`, `postal`, `accepts_marketing`, and for payment `cc-number`, `cvv`, `exp-month`, `exp-year`. The two card fields are empty `<div>`s the SDK mounts hosted inputs into. |
| `data-next-component` | `shipping-form` \| `shipping-field-row` \| `location` \| `<method>-error` \| `<method>-error-text` \| `express-error` \| `express-error-text` \| `scroll-hint` | Named containers the SDK manages. `location` (with `class="next-hidden"`) wraps city/state/postal and is revealed once a country is chosen. The `*-error` pairs are where payment errors render. |
| `data-next-payment-method` | `credit` \| `paypal` \| `klarna` \| `apple-pay` \| `google-pay` | One payment method section, with its radio input. |
| `data-next-payment-form` | same values | The method's expandable form body, paired with the section. |
| `data-next-express-checkout` | `container` \| `buttons` | Express checkout: the SDK injects wallet buttons into the `buttons` element. |
| `data-next-checkout-step` | the next step's URL | Multi-step checkout: where this step's form submits to. |
| `data-next-step-number` | `1`, `2`, … | Which step of a multi-step form this is. |
| `data-next-checkout-review` | `email` \| `phone` \| `address` \| `shippingMethod.name` | Read-back panel on a later step showing what an earlier step collected (with `data-next-enhancer="checkout-review"`). |
| `data-next-coupon` | `input` | A coupon entry field; `data-auto-apply="true"`, `data-placeholder`, and `data-button-text` configure it. |

## Order bumps

| Attribute | Value | What it does |
|---|---|---|
| `data-next-package-toggle` | none | The bump container. |
| `data-next-toggle-card` | none | One toggleable card — clicking anywhere on it adds or removes its package. |
| `data-next-is-upsell` | `true` | Marks the bump's cart line as an upsell for reporting. |
| `data-next-package-sync` | `1` | Keeps the bump's quantity in step with the main package's quantity. |
| `data-next-toggle-display` | `price` \| `originalPrice` \| `unitPrice` \| `originalUnitPrice` | The bump's pricing. Per-unit tokens stay stable across tiers; line totals scale with the synced quantity. |
| `data-next-toggle-image` | none (on an `<img>`) | The SDK swaps in the package image. |
| `data-next-toggle` | `toggle` | Narrows the clickable area to one element instead of the whole card. |

## Post-purchase upsells

| Attribute | Value | What it does |
|---|---|---|
| `data-next-upsell` | `offer` | The offer wrapper — everything the visitor acts on sits inside it. |
| `data-next-upsell-action` | `add` \| `skip` | Accept or decline. `add` submits the first bundle selector inside the wrapper, then forwards to the accept URL; `skip` forwards to the decline URL. |
| `data-next-upsell-context` | none | On a bundle selector shown after checkout: forces select mode so tier clicks stop writing to the cart. |

## Receipt

| Attribute | Value | What it does |
|---|---|---|
| `data-next-order-items` | none | Renders the order's lines, one per `<template>` stamp. |
| `data-item-template-id` | a `<template>` id | Which template the line list stamps, using `{item.*}` tokens. |

## Cart summary and lists

| Attribute | Value | What it does |
|---|---|---|
| `data-next-cart-summary` | none | The live order summary. Its direct `<template>` is the layout, interpolating `{subtotal}`, `{shipping}`, `{tax}`, `{total}`, `{currency}`, `{discounts}`, and per-line `{item.*}` tokens inside a nested `data-summary-lines` template. |
| `data-next-discounts` | `offer` \| `voucher` | A repeating list of discount rows, one `<template>` stamp per discount, with `{discount.name}`, `{discount.amount}`, `{discount.description}`. |
| `data-next-quantity` | `increase` \| `decrease` | Cart-line quantity buttons, targeted by a `data-package-id` on the same element. |

Template tokens the starter templates interpolate: `{item.quantity}`, `{item.name}`, `{item.variantName}`, `{item.packageId}`, `{item.price}`, `{item.originalPrice}`, `{item.unitPrice}`, `{item.originalUnitPrice}`, `{item.hasDiscount}` (renders as a CSS class hook), `{item.image}`, `{item.lineTotal}`, `{item.frequency}`, `{item.id}` — plus the summary totals and `{discount.*}` above. Tokens only mean something inside a `<template>` owned by a list feature; anywhere else they stay on screen as literal text.

## UI helpers

| Attribute | Value | What it does |
|---|---|---|
| `data-next-accordion` | a name, e.g. `order-summary` | Collapsible section, with `data-next-accordion-trigger`, `data-next-accordion-panel`, and `data-next-accordion-text` sharing the name, and `data-open-text` / `data-close-text` / `data-toggle-class` / `data-initial-state` configuring it. The mobile order-summary drawer on every starter checkout. |
| `data-next-tooltip` | the tooltip text | Hover tooltip — the templates use it on the card-number and CVV field icons. |
| `data-next-action` | `add-to-cart` | A buy button that writes to the cart directly, with `data-next-package-id` for its target. |

## Cautions

- **A mistyped attribute does nothing, silently.** The scanner matches exact names; `data-next-bundle-card` misspelled is inert markup with no warning. When something fails to come alive, diff your attribute spelling against these tables first.
- **Remote `bundle.*` display bindings need `data-next-format`.** Inside a card, `data-next-bundle-display` formats itself; outside one, `data-next-display="bundle.main.price"` renders an unformatted number until you add `data-next-format="currency"`.
- **A display path is not a template token.** `data-next-display="cart.total"` binds an element; `{total}` works only inside a list feature's `<template>`. Mixing them leaves a literal `{total}` on screen or a binding that never fills.
- **The legacy `os-*` attributes in the starter templates are carryover, not API.** `os-checkout-validate` and friends appear in template markup but have zero references in the SDK source — copy the `data-next-*` attributes, not those.
