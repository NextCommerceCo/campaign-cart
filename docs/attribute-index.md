---
title: "Reference/All Attributes"
group: "Reference"
category: "Attributes"
---

# All Attributes

<!-- Generated from the feature manifests. Do not edit by hand:
     edit the feature's *.manifest.ts, then run `npm run docs:reference`. -->

Every attribute the SDK reads or writes — 268 of them across 29 features — with the feature that owns each one. Follow a feature link for what its attributes mean, their defaults, and their traps.

Attributes marked **sets** are written *by* the SDK for you to read from CSS or tests; you do not set them yourself.

## Autocomplete in your editor

These attributes are also published as VS Code HTML custom data, so your editor
can complete them and show the same descriptions on hover. Point at the copy
shipped in the package:

```json
// .vscode/settings.json
{
  "html.customData": [
    "./node_modules/@NextCommerce/campaign-cart/dist/html-custom-data.json"
  ]
}
```

Reload the window and typing `data-next-` in any `.html` file will suggest the
full list, with defaults, valid values, and a link to the feature.

## SDK-level

These belong to the SDK itself rather than to a feature — the boot sequence, the shared action base, attribution, and the DOM observer. They are the ones you will not find by looking up a feature.

| Attribute | Owner | Use |
|---|---|---|
| `data-next-sdk-loading` | SDK boot | **sets** |
| `data-next-tracking-tag` | Attribution | you set it |
| `data-loading-text` | Shared action base | **sets** |
| `data-next-validate` | DOM observer | you set it |
| `data-next-await` | Debug overlay | you set it |
| `data-next-toggle` | DOM observer / debug overlay | you set it |

Full descriptions: [SDK-level attributes](./sdk-attributes.md).

## CSS classes

Classes the SDK toggles for you. Style these rather than tracking the same state yourself — the feature already knows it. Follow the feature link for exactly when each is applied.

