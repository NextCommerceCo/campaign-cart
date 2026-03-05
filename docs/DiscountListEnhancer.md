# DiscountListEnhancer

Display cart-level and item-level discounts with descriptions and amounts.

## Overview

The `DiscountListEnhancer` automatically displays offer discounts and voucher discounts applied to the cart. It supports both order-level discounts (from `cart.discountDetails`) and item-level discounts (from individual cart items).

## Features

- ✅ **Automatic Updates** - Syncs with cart state changes
- ✅ **Flexible Templates** - Inline, external, or default templates
- ✅ **Multiple Discount Types** - Shows offers and vouchers
- ✅ **Item-Level Support** - Optional display of per-item discounts
- ✅ **Smart Grouping** - Prevents duplicate display of same offers
- ✅ **Custom Styling** - Full control over appearance
- ✅ **Empty States** - Configurable messaging when no discounts

## Basic Usage

### Minimal Setup

```html
<div data-next-discount-list></div>
```

This creates a discount list with the default template.

### With Empty State

```html
<div data-next-discount-list
     data-empty-template="<p>No discounts applied</p>">
</div>
```

## Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `data-next-discount-list` | Required | Main identifier for the enhancer |
| `data-discount-template` | Optional | Inline template string for discount items |
| `data-discount-template-id` | Optional | ID of template element |
| `data-discount-template-selector` | Optional | CSS selector for template element |
| `data-empty-template` | Optional | Template to show when no discounts |
| `data-show-item-discounts` | Optional | Show item-level discounts separately (default: false) |
| `data-group-by-offer` | Optional | Group discounts by offer ID (default: true) |

## Template Variables

Use these variables in your discount templates:

### Basic Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{discount.name}` | Discount name | "SAVE20" |
| `{discount.description}` | Discount description | "20% off your order" |
| `{discount.amount}` | Formatted discount amount | "$15.99" |
| `{discount.amount.raw}` | Raw discount amount (number) | 15.99 |
| `{discount.type}` | Type: 'offer' or 'voucher' | "offer" |
| `{discount.offerId}` | Offer ID (if applicable) | 123 |
| `{discount.isItemLevel}` | 'true' if item-level discount | "false" |
| `{discount.packageId}` | Package ID (for item-level) | 456 |

### Display Helper Classes

These output `"show"` or `"hide"` for conditional display:

| Variable | Description |
|----------|-------------|
| `{discount.showDescription}` | Show if description exists |
| `{discount.showOfferId}` | Show if offer ID exists |
| `{discount.showPackageId}` | Show if package ID exists |
| `{discount.isOffer}` | 'true' if type is 'offer' |
| `{discount.isVoucher}` | 'true' if type is 'voucher' |

## Examples

### Example 1: Custom Inline Template

```html
<div data-next-discount-list
     data-discount-template='
       <div class="discount-badge">
         <span>{discount.name}</span>
         <strong>-{discount.amount}</strong>
       </div>
     '>
</div>
```

### Example 2: External Template with Conditionals

```html
<!-- Template element (hidden) -->
<template id="my-discount-template">
  <div class="discount-item" data-discount-type="{discount.type}">
    <div class="discount-info">
      <h4>{discount.name}</h4>
      <p class="{discount.showDescription}">{discount.description}</p>
      <span class="{discount.showOfferId}">Offer #{discount.offerId}</span>
    </div>
    <div class="discount-savings">-{discount.amount}</div>
  </div>
</template>

<!-- Discount list -->
<div data-next-discount-list
     data-discount-template-id="my-discount-template"
     data-empty-template="<p>No discounts</p>">
</div>
```

### Example 3: Show Item-Level Discounts

```html
<div data-next-discount-list
     data-show-item-discounts="true"
     data-group-by-offer="false">
</div>
```

**Note:** When `data-show-item-discounts="true"` and `data-group-by-offer="true"` (default), item-level discounts with the same offer ID as cart-level discounts will be grouped together to avoid duplication.

### Example 4: Default Template (No Configuration)

The default template provides a clean, functional layout:

```html
<div class="discount-item" data-discount-type="{discount.type}" data-offer-id="{discount.offerId}">
  <div class="discount-details">
    <div class="discount-name">{discount.name}</div>
    <div class="discount-description {discount.showDescription}">{discount.description}</div>
  </div>
  <div class="discount-amount">-{discount.amount}</div>
</div>
```

## Styling

### Basic CSS

```css
.discount-list {
  margin-top: 16px;
}

.discount-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background: #f0fdf4;
  border-radius: 6px;
  border-left: 4px solid #10b981;
}

.discount-item[data-discount-type="voucher"] {
  background: #eff6ff;
  border-left-color: #3b82f6;
}

.discount-name {
  font-weight: 600;
  color: #1f2937;
}

.discount-description {
  font-size: 0.875rem;
  color: #6b7280;
  margin-top: 4px;
}

.discount-amount {
  font-weight: 700;
  color: #10b981;
  font-size: 1.125rem;
}

.discount-list-empty {
  text-align: center;
  padding: 20px;
  color: #9ca3af;
  font-style: italic;
}

/* Hide utility class for conditional display */
.hide {
  display: none !important;
}
```

