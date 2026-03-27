# Upsell Enhancer Guide

The `UpsellEnhancer` handles post-purchase upsell offers on order confirmation and upsell pages.
It reads the current order from `orderStore`, adds packages to the order via the upsell API, and
navigates to the next page in the funnel.

---

## How it works

1. The page loads with a `?ref_id=<order_id>` query parameter.
2. `orderStore` fetches the order and checks `supports_post_purchase_upsells`.
3. `UpsellEnhancer` subscribes to `orderStore` — if the order can accept upsells the offer is
   shown, otherwise it is hidden.
4. When the visitor clicks **Add to Order**, the enhancer calls `orderStore.addUpsell()` which
   POSTs to `/api/v1/orders/<ref_id>/upsells/`.
5. On success it navigates to the next URL (from button attribute or meta tag).
6. On **Skip**, it records the skip in `orderStore` and navigates forward.

> The calculate API is called with `?upsell=true` when `PackageSelectorEnhancer` or
> `PackageToggleEnhancer` are used in upsell context, so the server applies post-purchase
> pricing logic.

---

## Modes

| Mode | Attribute | Use when |
|---|---|---|
| **Direct** | `data-next-upsell="offer"` + `data-next-package-id` | Single fixed package, yes/no choice |
| **Selector (options)** | `data-next-upsell-selector` + `data-next-selector-id` | Multiple options the visitor picks from using `data-next-upsell-option` cards or a `<select>` |
| **PackageSelector** | `data-next-upsell="offer"` + `data-next-package-selector-id` | Full `PackageSelectorEnhancer` UI (prices, quantity controls, auto-render) |
| **Toggle** | `data-next-package-toggle` + `data-next-upsell-context` | Standalone add-to-order toggle card (no separate UpsellEnhancer needed) |

---

## Data attributes

### Container / offer element

| Attribute | Value | Description |
|---|---|---|
| `data-next-upsell` | `"offer"` | Marks the upsell container. Required. |
| `data-next-package-id` | `"<id>"` | Package to add (direct mode). |
| `data-next-selector-id` | `"<id>"` | Links to built-in option cards (selector mode). |
| `data-next-package-selector-id` | `"<id>"` | Links to a `PackageSelectorEnhancer` (see below). |
| `data-next-quantity` | `"<n>"` | Initial quantity, default `1`. |

### Action buttons (inside the container)

| Attribute | Value | Description |
|---|---|---|
| `data-next-upsell-action` | `"add"` / `"accept"` | Adds the package to the order. |
| `data-next-upsell-action` | `"skip"` / `"decline"` | Records skip and navigates forward. |
| `data-next-url` | `"<url>"` | Where to go after the action. |

If `data-next-url` is missing the enhancer falls back to:
- `<meta name="next-upsell-accept-url" content="…">` for add/accept
- `<meta name="next-upsell-decline-url" content="…">` for skip/decline

### Built-in option cards (selector mode only)

| Attribute | Value | Description |
|---|---|---|
| `data-next-upsell-option` | — | Marks a clickable option card. |
| `data-next-package-id` | `"<id>"` | Package this option represents. |
| `data-next-selected` | `"true"` | Pre-selects this option on init. |

### Quantity controls

| Attribute | Value | Description |
|---|---|---|
| `data-next-upsell-quantity` | `"increase"` | Increment button. |
| `data-next-upsell-quantity` | `"decrease"` | Decrement button. |
| `data-next-upsell-quantity` | `"display"` | Shows current quantity. |
| `data-next-upsell-quantity-toggle` | `"<n>"` | Sets quantity to `n` when clicked (button group). |
| `data-next-quantity-selector-id` | `"<id>"` | Scopes inc/dec controls to a specific selector. |

### `<select>` element (selector mode)

```html
<select data-next-upsell-select="<selectorId>">
  <option value="">Choose…</option>
  <option value="123">Option A</option>
  <option value="456">Option B</option>
</select>
```

---

## CSS classes applied by the enhancer

