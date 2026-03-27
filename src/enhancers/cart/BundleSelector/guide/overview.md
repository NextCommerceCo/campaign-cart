# BundleSelectorEnhancer

> Category: `cart`
> Last reviewed: 2026-03-27
> Owner: campaign-cart

A container that lets a developer define named bundles — each bundle being a fixed set of packages and quantities — and lets a visitor pick one. In swap mode, selecting a bundle atomically replaces the previous bundle's cart items while leaving unrelated cart items untouched. Bundle vouchers are applied and removed automatically as the selection changes.

## Concept

Each bundle is a card element the enhancer registers, tracks, and updates as the cart or prices change. Exactly one bundle is selected at all times. When a visitor clicks a card, the previous card loses its selected state and the new card gains it. In swap mode, the enhancer also writes to the cart — removing all items that belong to the previous bundle and adding the new bundle's items in a single `swapCart` call.

The key difference from `PackageSelectorEnhancer` is that a bundle card can hold **multiple packages** with independent quantities and, optionally, per-unit variant selection. A "3 bottles + free shaker" offer is a single bundle card, not three separate selectable packages.

```
User clicks a bundle card
        │
        ▼
 handleCardClick()
 ├── selectCard()
 │   ├── update CSS classes (next-selected)
 │   ├── set data-next-selected="true"
 │   ├── set data-selected-bundle on container
 │   └── emit bundle:selection-changed
 ├── applyVoucherSwap() — if either bundle has vouchers
 └── mode = swap?
     ├── YES → applyBundle()
     │         ├── strip previous bundle's items from cart
     │         ├── add new bundle's items (tagged with bundleId)
     │         └── cartStore.swapCart([retained + new])
     └── NO  → wait for external action
```

When a configurable slot's variant changes:

```
Visitor changes variant (select or custom option)
        │
        ▼
 applyVariantChange()
 ├── resolve matching package from campaign data
 ├── update slot.activePackageId
 ├── re-render slots
 ├── mode = swap? → applyEffectiveChange() (cart sync)
 └── fetchAndUpdateBundlePrice()
```

## Business logic

- Exactly one bundle card is selected at all times. There is no "none selected" state after initialization.
- On init, the first card with `data-next-selected="true"` is pre-selected and, in swap mode, its items are immediately added to the cart.
- In swap mode, bundle items are tagged in the cart with a `bundleId`. When a different bundle is selected, only the items sharing the previous bundle's `bundleId` are removed; unrelated cart items (upsells, standalone packages) are preserved.
- Vouchers declared on a bundle card via `data-next-bundle-vouchers` are automatically applied when that bundle is selected and removed when it is deselected. Vouchers shared between two bundles are not re-applied or re-removed. User-applied coupons (not bundle vouchers) are always preserved.
- A `BundleItem` with `configurable: true` and `quantity > 1` is expanded into one slot per unit so the visitor can independently choose a variant (size, color) for each unit.
- A `BundleItem` with `noSlot: true` is added to the cart silently without rendering a slot row. Use this for free gifts or add-ons that should not be visible in the slot list.
- Variant selection within a slot resolves a matching package from the campaign store by matching all attribute values. If no package matches the selected attribute combination, the change is logged as a warning and ignored.
- Unavailable variant options (package `product_purchase_availability === 'unavailable'`) are marked with `next-variant-unavailable` and `data-next-unavailable="true"` and are not selectable.
- Price previews are fetched for all cards on init and re-fetched on currency change and on checkout voucher change (both debounced 150ms). During fetch, the card element gets `data-next-loading="true"` and class `next-loading`.
- Price comparison uses the campaign package `price_retail` as the compare-at value, not the API's compare total, so savings reflects the true retail-to-current-price difference.
- If a cart write fails (network error or API rejection), the enhancer reverts the visual selection to match the actual cart state.
- Dynamic cards added to the DOM after init are registered automatically via a mutation observer.

## Decisions

- We chose to tag cart items with `bundleId` (rather than tracking them by package ID alone) because multiple bundles can share the same package. Without the tag, the enhancer could not determine which items belonged to the previous bundle when performing a swap.
- We chose `swapCart` (full cart replace, keeping non-bundle items) over individual add/remove calls because it is a single API round trip and avoids partial-state windows where the old bundle is removed but the new one is not yet added.
- We chose to revert visual state on cart write failure so the UI always reflects the actual cart, preventing a mismatch where the card appears selected but its items are not in the cart.
- We chose `configurable` as a per-item opt-in rather than auto-expanding all multi-quantity items, because most bundles with qty > 1 want a single slot (e.g., "6 bottles of the same product"), and expanding them all into individual slots would require template changes most implementations don't need.
- We chose to debounce currency and voucher re-fetches by 150ms to avoid one price API call per card per rapid change event.

## Limitations

- Does not support multi-select (choosing more than one bundle simultaneously). Use independent `PackageToggleEnhancer` instances per item for additive cart behavior.
- Does not support nested bundle selectors. Placing a `BundleSelectorEnhancer` inside another bundle card is not tested or supported.
- Variant resolution requires that all variant packages for a product exist in the campaign store. If only some variants are included in the campaign, unavailable combinations cannot be detected accurately.
- Slots are re-rendered on every cart store update (when `slotTemplate` is configured). Do not attach event listeners to slot elements directly — they are destroyed on every re-render.
- External slots containers (`data-next-bundle-slots-for`) render only the currently selected bundle's slots. Slots for non-selected bundles are not rendered into the external container.
- Price fetching is asynchronous. Until the fetch resolves, `[data-next-bundle-price]` elements show their initial content. There is no built-in skeleton or placeholder state.
- In select mode, if no external action (button or other enhancer) writes to the cart, the bundle is never applied. The enhancer does not warn when this happens.
