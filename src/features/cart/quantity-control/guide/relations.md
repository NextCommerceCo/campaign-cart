---
title: "Features/Cart/Quantity Control/Relations"
group: "Features"
category: "Quantity Control"
---

# Relations

## Dependencies

- `cartStore` (`src/state/cart/cart.state.ts`) — required. The enhancer subscribes to cart state and calls `updateQuantity` / `removeItem` actions. Without a populated cart store the enhancer renders an empty/disabled state and API calls will fail.

## Conflicts

- None. `QuantityControlEnhancer` is a single-element, single-package enhancer with no global side effects. Multiple instances for different packages coexist without conflict.

## Common combinations

- `CartItemListEnhancer` + this — the standard pairing. `CartItemListEnhancer` renders the item template and auto-initialises `QuantityControlEnhancer` on every `[data-next-quantity]` element it renders after each cart update.
- `RemoveItemEnhancer` + this — used together on the same cart item row. `RemoveItemEnhancer` handles explicit removal; this enhancer handles quantity adjustment. Set `data-min="1"` when using both so that decreasing to zero does not silently duplicate the remove action.
- `CartItemListEnhancer`'s `{item.quantity}` token + this — a display-only span shows the live quantity next to the stepper buttons. Use the token, not `data-next-display="cart.item.quantity"`: the `cart.` namespace answers whole-cart values, and a per-item path renders nothing.
