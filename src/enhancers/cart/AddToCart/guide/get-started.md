# Get Started

## Prerequisites

- The campaign is loaded and `cartStore` is initialized.
- For selector-linked mode: a `PackageSelectorEnhancer` must be present on the page with a matching `data-next-selector-id`.

## Setup

### Option A — direct package button

Add `data-next-action="add-to-cart"` and `data-next-package-id` to any button:

```html
<button
  data-next-action="add-to-cart"
  data-next-package-id="42"
>
  Add to cart
</button>
```

### Option B — selector-linked button

Pair with a `PackageSelectorEnhancer`. The button reads the current selection automatically:

```html
<!-- Selector -->
<div
  data-next-package-selector
  data-next-selector-id="main"
  data-next-selection-mode="select"
>
  <div data-next-selector-card data-next-package-id="42">1 bottle — $29</div>
  <div data-next-selector-card data-next-package-id="43">3 bottles — $59</div>
</div>

<!-- Button -->
<button
  data-next-action="add-to-cart"
  data-next-selector-id="main"
>
  Add to cart
</button>
```

### Option C — add with redirect

```html
<button
  data-next-action="add-to-cart"
  data-next-package-id="42"
  data-next-url="https://example.com/checkout"
>
  Buy now
</button>
```

### Option D — replace cart before adding

```html
<button
  data-next-action="add-to-cart"
  data-next-package-id="42"
  data-next-clear-cart="true"
>
  Start fresh
</button>
```

## Verify it is working

After setup, open the browser console. You should see:

```
[AddToCartEnhancer] Initialized { packageId: 42, selectorId: undefined, quantity: 1, ... }
```

Click the button. You should see a `cart:item-added` event in the console and the cart store item count increase. If `data-next-url` is set, the browser redirects.

For selector-linked mode, the button should be disabled on load if no card is pre-selected, then become enabled when a card is clicked.

## Next steps

- Explore use cases: [use-cases.md](./use-cases.md)
- Configure all attributes: [reference/attributes.md](./reference/attributes.md)
- See what events it emits: [reference/events.md](./reference/events.md)
