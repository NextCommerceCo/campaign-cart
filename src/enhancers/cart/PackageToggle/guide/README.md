# PackageToggleEnhancer Guide

The `PackageToggleEnhancer` manages independently toggleable package cards. Each card maps to a
single package. Clicking a card adds it to the cart; clicking it again removes it. Any combination
of cards can be active at the same time — unlike `PackageSelectorEnhancer` which enforces a single
selection.

Also supports a **single-element mode** where the toggle attribute sits directly on a button or
element (no child cards needed).

---

## How it works

1. The enhancer scans for `[data-next-toggle-card]` children and registers each as a toggle card.
   In single-element mode, the container element itself is treated as the card.
2. On init it subscribes to `cartStore` and syncs each card's CSS classes with cart state.
3. Clicking a card that is not in the cart calls `cartStore.addItem()`. Clicking one that is in the
   cart calls `cartStore.removeItem()`.
4. Live prices are fetched from the calculate API and written into `[data-next-toggle-price]` slots.
5. In **upsell context** (`data-next-upsell-context`), clicking a card POSTs directly to the order
   upsell API instead of touching the cart, then navigates to `data-next-url`.

---

## Data attributes

### Container (`data-next-package-toggle`)

| Attribute | Value | Description |
|---|---|---|
| `data-next-package-toggle` | — | Marks the container (or the toggle element itself). Required. |
| `data-next-packages` | `'[…]'` | JSON array for auto-render mode (see below). |
| `data-next-toggle-template-id` | `"<id>"` | ID of a `<template>` element to use as the card template. |
| `data-next-toggle-template` | `"<html>"` | Inline card template string. |
| `data-next-include-shipping` | `"true"` | Include shipping in price calculation. |
| `data-next-upsell-context` | — | Upsell mode: clicks add to order, not cart; prices use `?upsell=true`. |
| `data-next-url` | `"<url>"` | Navigation target used in upsell context after a successful add. |

### Card (`data-next-toggle-card`)

| Attribute | Value | Description |
|---|---|---|
| `data-next-toggle-card` | — | Marks a card element. |
| `data-next-package-id` | `"<id>"` | Package `ref_id`. Required. |
| `data-next-selected` | `"true"` | Pre-selects (auto-adds to cart) on init. |
| `data-next-quantity` | `"<n>"` | Quantity to add (default `1`). |
| `data-next-package-sync` | `"1,2,3"` | Sync quantity to the total of the listed package IDs. |
| `data-next-is-upsell` | `"true"` | Flag this item as an upsell / order bump. |
| `data-add-text` | `"<text>"` | Button text when the package is not in the cart. |
| `data-remove-text` | `"<text>"` | Button text when the package is in the cart. |

### Price slots (inside a card)

| Attribute | Description |
|---|---|
| `data-next-toggle-price` | Formatted total price (default) |
| `data-next-toggle-price="compare"` | Retail / compare-at price |
| `data-next-toggle-price="savings"` | Savings amount |
| `data-next-toggle-price="savingsPercentage"` | Savings percentage |
| `data-next-toggle-price="subtotal"` | Formatted subtotal |

---

## Auto-render mode

When `data-next-packages` (JSON array) and a template are both present, the enhancer renders cards
from the JSON data instead of using static HTML.

Each JSON object may contain any keys — all are available as `{toggle.<key>}` in the template.
Built-in keys enriched from the campaign store when not provided:

| Key | Description |
|---|---|
| `packageId` | Package `ref_id` (required) |
| `name` | Package name |
| `image` | Package image URL |
| `price` | Campaign per-unit price |
| `priceRetail` | Campaign retail / compare price |
| `priceRetailTotal` | Retail total |

Set `"selected": true` in the JSON object to pre-add that card on init.

---

## CSS classes applied by the enhancer

| Class | When |
|---|---|
| `next-toggle-card` | Added to every registered card |
| `next-in-cart` | Package is in the cart |
| `next-not-in-cart` | Package is not in the cart |
| `next-selected` | Alias for `next-in-cart` (styling convenience) |
| `next-active` | Alias for `next-in-cart` (styling convenience) |
| `next-loading` | During an async cart or order operation |

The card's **state container** (nearest ancestor with `data-next-toggle-container`,
`data-next-bump`, `data-next-upsell-item`, or a `data-next-package-id` attribute) also receives
`next-in-cart`, `next-not-in-cart`, `next-active`, `os--active` classes and
`data-in-cart` / `data-next-active` attributes.

---

## Events emitted

| Event | Payload | When |
|---|---|---|
| `toggle:toggled` | `{ packageId, added }` | Card clicked (add or remove) |
| `toggle:selection-changed` | `{ selected: number[] }` | After cart sync — list of all in-cart package IDs |

Listen via the SDK EventBus or `window.addEventListener`:

