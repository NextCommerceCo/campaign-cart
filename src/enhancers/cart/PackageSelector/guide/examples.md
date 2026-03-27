# PackageSelectorEnhancer — Examples

---

## 1. Swap mode — clicking a card updates the cart immediately

```html
<div data-next-package-selector data-next-selector-id="main">
  <div data-next-selector-card data-next-package-id="10" data-next-selected="true">
    <strong>1 Bottle</strong>
    <span data-next-package-price></span>
    <del data-next-package-price="compare"></del>
  </div>
  <div data-next-selector-card data-next-package-id="11">
    <strong>3 Bottles</strong>
    <span data-next-package-price></span>
    <del data-next-package-price="compare"></del>
    <span data-next-package-price="savings"></span>
  </div>
</div>
```

---

## 2. Select mode — button handles the cart write

```html
<div data-next-package-selector
     data-next-selector-id="main"
     data-next-selection-mode="select">

  <div data-next-selector-card data-next-package-id="10" data-next-selected="true">
    <strong>1 Bottle</strong>
    <span data-next-package-price></span>
  </div>
  <div data-next-selector-card data-next-package-id="11">
    <strong>3 Bottles</strong>
    <span data-next-package-price></span>
  </div>
</div>

<button data-next-action="add-to-cart"
        data-next-selector-id="main"
        data-next-url="/checkout">
  Add to Cart
</button>
```

---

## 3. With inline quantity controls

```html
<div data-next-package-selector data-next-selector-id="main">
  <div data-next-selector-card
       data-next-package-id="10"
       data-next-selected="true"
       data-next-min-quantity="1"
       data-next-max-quantity="10">

    <strong>Supplement</strong>
    <span data-next-package-price></span>

    <button data-next-quantity-decrease>−</button>
    <span data-next-quantity-display>1</span>
    <button data-next-quantity-increase>+</button>
  </div>
</div>
```

---

## 4. With per-card shipping method

Selecting a card sets the shipping method automatically:

```html
<div data-next-package-selector data-next-selector-id="main">
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
</div>
```

---

## 5. Auto-render from JSON

```html
<div data-next-package-selector
     data-next-selector-id="main"
     data-next-packages='[
       {"packageId": 10, "name": "1 Bottle", "badge": "Most Popular", "selected": true},
       {"packageId": 11, "name": "3 Bottles", "badge": "Best Value"}
     ]'
     data-next-package-template-id="pkg-tpl">
</div>

<template id="pkg-tpl">
  <div data-next-selector-card>
    <span class="badge">{package.badge}</span>
    <strong>{package.name}</strong>
    <span data-next-package-price></span>
    <del data-next-package-price="compare"></del>
  </div>
</template>
```

---

## 6. Upsell context (post-purchase page)

In upsell context there are no cart writes. The selector is paired with a
`UpsellEnhancer` that reads the selection at click time.

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

See [upsell.md](upsell.md) for full upsell integration details.
