# Changelog

## [0.4.8] — 2026-04-02

### Breaking

- **Bundle event payloads use `selectorId` instead of `bundleId`** — `bundle:selected`, `bundle:selection-changed`, and `bundle:price-updated` events now carry `selectorId` (the value of `data-next-selector-id`) instead of `bundleId`. Update any listeners that destructure `bundleId` from these events.

- **`CartItem.bundleId` renamed to `selectorId`** — the field that tags cart items to a `BundleSelectorEnhancer` instance is now `selectorId`. Cart filtering and swap logic inside the handlers use this field; direct reads of `item.bundleId` in custom code must be updated to `item.selectorId`.

### Fixed

- **`BundleSelectorEnhancer` concurrent-click guard** — `handleCardClick` now checks `isApplyingRef` before proceeding, preventing a second card click from starting a parallel cart write while the first is still in flight.

- **`BundleSelectorEnhancer` voucher revert on `applyBundle` error** — when a cart write fails after a card switch, vouchers are now swapped back to the previous state so the cart and the displayed selection stay consistent.

- **`BundleSelectorEnhancer` slot revert on `applyEffectiveChange` error** — when a variant-driven cart swap fails, slot `activePackageId` values are reset to their pre-change snapshot and a `bundle:selection-changed` event is emitted so the UI reflects the actual cart state.

- **`BundleSelectorEnhancer` `syncWithCart` uses `selectorId` for item matching** — cart items are now matched against `item.selectorId === this.selectorId` instead of `item.bundleId === card.bundleId`. This prevents a package shared across two selectors from incorrectly marking the wrong selector's card as in-cart.

### Tests

- **`BundleSelectorEnhancer` `applyBundle` unit tests** — added `tests/applyBundle.test.ts` covering successful bundle swap, error recovery (UI revert and voucher revert), and the concurrent-click guard.

## [0.4.7] — 2026-04-02

### New

- **`BundleSelectorEnhancer` upsell context** (`data-next-upsell-context`) — when set, the bundle selector operates in post-purchase upsell mode. Cart writes are disabled, mode is forced to `select`, prices are fetched with `?upsell=true`, and the element exposes `_getSelectedBundleItems()` and `_getSelectedBundleVouchers()` DOM methods for use by `AcceptUpsellEnhancer` and `UpsellEnhancer`. The default card is auto-selected on initialization.

- **`AcceptUpsellEnhancer` bundle support** (`data-next-upsell-action-for`) — links the accept button to a `BundleSelectorEnhancer` by its `data-next-selector-id`. On click, the button reads the selected bundle items via `_getSelectedBundleItems()`, submits them as a multi-line upsell order, and emits `upsell:accepted` for each item.

- **`UpsellEnhancer` bundle selector integration** — auto-detects a child `[data-next-bundle-selector]` element or reads `data-next-bundle-selector-id`. When detected, the add-upsell action submits all selected bundle items including their associated vouchers.

- **`BundleSelectorEnhancer` variant selector rendering options** — two new attributes on variant selector containers:
  - `next-render-swap="outerHTML"` — rendered fields replace the container element entirely instead of populating its `innerHTML`
  - `next-render-no-label` — suppresses the auto-generated label element

- **`BundleSelectorEnhancer` `getBundleState()` selector fallback** — when the `bundleId` parameter matches a selector's `data-next-selector-id`, the method now returns the currently selected card's state. Enables `bundle.{selectorId}.property` display keys to always reflect the active selection across all `BundleDisplayEnhancer` slots.

- **`AddUpsellLine` `vouchers` field** — the API request type now accepts an optional `vouchers?: string[]` field so bundle-managed vouchers can be submitted with the upsell request.

### Fixed

- **`BundleSelectorEnhancer` `bundle:selection-changed` not emitted on no-op variant change** — when a variant change resolved to the same `activePackageId` (user re-selects the current variant), the event was silently dropped. It is now always emitted so dependent listeners (`AcceptUpsellEnhancer`, `UpsellSelector`) still update their state.

- **`BundleSelectorEnhancer` configurable slot blocking submission** — slots now track `configurable` and `variantSelected` flags. `_getSelectedBundleItems()` returns `null` when any configurable slot has not yet had a variant explicitly selected, preventing premature upsell submission. Slots whose initial package already has specific variant attribute values are pre-marked as selected.

- **`BundleSelectorEnhancer` `bundle:price-updated` on selection change** — when a card is selected and a `data-next-selector-id` is set, a `bundle:price-updated` event is now dispatched so `BundleDisplayEnhancer` slots using `bundle.{selectorId}.property` immediately reflect the new selection's price.

- **`ProductDisplayEnhancer` and `QuantityTextEnhancer` container lookup** — changed from `[data-next-upsell="offer"]` to `[data-next-upsell]` so quantity display resolution works for any value of the `data-next-upsell` attribute, not only `"offer"`.

- **`UpsellEnhancer` quantity sync container query** — `syncQuantityAcrossContainers` now queries `[data-next-upsell]` instead of `[data-next-upsell="offer"]`, matching the display enhancer fix above.

- **`UpsellSelector` debug widget bundle mode** — the debug overlay now detects bundle mode (via child `[data-next-bundle-selector]` or `data-next-bundle-selector-id`), renders selected bundle items with package names and quantities, and updates on `bundle:selection-changed` events.

## [0.4.6] — 2026-04-01

### Removed

- **Profile system** — `ProfileManager`, `ProfileSwitcherEnhancer`, `ProfileMapper`, `profileStore`, and `configStore` have been removed. Profile mapping logic has been stripped from `cartSlice.api.ts` (`addItem`, `swapPackage`). These APIs were deprecated and are no longer supported.

### Fixed

- **`BundleSelectorEnhancer` variant select** — variant changes in external slot containers now always trigger a re-render. Previously, the shared `slotVarsCache` caused external containers (those not inside the card's own placeholder) to be silently skipped after the first internal render had already populated the cache. Cache writes and reads are now scoped to internal renders only.

- **`BundleSelectorEnhancer` variant field data attributes** — `data-next-variant-code`, `data-next-variant-name`, `data-next-bundle-id`, and `data-next-slot-index` are now set on the variant field wrapper element. This ensures the changed select's value is correctly resolved when the `<select>` element is in an external slot container that is not a descendant of `slotEl`.

- **`BundleSelectorEnhancer` removed legacy price data attributes** — `data-bundle-price-total`, `data-bundle-price-compare`, `data-bundle-price-savings`, and `data-bundle-price-savings-pct` are no longer written to the card element after a price fetch. Use `data-next-bundle-display` slots instead.

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
