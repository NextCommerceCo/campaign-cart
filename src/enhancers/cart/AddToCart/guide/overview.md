# AddToCart

> Category: `cart`
> Last reviewed: 2026-03-27
> Owner: frontend

`AddToCartEnhancer` turns any button or link into an add-to-cart trigger. It either adds a fixed package directly by ID, or reads the current selection from a `PackageSelectorEnhancer` and adds whatever the customer has chosen. After a successful add, it can redirect the customer to a new URL with query parameters preserved.

## Concept

The enhancer wires a DOM element to a single cart-write operation. It has two source modes:

- **Direct**: `data-next-package-id` is set on the button. The package is always known; the button is always enabled.
- **Selector-linked**: `data-next-selector-id` points to a `PackageSelectorEnhancer`. The button reads the current selection via `_getSelectedItem()` on the selector element and stays disabled until a selection exists.

```
[PackageSelectorEnhancer]
  └─ data-next-selector-id="main"
       │  emits selector:item-selected / selector:selection-changed
       │
[AddToCartEnhancer]
  └─ data-next-selector-id="main"
       │  reads _getSelectedItem() or data-selected-package
       │
       ▼
  cartStore.addItem()  →  cart:item-added  →  redirect (optional)
```

In selector-linked mode the enhancer listens to `selector:item-selected` and `selector:selection-changed` events. When either fires it re-reads the selector element and updates its internal selection reference. The button is enabled when a selection exists and disabled when it does not.

## Business logic

- A button with `data-next-selector-id` is **disabled** (`disabled` attribute + `next-disabled` class) until the linked selector has an active selection.
- A button with `data-next-package-id` only is **always enabled**.
- During the cart write the button enters a loading state (`loading` / `next-loading` classes, `aria-busy="true"`, `disabled`). Concurrent clicks are ignored.
- If `data-next-clear-cart="true"`, the entire cart is emptied before the new item is added. Use this for single-item flows where the customer must not carry previous selections forward.
- `data-next-url` redirects after a successful add. Query parameters from the current page URL are appended to the redirect URL.
- `data-next-profile` switches the active profile before the cart write. This is evaluated at click time, not at initialization.
- Selector resolution uses a 50 ms retry loop (max 5 attempts) to tolerate race conditions where the selector element initializes after the button.

## Decisions

- We read the selector via `_getSelectedItem()` method rather than subscribing to the store because the button only needs the selection at the moment of click — continuous reactivity would be unnecessary overhead.
- We store the resolved `SelectorItem` in a ref object (`selectedItemRef`) so handler functions can read and update it without needing `this`.
- We kept `data-next-clear-cart` as an explicit attribute rather than making it a default behavior because most flows want to accumulate items, not replace them.
- We preserve query parameters on redirect so UTM and attribution data are not lost when the customer moves to the checkout page.
- We apply `data-next-profile` at click time (not init time) so a single button can serve different profile contexts depending on runtime state.

## Limitations

- Does not support adding multiple different packages in a single click. Each button adds exactly one package.
- Does not validate that the resolved package ID exists in the campaign. If the package ID is invalid the cart API will return an error.
- Selector retry logic uses `setTimeout` — if the selector takes longer than 250 ms to initialize the button will log a warning and may remain disabled until the next `selector:selection-changed` event.
- Does not re-enable itself after a failed add. The `executeAction` wrapper re-enables the button after the action completes; if the action throws, the button becomes enabled again but no retry logic runs.
- `data-next-profile` is applied globally to the session, not scoped to this button. Other enhancers on the page will see the profile change.
