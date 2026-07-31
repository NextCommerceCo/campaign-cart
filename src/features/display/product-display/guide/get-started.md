---
title: "Features/Display/Product Display/Get Started"
group: "Features"
category: "Product Display"
---

# Get Started

## Prerequisites

- The campaign is loaded into `useCampaignStore` (the SDK does this at init).
- You know the campaign **package id(s)** you want to show (from the Campaigns App).

## Setup

### Long form — id in the path

Each element names its package id explicitly:

```html
<div>
  <h3 data-next-display="package.123.name">Product Name</h3>
  <span data-next-display="package.123.price">$0.00</span>
  <s data-next-display="package.123.price_retail">$0.00</s>
</div>
```

### Shorthand — id from context

Put the id once on an ancestor; children use the short path. The same markup then works for any package by changing the ancestor id:

```html
<div data-next-package-id="123">
  <h3 data-next-display="package.name">Product Name</h3>
  <span data-next-display="package.price">$0.00</span>
</div>
```

### Show a computed saving

```html
<div data-next-package-id="123">
  <span data-next-display="package.savingsPercentage" data-next-format="percentage">0%</span>
  <span data-next-display="package.savingsAmount">$0.00</span>
</div>
```

### Hide an element when there's nothing to show

```html
<!-- hides the retail strikethrough when there is no saving -->
<s data-next-display="package.price_retail" data-hide-if-zero="true">$0.00</s>
```

### Multiply a price by a live quantity (upsell pages)

```html
<div data-next-package-id="123">
  <span data-next-display="package.price" data-next-multiply-quantity>$0.00</span>
</div>
```

## Verify it is working

Open the browser console. You should see:

```
[ProductDisplayEnhancer] ProductDisplayEnhancer initialized with package 123, path: package.price, format: currency, multiplyByQuantity: false
[ProductDisplayEnhancer] Package 123 loaded with price: 29.99 USD
```

Then:

- Each bound element shows the real value (not the `$0.00` placeholder), formatted.
- Switching currency (a `next:currency-changed` event) re-renders every bound element.
- If you see `No package context found` or `Package 123 not found`, the id is missing or wrong (see [errors](./reference/errors.md)).

## Next steps

- Every path this feature can display: [reference/display-paths.md](./reference/display-paths.md)
- Every property you can display: [reference/object-attributes.md](./reference/object-attributes.md)
- All config attributes: [reference/attributes.md](./reference/attributes.md)
- What can go wrong: [reference/errors.md](./reference/errors.md)
