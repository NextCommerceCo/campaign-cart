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
| `totalDiscountPercentage` | percentage | Combined discount as a percentage of the subtotal; `0` when no discounts are applied |
| `shipping` | currency | Shipping cost (`0` when free — pair with `isFreeShipping` for "Free" display) |
| `shippingOriginal` | currency | Original shipping before a shipping discount; `0` when no shipping discount |
| `shippingDiscountAmount` | currency | Absolute discount applied to shipping; `0` when no shipping discount |
| `shippingDiscountPercentage` | percentage | Shipping discount as a percentage of the original price; `0` when no shipping discount |
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

Optional attributes:

| Attribute | Effect |
|-----------|--------|
| `data-next-format` | Override format type (`currency`, `number`, `boolean`, `percentage`, `text`, `auto`) |
| `data-hide-if-zero` | Hide the element when the value is `0` |
| `data-hide-if-false` | Hide the element when the value is falsy |
| `data-hide-zero-cents` | Omit `.00` from currency output |

**Example — hide shipping cost when free:**
```html
<span data-next-display="cart.shipping" data-hide-if-zero="true"></span>
```



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

| Token | Format | Description |
|-------|--------|-------------|
| `{subtotal}` | currency | Subtotal before discounts and shipping (e.g. `$24.99`) |
| `{total}` | currency | Grand total after all discounts and shipping |
| `{shipping}` | currency / text | Shipping cost, or `"Free"` when shipping is zero |
| `{shippingOriginal}` | currency | Original shipping before a discount; empty string when no shipping discount |
| `{shippingDiscountAmount}` | currency | Absolute amount saved on shipping |
| `{shippingDiscountPercentage}` | percentage | Shipping discount as a percentage (e.g. `"10%"`) |
| `{shippingName}` | text | Display name of the selected shipping method |
| `{shippingCode}` | text | Code of the selected shipping method |
| `{totalDiscount}` | currency | Combined offer and voucher discount total |
| `{totalDiscountPercentage}` | percentage | Total discount as a percentage of subtotal (e.g. `"20%"`) |
| `{discounts}` | currency | **Deprecated alias** for `{totalDiscount}` — still rendered, use `{totalDiscount}` in new templates |
| `{currency}` | text | Active currency code (e.g. `"USD"`) |
| `{itemCount}` | text | Number of lines in the cart (e.g. `"3"`) |
| `{totalQuantity}` | text | Total unit quantity across all lines (e.g. `"5"`) |
| `{isEmpty}` | text | `"true"` or `"false"` — whether the cart has no items |
| `{hasDiscounts}` | text | `"true"` or `"false"` — whether any discount is applied |
| `{isFreeShipping}` | text | `"true"` or `"false"` — whether shipping cost is zero |
| `{hasShippingDiscount}` | text | `"true"` or `"false"` — whether a shipping discount is applied |
| `{isCalculating}` | text | `"true"` or `"false"` — whether a totals recalculation is in progress |

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

---

## Per-line conditional display

Inside any line or discount template you can use `data-next-show` and `data-next-hide` to render rows conditionally per row. Conditions are evaluated at render time against the same data used for token replacement, so you do not need to instantiate `ConditionalDisplayEnhancer`. Hidden elements are removed from the DOM and the attribute is stripped, so the global enhancer never re-processes them.

### Syntax rules

- Use the **no-braces** syntax. Write `item.quantity > 1`, not `{item.quantity} > 1`. The latter is substituted before evaluation and produces a malformed expression.
- Supported operators: `>`, `>=`, `<`, `<=`, `==`, `===`, `!=`, `!==`, `&&`, `||`, `!`, parentheses.
- A bare property is interpreted as a truthy check: `data-next-show="item.isRecurring"`.
- Conditions referencing other namespaces (e.g. `cart.hasItems`) are passed through untouched and processed by the global `ConditionalDisplayEnhancer`. **Avoid** using cart-wide conditions inside line templates — they thrash on every cart re-render. Place cart-wide conditions outside the `[data-summary-lines]` template instead.

### `item.*` namespace

Available in `[data-summary-lines]` row templates and inside any nested `[data-line-discounts]` template.

| Path | Type | Description |
|------|------|-------------|
| `item.packageId` | number | Package ref_id |
| `item.name` | string | Package display name |
| `item.image` | string | Product image URL |
| `item.quantity` | number | Unit quantity for this line |
| `item.productName` | string | Product name |
| `item.variantName` | string | Variant name (empty when no variant) |
| `item.sku` | string | Product SKU |
| `item.isRecurring` | boolean | Whether the line is a subscription |
| `item.interval` | `'day' \| 'month' \| null` | Subscription interval |
| `item.intervalCount` | number \| null | Subscription interval count |
| `item.frequency` | string | Human-readable frequency (e.g. `"Monthly"`, `"Every 7 days"`) |
| `item.recurringPrice` | number \| null | Recurring unit price |
| `item.originalRecurringPrice` | number \| null | Original recurring unit price |
| `item.price` | number | Package price after discounts |
| `item.originalPrice` | number | Package price before discounts |
| `item.unitPrice` | number | Unit price after discounts |
| `item.originalUnitPrice` | number | Unit price before discounts |
| `item.discountAmount` | number | Total discount amount on the line |
| `item.discountPercentage` | number | Discount as a percentage of original (e.g. `25` for 25%) |
| `item.hasDiscount` | boolean | Whether the line has any discount applied |
| `item.currency` | string | Active currency code (e.g. `"USD"`) |

> **Note**: These types are the *raw* condition values. The same `item.*` paths used as text tokens (`{item.price}`, `{item.hasDiscount}`) are still rendered as currency-formatted strings / `"show"` / `"hide"` for backwards compatibility.

### `discount.*` namespace

Available in `[data-summary-offer-discounts]`, `[data-summary-voucher-discounts]`, and `[data-line-discounts]` row templates.

| Path | Type | Description |
|------|------|-------------|
| `discount.name` | string | Offer or voucher name |
| `discount.amount` | number | Discount amount as a raw number (currency symbols stripped) |
| `discount.amountFormatted` | string | Original currency-formatted amount string |
| `discount.description` | string | Offer or voucher description |

### Examples

```html
<!-- Show only if quantity > 1 -->
<span data-next-show="item.quantity > 1">×{item.quantity}</span>

<!-- Hide when the line has a discount -->
<span data-next-hide="item.hasDiscount">{item.price}</span>

<!-- Logical combinations -->
<span data-next-show="item.isRecurring && item.discountPercentage >= 10">
  Subscriber bonus
</span>

<!-- NOT operator -->
<span data-next-show="!item.isRecurring">One-time purchase</span>

<!-- Discount-side conditions -->
<li data-next-show="discount.amount >= 5">{discount.name} -{discount.amountFormatted}</li>
```
