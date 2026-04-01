# Attributes

## Host element attributes — `CartSummaryEnhancer`

---

### `data-next-cart-summary`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes |
| Default | — |

Marks the element as a cart summary block and triggers enhancer instantiation. Place on the outermost container element.

---

## Display element attributes — `CartDisplayEnhancer`

---

### `data-next-display`

| | |
|---|---|
| Type | `string` |
| Required | yes |
| Default | — |

Places a single reactive cart value on the element. Value is updated automatically on every cart change. Format: `cart.{property}`.

```html
<span data-next-display="cart.total"></span>
```

**Supported properties:**

| Property | Format | Description |
|----------|--------|-------------|
| `subtotal` | currency | Subtotal before shipping and discounts |
| `total` | currency | Grand total after all discounts and shipping |
| `totalDiscount` | currency | Combined offer and voucher discount amount |
| `discounts` | currency | **Deprecated** — use `totalDiscount` instead |
| `shipping` | currency | Shipping cost (`0` when free — pair with `isFreeShipping` for "Free" display) |
| `shippingOriginal` | currency | Original shipping before a shipping discount; `0` when no shipping discount |
| `shippingDiscountAmount` | currency | Absolute discount applied to shipping; `0` when no shipping discount |
| `shippingDiscountPercentage` | number | Shipping discount as a percentage of the original price; `0` when no shipping discount |
| `shippingName` | text | Display name of the selected shipping method; empty string when no method is selected |
| `shippingCode` | text | Code of the selected shipping method (matches campaign API); empty string when no method is selected |
| `itemCount` | number | Number of lines in the cart |
| `totalQuantity` | number | Total unit quantity across all cart lines |
| `isEmpty` | boolean | `Yes` / `No` — whether the cart has no items |
| `hasDiscounts` | boolean | `Yes` / `No` — whether any discount is applied |
| `isFreeShipping` | boolean | `Yes` / `No` — whether shipping cost is zero |
| `hasShippingDiscount` | boolean | `Yes` / `No` — whether a shipping discount is applied |
| `isCalculating` | boolean | `Yes` / `No` — whether a totals recalculation is in progress |
| `currency` | text | Active currency code (e.g. `USD`) |
| `currencyCode` | text | Alias for `currency` |
| `currencySymbol` | text | Symbol for the active currency (e.g. `$`) |

Optional attributes:

| Attribute | Effect |
|-----------|--------|
| `data-include-discounts` | **Deprecated.** Subtracts `totalDiscount` from `subtotal` before formatting. Logs a console warning. Migrate to a separate `data-next-display="cart.totalDiscount"` element hidden via `.next-no-discounts`. |
| `data-next-format` | Override format type (`currency`, `number`, `boolean`, `percentage`, `text`, `auto`) |
| `data-hide-if-zero` | Hide the element when the value is `0` |
| `data-hide-if-false` | Hide the element when the value is falsy |
| `data-hide-zero-cents` | Omit `.00` from currency output |

**Example — hide shipping cost when free:**
```html
<span data-next-display="cart.shipping" data-hide-if-zero="true"></span>
```

**Example — raw numeric value (no formatting):**
```html
<span data-next-display="cart.total.raw"></span>
```

> **Deprecated prefix:** `cart-summary.{property}` still works but logs a deprecation warning. Migrate to `cart.{property}`.

---

## State classes *(set by `CartSummaryEnhancer`)*

Applied to the host element on every render. Use these in CSS to show or hide rows without JavaScript.

| Class | Condition |
|-------|-----------|
| `next-cart-empty` | Cart has no items |
| `next-cart-has-items` | Cart has one or more items |
| `next-has-discounts` | Total discount amount > 0 |
| `next-no-discounts` | Total discount amount = 0 |
| `next-has-shipping` | Shipping cost > 0 |
| `next-free-shipping` | Shipping cost = 0 |
| `next-has-shipping-discount` | A shipping discount is applied |
| `next-no-shipping-discount` | No shipping discount |
| `next-calculating` | Totals recalculation is in progress |
| `next-not-calculating` | Totals are up to date |

**Example — hide discount row when no discount is active:**
```css
.next-no-discounts .discount-row { display: none; }
```

---

## Custom template tokens

Tokens are replaced in a custom `<template>` child. Unrecognized tokens are left unchanged.

---

### `{subtotal}`

Subtotal before shipping and discounts. Formatted currency string (e.g., `$24.99`).

---

### `{total}`

Grand total after all discounts, shipping, and tax. Formatted currency string.

---

### `{shipping}`

Shipping cost. Formatted currency string, or `"Free"` when the shipping value is zero.

---

### `{shippingOriginal}`

Original shipping cost before a shipping discount was applied. Empty string when no shipping discount is active.

---

### `{discounts}`

Combined total of all offer and voucher discounts. Formatted currency string.

---

### `{itemCount}`

Number of items (lines) in the cart. Plain integer string (e.g., `"3"`).

---

## List container attributes

Place these on elements inside a custom `<template>` to render repeating rows. Each container must include a `<template>` child that defines the row markup.

All list containers receive these state classes:

| Class | Condition |
|-------|-----------|
| `next-summary-empty` | No items in this list |
| `next-summary-has-items` | One or more items in this list |

---

### `data-summary-lines`

Renders one row per cart line. Uses the `<template>` child as the row template. Lines are sorted by `package_id` ascending.

**Row tokens:** See [object-attributes.md](./object-attributes.md) → `SummaryLine`.

---

### `data-summary-offer-discounts`

Renders one row per offer discount. Uses the `<template>` child as the row template.

**Row tokens:** `{discount.name}`, `{discount.amount}`, `{discount.description}`.

---

### `data-summary-voucher-discounts`

Renders one row per voucher (coupon) discount. Uses the `<template>` child as the row template.

**Row tokens:** `{discount.name}`, `{discount.amount}`, `{discount.description}`.

---

### `data-line-discounts`

Place inside a `data-summary-lines` row template to render per-line discount breakdowns. Uses its own `<template>` child.

**Row tokens:** `{discount.name}`, `{discount.amount}`, `{discount.description}`.

Receives `next-summary-empty` / `next-summary-has-items` classes.
