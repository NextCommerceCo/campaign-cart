# Cart Enhancers (`src/enhancers/cart/`)

Supplements the general `enhancers.md` rules with patterns specific to cart enhancers.

## Selector ↔ AddToCart Contract

`PackageSelectorEnhancer` exposes two methods on the DOM element after initialization:
- `element._getSelectedItem()` → `SelectorItem | null`
- `element._getSelectedPackageId()` → `number | undefined`

`AddToCartEnhancer` calls these directly when given a `data-next-selector-id`. The container also gets `data-selected-package` set — use `getAttribute('data-selected-package')` when reading selection state outside an enhancer.

## swap vs select Mode

Default is **swap** — selecting a card immediately calls `cartStore.swapPackage()`. Use **select** mode when a button should initiate the add-to-cart action.

**Do not** use swap mode on a selector that also feeds an `AddToCartEnhancer` — clicking a card will fire a cart write, and then the button fires another, resulting in double cart writes.

## Bundle Swaps Must Use BundleSelectorEnhancer

Use `BundleSelectorEnhancer` for any multi-package bundle, not multiple `CartToggleEnhancer` instances. Toggle is not atomic — it cannot identify or remove the previous bundle's items cleanly.

Vouchers declared via `data-next-bundle-vouchers` are automatically applied/removed when a bundle is selected or deselected. Do not manage bundle vouchers separately via `CouponEnhancer`.

## CartToggleEnhancer Sync

`data-next-package-sync="2,4,9"` mirrors the total quantity of the listed packages (e.g., one warranty unit per product unit). When all synced packages are removed, the toggle item is also removed automatically.

Do not use `data-next-qty-sync` in new code — it is a legacy alias for a single package ID. Always use `data-next-package-sync`.

## Template Rendering Safety

`CartItemListEnhancer` and `CartSummaryEnhancer` replace their entire `innerHTML` on every cart store update. Do not attach event listeners directly to their rendered children — the elements are destroyed on every re-render.

`CartItemListEnhancer` auto-initializes `QuantityControlEnhancer` and `RemoveItemEnhancer` on `[data-next-quantity]` and `[data-next-remove-item]` elements after each render. Do not manually instantiate these inside item templates.

## AcceptUpsellEnhancer Constraints

- Writes to the **order** (post-purchase API), not to the cart store — never call `cartStore` actions from this enhancer or alongside it for the same package
- Is only active when `orderStore.canAddUpsells()` is true; button is disabled otherwise
- Duplicate detection is via `orderStore.completedUpsells`, not cart state

## Base Class Selection

| Enhancer type | Base class |
|---|---|
| Selection, list rendering, display | `BaseEnhancer` |
| Reads cart state reactively (e.g., quantity control) | `BaseCartEnhancer` |
| Fires an async cart or order action (add-to-cart, accept-upsell) | `BaseActionEnhancer` |