```js
window.addEventListener('next:toggle:toggled', e => {
  console.log(e.detail.added ? 'Added' : 'Removed', e.detail.packageId);
});
```

---

## Examples

### 1. Static card

```html
<div data-next-package-toggle>
  <div data-next-toggle-card data-next-package-id="101" data-next-selected="true">
    <strong>Extended Warranty</strong>
    <span data-next-toggle-price></span>
    <del data-next-toggle-price="compare"></del>
  </div>
</div>
```

---

### 2. Multiple independent cards

Any combination can be active simultaneously:

```html
<div data-next-package-toggle>
  <div data-next-toggle-card data-next-package-id="101">
    <strong>Extra Battery</strong>
    <span data-next-toggle-price></span>
  </div>
  <div data-next-toggle-card data-next-package-id="102">
    <strong>Carrying Case</strong>
    <span data-next-toggle-price></span>
  </div>
  <div data-next-toggle-card data-next-package-id="103">
    <strong>Screen Protector</strong>
    <span data-next-toggle-price></span>
  </div>
</div>
```

---

### 3. Single-element toggle (no child cards)

Place `data-next-package-toggle` directly on a button:

```html
<button data-next-package-toggle
        data-next-package-id="123"
        data-add-text="Add Protection Plan"
        data-remove-text="✓ Protection Plan Added">
  Add Protection Plan
</button>
```

For dynamic text, use a `[data-next-button-text]` slot inside the element:

```html
<button data-next-package-toggle data-next-package-id="123">
  <span data-next-button-text>Add Protection Plan</span>
  <span data-next-toggle-price></span>
</button>
```

---

### 4. Order bump (upsell item on checkout page)

Use `data-next-is-upsell="true"` so the item is flagged correctly in the cart:

```html
<div data-next-package-toggle>
  <div data-next-toggle-card
       data-next-package-id="200"
       data-next-is-upsell="true"
       data-next-selected="true">
    <strong>Add Rush Processing — Only $4.95</strong>
    <span data-next-toggle-price></span>
  </div>
</div>
```

---

### 5. Quantity sync — warranty mirrors product quantity

`data-next-package-sync` keeps the toggled item's quantity equal to the total quantity of the
listed packages. When all synced packages are removed, the toggle item is automatically removed.

```html
<div data-next-package-toggle>
  <!-- Main product cards (managed by PackageSelectorEnhancer) -->

  <!-- Warranty mirrors the quantity of packages 10 and 11 -->
  <div data-next-toggle-card
       data-next-package-id="999"
       data-next-package-sync="10,11"
       data-next-is-upsell="true"
       data-next-selected="true">
    <strong>Warranty (auto-quantity)</strong>
    <span data-next-toggle-price></span>
  </div>
</div>
```

> Do not use `data-next-qty-sync` — it is a legacy alias. Always use `data-next-package-sync`.

---

### 6. Auto-render from JSON

```html
<div data-next-package-toggle
     data-next-packages='[
       {"packageId": 101, "name": "Extra Battery", "selected": true},
       {"packageId": 102, "name": "Carrying Case"}
     ]'
     data-next-toggle-template-id="toggle-tpl">
</div>

<template id="toggle-tpl">
  <div data-next-toggle-card>
    <strong>{toggle.name}</strong>
    <span data-next-toggle-price></span>
    <del data-next-toggle-price="compare"></del>
  </div>
</template>
```

---

### 7. Upsell context (post-purchase page)

In upsell context, clicking a card calls the order upsell API directly — no cart interaction.
The next URL is read from `data-next-url` on the card, the state container, or the container
element, then falls back to the `<meta name="next-upsell-accept-url">` tag.

```html
<div data-next-package-toggle
     data-next-upsell-context
     data-next-url="/thank-you">

  <div data-next-toggle-card data-next-package-id="123">
    <strong>Protection Plan</strong>
    <span data-next-toggle-price></span>
    <button>Add to Order</button>
  </div>
</div>
```

Key points:
- No cart store is touched at all in upsell context.
- Prices use `?upsell=true` so the server applies post-purchase pricing logic.
- A separate skip link can navigate to the next URL without the enhancer's involvement.
- See the [Upsell guide](../../../order/Upsell/guide/README.md) for the full upsell flow.

---

## Pre-selection behaviour

Cards with `data-next-selected="true"` are auto-added to the cart once on page load.
Deduplication prevents the same package from being added twice even if multiple elements
pre-select it (tracked via a module-level `autoAddedPackages` set, cleared on page unload).

---

## Sync mode behaviour

When `data-next-package-sync` is set on a card:
- The card's quantity is computed as the **sum of quantities** of all listed packages in the cart.
- If any synced package is in the cart with quantity `n`, the toggled item is set to `n`.
- If all synced packages are removed from the cart, the toggled item is also removed.
- `is_upsell` items get a 500 ms grace period before removal (to avoid race conditions during
  package swaps).
