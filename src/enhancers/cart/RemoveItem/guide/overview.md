# RemoveItemEnhancer

> Category: `cart`
> Last reviewed: 2026-03-27
> Owner: frontend

Removes a specific package from the cart when the user clicks the bound element. Keeps the element's visual state in sync with the cart store — disabling itself when the package is not in the cart and re-enabling when it is.

## Concept

The enhancer binds to a single DOM element (typically a button) and registers a click listener. On click it calls `cartStore.removeItem()`. It subscribes to the cart store so that every cart change re-renders the button's disabled state, CSS classes, and data attributes — the cart store is always the source of truth.

```
User click
      │
      ▼
handleClick() — guards: disabled check, optional confirm dialog
      │
      ▼
cartStore.removeItem(packageId)
      │
      ▼
Cart store emits update
      │
      ▼
handleCartUpdate() re-renders button state
      │
      ▼
EventBus emits cart:item-removed
```

## Business logic

- **Disabled when not in cart**: if the package is not present in the cart (quantity 0), the button is disabled (`disabled` attribute, `disabled` CSS class, `aria-disabled="true"`). Clicking a disabled button is a no-op.
- **Processing state**: the `processing` CSS class is added while the cart API call is in flight and removed on completion or error.
- **Optional confirmation**: when `data-next-confirm="true"` is present, a native `confirm()` dialog is shown before removing. Cancelling aborts the removal.
- **Removal feedback**: after a successful removal the `item-removed` class is briefly added to the button (300 ms) and the `removing` class is briefly added to the closest `[data-cart-item-id]` or `.cart-item` ancestor (300 ms), enabling CSS exit animations.
- **Template tokens**: button `innerHTML` may contain `{quantity}` which is replaced with the live cart quantity on every cart update. The original HTML is stored in `data-original-content` on first render so the template is never consumed.
- **Already removed guard**: if `cartStore.getItemQuantity()` returns 0 at the time the handler runs, no API call is made.

## Decisions

- We chose `BaseCartEnhancer` over `BaseEnhancer` because the button's disabled state is driven by reactive cart state, which `BaseCartEnhancer.setupCartSubscription()` wires automatically.
- We chose `data-package-id` (no `data-next-` prefix) to match the convention established by other cart enhancers — this attribute is typically stamped by `CartItemListEnhancer` template rendering and is shared across enhancers on the same row.
- We chose to use a stable `boundHandleClick` ref on the class rather than `bind()` inside `initialize()` so that `removeEventListener` in `cleanupEventListeners()` can target the exact same function reference.
- We chose native `confirm()` for the optional dialog rather than a custom modal to keep the enhancer dependency-free. Teams requiring branded dialogs should intercept the `data-next-confirm` attribute and manage the dialog externally before triggering removal.
- We chose `renderRemovalFeedback()` with a 300 ms timeout rather than listening for a CSS `transitionend` event because the animation duration is a styling concern — the enhancer should not couple to CSS timing values.

## Limitations

- Does not support undo / restore after removal — once `cartStore.removeItem()` completes the item is gone from cart state.
- The native `confirm()` dialog blocks the main thread and cannot be styled. Teams requiring a branded confirmation UI must manage that externally.
- `{quantity}` template token replacement operates on `innerHTML`. Do not add interactive child elements inside the button if using this token — they are destroyed on every cart update.
- Removal feedback targets the closest `[data-cart-item-id]` or `.cart-item` ancestor. If neither is present in the DOM tree the parent animation is silently skipped.
- Does not interact with `BundleSelectorEnhancer` — removing one item from a bundle does not automatically remove sibling bundle items. Use `BundleSelectorEnhancer` to manage full-bundle removal.