| Class | When |
|---|---|
| `next-available` | Order can accept upsells — offer is visible |
| `next-hidden` | Order cannot accept upsells — offer is hidden |
| `next-selected` | An option card or quantity toggle is selected |
| `next-processing` | API call in progress |
| `next-disabled` | Button disabled during processing |
| `next-success` | Add succeeded (removed after 3 s) |
| `next-error` | Error state (removed after 5 s) |
| `next-skipped` | Visitor clicked skip |

---

## Events emitted

| Event | Payload | When |
|---|---|---|
| `upsell:initialized` | `{ packageId, element }` | Enhancer ready |
| `upsell:viewed` | `{ pagePath, orderId }` | Page view tracked |
| `upsell:adding` | `{ packageId }` | API call starts |
| `upsell:added` | `{ packageId, quantity, order, value, willRedirect }` | Added successfully |
| `upsell:skipped` | `{ packageId?, orderId? }` | Visitor skipped |
| `upsell:error` | `{ packageId, error }` | API call failed |

Listen to these with the SDK EventBus or `window.addEventListener`:

```js
window.addEventListener('next:upsell:added', e => {
  console.log('Upsell accepted:', e.detail);
});
```

---

## Examples

### 1. Direct mode — single fixed package

```html
<div data-next-upsell="offer" data-next-package-id="123">
  <h2>Add Protection Plan</h2>
  <p>Only $9.99 added to your order</p>

  <button data-next-upsell-action="add" data-next-url="/thank-you">
    Yes, Add to My Order
  </button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/thank-you">
    No thanks
  </a>
</div>
```

---

### 2. Direct mode — with quantity controls

```html
<div data-next-upsell="offer" data-next-package-id="123">
  <p>How many bottles?</p>

  <button data-next-upsell-quantity="decrease">−</button>
  <span data-next-upsell-quantity="display">1</span>
  <button data-next-upsell-quantity="increase">+</button>

  <button data-next-upsell-action="add" data-next-url="/thank-you">Add to Order</button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/thank-you">Skip</a>
</div>
```

---

### 3. Direct mode — quantity toggle buttons

Useful for "1 / 2 / 3 bottles" style selectors:

```html
<div data-next-upsell="offer" data-next-package-id="123">
  <button data-next-upsell-quantity-toggle="1">1 Bottle</button>
  <button data-next-upsell-quantity-toggle="2">2 Bottles</button>
  <button data-next-upsell-quantity-toggle="3">3 Bottles</button>

  <button data-next-upsell-action="add" data-next-url="/thank-you">Add to Order</button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/thank-you">Skip</a>
</div>
```

---

### 4. Built-in selector mode — clickable option cards

Multiple packages, visitor picks one before clicking Add:

```html
<!-- Selector container — tracks which option is selected -->
<div data-next-upsell-selector data-next-selector-id="protection">
  <div data-next-upsell-option data-next-package-id="10" data-next-selected="true">
    Basic Protection — $9
  </div>
  <div data-next-upsell-option data-next-package-id="11">
    Full Protection — $19
  </div>
</div>

<!-- Offer container — reads selection from selector above -->
<div data-next-upsell="offer" data-next-selector-id="protection">
  <button data-next-upsell-action="add" data-next-url="/thank-you">Add Selected</button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/thank-you">Skip</a>
</div>
```

---

### 5. Built-in selector mode — `<select>` dropdown

```html
<div data-next-upsell="offer" data-next-selector-id="sizes">
  <select data-next-upsell-select="sizes">
    <option value="">Choose a size…</option>
    <option value="10">Small — $9</option>
    <option value="11">Large — $19</option>
  </select>

  <button data-next-upsell-action="add" data-next-url="/thank-you">Add to Order</button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/thank-you">Skip</a>
</div>
```

---

### 6. PackageSelectorEnhancer integration

Use the full `PackageSelectorEnhancer` UI (live prices, quantity controls, auto-render from
JSON) paired with `UpsellEnhancer` for the Add button.

