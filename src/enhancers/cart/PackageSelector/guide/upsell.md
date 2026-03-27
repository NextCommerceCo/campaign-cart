# PackageSelectorEnhancer — Upsell Context

`data-next-upsell-context` switches the selector into upsell mode. In this mode:
- No cart writes occur on card selection.
- Price requests include `?upsell=true` so the server applies post-purchase pricing.
- The selector is typically paired with a `UpsellEnhancer` that reads the selection at click time.

---

## How it works

1. Add `data-next-upsell-context` to the selector container.
2. The visitor picks a card — selection state updates, no cart write.
3. The `UpsellEnhancer` on the same page reads the current selection via `_getSelectedItem()`.
4. When the visitor clicks **Add to Order**, `UpsellEnhancer` POSTs to the upsell API with
   the selected package.

---

## Markup

```html
<!-- Selector — tracks selection only, prices use ?upsell=true -->
<div data-next-package-selector
     data-next-selector-id="upsell-options"
     data-next-upsell-context>

  <div data-next-selector-card data-next-package-id="10" data-next-selected="true">
    <strong>1 Bottle</strong>
    <span data-next-package-price></span>
  </div>
  <div data-next-selector-card data-next-package-id="11">
    <strong>3 Bottles</strong>
    <span data-next-package-price></span>
  </div>
</div>

<!-- UpsellEnhancer reads the selector's current selection -->
<div data-next-upsell="offer"
     data-next-package-selector-id="upsell-options">

  <button data-next-upsell-action="add" data-next-url="/thank-you">Add to Order</button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/thank-you">No thanks</a>
</div>
```

---

## Constraints

- Do **not** add an `AddToCartEnhancer` button alongside a upsell-context selector — it would
  write to the cart instead of the order.
- Upsell context works with both **swap** and **select** modes, but swap has no effect (no cart
  writes happen either way). Use the default or explicitly set `data-next-selection-mode="select"`.
- `orderStore.canAddUpsells()` must be `true` for the `UpsellEnhancer` button to be active.

---

## Related

- [UpsellEnhancer guide](../../../order/Upsell/guide/README.md) — full upsell integration details.
- [prices.md](prices.md) — how `?upsell=true` affects price fetching.
