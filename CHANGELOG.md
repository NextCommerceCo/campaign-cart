# Changelog

## [0.4.12] — 2026-04-09 — BundleSelector Shipping Method Support

### New

- **`data-next-shipping-id` attribute on bundle cards** — when set on a bundle card (or provided as `shippingId` in the `data-next-bundles` JSON), the specified shipping method is automatically applied via `cartStore.setShippingMethod()` after the bundle items are written to the cart in swap mode. Not applied in select mode or upsell context.

  **Manual card:**
  ```html
  <div data-next-bundle-card
       data-next-bundle-id="premium"
       data-next-bundle-items='[{"packageId":101,"quantity":1}]'
       data-next-shipping-id="2">
  </div>
  ```

  **Auto-rendered via JSON:**
  ```html
  <div data-next-bundle-selector
       data-next-selector-id="skincare"
       data-next-selection-mode="swap"
       data-next-bundles='[
         {
           "id": "basic-set",
           "shippingId": "2",
           "items": [{"packageId":1,"quantity":1}],
           "selected": true
         },
         {
           "id": "premium-set",
           "shippingId": "5",
           "items": [{"packageId":1,"quantity":3}]
         }
       ]'>
  </div>
  ```

- **`shippingId` field in `BundleDef` object** — auto-rendered bundles (`data-next-bundles`) now accept `shippingId` as an optional string field. The value is rendered as `data-next-shipping-id` on the card element.

### Fixed

- **`calculateTotals` now uses the selected shipping method** — previously hardcoded to `shippingMethod: 1`, ignoring the user's selection. Now reads `state.shippingMethod?.id ?? 1` so the calculate API receives the actual shipping method.
- **Shipping not applied when bundle swap fails** — `applyBundle` now returns `boolean` success status; `setShippingMethod` is only called when the cart write succeeds.
- **Unhandled promise rejections in `setShippingMethod`** — the handler now wraps `cartStore.setShippingMethod()` in try/catch with `logger.error`, preventing silent failures on both card click and init paths.

---

## [0.4.11] — 2026-04-09 — Cart Summary Display Refactor & Package Toggle Fix

### Breaking

- **`data-include-discounts` attribute removed from cart display** — the attribute is no longer parsed. Use a separate `data-next-display="cart.totalDiscount"` element and hide it with the `.next-no-discounts` state class instead.
- **`cart-summary.*` display path removed** — `data-next-display="cart-summary.subtotal"` no longer falls back to `cart.subtotal`. Use the `cart.*` namespace directly.
- **Deprecated cart display properties removed** — `currencyCode`, `currencySymbol`, and the `.raw` suffix on numeric properties (`subtotal.raw`, `total.raw`, `totalDiscount.raw`, `shipping.raw`) are no longer supported. Use `currency` for the currency code, and read raw numbers from the cart store directly.
- **`{item.discountPercentage}` token now includes the `%` symbol** — renders `"25%"` / `"0%"` instead of the bare integer (`"25"` / `"0"`). Update any CSS or JS that parsed the bare value.
- **`shippingDiscountPercentage` cart display now includes `%`** — renders `"25%"` instead of `"25"`.
- **`{item.price}` and `{item.originalPrice}` now show line totals, not per-unit prices** — inside `[data-summary-lines]` row templates and the raw `item.*` condition context, `{item.price}` is now the line total (`quantity × unit price` after discounts) and `{item.originalPrice}` is the line subtotal (`quantity × original unit price` before discounts). Previously both showed the per-unit price. Use `{item.unitPrice}` and `{item.originalUnitPrice}` for per-unit values. Templates that expected a single-unit value will now show the full line total.
- **`{line.*}` namespace cleaned up** — `{line.*}` is now a 1:1 alias of `{item.*}` (see "New" below), so templates using `{line.price}` (which used to be the per-unit price) now resolve to the line total, and `{line.subtotal}` now resolves to the line subtotal. The following old names are no longer recognized and will render as empty strings: `{line.qty}`, `{line.priceTotal}`, `{line.packagePrice}`, `{line.originalPackagePrice}`, `{line.totalDiscount}`, `{line.priceRetail}`, `{line.priceRetailTotal}`, `{line.priceRecurring}`, `{line.priceRecurringTotal}`, `{line.hasSavings}`. See [the migration table](src/enhancers/cart/CartSummary/guide/reference/object-attributes.md) for replacements.

