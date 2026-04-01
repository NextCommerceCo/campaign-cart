# Changelog

## [0.4.5] — 2026-04-01

### New

- **`CartSummaryEnhancer` display module** (`CartSummaryEnhancer.display.ts`) — dedicated display class extracted from the generic `CartDisplayEnhancer`. Manages all cart-summary-specific slot rendering (totals, discounts, shipping, line items). `AttributeScanner` now activates this module for both `data-next-cart` and `data-next-cart-summary` elements.

- **`isCalculating` flag on `CartSummaryEnhancer`** — element receives a `next-calculating` CSS class while a cart API call is in flight. Enables loading states (e.g., skeleton, spinner) on the summary block without extra JS.

- **Optimistic totals in `cartStore`** — `cartSlice.api.ts` now computes optimistic totals immediately after a cart mutation so the UI reflects the expected outcome before the server confirms. `isCalculating` is set to `true` during the round-trip and cleared on response.

### Fixed

- **`BundleSelectorEnhancer` price summary null safety** — `BundlePriceSummary` fields (`total`, `subtotal`, `totalDiscount`, `totalDiscountPercentage`) are now accessed with optional chaining. Previously a missing field caused a render-blocking error when a price fetch returned a partial response.

## [0.4.4] — 2026-03-31

### New

- **`data-next-display` support on all selector enhancers** — `BundleSelectorEnhancer`, `PackageSelectorEnhancer`, and `PackageToggleEnhancer` now support `data-next-display` elements for reactive price rendering outside card slots. Display elements update automatically when backend-calculated prices arrive.

- **`BundlePackageState`** — new per-package state type owned by each `BundleCard`. Holds both static campaign data (name, image, qty, SKU) and computed prices. Acts as the single source of truth for slot rendering; eliminates the separate `previewLines` map.

- **`BundlePriceSummary`** — new aggregate price summary stored on each `BundleCard` after a price fetch completes (`total`, `subtotal`, `totalDiscount`, `totalDiscountPercentage`).

- **New EventBus events** — `bundle:price-updated`, `selector:price-updated`, and `toggle:price-updated` are emitted after backend price fetches complete, enabling external listeners to react to price changes.

### Improved

- **`BundleSelectorEnhancer` refactor** — extracted `BundleSelectorEnhancer.state.ts` for state construction helpers (`makePackageState`, `getEffectiveItems`, `parseVouchers`). Renderer, handlers, and price files updated to use `BundlePackageState` as the single data source.

### Fixed

- **`BundleSelectorEnhancer` percentage formatting** — discount percentage slots now format correctly; previously the raw decimal was rendered instead of a rounded percentage string.

- **`SimpleExitIntentEnhancer` session key** — storage key renamed from `exit-intent-dismissed` to `next-exit-intent-dismissed` to avoid collisions with non-SDK keys in `sessionStorage`.

## [0.4.3] — 2026-03-30

### New

- **`data-next-upsell-context`** on `PackageSelectorEnhancer` — enables upsell mode so the selector feeds an `UpsellEnhancer` instead of writing to the cart. Prices are fetched with `?upsell=true` automatically.

- **`PackageToggleEnhancer` upsell action** — when toggled inside an upsell context, the enhancer fires the upsell accept action directly, bypassing cart writes.

### Improved

- **`UpsellEnhancer` refactor** — split from a single 1 000-line file into a folder-based structure (`UpsellEnhancer.ts`, `.types.ts`, `.renderer.ts`, `.handlers.ts`, `index.ts`). No behavioral changes.

- **`AcceptUpsellEnhancer` refactor** — moved to `src/enhancers/cart/AcceptUpsell/` folder structure with full guide documentation (`overview.md`, `get-started.md`, `use-cases.md`, `relations.md`, `glossary.md`, `reference/`).

- **`AddToCartEnhancer` refactor** — moved to `src/enhancers/cart/AddToCart/` folder structure with full guide documentation.

- **`CartItemListEnhancer` refactor** — moved to `src/enhancers/cart/CartItemList/` folder structure with full guide documentation.

- **`campaignStore` refactor** — split from a single file into `src/stores/campaignStore/` folder structure (`campaignSlice.api.ts`, `campaignSlice.items.ts`, `campaignSlice.variants.ts`, `campaignStore.types.ts`) with full guide documentation. Import path unchanged via `index.ts`.

- **Display enhancers cleanup** — `CartDisplayEnhancer`, `ProductDisplayEnhancer`, `SelectionDisplayEnhancer`, and `ConditionalDisplayEnhancer` simplified; `DisplayEnhancerTypes` consolidated.

- **`CartCalculator` refactor** — internal implementation simplified; public API unchanged.

- **Guide documentation** — added structured guide folders for `BundleSelectorEnhancer`, `CartSummaryEnhancer`, `PackageSelectorEnhancer`, `PackageToggleEnhancer`, `UpsellEnhancer`, and `campaignStore`.

### Fixed

- **`BundleSelectorEnhancer` slot rendering** — price slots now reflect the final cart state after a variant change instead of the pre-change state.

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
