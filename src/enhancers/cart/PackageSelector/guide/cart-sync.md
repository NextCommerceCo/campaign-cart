# PackageSelectorEnhancer — Cart Sync & AddToCart Contract

---

## Cart sync behaviour

| Scenario | What happens |
|---|---|
| Page load — package already in cart | Card matching that package is selected and marked `next-in-cart` |
| Page load — cart empty, no pre-selected card | First card is selected and (in swap mode) added to the cart |
| Visitor clicks a card (swap mode) | `cartStore.swapPackage()` replaces the previous cart item atomically |
| Visitor clicks a card (select mode) | Selection state updates; no cart write until the button is clicked |
| Inline quantity changed (swap mode, selected card) | `cartStore.updateQuantity()` is called for the cart item |
| Coupon applied or removed | Prices for all cards are re-fetched automatically |

---

## AddToCartEnhancer contract

After initialization, the container element exposes two methods that `AddToCartEnhancer`
calls when `data-next-selector-id` is set on the button:

```js
element._getSelectedItem()      // → SelectorItem | null
element._getSelectedPackageId() // → number | undefined
```

The container also has `data-selected-package="<packageId>"` updated on every selection
change — use `getAttribute('data-selected-package')` when reading selection state outside
an enhancer.

### Wiring a button to the selector

```html
<div data-next-package-selector
     data-next-selector-id="main"
     data-next-selection-mode="select">
  <div data-next-selector-card data-next-package-id="10" data-next-selected="true">…</div>
  <div data-next-selector-card data-next-package-id="11">…</div>
</div>

<!-- Button reads the selector's current selection at click time -->
<button data-next-action="add-to-cart"
        data-next-selector-id="main"
        data-next-url="/checkout">
  Add to Cart
</button>
```

> Use `data-next-selection-mode="select"` when pairing with a button. In **swap** mode
> clicking a card already writes to the cart — the button would cause a second write.

---

## Shipping per card

When a card has `data-next-shipping-id`, selecting that card automatically sets the active
shipping method in `cartStore`:

```html
<div data-next-selector-card
     data-next-package-id="10"
     data-next-selected="true"
     data-next-shipping-id="5">
  Standard Shipping
</div>
<div data-next-selector-card
     data-next-package-id="11"
     data-next-shipping-id="6">
  Express Shipping
</div>
```

The shipping ID is also included when `AddToCartEnhancer` reads `_getSelectedItem()`.
