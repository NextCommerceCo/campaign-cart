# PackageSelectorEnhancer — Prices

Live prices are fetched from the calculate API once per card on init, then re-fetched
whenever the coupon/voucher state changes.

---

## Price slots

Place these attributes inside a `[data-next-selector-card]` element. The enhancer writes
the formatted value into the element's `textContent`.

| Attribute value | What is written |
|---|---|
| `data-next-package-price` (no value) | Formatted total price |
| `data-next-package-price="compare"` | Retail / compare-at price |
| `data-next-package-price="savings"` | Savings amount (retail − price) |
| `data-next-package-price="savingsPercentage"` | Savings percentage |
| `data-next-package-price="subtotal"` | Formatted subtotal |

```html
<div data-next-selector-card data-next-package-id="10">
  <span data-next-package-price></span>
  <del data-next-package-price="compare"></del>
  <span data-next-package-price="savings"></span>
  <span data-next-package-price="savingsPercentage"></span>
</div>
```

---

## When prices are re-fetched

| Trigger | What happens |
|---|---|
| Enhancer initialises | All cards fetch their prices immediately |
| Coupon applied or removed | All cards re-fetch (debounced 150 ms) |
| Inline quantity changed | The affected card re-fetches |
| `data-next-include-shipping="true"` | Shipping cost is included in the total |
| `data-next-upsell-context` present | Prices are fetched with `?upsell=true` |

---

## Upsell pricing

When the container has `data-next-upsell-context`, all price requests include `?upsell=true`.
The server applies post-purchase pricing logic (typically a discounted rate).

No other behaviour changes — the enhancer still displays prices in the same slots and
follows the same re-fetch triggers.

See [upsell.md](upsell.md) for the full upsell integration.

---

## Shipping in price total

Add `data-next-include-shipping="true"` to the container to include the active shipping
method's cost in each card's displayed price:

```html
<div data-next-package-selector
     data-next-selector-id="main"
     data-next-include-shipping="true">
  …
</div>
```

Per-card shipping methods (via `data-next-shipping-id`) are factored in automatically when
this flag is set.
