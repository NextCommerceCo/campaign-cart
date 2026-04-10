# PackageToggleEnhancer

> Category: `cart`
> Last reviewed: 2026-04-10
> Owner: campaign-cart

A container that lets a user independently add or remove any combination of packages by clicking cards. Each card maps to one package; clicking toggles that package in or out of the cart without affecting any other card's state.

## Concept

The toggle works on one invariant: each card is independently in or out of the cart. There is no concept of "exactly one selected" — any number of cards can be active at the same time. The cart is the source of truth; the enhancer observes cart state and updates every card's visual state to match.

Three usage modes exist:

- **Multi-card container**: place `data-next-package-toggle` on a parent element containing one or more `[data-next-toggle-card]` children. Clicking any card toggles its package.
- **Single-element toggle**: place `data-next-package-toggle` and `data-next-package-id` on a single button or element. The element itself is the card.
- **Upsell context**: add `data-next-upsell-context` to the container. Clicks add the package to the post-purchase order (via `orderStore`) rather than the cart. The enhancer does not read cart state in this mode.

```
User clicks card
       │
       ▼
 handleCardClick()
 ├── upsell context? → addUpsell() via orderStore → emit upsell:added
 │                                                  emit toggle:toggled
 └── normal context
     ├── in cart? → removeItem() → emit toggle:toggled {added:false}
     └── not in cart? → addItem() → emit toggle:toggled {added:true}
             │
             ▼
     cartStore update → syncWithCart()
     ├── update CSS classes per card (next-in-cart / next-not-in-cart)
     ├── update button text (add/remove text)
     ├── update price slots from cart summary line
     └── emit toggle:selection-changed {selected:[...packageIds]}
```

## Business logic

- Any combination of cards can be active simultaneously. There is no mutual exclusion between cards.
- On init, any card with `data-next-selected="true"` is auto-added to the cart. Each package is auto-added at most once per page load, even if multiple elements on the page reference the same `packageId`.
- In sync mode (`data-next-package-sync`), a card's quantity is derived from the sum of quantities of the listed synced packages. The sync card is added when any synced package is in the cart, and removed when all synced packages are removed.
- For sync cards marked as upsell items, removal on sync loss is deferred by 500 ms to avoid race conditions during package swaps.
- The price displayed on a card is always the price the customer will pay if that package is in the cart. For cards not yet in the cart, this is fetched from `/calculate` with the package simulated alongside current cart items — so bundle or volume discounts are correctly reflected. For cards already in the cart, the price is read directly from the cart summary line (no extra API call). Both paths produce the same price: what's shown is what's charged.
- Boolean display slots (`hasDiscount`, `isRecurring`, `isSelected`) show or hide the element rather than writing text. The `image` display slot sets `src` on `<img>` elements.
- Display slots cover the full card data: package metadata (`packageId`, `name`, `image`, `quantity`, `productId`, `variantId`, `variantName`, `productName`, `sku`), all price fields, boolean visibility fields, and recurring billing fields.
- In auto-render mode, all card fields (including provisional prices from campaign data) are available as `{toggle.*}` template placeholders. `data-next-toggle-display` slots inside the rendered card still receive live, cart-aware prices after each fetch.
- Card templates support `data-next-show` and `data-next-hide` for conditional visibility based on template variables (e.g. `data-next-show="hasDiscount"`). These are evaluated locally at render time; store-based conditions are left for the global `ConditionalDisplayEnhancer`.
- Vouchers applied in the checkout store cause a price recalculation for all cards.
- Currency changes trigger a debounced (150 ms) price refetch for all cards.
- In upsell context, the click handler checks `orderStore.canAddUpsells()` before proceeding. If upsells are not available, it navigates to `data-next-url` (or the meta fallback) instead of throwing an error.
- After a successful upsell add, the enhancer navigates to `data-next-url` (with a 100 ms delay to allow the event to propagate).
- Dynamic cards added to the DOM after init are registered automatically via a mutation observer.

## Decisions

- We chose independent per-card state over mutual exclusion because the primary use case is add-on products (extended warranty, accessories) where any combination makes sense.
- We chose `cartStore` as the source of truth rather than tracking selected state internally so that external cart mutations (another enhancer, a remove button) are reflected without any additional coordination.
- We chose a module-level `autoAddedPackages` set (not per-instance) to prevent two `PackageToggleEnhancer` instances on the same page from both auto-adding the same package on init.
- We chose to defer sync-card removal by 500 ms for upsell items because a package swap briefly removes the synced package before adding the replacement, which would otherwise falsely trigger removal.
- We chose to calculate prices by merging the toggle package with current cart items (not standalone) so that any bundle pricing rules apply correctly to the preview price.
- We chose to flatten all price fields directly onto `ToggleCard` (instead of a nested `TogglePriceSummary`) to eliminate null checks throughout the rendering pipeline. Price fields are always initialized from `makeProvisionalPrices` at registration time.
- We chose to share the `applySlotConditionals` utility with `BundleSelectorEnhancer` so that `data-next-show`/`data-next-hide` behaves identically in both template systems.

## Limitations

- Does not support mutual exclusion between cards. If you need "pick exactly one", use `PackageSelectorEnhancer`.
- In upsell context, toggle state is one-way: packages can be added but not removed through the toggle (there is no "un-upsell" flow).
- Auto-render (`data-next-packages`) requires both `data-next-packages` and a template (`data-next-toggle-template-id` or `data-next-toggle-template`) to be present. Providing only one silently skips rendering.
- Display slots show stale values until the `calculateBundlePrice` async fetch resolves. There is no built-in skeleton or placeholder state.
- `data-next-toggle-display="isSelected"` reflects the `data-next-selected` attribute at the time of the last price update, not live cart state. For an element that toggles visibility based on whether the package is currently in the cart, use `data-next-display="toggle.{packageId}.isSelected"` instead.
- `data-next-package-sync` reads quantity from `syncedItem.qty` (an internal cart field). This field is not part of the public cart item interface and may not be set for all packages.
- Sync removal for non-upsell cards is immediate and synchronous; it does not account for in-progress cart operations (`swapInProgress` is checked, but only one level deep).
