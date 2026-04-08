# Object Attributes

## `SummaryLine`

One line in the cart summary. Corresponds to one package in the cart. Pricing fields come from the API calculate endpoint; display fields (name, image, etc.) come from campaign data enriched by the cart store.

Fields marked *campaign data* are empty strings when campaign data is unavailable.

### `item.*` tokens — canonical (use these)

| Token | Type | Nullable | Description |
|-------|------|----------|-------------|
| `{item.packageId}` | `string` | no | Package `ref_id`. Integer as a string. |
| `{item.name}` | `string` | yes* | Package display name. *campaign data* |
| `{item.image}` | `string` | yes* | Product image URL. *campaign data* |
| `{item.quantity}` | `string` | no | Quantity in cart. Integer as a string. |
| `{item.productName}` | `string` | yes* | Product name. *campaign data* |
| `{item.variantName}` | `string` | yes* | Variant name, if applicable. *campaign data* |
| `{item.sku}` | `string` | yes* | Product SKU. *campaign data* |
| `{item.isRecurring}` | `"true" \| "false"` | no | Whether this is a recurring/subscription line. |
| `{item.interval}` | `string` | yes | Billing interval: `"day"`, `"month"`, or empty string for one-time. |
| `{item.intervalCount}` | `string` | yes | Number of intervals per billing cycle (e.g. `"3"` for every 3 months). Empty string for one-time. |
| `{item.frequency}` | `string` | yes | Human-readable billing frequency (e.g. `"Monthly"`, `"Every 3 months"`, `"Daily"`). Empty string for one-time. |
| `{item.recurringPrice}` | `string` | yes* | Recurring unit price (subscriptions). Formatted. *campaign data* |
| `{item.originalRecurringPrice}` | `string` | yes* | Original recurring price before any discount. Formatted. *campaign data* |
| `{item.price}` | `string` | no | Line total after discounts — `quantity × package_price` (API `line.total`). Formatted. |
| `{item.originalPrice}` | `string` | no | Line subtotal before discounts — `quantity × original_package_price` (API `line.subtotal`). Formatted. |
| `{item.unitPrice}` | `string` | no | Per-unit price after discounts (API). Formatted. |
| `{item.originalUnitPrice}` | `string` | no | Per-unit price before discounts (API). Formatted. |
| `{item.discountAmount}` | `string` | no | Total discount applied to this line. Formatted. |
| `{item.discountPercentage}` | `string` | no | Discount as a percentage of the original unit price, formatted with `%` (e.g. `"20%"`). `"0%"` when no discount. |
| `{item.hasDiscount}` | `"show" \| "hide"` | no | `"show"` when `discountAmount > 0`. Use as a CSS class or visibility flag. |
| `{item.currency}` | `string` | yes | Active currency code for this line (e.g. `"USD"`). |

---

### `line.*` tokens — deprecated

> **Deprecated.** Templates containing `{line.*}` tokens trigger a console warning on every render that lists the equivalent `{item.*}` replacement for each token. The tokens render as **empty strings** — migrate to `{item.*}` tokens to restore output.

| Deprecated token | Replacement |
|------------------|-------------|
| `{line.packageId}` | `{item.packageId}` |
| `{line.name}` | `{item.name}` |
| `{line.image}` | `{item.image}` |
| `{line.qty}` / `{line.quantity}` | `{item.quantity}` |
| `{line.productName}` | `{item.productName}` |
| `{line.variantName}` | `{item.variantName}` |
| `{line.sku}` | `{item.sku}` |
| `{line.isRecurring}` | `{item.isRecurring}` |
| `{line.priceRecurring}` / `{line.priceRecurringTotal}` | `{item.recurringPrice}` |
| `{line.unitPrice}` | `{item.unitPrice}` |
| `{line.originalUnitPrice}` | `{item.originalUnitPrice}` |
| `{line.packagePrice}` | no equivalent — `{item.price}` is now the line total, not the per-package price |
| `{line.originalPackagePrice}` | no equivalent — `{item.originalPrice}` is now the line subtotal |
| `{line.totalDiscount}` | `{item.discountAmount}` |
| `{line.hasDiscount}` | `{item.hasDiscount}` |
| `{line.subtotal}` | `{item.originalPrice}` |
| `{line.total}` | `{item.price}` |
| `{line.price}` / `{line.priceTotal}` | `{item.unitPrice}` or `{item.price}` |
| `{line.priceRetail}` / `{line.priceRetailTotal}` | `{item.originalUnitPrice}` or `{item.originalPrice}` |
| `{line.hasSavings}` | derive from `{item.hasDiscount}` |

