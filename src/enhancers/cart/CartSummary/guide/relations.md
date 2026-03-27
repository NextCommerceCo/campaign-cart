# Relations

## Dependencies

- `cartStore` — required. The enhancer subscribes to `cartStore` for `totals`, `summary`, and `items`. Without a populated cart store, nothing renders.

## Conflicts

None. CartSummaryEnhancer is read-only and does not write to any store. It can coexist with any other enhancer.

## Common combinations

- `CartItemListEnhancer` + this — renders an editable item list above or beside the summary block. A standard cart drawer pattern: `CartItemListEnhancer` handles per-line editing; `CartSummaryEnhancer` shows the running totals.
- `CouponEnhancer` + this — when a coupon is applied, `{discounts}` and the `data-summary-voucher-discounts` list update automatically. Pair them in the same cart sidebar to show live coupon feedback.
- `PackageSelectorEnhancer` (swap mode) + this — the selector writes to the cart on card click; the summary reflects the new totals immediately.
- `CartDisplayEnhancer` + this — use `CartDisplayEnhancer` for isolated single-value displays (e.g., a total in a sticky header) and `CartSummaryEnhancer` for the full summary block. They subscribe to the same store independently and do not conflict.
