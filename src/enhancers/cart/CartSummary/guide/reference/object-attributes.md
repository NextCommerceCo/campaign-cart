# Object Attributes

## `SummaryLine`

One line in the cart summary. Corresponds to one package in the cart. Fields come from two sources: the API calculate endpoint (pricing, discounts) and campaign data enriched by the cart store (display fields like name and image).

Fields marked *campaign data* are empty strings when campaign data is unavailable.

| Token | Type | Nullable | Description |
|-------|------|----------|-------------|
| `{line.packageId}` | `string` | no | Package `ref_id`. Integer as a string. |
| `{line.quantity}` | `string` | no | Quantity in cart. Integer as a string. |
| `{line.qty}` | `string` | no | Display alias for `{line.quantity}`. |
| `{line.name}` | `string` | yes* | Package display name. *campaign data* |
| `{line.image}` | `string` | yes* | Product image URL. *campaign data* |
| `{line.productName}` | `string` | yes* | Product name. *campaign data* |
| `{line.variantName}` | `string` | yes* | Variant name, if applicable. *campaign data* |
| `{line.sku}` | `string` | yes* | Product SKU. *campaign data* |
| `{line.price}` | `string` | yes* | Unit price from campaign data. Formatted. *campaign data* |
| `{line.priceTotal}` | `string` | yes* | Line total from campaign data. Formatted. *campaign data* |
| `{line.priceRetail}` | `string` | yes* | Retail (compare-at) unit price. Formatted. *campaign data* |
| `{line.priceRetailTotal}` | `string` | yes* | Retail line total. Formatted. *campaign data* |
| `{line.priceRecurring}` | `string` | yes* | Recurring unit price (subscriptions). Formatted. *campaign data* |
| `{line.priceRecurringTotal}` | `string` | yes* | Recurring line total (subscriptions). Formatted. *campaign data* |
| `{line.isRecurring}` | `"true" \| "false"` | no | Whether this is a recurring/subscription line. |
| `{line.unitPrice}` | `string` | no | Unit price after discounts, from the API calculate response. Formatted. |
| `{line.originalUnitPrice}` | `string` | no | Unit price before discounts, from the API calculate response. Formatted. |
| `{line.packagePrice}` | `string` | no | Package price after discounts, from the API calculate response. Formatted. |
| `{line.originalPackagePrice}` | `string` | no | Package price before discounts, from the API calculate response. Formatted. |
| `{line.subtotal}` | `string` | no | Line subtotal, from the API calculate response. Formatted. |
| `{line.totalDiscount}` | `string` | no | Total discount applied to this line. Formatted. |
| `{line.total}` | `string` | no | Line total after all discounts. Formatted. |
| `{line.hasDiscount}` | `"show" \| "hide"` | no | `"show"` when `totalDiscount > 0`. Use as a CSS class or visibility flag. |
| `{line.hasSavings}` | `"show" \| "hide"` | no | `"show"` when retail savings or a discount exists on this line. |

---

## `Discount`

One discount entry in an offer, voucher, or per-line discount list.

| Token | Type | Nullable | Description |
|-------|------|----------|-------------|
| `{discount.name}` | `string` | yes | Display name of the discount (e.g., `"Bundle deal"`, `"SAVE20"`). Empty string when absent. |
| `{discount.amount}` | `string` | no | Formatted discount amount (e.g., `"$10.00"`). |
| `{discount.description}` | `string` | yes | Human-readable description of the discount. Empty string when absent. |