### State Classes

The enhancer automatically adds these classes:

- `.discount-list-empty` - When no discounts are present
- `.discount-list-has-items` - When discounts are displayed

## Integration with Coupon System

The `DiscountListEnhancer` works seamlessly with the `CouponEnhancer`:

```html
<!-- Coupon input -->
<div data-next-coupon>
  <input type="text" data-next-coupon="input" placeholder="Coupon code">
  <button data-next-coupon="apply">Apply</button>
</div>

<!-- Discount list (auto-updates when coupons applied) -->
<div data-next-discount-list
     data-empty-template="<p>Enter a coupon code above</p>">
</div>
```

## How Discounts Work

### Cart-Level Discounts

Cart-level discounts from `cartState.discountDetails` are always shown:

- **Offer Discounts** - Applied automatically based on campaign configuration
- **Voucher Discounts** - Applied via coupon codes

### Item-Level Discounts

Item-level discounts from `cartItem.discounts` are only shown when:

1. `data-show-item-discounts="true"` is set
2. The discount hasn't already been displayed at cart level (when grouping is enabled)

### Grouping Behavior

| Setting | Behavior |
|---------|----------|
| `data-group-by-offer="true"` (default) | Same offer IDs shown once (cart-level takes priority) |
| `data-group-by-offer="false"` | All discounts shown separately, including duplicates |

## API

### Public Methods

```javascript
// Get reference to enhancer
const discountList = document.querySelector('[data-next-discount-list]');

// Get count of displayed discounts
const count = discountList.nextEnhancer.getDiscountCount();

// Force refresh
discountList.nextEnhancer.refresh();
```

## Data Source

The enhancer pulls discount data from:

1. **`cartState.discountDetails.offerDiscounts`** - Cart-level offer discounts
2. **`cartState.discountDetails.voucherDiscounts`** - Cart-level voucher discounts
3. **`cartItem.discounts`** - Item-level discounts (when enabled)

### Expected API Response Structure

```typescript
// Cart state structure
{
  discountDetails: {
    offerDiscounts: [
      {
        offer_id: 123,
        amount: "15.99",
        name: "Summer Sale",
        description: "20% off all products"
      }
    ],
    voucherDiscounts: [
      {
        amount: "10.00",
        name: "SAVE10",
        description: "$10 off your order"
      }
    ]
  },
  items: [
    {
      packageId: 456,
      discounts: [
        {
          offer_id: 789,
          amount: "5.00",
          name: "Product Discount",
          description: "Special offer on this item"
        }
      ]
    }
  ]
}
```

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <meta name="next-api-key" content="your-api-key">
  <style>
    .discount-list { margin: 20px 0; }
    .discount-item {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      margin-bottom: 8px;
      background: #f0fdf4;
      border-radius: 6px;
      border-left: 4px solid #10b981;
    }
    .discount-item[data-discount-type="voucher"] {
      background: #eff6ff;
      border-left-color: #3b82f6;
    }
    .discount-name { font-weight: 600; }
    .discount-amount { font-weight: 700; color: #10b981; }
    .hide { display: none !important; }
  </style>
</head>
<body>
  <h2>Your Savings</h2>

  <!-- Discount list with custom template -->
  <div data-next-discount-list
       data-discount-template='
         <div class="discount-item" data-discount-type="{discount.type}">
           <div>
             <div class="discount-name">{discount.name}</div>
             <div class="discount-description {discount.showDescription}">
               {discount.description}
             </div>
           </div>
           <div class="discount-amount">-{discount.amount}</div>
         </div>
       '
       data-empty-template='<p style="color: #999;">Add a coupon to save more!</p>'
       class="discount-list">
  </div>

  <script src="path/to/nextcommerce-sdk.js"></script>
</body>
</html>
```

## Troubleshooting

### Discounts Not Showing

1. **Check campaign configuration** - Ensure offers/vouchers are configured in NextCommerce
2. **Verify cart state** - Use browser console: `useCartStore.getState().discountDetails`
3. **Check API response** - Look at network tab for cart summary API response
4. **Enable debug mode** - Add `?debugger=true` to URL

### Duplicate Discounts

If seeing duplicates:
- Set `data-group-by-offer="true"` (or remove attribute, it's default)
- This groups item-level and cart-level discounts with same offer ID

### Template Not Rendering

1. Check template syntax - ensure curly braces are correct: `{discount.name}`
2. If using template ID, verify the element exists: `document.getElementById('your-id')`
3. Check browser console for errors

### Empty State Not Showing

- Ensure `data-empty-template` attribute has valid HTML
- Check that there truly are no discounts in cart state

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## See Also

- [CouponEnhancer](./CouponEnhancer.md) - Apply discount codes
- [CartItemListEnhancer](./CartItemListEnhancer.md) - Display cart items
- [CartDisplayEnhancer](./CartDisplayEnhancer.md) - Cart totals and summaries
