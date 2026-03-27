# PackageSelectorEnhancer

> Category: `cart`
> Last reviewed: 2026-03-27
> Owner: campaign-cart

A container that lets a user pick exactly one package from a set of options and, in swap mode, keeps the cart in sync with that selection automatically. Each option is a card element the enhancer registers, tracks, and updates as the cart or prices change.

## Concept

The selector works on a single invariant: exactly one card is selected at all times. When a card is clicked, the previous card loses its selected state and the new card gains it. In swap mode, the enhancer also writes to the cart—adding the new package and removing the old one in a single operation.

The enhancer operates in one of two modes:

- **swap** (default): selecting a card immediately updates the cart. The cart is the source of truth; if the cart already contains one of the selector's packages, that card is auto-selected on init.
- **select**: the enhancer tracks which card is selected but takes no cart action. An external button (typically `AddToCartEnhancer`) reads the selection and performs the cart write.

A third variant is **upsell context** (`data-next-upsell-context`), which forces select mode and skips all cart interactions. The selector acts as a pure UI picker for a post-purchase upsell offer.

```
User clicks card
       │
       ▼
 selectItem()
 ├── update CSS classes (next-selected)
 ├── set data-next-selected="true"
 ├── set data-selected-package on container
 └── emit selector:selection-changed
       │
  mode = swap?
  ├── YES → updateCart() → cartStore.swapPackage() or cartStore.addItem()
  │         setShippingMethod() if card has data-next-shipping-id
  └── NO  → wait for external button
```

## Business logic

- Exactly one card is always selected. There is no "none selected" state after initialization.
- On init, the first card with `data-next-selected="true"` is pre-selected. If none is marked, the first card in the DOM is selected.
- In swap mode, on init, if the cart is empty, the pre-selected package is added to the cart automatically.
- In swap mode, if the cart already contains one of the selector's packages when the enhancer initializes, that card is selected to match.
- In swap mode, if the selected card's quantity changes, the cart quantity is updated immediately.
- If a card has `data-next-shipping-id`, selecting that card sets the shipping method on the cart.
- In upsell context, no cart operations occur. Selection only updates the visual state and emits events.
- Dynamic cards added to the DOM after init are registered automatically via a mutation observer.
- If a selected card is removed from the DOM, the selection is cleared.
- Currency changes trigger a debounced (150ms) price refetch for all cards.
- Voucher changes from the checkout store trigger price recalculation.

## Decisions

- We chose swap mode as the default because the most common campaign pattern is one selector driving the cart directly, with no intermediate add-to-cart button.
- We chose to auto-select the in-cart package on init rather than showing a mismatch, because showing the wrong card as selected when the cart already has a package is confusing to the user.
- We chose mutation observers over static registration so that templates rendered asynchronously (e.g., auto-render from `data-next-packages`) are picked up without requiring a re-init.
- We chose `_getSelectedItem()` as a method on the DOM element rather than an EventBus query so that `AddToCartEnhancer` can read selection synchronously without waiting for an event.
- We chose to debounce currency change price fetches by 150ms because rapid currency switches (e.g., a currency switcher) would otherwise fire one API call per card per keypress.

## Limitations

- Does not support multi-select. If you need multiple packages selected simultaneously, use `PackageToggleEnhancer` per package instead.
- Does not support nested selectors. Placing a selector inside another selector's card is not tested or supported.
- In select mode, if no `AddToCartEnhancer` is wired up, the selected package is never added to the cart. The enhancer does not warn when this happens.
- Auto-render templates (`data-next-packages`) must produce a single root element containing `[data-next-selector-card]`. Fragments or multi-root templates are not supported.
- Price calculation via `calculateBundlePrice` is asynchronous. Until the fetch resolves, price slots show stale values. There is no placeholder or skeleton state built in.
- The `data-next-shipping-id` is per card, not per selector. Only the most recently selected card's shipping ID is applied. There is no "clear shipping" operation when switching to a card without a shipping ID.
