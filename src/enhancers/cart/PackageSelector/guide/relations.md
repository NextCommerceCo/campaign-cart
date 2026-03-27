# Relations

## Dependencies

- `campaignStore` — required at initialization to look up package metadata (name, price, image) and enrich template variables. If the store has not loaded campaign data yet, price slots stay blank.
- `cartStore` — required in swap mode to read current cart state and perform add/swap operations. In upsell context or select mode, it is still imported but not subscribed.
- `checkoutStore` — subscribed to in non-upsell contexts to detect voucher changes and trigger price recalculation.
- `SDKInitializer` — must run before any enhancer initializes so the campaign store is populated.

## Conflicts

- `PackageToggleEnhancer` — do not use both for the same set of packages on the same page area. Toggle is independent per card; selector enforces mutual exclusivity. Running both means a user could end up with multiple packages in the cart that the selector does not know about, causing sync issues.
- `BundleSelectorEnhancer` — manages its own mutual exclusivity and cart sync for multi-package bundles. Wrapping `PackageSelectorEnhancer` inside a bundle's card is unsupported.

## Common combinations

- `PackageSelectorEnhancer` + `AddToCartEnhancer` — the canonical select-mode setup. The selector tracks the chosen package; the button reads `_getSelectedItem()` and adds it to the cart.
- `PackageSelectorEnhancer` + `SelectionDisplayEnhancer` — displays details (name, price, image) of the currently selected package in a separate DOM area. The display enhancer subscribes to `selector:selection-changed`.
- `PackageSelectorEnhancer` + `ConditionalDisplayEnhancer` — shows or hides content based on which package is selected (e.g., show a "best value" badge only when the 6-pack is chosen).
- `PackageSelectorEnhancer` + `AcceptUpsellEnhancer` — used on post-purchase upsell pages. The selector (with `data-next-upsell-context`) picks the package; `AcceptUpsellEnhancer` submits it to the order API.
- `PackageSelectorEnhancer` + `UpsellEnhancer` — `UpsellEnhancer` can reference this selector via `data-next-selector-id` to read the selected package when the upsell offer is accepted.
- `PackageSelectorEnhancer` + `CartDisplayEnhancer` — the display enhancer reads the cart store (updated by swap mode) and reflects line-item changes without extra wiring.
