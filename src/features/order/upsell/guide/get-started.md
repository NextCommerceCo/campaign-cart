---
title: "Features/Order/Upsell/Get Started"
group: "Features"
category: "Upsell"
---

# Get Started

## Prerequisites

- An **upsell page** in your funnel, reached after a completed order (the SDK has loaded that order into `useOrderStore`).
- The order must support post-purchase upsells (`supports_post_purchase_upsells` on the order) — configured on the campaign/order in the Campaigns App.
- The `data-next-package-id` values you offer must be real campaign package IDs.
- For view tracking, add `<meta name="next-page-type" content="upsell">` to the page `<head>`.

## Setup

### Option A — direct offer (single package)

One package with an add and a skip button. `data-next-url` on each button is where the customer goes next.

```html
<div data-next-upsell="offer" data-next-package-id="123">
  <h3 data-next-display="package.name">Protection Plan</h3>
  <span data-next-display="package.price">$19.99</span>

  <button data-next-upsell-action="add" data-next-url="/receipt/">
    Yes, add it to my order
  </button>
  <button data-next-upsell-action="skip" data-next-url="/receipt/">
    No thanks
  </button>
</div>
```

### Option B — selector offer (choose one of several)

Cards the customer picks from, then a single add button. The chosen card gets `next-selected`.

```html
<div data-next-upsell-selector data-next-selector-id="protection">
  <div data-next-upsell-option data-next-package-id="123">1 year — $19.99</div>
  <div data-next-upsell-option data-next-package-id="124">2 years — $29.99</div>

  <button data-next-upsell-action="add" data-next-url="/receipt/">Add selected</button>
</div>
```

### Option C — quantity control

Add increase/decrease buttons and a display; quantity is clamped to 1–10.

```html
<div data-next-upsell="offer" data-next-package-id="123">
  <button data-next-upsell-quantity="decrease">−</button>
  <span data-next-upsell-quantity="display">1</span>
  <button data-next-upsell-quantity="increase">+</button>

  <button data-next-upsell-action="add" data-next-url="/receipt/">Add to order</button>
</div>
```

### Option D — shared next-page URLs via meta tags

Set the accept/skip targets once for the whole page instead of on each button:

```html
<meta name="next-upsell-accept-url" content="/upsell-2/">
<meta name="next-upsell-decline-url" content="/receipt/">
```

## Verify it is working

Open the browser console on the upsell page. You should see:

```
[UpsellEnhancer] UpsellEnhancer initialized { mode: 'direct', packageId: 123, ... }
```

Then:

- The offer element gets the `next-available` class when the order supports upsells (and `next-hidden` when it does not).
- Clicking add logs `Adding upsell to order:` then `Upsell added successfully`, emits `upsell:added`, briefly adds `next-success`, and redirects to your next URL.
- If nothing can be added you will see the `next-error` class and an "Unable to add upsell at this time" message.

## Next steps

- See every option and card: [use-cases.md](./use-cases.md)
- Configure all attributes: [reference/attributes.md](./reference/attributes.md)
- See what events it emits: [reference/events.md](./reference/events.md)
- Understand what can go wrong: [reference/errors.md](./reference/errors.md)
