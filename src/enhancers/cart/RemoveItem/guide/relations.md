# Relations

## Dependencies

- `cartStore` (`src/stores/cartStore.ts`) — required for reading item quantity and calling `removeItem()`. The enhancer will not function without an initialised cart store.
- `BaseCartEnhancer` (`src/enhancers/base/BaseCartEnhancer.ts`) — provides `setupCartSubscription()`, `getCartItem()`, and `cartState` used by the reactive update path.

## Conflicts

- None. `RemoveItemEnhancer` is read-write to the cart store but performs only removals, so it does not conflict with other enhancers that read cart state.

## Common combinations

- `CartItemListEnhancer` + this — `CartItemListEnhancer` renders item rows and auto-initialises `RemoveItemEnhancer` on any `[data-next-remove-item]` element in the rendered template after each cart update.
- `QuantityControlEnhancer` + this — placed on the same cart item row. `QuantityControlEnhancer` manages quantity adjustments; this enhancer provides the explicit remove action. Both subscribe independently to the cart store.
- `CartDisplayEnhancer` + this — display enhancers reflect the cart total; removing an item via this enhancer triggers a cart store update that display enhancers pick up automatically.
