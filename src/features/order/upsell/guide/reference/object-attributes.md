---
title: "Features/Order/Upsell/Object Attributes"
group: "Features"
category: "Upsell"
---

# Object Attributes

## `AddUpsellLine` (request)

The payload the enhancer sends to the order API when adding an upsell.

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `lines` | `Array<{ package_id, quantity, properties? }>` | no | The package line(s) to add. One entry in direct/selector mode; several in bundle mode. |
| `lines[].package_id` | `number` | no | The campaign package id to add. |
| `lines[].quantity` | `number` | no | Units to add (1–10). |
| `lines[].properties` | `Record<string, string>` | yes | Custom per-line properties from `data-next-property` / `data-next-default-property`; omitted when empty. |
| `currency` | `string` | no | ISO currency code, from the campaign (falling back to config). |
| `vouchers` | `string[]` | yes | Voucher codes carried from a linked bundle selector; omitted when none. |

---

## `Order` (result)

The updated order the API returns after a successful add — the same object the
order store keeps on `useOrderStore().order`. Full field reference:
{@link index.Order | Order} in the SDK reference. The fields this feature relies
on:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `ref_id` | `string` | no | Order reference; appended to the next URL so the following page loads the same order. |
| `supports_post_purchase_upsells` | `boolean` | no | Whether lines may still be added to this order. `false` hides every offer on the page. |
| `lines` | `OrderLine[]` | no | Every line on the order. Lines added by an upsell carry `is_upsell: true` and are matched by `id` against the lines seen before the add, to work out what this add was worth. |
| `number` | `string` | no | Human-facing order number, for display. |
| `total_incl_tax` | `string` | no | Order grand total the customer was charged, tax included, as a decimal string. |

Not to be confused with {@link index.OrderData | OrderData}: that type declares
only the six fields the `order:completed` event guarantees, and it does not carry
`supports_post_purchase_upsells` or typed lines. Read the order store, which is
typed as `Order`.

---

## `OrderLine` (result)

One line on the updated order — a package the customer bought, at the price they
were charged for it. Full field reference: {@link index.OrderLine | OrderLine}.
The fields this feature reads:

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `number` | no | The line's id on the order. New lines are the ones whose id was not on the order before the add. |
| `is_upsell` | `boolean` | no | `true` when the line was added after checkout by an upsell, `false` for the original purchase. |
| `price_incl_tax` | `string` | no | What this line was charged, tax included and after discounts, as a decimal string. Reported as the accepted upsell's value. |
| `quantity` | `number` | no | Units bought on this line. |
| `product_title` | `string` | no | Product name to display for the line. |