### New

- **More cart summary template variables** — the following `{token}` placeholders are now available inside custom cart summary `<template>` markup:

  | Token | Description |
  |---|---|
  | `{currency}` | Active currency code (e.g. `"USD"`) |
  | `{shippingName}` | Display name of the selected shipping method |
  | `{shippingCode}` | Code of the selected shipping method |
  | `{shippingDiscountAmount}` | Absolute discount applied to shipping |
  | `{shippingDiscountPercentage}` | Shipping discount as a formatted percentage |
  | `{totalDiscount}` | Combined offer and voucher discount amount (canonical name; `{discounts}` kept as alias) |
  | `{totalDiscountPercentage}` | Combined discount as a formatted percentage of subtotal |
  | `{totalQuantity}` | Total unit quantity across all cart lines |
  | `{isCalculating}` | `"true"` / `"false"` — totals recalculation in progress |
  | `{isEmpty}` | `"true"` / `"false"` — cart has no items |
  | `{isFreeShipping}` | `"true"` / `"false"` — shipping cost is zero |
  | `{hasShippingDiscount}` | `"true"` / `"false"` — a shipping discount is applied |
  | `{hasDiscounts}` | `"true"` / `"false"` — any discount is applied |

- **Currency-aware price formatting** — every monetary token is now formatted using the active currency. The currency is resolved from the campaign currency first, then the user-selected currency, then the auto-detected currency, falling back to `"USD"`. Previously prices were formatted without an explicit currency.

- **More cart display properties** — `data-next-display="cart.{property}"` now exposes `totalDiscountPercentage`, `totalQuantity`, `shippingName`, `shippingCode`, `shippingDiscountAmount`, and `shippingDiscountPercentage`. The two `*Percentage` properties render with the `%` symbol.

- **`{line.*}` alias namespace** — every `{item.X}` token and `item.X` condition property is also reachable as `{line.X}` / `line.X`. The two namespaces are 1:1 equivalents — pick whichever vocabulary fits your mental model (`item` for the cart-shopper view, `line` for the invoice/order-row view). Conditions like `data-next-show="line.quantity > 1"` work identically to `data-next-show="item.quantity > 1"`. Legacy names removed in this release (`{line.qty}`, `{line.priceTotal}`, `{line.packagePrice}`, etc.) are **not** restored — see the Breaking note above and the migration table in [reference/object-attributes.md](src/enhancers/cart/CartSummary/guide/reference/object-attributes.md).

- **Malformed-condition warnings** — when a per-line `data-next-show` / `data-next-hide` expression fails to parse or evaluate, the warning is now surfaced through the cart summary logger so template authors can spot broken conditions in the console.

- **New summary line fields** — `original_recurring_price` and `currency` added to the summary line shape. Line-level currency formatting now uses the per-line `currency`, and two new template tokens are available: `{item.originalRecurringPrice}` and `{item.currency}`.

