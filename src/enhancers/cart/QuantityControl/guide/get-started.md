# Get Started

## Prerequisites

- The target package must already be in the cart (the enhancer reacts to cart state — it does not add items).
- Each element needs `data-package-id` set to the package's `ref_id`. When used inside `CartItemListEnhancer`, this is injected automatically via the item template.

## Setup

1. Add `data-next-quantity` with the mode value (`increase`, `decrease`, or `set`) to each control element.
2. Add `data-package-id` with the numeric package `ref_id`.
3. Optionally add `data-step`, `data-min`, and `data-max` to configure constraints.

### Increase / decrease buttons

```html
<div data-next-cart-items>
  <template>
    <div class="cart-item">
      <button
        data-next-quantity="decrease"
        data-package-id="{item.packageId}"
        data-min="1"
      >−</button>

      <span data-next-display="cart.item.quantity"></span>

      <button
        data-next-quantity="increase"
        data-package-id="{item.packageId}"
        data-max="10"
      >+</button>
    </div>
  </template>
</div>
```

### Direct quantity input

```html
<input
  type="number"
  data-next-quantity="set"
  data-package-id="42"
  data-min="1"
  data-max="10"
/>
```

## Verify it is working

After setup, you should see:

- On page load the increase/decrease buttons reflect the current cart quantity — the `disabled` HTML attribute and `disabled` CSS class are present on the button that has hit its limit.
- `data-quantity` and `data-in-cart` attributes appear on the element.
- Clicking a button adds the `processing` class briefly, then the display quantity updates.
- The browser console shows: `[QuantityControlEnhancer] Initialized for package {id}, action: {mode}`.

## Next steps

- Explore use cases: [use-cases.md](./use-cases.md)
- Configure all attributes: [reference/attributes.md](./reference/attributes.md)
- See what events are emitted: [reference/events.md](./reference/events.md)
