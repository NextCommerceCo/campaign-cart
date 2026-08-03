---
title: "Features/Cart/Accept Upsell/Get Started"
group: "Features"
category: "Accept Upsell"
---

# Get Started

## Prerequisites

- The order must be loaded in `orderStore` before the button is active. This happens automatically when `NextCommerce.init()` detects a `ref_id` query parameter on the page.
- The order must have `supports_post_purchase_upsells: true`. If the order does not support upsells, the button stays disabled.
- The package you want to offer must have a numeric `ref_id` (visible in the campaign dashboard).

## Setup

### Option A — Direct package ID

Add `data-next-action="accept-upsell"` and `data-next-package-id` to your button:

```html
<button
  data-next-action="accept-upsell"
  data-next-package-id="42"
  data-next-url="/upsell-2"
>
  Yes, add this to my order!
</button>
```

### Option B — Selector-driven (user picks a variant)

Place a `PackageSelectorEnhancer` in upsell context alongside the button:

```html
<div
  data-next-package-selector
  data-next-selector-id="upsell-pkg"
  data-next-upsell-context
>
  <div data-next-selector-card data-next-package-id="42">
    1 bottle — $29
  </div>
  <div data-next-selector-card data-next-package-id="43">
    3 bottles — $69
  </div>
</div>

<button
  data-next-action="accept-upsell"
  data-next-selector-id="upsell-pkg"
  data-next-url="/upsell-2"
>
  Add to my order
</button>
```

The `data-next-selector-id` value must match between the selector container and the button.

The selector pre-selects a card on its own as it boots (the one marked
`data-next-selected="true"`, else the first), and the button reads that pre-selection when it
initialises — so it arms itself without waiting for a click. A visitor's click on any card
arms it too.

The one case where it starts disabled is a selector container that reaches the DOM later
than 100 ms after the button — rendered into a tab or a modal, or behind a deferred script.
Then you will see `[AcceptUpsellEnhancer] Selector "upsell-pkg" not found` in the console and
the button arms on the first card click; [reference/logs.md](./reference/logs.md) covers it.

## Verify it is working

After the page loads with a valid `?ref_id=` in the URL, you should see:

- The button is **enabled** (no `disabled` attribute, no `next-disabled` class) — with Option B too, because the button reads the selector's pre-selection at startup.
- In the browser console: `[AcceptUpsellEnhancer] Initialized { packageId: 42, ... }` (or `selectorId` if using Option B).
- Clicking the button shows a full-page loading overlay, then navigates to `data-next-url`.

If the button stays disabled:
- Open the console and run `useOrderStore.getState().canAddUpsells()` — if `false`, the order has not loaded or does not support upsells.
- Confirm the page URL contains a `ref_id` query parameter.

## Next steps

- Explore use cases: [use-cases.md](./use-cases.md)
- Configure all attributes: [reference/attributes.md](./reference/attributes.md)
- See what events are emitted: [reference/events.md](./reference/events.md)