- **Per-line `data-next-show` / `data-next-hide` inside cart summary templates** — line and discount templates now support local conditional rendering against the `item.*` and `discount.*` namespaces. Conditions are evaluated per row at render time using raw line / discount data (real numbers, real booleans), so comparison operators behave as expected. Hidden elements are removed from the DOM and the attributes are stripped, so the global conditional display flow does not double-process them.

  Use the no-braces syntax — write `item.quantity > 1`, not `{item.quantity} > 1`. Supported operators: `>`, `>=`, `<`, `<=`, `==`, `===`, `!=`, `!==`, `&&`, `||`, `!`, parentheses.

  **Example — final price with the original struck through (only on discounted lines):**

  ```html
  <ul data-summary-lines>
    <template>
      <li class="line-item">
        <span class="name">{item.name}</span>
        <span class="qty">×{item.quantity}</span>
        <span class="price-current">{item.unitPrice}</span>
        <s class="price-original" data-next-show="item.hasDiscount">{item.originalUnitPrice}</s>
      </li>
    </template>
  </ul>
  ```

  **Example — savings amount and percentage badge per line:**

  ```html
  <ul data-summary-lines>
    <template>
      <li class="line-item">
        <span class="name">{item.name}</span>
        <span class="qty">×{item.quantity}</span>

        <div class="line-savings" data-next-show="item.hasDiscount">
          <span class="savings-amount">−{item.discountAmount}</span>
          <span class="savings-pct">{item.discountPercentage} off</span>
        </div>
      </li>
    </template>
  </ul>
  ```

  Use `data-next-show="item.discountPercentage >= 20"` if you want the badge to appear only when the discount is meaningful.

  **Example — full receipt row combining final, original, savings, and per-unit pricing:**

  ```html
  <ul data-summary-lines>
    <template>
      <li class="line-item">
        <img src="{item.image}" alt="{item.name}" />

        <div class="line-details">
          <span class="name">{item.name}</span>
          <span class="qty">{item.quantity} × {item.unitPrice}</span>
          <span class="qty-original" data-next-show="item.hasDiscount">
            was {item.originalUnitPrice} per unit
          </span>
        </div>

        <div class="line-pricing">
          <span class="line-total">{item.price}</span>
          <s class="line-original" data-next-show="item.hasDiscount">{item.originalPrice}</s>
          <span class="line-savings" data-next-show="item.hasDiscount">
            You save {item.discountAmount} ({item.discountPercentage})
          </span>
        </div>
      </li>
    </template>
  </ul>
  ```

  **Example — recurring (subscription) line with frequency, recurring price, and "one-time" fallback:**

  ```html
  <ul data-summary-lines>
    <template>
      <li class="line-item">
        <img src="{item.image}" alt="{item.name}" />

        <div class="line-details">
          <span class="name">{item.name}</span>
          <span class="qty">×{item.quantity}</span>

          <span class="recurring-badge" data-next-show="item.isRecurring">
            🔁 {item.frequency} · then {item.recurringPrice}
          </span>
          <span class="one-time-badge" data-next-hide="item.isRecurring">
            One-time purchase
          </span>
        </div>

        <span class="line-total">{item.price}</span>
      </li>
    </template>
  </ul>
  ```

  `{item.frequency}` resolves to `"Daily"`, `"Monthly"`, `"Every 7 days"`, `"Every 3 months"`, etc. `{item.recurringPrice}` is currency-formatted and empty when the line is not recurring. The two badges are mutually exclusive — `data-next-show="item.isRecurring"` and `data-next-hide="item.isRecurring"` are evaluated independently per line, so exactly one renders.

  Conditions referencing other namespaces (e.g. `cart.hasItems`) are passed through untouched and processed by the global conditional display flow. Cart-wide conditions are best placed *outside* the line template to avoid thrashing on cart re-renders. Function-call conditions (`item.hasFlag(x)`) are not handled locally.

- **Raw `item.*` and `discount.*` condition contexts** — both expose unformatted fields (real numbers, real booleans). `item.hasDiscount` is a boolean here (not the `'show'` / `'hide'` string used by the matching text token); `discount.amount` is a number while `discount.amountFormatted` keeps the original currency-formatted string. Full field reference: [reference/object-attributes.md](src/enhancers/cart/CartSummary/guide/reference/object-attributes.md).

### Fixed

- **Package toggle card display now uses live selection state** — toggle card slots used to read the `data-next-selected` DOM attribute, which could lag behind the in-memory state when the toggle changed mid-render, causing slots to render with a stale selection flag. They now read the live selection state directly.

- **`{item.discountPercentage}` now includes `%`** — previously rendered as a bare integer (`"25"`). Now produces `"25%"` for consistency with other percentage tokens.

- **Cart summary line price tokens showed wrong amounts on multi-quantity rows** — `{item.price}` and `{item.originalPrice}` were reading the per-unit price, so a quantity-3 line showed the price of a single unit instead of the full line total. They now read the line totals so the rendered values match what the cart actually charges. Guide files (`reference/attributes.md`, `reference/object-attributes.md`, `use-cases.md`) updated to describe the new line-total semantics.

### Tests

- Significantly expanded unit test coverage for the cart summary renderer, cart display properties, package toggle renderer, and per-line condition evaluation (44 new condition tests). Includes regression coverage for the multi-quantity line-total fix.

## [0.4.10] — 2026-04-03 — PackageToggle Display Slots & Pricing Refactor

### Breaking

- **`PackageToggleDisplayEnhancer` property names changed** — the set of properties available on `data-next-display="toggle.{packageId}.{property}"` has been renamed to align with the `TogglePriceSummary` shape:

  | Old property | New property |
  |---|---|
  | `isInCart` | `isSelected` |
  | `hasSavings` | `hasDiscount` |
  | `compare` | `originalPrice` |
  | `savings` | `discountAmount` |
  | `savingsPercentage` | `discountPercentage` |

  Any `data-next-display` bindings using the old names must be updated.

