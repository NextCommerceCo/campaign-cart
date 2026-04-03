# Relations

## Dependencies

- `cartStore` — required for all non-upsell interactions. The enhancer subscribes to cart state on init and calls `addItem` / `removeItem` / `updateQuantity` on user interaction.
- `campaignStore` — required to resolve package names, images, and base prices for rendering and cart line construction. The store must be populated before the enhancer initializes; it is loaded by the SDK init flow.
- `orderStore` — required in upsell context (`data-next-upsell-context`) only. Provides `canAddUpsells()` gating and the `addUpsell()` action.
- `checkoutStore` — subscribed to in normal (non-upsell) context to detect voucher changes that require a price recalculation.
- `calculateBundlePrice` utility — used to fetch accurate preview prices for cards not currently in the cart.
- `PackageToggleDisplayEnhancer` — the companion display enhancer that handles `data-next-display="toggle.{packageId}.{property}"` bindings anywhere in the document. It listens to `toggle:selection-changed` and `toggle:price-updated` events emitted by this enhancer and calls `PackageToggleEnhancer.getToggleState()` to read card state. No explicit wiring is required — both enhancers activate from their own `data-next-*` attributes.

## Conflicts

- `PackageSelectorEnhancer` (swap mode) on the same `packageId` — conflicts because both enhancers will react to each other's cart writes. Selecting the package in the selector adds it to the cart, which causes the toggle to mark itself as in-cart, which may trigger unexpected UI state. Keep `packageId` values disjoint across the two enhancers on the same page.
- `BundleSelectorEnhancer` managing the same `packageId` — conflicts for the same reason: the bundle selector treats its packages as a group and may remove the toggle's package when switching bundles.

## Common combinations

- `PackageToggleEnhancer` + `PackageSelectorEnhancer` — the selector manages the primary product choice while the toggle manages independent add-ons. Works correctly as long as no `packageId` appears in both enhancers.
- `PackageToggleEnhancer` (sync mode) + `PackageSelectorEnhancer` — the toggle's sync quantity tracks the selected package's quantity in the selector. When the selector swaps to a different package, `swapInProgress` prevents the sync card from being removed prematurely.
- `PackageToggleEnhancer` (upsell context) + `UpsellEnhancer` — both can appear on the same post-purchase page. They share the `orderStore` and the `canAddUpsells()` gate. Multiple upsell elements can coexist as long as each targets a different `packageId`.
- `PackageToggleEnhancer` + `CartSummaryEnhancer` — the summary re-renders whenever the cart changes, including toggle adds and removes. No additional wiring is needed.
