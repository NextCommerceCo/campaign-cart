---
title: "Features/Cart/Add to Cart/Relations"
group: "Features"
category: "Add to Cart"
---

# Relations

## Dependencies

- `PackageSelectorEnhancer` — required when using `data-next-selector-id`. The button reads selection state from the selector's `_getSelectedItem()` method and listens to its events.
- `cartOperations` (`state/cart/operations/`) — all cart writes go through `cartOperations.addItem()` / `clear()`, exposed programmatically as `sdk.cart.*`. The store's `useCartStore.getState().addItem()` still works but is deprecated in favour of the operations/facade.

## Conflicts

- `AcceptUpsellEnhancer` — do not use both on the same element or for the same package on a post-purchase page. `AddToCartEnhancer` writes to `cartStore`; `AcceptUpsellEnhancer` writes to the order API. Using both for the same item will produce duplicate records.
- `PackageSelectorEnhancer` in `swap` mode — if the selector is in `swap` mode, selecting a card already writes to the cart. Wiring an `AddToCartEnhancer` to the same selector will cause a second cart write on button click, resulting in double the quantity being added.

## Common combinations

- `PackageSelectorEnhancer` (select mode) + this — the canonical select-mode setup. The selector tracks the chosen package; the button adds it to the cart.
- `BundleSelectorEnhancer` (select mode) + this — same pattern for multi-package bundles. The bundle selector exposes `data-selected-bundle` and `_getSelectedItem()`; this button reads it and adds the bundle.
- This + `data-next-url` — a "buy now" flow that adds to cart and immediately sends the customer to checkout.