- **`PackageToggleDisplayEnhancer` listens to `toggle:selection-changed` instead of `toggle:toggled`** — the display enhancer now subscribes to `toggle:selection-changed` for `isSelected` updates. Custom code that dispatched `toggle:toggled` to drive display updates must switch to emitting `toggle:selection-changed`.

### New

- **`data-next-toggle-display` attribute** — new primary display slot attribute for toggle cards. Replaces `data-next-toggle-price`. Accepts the same field names plus the following additions:

  | Value | Effect |
  |---|---|
  | `"name"` | Package display name from the campaign store |
  | `"isSelected"` | Shown (`display: ""`) when `data-next-selected` was `"true"` at last price update; hidden (`display: none`) otherwise |
  | `"hasDiscount"` | Shown when a discount applies; hidden otherwise |
  | `"isRecurring"` | Shown when the package bills on a recurring schedule; hidden otherwise |

  All price values are formatted using the currency stored in `TogglePriceSummary` (set from `campaignStore.currency`, updated by the price fetch response). `discountPercentage` now uses `formatPercentage` for consistent formatting.

- **`PackageToggleDisplayEnhancer` expanded property set** — the companion display enhancer (`data-next-display="toggle.{packageId}.{property}"`) now exposes the full `TogglePriceSummary` shape: `isSelected`, `name`, `price`, `unitPrice`, `originalPrice`, `originalUnitPrice`, `discountAmount`, `discountPercentage`, `hasDiscount`, `isRecurring`, `recurringPrice`, `interval`, `intervalCount`, `frequency`, `currency`.

- **`TogglePriceSummary` interface** — the price shape used by `ToggleCard` is now a named interface in `PackageToggleEnhancer.types.ts`. Fields: `price`, `unitPrice`, `originalPrice`, `originalUnitPrice`, `discountAmount`, `discountPercentage`, `hasDiscount`, `currency`, `isRecurring`, `recurringPrice`, `interval`, `intervalCount`, `frequency`.

- **`ToggleCardPublicState` interface** — typed shape for the value returned by `PackageToggleEnhancer.getToggleState()`: `name`, `isSelected`, `togglePrice`.

- **`PackageToggleEnhancer.state.ts`** — new file exporting `makeTogglePriceSummary(pkg)`. Builds a provisional `TogglePriceSummary` from campaign package data at card registration so display slots render immediately before the async price fetch resolves.

- **`ToggleCard.name` and `ToggleCard.isSelected` fields** — the card registration shape now carries the package display name and a live `isSelected` flag, read by `updateCardDisplayElements` on every price update.

### Deprecated

- **`data-next-toggle-price`** — kept for backward compatibility. Accepts the same field names as `data-next-toggle-display` and produces identical output. Prefer `data-next-toggle-display` in new markup.

### Tests

- **`PackageToggleEnhancer` renderer unit tests updated** — `renderer.test.ts` updated to cover `updateCardDisplayElements` (renamed from `renderTogglePriceSlots`), the `data-next-toggle-display` path, and the new `formatPercentage` mock.

## [0.4.9] — 2026-04-03 — Pricing Model Refactor & Unit Tests

### Breaking

- **`BundlePriceSummary` fields renamed and typed as `Decimal`** — all numeric price fields on the summary object returned by `fetchAndUpdateBundlePrice` are now `Decimal` instances (from `decimal.js`) and have been renamed for consistency:

  | Old field | New field |
  |---|---|
  | `total` | `price` |
  | `subtotal` | `originalPrice` |
  | `totalDiscount` | `discountAmount` |
  | `totalDiscountPercentage` | `discountPercentage` |

  Any code that reads these fields directly must call `.toNumber()` to get a plain number, and update field names accordingly.

- **`BundlePackageState` price fields renamed and typed as `Decimal`** — the per-package state shape used internally by `BundleSelectorEnhancer` follows the same rename. `hasSavings` is removed; use `hasDiscount` instead. `unitPrice`, `packagePrice`, `originalUnitPrice`, `originalPackagePrice`, `totalDiscount`, `subtotal`, and `total` are replaced with `price`, `originalPrice`, `discountAmount`, `discountPercentage`, `unitPrice`, and `originalUnitPrice` (all `Decimal`).

