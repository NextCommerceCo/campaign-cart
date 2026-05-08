# Relations

## Dependencies

- `QuantityControlEnhancer` — instantiated automatically on `[data-next-quantity]` elements inside every rendered item row. Must be importable; the enhancer will log an error and that control will be non-functional if the import fails.
- `RemoveItemEnhancer` — instantiated automatically on `[data-next-remove-item]` elements inside every rendered item row. Same failure behavior as above.
- `cartStore` — the sole data source. The enhancer subscribes to it on initialization and re-renders on every change.

## Conflicts

- **Direct event listeners on rendered children** — not an enhancer conflict, but a usage conflict. Any JavaScript that attaches event listeners directly to elements inside the `data-next-cart-items` element will have those listeners destroyed on the next cart update. Use `data-next-quantity` and `data-next-remove-item` attributes — the enhancer re-initializes their handlers after each render.

## Common combinations

- `CartItemListEnhancer` + `CartSummaryEnhancer` — the standard cart drawer layout: item list on one side, running totals (subtotal, shipping, total) on the other. Both subscribe to the cart store independently.
- `CartItemListEnhancer` + `PackageSelectorEnhancer` — selector picks the package, list reflects the result. When the user changes their selection, the list updates automatically.
- `CartItemListEnhancer` + `CartToggleEnhancer` — toggle adds/removes an item, list shows the current cart contents. The list updates on every toggle event because both write to the same cart store.
- `CartItemListEnhancer` + `CouponEnhancer` — coupon application changes discount fields on cart items. The list re-renders automatically, reflecting updated `{item.discountAmount}`, `{item.finalPrice}`, and related tokens.