```html
<!-- 1. PackageSelectorEnhancer in upsell context — tracks selection, no cart writes -->
<div data-next-package-selector
     data-next-selector-id="upsell-options"
     data-next-upsell-context>

  <div data-next-selector-card data-next-package-id="10" data-next-selected="true">
    <strong>1 Bottle</strong>
    <span data-next-package-price></span>        <!-- live price from API -->
  </div>
  <div data-next-selector-card data-next-package-id="11">
    <strong>3 Bottles</strong>
    <span data-next-package-price></span>
    <del data-next-package-price="compare"></del>
  </div>
</div>

<!-- 2. UpsellEnhancer reads selection from the PackageSelectorEnhancer above -->
<div data-next-upsell="offer"
     data-next-package-selector-id="upsell-options">

  <button data-next-upsell-action="add" data-next-url="/thank-you">Add to Order</button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/thank-you">Skip</a>
</div>
```

Key points:
- `data-next-upsell-context` on the selector means no cart writes and prices use `?upsell=true`.
- `data-next-package-selector-id` on the upsell container links it to the selector by its `data-next-selector-id`.
- The selector resolves the selected package at click time, so the user's choice is always current.

---

### 7. PackageToggleEnhancer in upsell context

A standalone toggle card that adds directly to the order on click — no separate
`UpsellEnhancer` needed. The next URL comes from `data-next-url` or the
`next-upsell-accept-url` meta tag.

```html
<div data-next-package-toggle
     data-next-upsell-context
     data-next-url="/thank-you">

  <div data-next-toggle-card data-next-package-id="123">
    <strong>Protection Plan</strong>
    <span data-next-toggle-price></span>          <!-- live price via ?upsell=true -->
    <del data-next-toggle-price="compare"></del>
    <button>Add to Order</button>
  </div>
</div>
```

Key points:
- No cart interaction at all — the click POSTs directly to the orders upsell endpoint.
- `data-next-upsell-context` also makes the price calculation use `?upsell=true`.
- You can still add a skip/decline link separately and handle navigation yourself.

---

### 8. Multiple upsell offers on the same page

Each `UpsellEnhancer` tracks its own package. They share the `orderStore` — the first add
marks the order as having an upsell in progress, and duplicate-package detection prevents
double-submits.

```html
<div data-next-upsell="offer" data-next-package-id="10">
  <button data-next-upsell-action="add" data-next-url="/upsell-2">Yes</button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/upsell-2">No</a>
</div>

<div data-next-upsell="offer" data-next-package-id="20">
  <button data-next-upsell-action="add" data-next-url="/thank-you">Yes</button>
  <a href="#" data-next-upsell-action="skip" data-next-url="/thank-you">No</a>
</div>
```

---

## Fallback URLs via meta tags

Instead of `data-next-url` on every button, declare site-wide fallbacks in `<head>`:

```html
<meta name="next-upsell-accept-url" content="/thank-you">
<meta name="next-upsell-decline-url" content="/thank-you">
```

Button-level `data-next-url` always takes priority over meta tags.

---

## Duplicate upsell detection

If the visitor tries to add a package they already accepted, a confirmation dialog appears
(`GeneralModal.showDuplicateUpsell()`). If they confirm, the package is added again. If they
cancel, the flow navigates to the next URL without adding.

Accepted packages are tracked in `orderStore.completedUpsells` (persisted in sessionStorage for
15 minutes).

---

## Quantity behaviour

- **inc / dec controls** — range 1–10 by default.
- **toggle buttons** — set a fixed quantity directly; the active toggle gets `next-selected`.
- **Per-selector quantity** — when `data-next-quantity-selector-id` is set on the controls, each
  selector (`data-next-selector-id`) tracks its own quantity independently.
- Quantity syncs across all `UpsellEnhancer` instances with the same `selectorId` via the
  `upsell:quantity-changed` event.

---

## When the offer is hidden

The offer is hidden (`next-hidden`) and shown (`next-available`) reactively based on
`orderStore.canAddUpsells()`. The offer hides when:

- No order is loaded in `orderStore`
- `order.supports_post_purchase_upsells` is `false`
- `isProcessingUpsell` is `true` (another upsell is in flight)
- The order has expired (15-minute TTL)