---

## `Discount`

One discount entry in an offer, voucher, or per-line discount list.

| Token | Type | Nullable | Description |
|-------|------|----------|-------------|
| `{discount.name}` | `string` | yes | Display name of the discount (e.g., `"Bundle deal"`, `"SAVE20"`). Empty string when absent. |
| `{discount.amount}` | `string` | no | Formatted discount amount (e.g., `"$10.00"`). |
| `{discount.description}` | `string` | yes | Human-readable description of the discount. Empty string when absent. |

---

## `ItemContext` *(per-line condition shape)*

The raw-typed object exposed to `data-next-show` / `data-next-hide` conditions inside `[data-summary-lines]` and `[data-line-discounts]` row templates. Distinct from the `{item.*}` text tokens above — values here are unformatted (real numbers, real booleans) so comparison operators work as expected.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `item.packageId` | `number` | no | Package `ref_id`. |
| `item.name` | `string` | no | Package display name (empty string when absent). |
| `item.image` | `string` | no | Product image URL (empty string when absent). |
| `item.quantity` | `number` | no | Unit quantity for this line. |
| `item.productName` | `string` | no | Product name (empty string when absent). |
| `item.variantName` | `string` | no | Variant name (empty string when no variant). |
| `item.sku` | `string` | no | Product SKU (empty string when absent). |
| `item.isRecurring` | `boolean` | no | `true` when the line is a subscription. |
| `item.interval` | `'day' \| 'month' \| null` | yes | Subscription interval. `null` for one-time purchases. |
| `item.intervalCount` | `number \| null` | yes | Subscription interval count. `null` for one-time purchases. |
| `item.recurringPrice` | `number \| null` | yes | Recurring unit price as a raw number. `null` when not set. |
| `item.originalRecurringPrice` | `number \| null` | yes | Original recurring price as a raw number. `null` when not set. |
| `item.price` | `number` | no | Line total after discounts (`line.total`) as a raw number. |
| `item.originalPrice` | `number` | no | Line subtotal before discounts (`line.subtotal`) as a raw number. |
| `item.unitPrice` | `number` | no | Per-unit price after discounts as a raw number. |
| `item.originalUnitPrice` | `number` | no | Per-unit price before discounts as a raw number. |
| `item.discountAmount` | `number` | no | Total discount on this line as a raw number. |
| `item.discountPercentage` | `number` | no | Discount as an integer percentage of the original unit price (e.g. `25` for 25%). `0` when no discount. |
| `item.hasDiscount` | `boolean` | no | `true` when `discountAmount > 0`. |
| `item.currency` | `string` | no | Active currency code (empty string when absent). |
| `item.frequency` | `string` | no | Human-readable billing frequency (`"Monthly"`, `"Every 3 months"`, etc.). Empty string for one-time purchases. |

---

## `DiscountContext` *(per-discount condition shape)*

The raw-typed object exposed to `data-next-show` / `data-next-hide` conditions inside `[data-summary-offer-discounts]`, `[data-summary-voucher-discounts]`, and `[data-line-discounts]` row templates.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `discount.name` | `string` | no | Display name of the discount (empty string when absent). |
| `discount.amount` | `number` | no | Discount amount as a raw number with currency formatting stripped. `0` when unparseable. |
| `discount.amountFormatted` | `string` | no | Original currency-formatted amount string (matches the `{discount.amount}` text token). |
| `discount.description` | `string` | no | Description of the discount (empty string when absent). |
