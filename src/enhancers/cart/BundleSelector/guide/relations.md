# Relations

## Dependencies

- `campaignStore` — required to look up package metadata (name, image, price, variant attributes) for slot rendering and variant resolution. If the store has not loaded campaign data, slot templates render blank and variant selectors cannot be built.
- `cartStore` — required in swap mode to read current cart state and perform `swapCart` operations. Subscribed to for syncing `next-in-cart` state on all cards.
- `checkoutStore` — subscribed to detect voucher changes and trigger price re-fetches. Also written to when bundle vouchers are applied or removed.
- `SDKInitializer` — must run before any enhancer initializes so that `campaignStore` is populated.

## Conflicts

- `PackageSelectorEnhancer` — do not use both to manage the same packages on the same page area. `PackageSelectorEnhancer` tracks a single package per card; `BundleSelectorEnhancer` tracks a bundle per card. Running both for overlapping packages means cart items can be added by one enhancer and orphaned by the other during a swap.
- `PackageToggleEnhancer` — do not use toggles to manage packages that are also declared inside a bundle's `items` array. The toggle writes to the cart independently; if the bundle selector swaps the cart, it will strip the toggled item because it doesn't share the expected `bundleId` tag.
- `CouponEnhancer` — do not use `CouponEnhancer` to apply or remove codes that are also declared as `data-next-bundle-vouchers`. The bundle selector's automatic apply/remove logic and `CouponEnhancer`'s manual logic will conflict, leaving vouchers in an unpredictable state.

## Common combinations

- `BundleSelectorEnhancer` + `CartDisplayEnhancer` — the display enhancer reads the cart store (updated by swap mode) and reflects line-item changes without extra wiring. Useful to show a live cart summary alongside the bundle picker.
- `BundleSelectorEnhancer` + `SelectionDisplayEnhancer` — listens to `bundle:selection-changed` to display the selected bundle's ID or item details in a separate DOM area.
- `BundleSelectorEnhancer` + `ConditionalDisplayEnhancer` — shows or hides content based on `data-selected-bundle` on the container, e.g., displaying a bundle-specific badge or feature list only when a particular bundle is chosen.
- `BundleSelectorEnhancer` (select mode) + `AddToCartEnhancer` — the bundle selector with `data-next-selection-mode="select"` tracks which bundle is chosen; the `AddToCartEnhancer` reads `data-selected-bundle` from the container and performs the cart write on button click. Requires the bundle selector and button to share a `data-next-selector-id`.
