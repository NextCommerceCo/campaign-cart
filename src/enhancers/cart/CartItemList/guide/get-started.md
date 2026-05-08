# Get Started

## Prerequisites

- Cart store initialized — the SDK must be bootstrapped before the enhancer renders anything.
- A `data-next-cart-items` element present in the DOM before the SDK scans attributes.

## Setup

1. Add a `data-next-cart-items` element to your HTML.
2. Inside it, place a `<template>` element (or use `data-item-template-id`) with your per-item markup.
3. Use `{item.*}` tokens to insert item data. The `currency` formatter applies automatically to numeric price fields.

```html
<div data-next-cart-items>
  <template>
    <div class="cart-item" data-cart-item-id="{item.id}">
      <img src="{item.image}" alt="{item.name}">
      <div class="item-info">
        <p class="item-name">{item.name}</p>
        <p class="item-variant">{item.variantAttributesFormatted}</p>
        <p class="item-price">{item.finalPrice|currency}</p>
      </div>
      <div class="item-qty">
        <button data-next-quantity="decrease" data-package-id="{item.packageId}">−</button>
        <span>{item.quantity}</span>
        <button data-next-quantity="increase" data-package-id="{item.packageId}">+</button>
      </div>
      <p class="item-total">{item.finalLineTotal|currency}</p>
      <button data-next-remove-item data-package-id="{item.packageId}">Remove</button>
    </div>
  </template>
</div>
```

The SDK discovers the `data-next-cart-items` attribute and instantiates `CartItemListEnhancer` automatically. No JavaScript is required.

## Verify it is working

After the SDK initializes, you should see:

- One rendered item row per cart item inside the `data-next-cart-items` element.
- Quantity buttons respond to clicks (quantity goes up/down in the cart).
- The Remove button removes the item from the cart.
- The element gains the class `cart-has-items` when items are present, or `cart-empty` when the cart is empty.
- Console: `[CartItemListEnhancer] CartItemListEnhancer initialized`

If the element remains empty and no log appears, the SDK has not scanned attributes yet or the cart has not loaded.

## Next steps

- Explore the full token reference: [reference/object-attributes.md](./reference/object-attributes.md)
- Configure attributes: [reference/attributes.md](./reference/attributes.md)
- See use cases: [use-cases.md](./use-cases.md)