| Class | Applied by |
|---|---|
| `cart-items__scroll-hint--active` | [scroll-hint](../src/features/ui/scroll-hint/guide/reference/attributes.md) |
| `coupon-message` | [coupon](../src/features/cart/coupon/guide/reference/attributes.md) |
| `coupon-message--success / --error / --info` | [coupon](../src/features/cart/coupon/guide/reference/attributes.md) |
| `disabled` | [quantity-control](../src/features/cart/quantity-control/guide/reference/attributes.md) |
| `disabled` | [remove-item](../src/features/cart/remove-item/guide/reference/attributes.md) |
| `empty` | [quantity-control](../src/features/cart/quantity-control/guide/reference/attributes.md) |
| `empty` | [remove-item](../src/features/cart/remove-item/guide/reference/attributes.md) |
| `has-item` | [quantity-control](../src/features/cart/quantity-control/guide/reference/attributes.md) |
| `has-item` | [remove-item](../src/features/cart/remove-item/guide/reference/attributes.md) |
| `item-removed` | [remove-item](../src/features/cart/remove-item/guide/reference/attributes.md) |
| `loading` | [add-to-cart](../src/features/cart/add-to-cart/guide/reference/attributes.md) |
| `next-active` | [package-toggle](../src/features/cart/package-toggle/guide/reference/attributes.md) |
| `next-calculating` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-cart-empty` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-cart-has-items` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-disabled` | [accept-upsell](../src/features/cart/accept-upsell/guide/reference/attributes.md) |
| `next-disabled` | [add-to-cart](../src/features/cart/add-to-cart/guide/reference/attributes.md) |
| `next-disabled` | [coupon](../src/features/cart/coupon/guide/reference/attributes.md) |
| `next-error` | [checkout-form](../src/features/checkout/checkout-form/guide/reference/attributes.md) |
| `next-error-field` | [checkout-form](../src/features/checkout/checkout-form/guide/reference/attributes.md) |
| `next-fomo-show` | [fomo-popup](../src/features/behavior/fomo-popup/guide/reference/attributes.md) |
| `next-free-shipping` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-has-discounts` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-has-shipping` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-in-cart` | [package-toggle](../src/features/cart/package-toggle/guide/reference/attributes.md) |
| `next-loaded` | [order-display](../src/features/display/order-display/guide/reference/attributes.md) |
| `next-loading` | [add-to-cart](../src/features/cart/add-to-cart/guide/reference/attributes.md) |
| `next-loading` | [bundle-selector](../src/features/cart/bundle-selector/guide/reference/attributes.md) |
| `next-loading` | [package-toggle](../src/features/cart/package-toggle/guide/reference/attributes.md) |
| `next-no-discounts` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-not-calculating` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-not-in-cart` | [package-toggle](../src/features/cart/package-toggle/guide/reference/attributes.md) |
| `next-selected` | [bundle-selector](../src/features/cart/bundle-selector/guide/reference/attributes.md) |
| `next-selected` | [package-toggle](../src/features/cart/package-toggle/guide/reference/attributes.md) |
| `next-selected` | [upsell](../src/features/order/upsell/guide/reference/attributes.md) |
| `next-summary-empty` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-summary-has-items` | [cart-summary](../src/features/cart/cart-summary/guide/reference/attributes.md) |
| `next-toggle-card` | [package-toggle](../src/features/cart/package-toggle/guide/reference/attributes.md) |
| `next-tooltip--visible` | [tooltip](../src/features/ui/tooltip/guide/reference/attributes.md) |
| `order-empty` | [order-item-list](../src/features/order/order-item-list/guide/reference/attributes.md) |
| `order-error` | [order-item-list](../src/features/order/order-item-list/guide/reference/attributes.md) |
| `order-has-items` | [order-item-list](../src/features/order/order-item-list/guide/reference/attributes.md) |
| `order-loading` | [order-item-list](../src/features/order/order-item-list/guide/reference/attributes.md) |
| `os--active` | [package-toggle](../src/features/cart/package-toggle/guide/reference/attributes.md) |
| `processing` | [quantity-control](../src/features/cart/quantity-control/guide/reference/attributes.md) |
| `processing` | [remove-item](../src/features/cart/remove-item/guide/reference/attributes.md) |
| `removing` | [remove-item](../src/features/cart/remove-item/guide/reference/attributes.md) |

## behavior

### [fomo-popup](../src/features/behavior/fomo-popup/guide/overview.md) *(optional)*

Rotates small social-proof notifications — "Sarah from Denver just bought this" — to show the page has traffic.

Turned on by `next.fomo({ … })`.

No attributes — configured entirely from JavaScript.

### [simple-exit-intent](../src/features/behavior/simple-exit-intent/guide/overview.md) *(optional)*

Shows one last offer when the visitor looks like they are leaving — pointer heading for the tab bar, or a fast scroll up on mobile.

Turned on by `next.exitIntent({ … })`.

| Attribute | Use | Default |
|---|---|---|
| `data-exit-intent-action` | on another element | — |
| `data-coupon-code` | on another element | — |
| `data-exit-intent` | **sets** | — |

## cart

### [accept-upsell](../src/features/cart/accept-upsell/guide/overview.md)

Adds a post-purchase upsell to an order the visitor has already paid for, then sends them onward.

Turned on by `[data-next-action="accept-upsell"]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-action` | required | — |
| `data-next-package-id` | optional | — |
| `data-next-selector-id` | optional | — |
| `data-next-upsell-action-for` | optional | — |
| `data-next-quantity` | optional | `1` |
| `data-next-url` | optional | — |

### [add-to-cart](../src/features/cart/add-to-cart/guide/overview.md)

Adds a package to the cart on click — either a fixed package or whatever a linked selector currently has selected.

Turned on by `[data-next-action="add-to-cart"]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-action` | required | — |
| `data-next-package-id` | optional | — |
| `data-next-selector-id` | optional | — |
| `data-next-quantity` | optional | `1` |
| `data-next-url` | optional | — |
| `data-next-clear-cart` | optional | `false` |
| `data-next-property-container` | optional | — |
| `data-next-property` | on another element | — |
| `data-next-default-property` | on another element | — |
| `data-next-selection-mode` | on another element | — |
| `data-selected-package / data-selected-bundle` | on another element | — |
| `disabled` | **sets** | — |
| `aria-busy` | **sets** | — |

### [bundle-selector](../src/features/cart/bundle-selector/guide/overview.md)

Sells several packages as one unit — a fixed bundle, or slots the visitor fills with their own choices and variants.

Turned on by `[data-next-bundle-selector]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-bundle-selector` | required | — |
| `data-next-selector-id` | required | — |
| `data-next-selection-mode` | optional | — |
| `data-next-bundles` | optional | — |
| `data-next-bundle-template-id` | optional | — |
| `data-next-bundle-template` | optional | — |
| `data-next-bundle-slot-template-id` | optional | — |
| `data-next-bundle-slot-template` | optional | — |
| `data-next-include-shipping` | optional | — |
| `data-next-upsell-context` | optional | — |
| `data-next-variant-selector-template-id` | optional | — |
| `data-next-variant-option-template-id` | optional | — |
| `data-next-bundle-card` | required | — |
| `data-next-bundle-id` | required | — |
| `data-next-bundle-name` | optional | — |
| `data-next-bundle-items` | optional | — |
| `data-next-selected` | optional | — |
| `data-next-quantity` | optional | — |
| `data-next-min-quantity` | optional | — |
| `data-next-max-quantity` | optional | — |
| `data-next-shipping-id` | optional | — |
| `data-next-bundle-slots` | optional | — |
| `data-next-slot-index` | optional | — |
| `data-next-variant-selectors` | optional | — |
| `data-next-variant-options` | optional | — |
| `data-next-variant-code` | optional | — |
| `data-next-variant-option` | optional | — |
| `data-next-bundle-display` | optional | — |
| `data-next-bundle-price` | optional | — |
| `data-next-bundle-vouchers` | optional | — |
| `data-next-discounts` | optional | — |
| `data-next-bundle-slots-for` | optional | — |
| `data-next-bundle-qty-for` | optional | — |
| `data-next-property` | optional | — |
| `data-next-default-property` | optional | — |
| `data-next-class-` | on another element | — |
| `data-selected-bundle` | **sets** | — |
| `data-selected` | **sets** | — |
| `data-next-in-cart` | **sets** | — |
| `data-next-loading` | **sets** | — |

### [cart-item-list](../src/features/cart/cart-item-list/guide/overview.md)

Renders one row per cart line from a template you supply, and re-renders whenever the cart changes.

Turned on by `[data-next-cart-items]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-cart-items` | required | — |
| `data-item-template-id` | optional | — |
| `data-item-template-selector` | optional | — |
| `data-item-template` | optional | — |
| `data-empty-template` | optional | `<div class="cart-empty">Your cart is empty</div>` |
| `data-title-map` | optional | — |
| `data-group-items` | optional | — |
| `data-cart-item-id` | optional | — |
| `data-package-id` | optional | — |
| `data-next-quantity` | optional | — |
| `data-next-remove-item` | optional | — |
| `data-confirm` | optional | — |
| `data-confirm-message` | optional | `Remove this item from your cart?` |

### [cart-summary](../src/features/cart/cart-summary/guide/overview.md)

Renders the order summary — line rows, discount rows, and totals — and keeps it in step with the cart.

Turned on by `[data-next-cart-summary]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-cart-summary` | required | — |
| `data-summary-lines` | optional | — |
| `data-summary-offer-discounts` | optional | — |
| `data-summary-voucher-discounts` | optional | — |
| `data-line-discounts` | optional | — |
| `data-next-discounts` | optional | — |
| `data-next-item-properties` | optional | — |
| `data-next-show` | optional | — |
| `data-next-hide` | optional | — |

### [coupon](../src/features/cart/coupon/guide/overview.md)

Lets the visitor enter a discount code, shows the codes already applied, and lets them take one off again.

Turned on by `[data-next-coupon=""]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-coupon` | required | — |
| `data-template` | on another element | — |

### [package-selector](../src/features/cart/package-selector/guide/overview.md)

Presents a group of packages as cards and tracks which one the visitor picked — optionally writing the choice straight to the cart.

Turned on by `[data-next-package-selector]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-package-selector` | required | — |
| `data-next-selector-id` | required | — |
| `data-next-selection-mode` | optional | `swap` |
| `data-next-upsell-context` | optional | — |
| `data-next-include-shipping` | optional | `false` |
| `data-next-packages` | optional | — |
| `data-next-package-template-id` | optional | — |
| `data-next-package-template` | optional | — |
| `data-next-selector-card` | required | — |
| `data-next-package-id` | required | — |
| `data-next-selected` | optional | `false` |
| `data-next-quantity` | optional | `1` |
| `data-next-min-quantity` | optional | `1` |
| `data-next-max-quantity` | optional | `999` |
| `data-next-shipping-id` | optional | — |
| `data-next-package-price` | optional | — |
| `data-next-quantity-increase` | optional | — |
| `data-next-quantity-decrease` | optional | — |
| `data-next-quantity-display` | optional | — |
| `data-selected-package` | **sets** | — |
| `data-next-loading` | **sets** | — |
| `data-next-selected` | **sets** | — |
| `data-next-in-cart` | **sets** | — |
| `data-package-price-total` | **sets** | — |
| `data-package-price-compare` | **sets** | — |
| `data-package-price-savings` | **sets** | — |
| `data-package-price-savings-pct` | **sets** | — |

### [package-toggle](../src/features/cart/package-toggle/guide/overview.md)

Turns an add-on — a warranty, express shipping, a bonus item — on and off in the cart with one click.

Turned on by `[data-next-package-toggle]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-package-toggle` | required | — |
| `data-next-packages` | optional | — |
| `data-next-toggle-template-id` | optional | — |
| `data-next-toggle-template` | optional | — |
| `data-next-include-shipping` | optional | `false` |
| `data-next-upsell-context` | optional | — |
| `data-next-toggle-card` | required | — |
| `data-next-package-id` | required | — |
| `data-next-selected` | optional | — |
| `data-next-quantity` | optional | `1` |
| `data-next-package-sync` | optional | — |
| `data-next-product-sync` | optional | — |
| `data-next-is-upsell` | optional | `false` |
| `data-next-bump` | optional | — |
| `data-next-exclude-property` | optional | — |
| `data-add-text` | optional | — |
| `data-remove-text` | optional | — |
| `data-next-toggle-container` | optional | — |
| `data-next-upsell-item` | optional | — |
| `data-next-toggle-display` | optional | `price` |
| `data-next-toggle-price` | optional | `price` |
| `data-next-toggle-image` | optional | — |
| `data-next-discounts` | optional | `(empty)` |
| `data-next-url` | optional | `the meta[name="next-upsell-accept-url"] content` |
| `data-next-upsell-section` | on another element | — |
| `data-next-in-cart` | **sets** | — |
| `data-next-active` | **sets** | — |
| `data-next-loading` | **sets** | — |

### [quantity-control](../src/features/cart/quantity-control/guide/overview.md)

Steps a cart line up or down, or sets it to an exact quantity from an input.

Turned on by `[data-next-quantity="increase"]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-quantity` | required | — |
| `data-package-id` | required | — |
| `data-step` | optional | `1` |
| `data-min` | optional | `0` |
| `data-max` | optional | `99` |
| `data-quantity` | **sets** | — |
| `data-in-cart` | **sets** | — |
| `disabled` | **sets** | — |
| `aria-disabled` | **sets** | — |
| `data-original-content` | **sets** | — |
| `min / max / step` | **sets** | — |

### [remove-item](../src/features/cart/remove-item/guide/overview.md)

Removes a line from the cart, optionally asking the visitor to confirm first.

Turned on by `[data-next-remove-item]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-remove-item` | required | — |
| `data-package-id` | required | — |
| `data-next-confirm` | optional | — |
| `data-next-confirm-message` | optional | `Are you sure you want to remove this item?` |
| `data-quantity` | **sets** | — |
| `data-in-cart` | **sets** | — |
| `data-original-content` | **sets** | — |

## checkout

### [checkout-form](../src/features/checkout/checkout-form/guide/overview.md)

Turns a plain HTML form into a working checkout: validates it, tokenizes the card, creates the order, and sends the visitor onward.

Turned on by `form[data-next-checkout]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-checkout` | required | — |
| `data-next-checkout-step` | optional | — |
| `data-next-step-number` | optional | `1` |
| `data-next-checkout-field` | required | — |
| `data-next-required` | optional | — |
| `data-next-checkout-submit` | optional | — |
| `data-next-checkout-payment` | optional | — |
| `data-next-component` | optional | — |
| `data-next-component-location` | optional | — |
| `data-next-payment-method` | on another element | — |
| `data-next-payment-form` | on another element | — |
| `data-next-payment-state` | **sets** | — |

### [checkout-review](../src/features/checkout/checkout-review/guide/overview.md) *(optional)*

Plays back what the visitor entered — address, contact, payment method — so they can check it before paying.

Turned on by `[data-next-enhancer]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-enhancer` | required | — |
| `data-next-checkout-review` | required | — |
| `data-next-format` | optional | `text` |
| `data-next-fallback` | optional | `(empty)` |

### [express-checkout-container](../src/features/checkout/express-checkout-container/guide/overview.md) *(optional)*

Renders the express payment buttons — PayPal, Apple Pay, Google Pay — for whichever of them the campaign and device support.

Turned on by `[data-next-express-checkout="container"]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-express-checkout` | required | — |
| `data-next-express-checkout` | **sets** | — |
| `data-action` | **sets** | — |

### [prospect-cart](../src/features/checkout/prospect-cart/guide/overview.md) *(optional)*

Captures an abandoning visitor as a lead the moment they type an email or phone, before they finish paying.

Turned on by `form[data-next-checkout]`.

| Attribute | Use | Default |
|---|---|---|
| `data-auto-create` | optional | `true` |
| `data-trigger-on` | optional | `emailEntry` |
| `data-email-field` | optional | `email` |
| `data-phone-field` | optional | `phone` |
| `data-min-phone-digits` | optional | `7` |
| `data-prospect-config` | optional | — |

## display

### [conditional-display](../src/features/display/conditional-display/guide/overview.md)

Shows or hides an element based on a live condition — cart contents, totals, selection state, or a URL parameter.

Turned on by `[data-next-show]` (also `[data-next-hide]`).

| Attribute | Use | Default |
|---|---|---|
| `data-next-show` | optional | — |
| `data-next-hide` | optional | — |
| `data-next-selector-id` | optional | — |
| `data-next-id` | optional | — |
| `data-next-cart-selector` | on another element | — |
| `data-next-shipping-id` | on another element | — |

### [display-core](../src/features/display/display-core/guide/overview.md)

Binds any element to a live value from the cart, campaign, order, or a selector — and formats it.

Turned on by `[data-next-display]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-display` | required | — |
| `data-next-format` | optional | `auto` |
| `data-hide-if-zero` | optional | — |
| `data-hide-if-false` | optional | — |
| `data-hide-zero-cents` | optional | — |
| `data-multiply-by` | optional | — |
| `data-divide-by` | optional | — |
| `data-next-package` | on another element | — |
| `data-next-cart-item-id` | on another element | — |
| `data-format-debug` | **sets** | — |

### [order-display](../src/features/display/order-display/guide/overview.md)

Shows values from a completed order — number, totals, customer, shipping — on receipt and upsell pages.

Turned on by `[data-next-display]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-display` | required | — |

### [product-display](../src/features/display/product-display/guide/overview.md)

Shows a campaign package's own name, price, and savings — before anything is in the cart.

Turned on by `[data-next-display]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-multiply-quantity` | optional | — |
| `data-next-quantity-selector-id` | optional | — |
| `data-next-selector-id` | optional | — |
| `data-next-upsell / data-next-upsell-quantity` | on another element | — |
| `data-container` | on another element | — |

### [quantity-text](../src/features/display/quantity-text/guide/overview.md) *(optional)*

Writes a sentence that mentions a live quantity — "3 bottles selected" — and rewrites it as the quantity changes.

Turned on by `[data-next-quantity-text]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-quantity-text` | required | — |
| `data-next-quantity-selector-id` | optional | — |
| `data-next-selector-id` | optional | — |
| `data-next-package-id` | on another element | — |
| `data-next-upsell / data-next-upsell-quantity` | on another element | — |

### [selection-display](../src/features/display/selection-display/guide/overview.md)

Shows what a selector currently has selected — its name, price, and savings — before it reaches the cart.

Turned on by `[data-next-display]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-selector-id` | optional | — |
| `data-next-id` | optional | — |
| `data-next-cart-selector` | on another element | — |
| `data-next-package-id` | on another element | — |
| `data-next-selected` | on another element | — |
| `data-next-quantity` | on another element | — |
| `data-next-shipping-id` | on another element | — |

### [shipping-display](../src/features/display/shipping-display/guide/overview.md)

Shows a shipping method's name and cost, including whether it is free.

Turned on by `[data-next-display]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-shipping-id` | required | — |

### [timer](../src/features/display/timer/guide/overview.md) *(optional)*

Counts down to a deadline and survives a page reload, so an offer window stays honest.

Turned on by `[data-next-timer]` (also `[data-next-timer-display]`, `[data-next-timer-expired]`).

| Attribute | Use | Default |
|---|---|---|
| `data-next-timer` | required | — |
| `data-duration` | required | — |
| `data-persistence-id` | optional | `default-timer` |
| `data-format` | optional | `mm:ss` |
| `data-next-timer-display` | on another element | — |
| `data-next-timer-expired` | on another element | — |

## order

### [order-item-list](../src/features/order/order-item-list/guide/overview.md)

Renders one row per line of a completed order, from a template you supply — the receipt equivalent of the cart item list.

Turned on by `[data-next-order-items]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-order-items` | required | — |
| `data-item-template-id` | optional | — |
| `data-item-template-selector` | optional | — |
| `data-item-template` | optional | — |
| `data-empty-template` | optional | — |

### [upsell](../src/features/order/upsell/guide/overview.md)

Presents a post-purchase offer on the order the visitor already paid for, and adds it without asking for payment again.

Turned on by `[data-next-upsell]` (also `[data-next-upsell-selector]`, `[data-next-upsell-select]`).

| Attribute | Use | Default |
|---|---|---|
| `data-next-upsell` | optional | — |
| `data-next-upsell-selector` | optional | — |
| `data-next-package-id` | optional | — |
| `data-next-selector-id` | optional | — |
| `data-next-quantity` | optional | `1` |
| `data-next-upsell-option` | optional | — |
| `data-next-selected` | optional | — |
| `data-next-upsell-select` | optional | — |
| `data-next-upsell-action` | optional | — |
| `data-next-url` | optional | — |
| `data-next-upsell-quantity` | optional | — |
| `data-next-upsell-quantity-toggle` | optional | — |
| `data-next-quantity-selector-id` | optional | — |
| `data-next-package-selector-id` | optional | — |
| `data-next-bundle-selector-id` | optional | — |
| `data-next-property` | optional | — |
| `data-next-default-property` | optional | — |
| `data-next-next-url` | on another element | — |

## ui

### [accordion](../src/features/ui/accordion/guide/overview.md) *(optional)*

Collapses a section behind a trigger — an order summary on mobile, an FAQ, a shipping-details panel.

Turned on by `[data-next-accordion]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-accordion` | required | — |
| `data-initial-state` | optional | `closed` |
| `data-toggle-class` | optional | `next-expanded` |
| `data-animation-duration` | optional | `300` |
| `data-open-text` | optional | — |
| `data-close-text` | optional | — |
| `data-next-accordion-trigger` | on another element | — |
| `data-next-accordion-panel` | on another element | — |
| `data-next-accordion-text` | on another element | — |

### [scroll-hint](../src/features/ui/scroll-hint/guide/overview.md) *(optional)*

Shows a "scroll for more" cue while a scrollable list is at the top and has content below the fold.

Turned on by `[data-next-component="scroll-hint"]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-component` | required | — |
| `data-next-scroll-target` | optional | — |
| `data-next-scroll-threshold` | optional | `5` |
| `aria-hidden` | **sets** | — |

### [tooltip](../src/features/ui/tooltip/guide/overview.md) *(optional)*

Shows a small explanation on hover or focus — what a fee covers, what a guarantee includes.

Turned on by `[data-next-tooltip]`.

| Attribute | Use | Default |
|---|---|---|
| `data-next-tooltip` | required | — |
| `data-next-tooltip-placement` | optional | `top` |
| `data-next-tooltip-offset` | optional | `8` |
| `data-next-tooltip-delay` | optional | `500` |
| `data-next-tooltip-max-width` | optional | `200px` |
| `data-next-tooltip-class` | optional | — |
| `data-placement` | **sets** | — |
