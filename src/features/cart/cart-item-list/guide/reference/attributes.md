---
title: "Features/Cart/Cart Item List/Attributes"
group: "Features"
category: "Cart Item List"
---

# Attributes

<!-- Generated from the feature manifest. Do not edit by hand:
     edit <feature>.manifest.ts, then run `npm run docs:reference`. -->

Renders one row per cart line from a template you supply, and re-renders whenever the cart changes.

Turned on by `[data-next-cart-items]`.

## On the list element

### `data-next-cart-items`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | yes |
| Default | — |

Marks the element as the cart line list. Presence is enough — it takes no value.

---

### `data-item-template-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Id of an element whose `innerHTML` is the per-row template. Highest precedence of the four template sources.

**Valid values:** an element id present in the document when the feature initializes

---

### `data-item-template-selector`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

CSS selector for the element whose `innerHTML` is the per-row template. Used when `data-item-template-id` is absent.

**Valid values:** a selector resolving to exactly one element at init time

---

### `data-item-template`

| | |
|---|---|
| Type | `string (HTML)` |
| Required | no |
| Default | — |

The per-row template as an inline HTML string. Used when neither id nor selector is set.

---

### `data-empty-template`

| | |
|---|---|
| Type | `string (HTML)` |
| Required | no |
| Default | `<div class="cart-empty">Your cart is empty</div>` |

What to render in place of rows when the cart is empty.

---

### `data-title-map`

| | |
|---|---|
| Type | `JSON string` |
| Required | no |
| Default | — |

Overrides the campaign package name per package, for pages that use their own wording. Keys are package ids, values are the titles to show for `{item.name}` and `{item.title}`.

```html
<div data-next-cart-items data-title-map='{"42": "Main Product", "43": "Accessory"}'>
```

**Valid values:** a JSON object of package id → title

> **Watch out:** Malformed JSON is logged as a warning and ignored, so the list falls back to campaign names rather than failing to render.

---

### `data-group-items`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Collapses cart lines that share a package id into one row with the quantities added together. Display only — the cart itself is untouched.

## Inside the item template

### `data-cart-item-id`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | — |

Identifies a rendered row by cart line id. The feature counts and queries rows through it, so keep it on the row root — usually as `data-cart-item-id="{item.id}"`.

---

### `data-package-id`

| | |
|---|---|
| Type | `number` |
| Required | no |
| Default | — |

Ties a control inside the row to its package, normally as `data-package-id="{item.packageId}"`. The quantity and remove features inside the row both read it.

---

### `data-next-quantity`

| | |
|---|---|
| Type | `'increase' \| 'decrease' \| 'set'` |
| Required | no |
| Default | — |

Puts a quantity control in the row. After each re-render the feature re-binds these, so they keep working on freshly rendered rows. Full reference: the quantity-control feature.

---

### `data-next-remove-item`

| | |
|---|---|
| Type | `boolean (presence)` |
| Required | no |
| Default | — |

Puts a remove button in the row, re-bound after each re-render like the quantity controls. Full reference: the remove-item feature.

---

### `data-confirm`

| | |
|---|---|
| Type | `'true'` |
| Required | no |
| Default | — |

On a remove button inside the row: ask the visitor to confirm before removing. The built-in default template sets this.

---

### `data-confirm-message`

| | |
|---|---|
| Type | `string` |
| Required | no |
| Default | `Remove this item from your cart?` |

The wording of that confirmation, when `data-confirm="true"` is set.

## Template resolution order

The per-row template is taken from the first of these that is present:

1. `data-item-template-id`
2. `data-item-template-selector`
3. `data-item-template`
4. the list element's own `innerHTML`

With none of them, a built-in default row is used — it already includes quantity
controls and a remove button with confirmation.

## Re-render safety

The list replaces its entire `innerHTML` on every cart change. Anything you
attach yourself to a rendered row is destroyed by the next update.

```js
// Breaks: the row is replaced on the next cart change
document.querySelector('[data-cart-item-id="1"] .remove-btn')
  .addEventListener('click', handler);

// Works: listen on the list, which survives re-renders
document.querySelector('[data-next-cart-items]')
  .addEventListener('click', (e) => {
    const row = e.target.closest('[data-cart-item-id]');
    if (row) handler(row.dataset.cartItemId);
  });
```

The SDK's own controls inside the row — `data-next-quantity`,
`data-next-remove-item` — are exempt: the feature re-binds them after every
render, so put those in the template rather than wiring them yourself.
