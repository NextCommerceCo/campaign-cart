# Attributes

## Host element attributes

---

### `data-next-cart-summary`

| | |
|---|---|
| Type | `boolean` (presence) |
| Required | yes |
| Default | — |

Marks the element as a cart summary block and triggers enhancer instantiation. Place on the outermost container element.

---

## State classes *(set by enhancer)*

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
| `next-has-tax` | Tax amount > 0 |
| `next-no-tax` | Tax amount = 0 |
| `next-has-savings` | Retail or discount savings are available |
| `next-no-savings` | No savings |

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

### `{tax}`

Tax amount. Formatted currency string. Zero when no tax applies.

---

### `{discounts}`

Combined total of all offer and voucher discounts. Formatted currency string.

---

### `{savings}`

Total savings including both retail price differences (compare-at minus price) and applied discounts. Formatted currency string.

---

### `{compareTotal}`

The full retail (compare-at) total across all cart lines. Formatted currency string. The "before" price for a savings display.

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
