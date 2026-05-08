# QuantityControlEnhancer

> Category: `cart`
> Last reviewed: 2026-03-27
> Owner: frontend

Controls the quantity of a specific package in the cart. Enables increase/decrease buttons and direct quantity input elements on cart item rows, with automatic disabled state management and cart store synchronisation.

## Concept

The enhancer binds to a single DOM element and operates in one of three modes, declared via `data-next-quantity`: `increase`, `decrease`, or `set`. Mode determines which events are listened to and which cart store action is called.

The enhancer subscribes to the cart store and re-renders the element's state (disabled, classes, data attributes) on every cart change. It does not manage a local quantity counter — cart store state is always the source of truth.

```
User interaction
      │
      ▼
Event handler (click / change / blur)
      │
      ▼
cartStore.updateQuantity() or cartStore.removeItem()
      │
      ▼
Cart store emits update
      │
      ▼
handleCartUpdate() re-renders element state
      │
      ▼
EventBus emits cart:quantity-changed
```

## Business logic

- **Increase / decrease buttons**: clicking adds or removes one `step` unit. The resulting quantity is clamped to `[min, max]`. If the resulting quantity reaches 0 or below, `removeItem` is called instead of `updateQuantity`.
- **Set input / select**: validates the entered value against `[min, max]` on `change` and `blur`. Values below `min` are clamped to `min`; values above `max` are clamped to `max`. Entering 0 removes the item from cart.
- **Number inputs** (`<input type="number">`): additional `input` event listener prevents the user from typing out-of-range values in real time.
- **Disabled state**: `increase` button is disabled when quantity equals `max`; `decrease` button is disabled when quantity equals `min`. The `disabled` HTML attribute, `disabled` CSS class, and `aria-disabled` attribute are all kept in sync.
- **Processing state**: the `processing` CSS class is added while a cart API call is in flight and removed on completion or error.
- **Template tokens**: button `innerHTML` may contain `{quantity}` and `{step}` — these are replaced with live values on every cart update. The original HTML is stored in `data-original-content` on first render.
- **Quantity unchanged**: if the new quantity equals the current quantity (e.g., clicking increase at max), no API call is made and no event is emitted.

## Decisions

- We chose three separate mode values (`increase`, `decrease`, `set`) over a single generic attribute because the correct DOM event (`click` vs. `change`/`blur`) and cart action differ by mode — keeping them explicit prevents ambiguous wiring.
- We chose to remove the item when quantity reaches 0 rather than allowing 0-quantity items, because the cart API does not accept quantity 0 and the product should disappear from the UI cleanly.
- We chose `data-package-id` (no `data-next-` prefix) over `data-next-package-id` to match the convention established by other cart enhancers that share package IDs set by `CartItemListEnhancer` template rendering.
- We chose to store the original button HTML in `data-original-content` rather than reconstructing it on destroy, because the template tokens need to be applied relative to the static source, not the previously-rendered value.
- We chose to emit `cart:quantity-changed` after every successful quantity change rather than relying solely on `cart:updated`, so listeners can respond specifically to quantity interactions without diffing cart state.

## Limitations

- Does not support fractional quantities — all values are integers.
- Does not check package availability before calling the cart API; out-of-stock errors are handled server-side.
- Does not animate between quantity states — visual transitions must be added via CSS on `.processing`.
- `data-min` defaults to `0`. Setting `data-min` above `0` does not prevent the item from being removed via `decreasing` below that threshold if the current quantity is already at the minimum — the decrease button is disabled in that state, but the item can still be removed externally.
- Template token replacement (`{quantity}`, `{step}`) operates on `innerHTML`. Do not put interactive child elements inside a quantity button if you use these tokens — they will be re-rendered on every cart update and lose any attached event listeners.
