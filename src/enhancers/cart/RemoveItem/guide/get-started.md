# Get Started

## Prerequisites

- The SDK is initialised on the page (`NextCommerce.init()`).
- The `data-package-id` value is a valid package `ref_id` from the campaign.
- The button sits inside or alongside a cart item row, not inside a `[data-next-cart-items]` template (those are rendered separately by `CartItemListEnhancer`).

## Setup

1. Add `data-next-remove-item` to the button element.
2. Add `data-package-id` set to the package `ref_id` you want to remove.
3. Optionally add `data-next-confirm="true"` if you want a confirmation prompt before removal.

```html
<button
  data-next-remove-item
  data-package-id="42"
>
  Remove
</button>
```

With confirmation:

```html
<button
  data-next-remove-item
  data-package-id="42"
  data-next-confirm="true"
  data-next-confirm-message="Remove this item from your cart?"
>
  Remove
</button>
```

## Verify it is working

After page load you should see in the browser console:

```
[RemoveItemEnhancer] Initialized for package 42
```

- When the package is **in the cart**: the button is enabled; `data-in-cart="true"` is set on the element.
- When the package is **not in the cart**: the button has the `disabled` attribute and `disabled` + `empty` CSS classes; `data-in-cart="false"` is set.
- Clicking the enabled button removes the item and emits `cart:item-removed` on the EventBus.

## Next steps

- Explore use cases: [use-cases.md](./use-cases.md)
- Configure attributes: [reference/attributes.md](./reference/attributes.md)
- See what events it emits: [reference/events.md](./reference/events.md)