- **Deprecated bundle display keys removed** — the following `data-next-bundle-display` slot keys are no longer supported: `compare`, `savings`, `savingsPercentage`, `hasSavings`. Use `originalPrice`, `discountAmount`, `discountPercentage`, and `hasDiscount` respectively.

- **Deprecated slot template variables removed** — `{item.priceTotal}`, `{item.packagePrice}`, `{item.originalPackagePrice}`, `{item.totalDiscount}`, `{item.subtotal}`, `{item.total}`, and `{item.hasSavings}` are no longer injected into slot templates. See the new variable list below.

### New

- **`BundlePriceSummary` `unitPrice` and `originalUnitPrice` fields** — previously documented as "coming soon", these are now fully implemented. Both are `Decimal` values equal to the bundle total price divided by the total visible slot quantity.

- **`BundlePriceSummary` `quantity`, `hasDiscount`, and `currency` fields** — the summary now carries the total slot quantity, a boolean discount flag, and the ISO 4217 currency code returned by the price fetch API.

- **`BundlePackageState` recurring price fields** — `recurringPrice`, `originalRecurringPrice`, `interval` (`'day' | 'month' | null`), `intervalCount` (`number | null`), and `currency` are now part of the per-package state. Values are seeded from campaign data and updated after each price fetch.

- **New slot template variables** — available inside `{curly.brace}` syntax in bundle slot templates:

  | Variable | Description |
  |---|---|
  | `{item.price}` | `unitPrice × slot.quantity`, formatted with currency |
  | `{item.originalPrice}` | `originalUnitPrice × slot.quantity`, formatted with currency |
  | `{item.unitPrice}` | Per-unit price, formatted with currency |
  | `{item.originalUnitPrice}` | Per-unit original price, formatted with currency |
  | `{item.discountAmount}` | `(originalUnitPrice − unitPrice) × slot.quantity`, formatted |
  | `{item.discountPercentage}` | Discount percentage, formatted |
  | `{item.recurringPrice}` | Recurring price, formatted with currency |
  | `{item.originalRecurringPrice}` | Original recurring price, formatted with currency |
  | `{item.currency}` | ISO 4217 currency code |
  | `{item.interval}` | Billing interval (`day`, `month`) |
  | `{item.intervalCount}` | Billing interval count |
  | `{item.frequency}` | Human-readable frequency string, e.g. `Per month`, `Every 3 months`, `One time` |

- **`currency` bundle display key** — `data-next-bundle-display="bundle.{selectorId}.currency"` renders the ISO 4217 currency code for the selected bundle.

- **Currency-aware price formatting** — all price slots and slot template variables are formatted using the currency code stored in the package state (seeded from `campaignStore.currency`, updated by the price fetch response). Prices no longer re-read the store at render time.

### Fixed

- **`PackageToggleEnhancer` state class cleanup on destroy** — when the enhancer is destroyed, `next-in-cart`, `next-not-in-cart`, `next-active`, and `os--active` CSS classes and `data-in-cart` / `data-next-active` attributes are now removed from `stateContainer` when it differs from the card element. Previously these classes were left on the DOM after the enhancer was torn down.

- **`PackageToggleEnhancer` `destroy()` order** — `super.destroy()` is now called at the end of `destroy()`, after local cleanup, matching the lifecycle contract expected by `BaseEnhancer`.

- **`PackageToggleEnhancer` `campaignStore` package lookup** — `useCampaignStore.getState().data?.packages` replaced with `useCampaignStore.getState().packages` to use the flat store accessor and avoid an unnecessary optional chain.

- **`PackageToggleEnhancer` TypeScript `emit` context** — the `emit` function on `ToggleHandlerContext` is now typed against `EventMap` instead of `(event: string, detail: unknown) => void`. This removes the `as any` casts at call sites and enables compile-time event payload checking.

### Tests

- **`BundleSelectorEnhancer` unit tests** — added `tests/buildSlotVars.test.ts`, `tests/handlers.test.ts`, `tests/price.test.ts`, `tests/renderer.test.ts`, and `tests/state.test.ts` covering slot variable construction, card click handlers, price fetch and Decimal arithmetic, renderer output, and package state initialization.

- **`PackageToggleEnhancer` unit tests** — added `tests/handlers.test.ts`, `tests/price.test.ts`, and `tests/renderer.test.ts` covering card click handling, sync quantity logic, upsell context, price fetch, and renderer state updates.

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
