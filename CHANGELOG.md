# Changelog

## [0.4.2] — 2026-03-27

### Improved

- **Enhancer refactors** — `BundleSelectorEnhancer`, `PackageSelectorEnhancer`, `PackageToggleEnhancer`, and `CartSummaryEnhancer` have been split into folder-based structures (`.ts`, `.types.ts`, `.renderer.ts`, `.handlers.ts`, `index.ts`). No behavioral changes — purely internal organization for maintainability.

- **Cart store refactor** — `cartStore` moved to `src/stores/cartStore/` and split into dedicated slice files (`cartSlice.items.ts`, `cartSlice.ui.ts`, `cartSlice.api.ts`). Voucher state now lives in `checkoutStore` instead of `cartStore`; `CheckoutFormEnhancer` and `OrderManager` updated accordingly.

- **`CartCalculator` cache keys** — switched from SHA-256 to SHA-1 for bundle price cache keys (faster hashing, same collision resistance for this use case).

## [0.4.1] — 2026-03-27

### Removed

- **`sg_evclid` attribution parameter** — Singular Everflow click ID (`sg_evclid`) has been removed from attribution tracking. The `sg_evclid` URL parameter is no longer collected, stored, or sent to the API. Use `evclid` (Everflow transaction ID) for Everflow click tracking instead.

## [0.4.0] — 2026-03-20

### New

- **`PackageToggleEnhancer`** (`data-next-package-toggle`) — replaces `CartToggleEnhancer`. Toggle packages on/off independently with backend-calculated prices, auto-render mode, and quantity sync via `data-next-package-sync`.

- **`BundleSelectorEnhancer`** (`data-next-bundle-selector`) — mutually-exclusive multi-package bundles with backend-calculated prices per card, variant slot support, and automatic voucher apply/remove.

- **`CartSummaryEnhancer`** (`data-next-cart-summary`) — reactive cart summary with customizable template, state CSS classes (`next-has-discounts`, `next-free-shipping`, etc.), and list containers for discounts and line items.

### Improved

- **`PackageSelectorEnhancer`** — now uses backend `/calculate` API for card prices instead of raw campaign prices.

- **Backend Cart Calculator** — shared `CartCalculator` utility powers all price slots across enhancers. Results cached in `sessionStorage` for 10 minutes.

### Deprecated

- `CartToggleEnhancer` (`data-next-cart-toggle`) → use `PackageToggleEnhancer` (`data-next-package-toggle`)
- `data-next-qty-sync` → use `data-next-package-sync`
