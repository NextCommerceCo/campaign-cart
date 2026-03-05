# Offer Enhancers Documentation

Complete guide to implementing offer packages in your e-commerce campaigns using the Campaign Cart SDK.

## Table of Contents

1. [Overview](#overview)
2. [OfferPackageSelectorEnhancer](#offerpackageselectorenhancer)
3. [OfferVariantSelectorEnhancer](#offervariantselectorenhancer)
4. [OfferDisplayEnhancer](#offerdisplayenhancer)
5. [OfferBadgeEnhancer](#offerbadgeenhancer)
6. [OfferConditionDisplayEnhancer](#offerconditiondisplayenhancer)
6. [Complete Example](#complete-example)
7. [Styling Guide](#styling-guide)

---

## Overview

The Offer Enhancers provide a complete system for implementing multi-tier pricing, variant selection, and promotional offers commonly seen in e-commerce platforms.

**Key Features:**
- Multi-tier package selection (1x, 2x, 3x units)
- Per-unit variant selection (colors, sizes, etc.)
- Dynamic badges (Most Popular, Best Deal)
- Savings display and calculations
- Condition tracking and validation
- Cart integration

---

## OfferPackageSelectorEnhancer

Manages multi-tier package selection with badges, pricing, and discounts.

### Basic Usage

```html
<div data-next-offer-selector
     data-next-offer-id="123"
     data-next-selection-mode="swap">

  <!-- 1x Package -->
  <div data-next-offer-package-card
       data-next-package-id="100"
       data-next-quantity="1">
    <h3>1x Unit</h3>
    <div class="package-title">Next Commerce Shirts</div>
    <div data-next-package-price>$39.98</div>
    <div>Save 50% OFF</div>
  </div>

  <!-- 2x Package (Most Popular) -->
  <div data-next-offer-package-card
       data-next-package-id="101"
       data-next-quantity="1"
       data-next-badge="Most Popular"
       data-next-badge-type="popular"
       data-next-selected="true">
    <h3>2x Units</h3>
    <div class="package-title">Next Commerce Shirts</div>
    <div data-next-package-price>$19.99/ea</div>
    <div>Save 55% OFF</div>
  </div>

  <!-- 3x Package (Best Deal) -->
  <div data-next-offer-package-card
       data-next-package-id="102"
       data-next-quantity="1"
       data-next-badge="Best Deal"
       data-next-badge-type="deal">
    <h3>3x Units</h3>
    <div class="package-title">Next Commerce Shirts</div>
    <div data-next-package-price>$15.99/ea</div>
    <div>Save 60% OFF</div>
  </div>

</div>
```

### Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `data-next-offer-selector` | Main identifier (required) | - |
| `data-next-offer-id` | Offer ID from campaign data | - |
| `data-next-selection-mode` | `swap` or `select` | `swap` |
| `data-next-auto-select-best` | Auto-select best deal | `false` |

### Card Attributes

| Attribute | Description | Required |
|-----------|-------------|----------|
| `data-next-offer-package-card` | Identifies package card | ✓ |
| `data-next-package-id` | Package ID to add to cart | ✓ |
| `data-next-quantity` | Quantity | Default: 1 |
| `data-next-badge` | Badge text | - |
| `data-next-badge-type` | Badge style | - |
| `data-next-selected` | Pre-selected state | `false` |
| `data-next-shipping-id` | Shipping method ID | - |

### Events

```javascript
// Listen for package selection
eventBus.on('offer-package:selected', (data) => {
  console.log('Package selected:', data.packageId);
  console.log('Savings:', data.savings + '%');
});

// Listen for selection changes
eventBus.on('offer-package:selection-changed', (data) => {
  console.log('Selection changed to:', data.packageId);
});
```

---

## OfferVariantSelectorEnhancer

Manages per-unit variant selection within offer packages.

### Basic Usage

```html
<div data-next-offer-variant-selector
     data-next-package-id="101"
     data-next-units="2"
     data-next-require-all="true">

  <!-- Unit 1 -->
  <div data-next-variant-unit="1" class="variant-unit">
    <div class="unit-label">#1</div>

    <!-- Color selector -->
    <div data-next-variant-group="color" data-next-unit="1">
      <label>Select Color:</label>
      <select data-next-variant-selector>
        <option value="">Choose...</option>
        <option value="black">Black</option>
        <option value="white">White</option>
        <option value="red">Red</option>
      </select>
    </div>

    <!-- Size selector -->
    <div data-next-variant-group="size" data-next-unit="1">
      <label>Select Size:</label>
      <select data-next-variant-selector>
        <option value="">Choose...</option>
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </div>
  </div>

  <!-- Unit 2 -->
  <div data-next-variant-unit="2" class="variant-unit">
    <div class="unit-label">#2</div>

    <div data-next-variant-group="color" data-next-unit="2">
      <label>Select Color:</label>
      <select data-next-variant-selector>
        <option value="">Choose...</option>
        <option value="black">Black</option>
        <option value="white">White</option>
        <option value="red">Red</option>
      </select>
    </div>

    <div data-next-variant-group="size" data-next-unit="2">
      <label>Select Size:</label>
      <select data-next-variant-selector>
        <option value="">Choose...</option>
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
    </div>
  </div>

</div>
```

### Attributes

| Attribute | Description | Default |
|-----------|-------------|---------|
| `data-next-offer-variant-selector` | Main identifier | - |
| `data-next-package-id` | Package ID | - |
| `data-next-units` | Number of units | `1` |
| `data-next-require-all` | Require all variants | `true` |
| `data-next-sync-all` | Sync all units to same selection | `false` |
| `data-next-show-validation` | Show validation messages | `true` |

### Sync All Units Example

```html
<!-- When user selects color for unit 1, all units get same color -->
<div data-next-offer-variant-selector
     data-next-units="3"
     data-next-sync-all="true">
  <!-- Unit configurations -->
</div>
```

### Events

```javascript
eventBus.on('variant:selected', (data) => {
  console.log(`Unit ${data.unit}: ${data.attribute} = ${data.value}`);
});

eventBus.on('variant:all-selected', (data) => {
  console.log('All variants selected:', data.selections);
  // Example: { 1: { color: 'black', size: 'medium' }, 2: { color: 'white', size: 'large' } }
});

eventBus.on('variant:validation-failed', (data) => {
  console.log('Incomplete units:', data.incompleteUnits);
});
```

---

## OfferDisplayEnhancer

Displays offer benefits, conditions, and pricing information.

### Basic Usage

```html
<div data-next-offer-display
     data-next-offer-id="123"
     data-next-show-benefit="true"
     data-next-show-condition="true">

  <h2 data-offer-name></h2>

  <div class="offer-benefit">
    <p data-offer-benefit-description></p>
    <strong data-offer-benefit-value></strong>
  </div>

  <div class="offer-condition">
    <p data-offer-condition-description></p>
  </div>

  <div class="savings">
    <span data-offer-savings-percent></span>
    <span data-offer-savings-amount></span>
  </div>

</div>
```

### Display Elements

| Element Attribute | Content | Format |
|------------------|---------|--------|
| `data-offer-name` | Offer name | Text |
| `data-offer-benefit-description` | Benefit description | Text |
| `data-offer-benefit-value` | Benefit value | Formatted |
| `data-offer-condition-description` | Condition description | Text |
| `data-offer-savings-percent` | Savings percentage | `55%` |
| `data-offer-savings-amount` | Savings amount | `$10.00` |
| `data-offer-code` | Voucher code | Text |

### Custom Formatting

```html
<!-- Apply custom formatting -->
<div data-offer-benefit-value data-format="percentage"></div>
<div data-offer-savings-amount data-format="currency"></div>
<div data-offer-code data-format="uppercase"></div>
```

---

## OfferBadgeEnhancer

Dynamically displays badges on offer packages.

### Static Badge

```html
<div data-next-offer-badge
     data-next-badge-text="Most Popular"
     data-next-badge-type="popular"
     data-next-badge-icon="🔥"
     data-next-badge-position="top-right">
</div>
```

### Auto-Detect Badge

```html
<!-- Badge automatically determined from offer data -->
<div data-next-offer-badge
     data-next-offer-id="123"
     data-next-auto-detect="true"
     data-next-show-savings="true">
</div>
```

**Auto-detection rules:**
- ≥60% savings → "Best Deal" (deal type)
- ≥50% savings → "Most Popular" (popular type)
- ≥40% savings → "X% OFF" (discount type)
- Voucher type → "Limited Offer" (limited type)

### Badge Types

| Type | Description | Auto-icon |
|------|-------------|-----------|
| `popular` | Most Popular | 🔥 |
| `deal` | Best Deal | ⭐ |
| `limited` | Limited Time | ⏰ |
| `discount` | Discount % | - |
| `new` | New Offer | ✨ |
| `recommended` | Recommended | 👍 |

### Badge Positions

- `top-left`
- `top-right` (default)
- `bottom-left`
- `bottom-right`

### Highlighted Badge

```html
<!-- Animated/highlighted badge -->
<div data-next-offer-badge
     data-next-badge-text="Limited Time!"
     data-next-badge-type="limited"
     data-next-highlight="true">
</div>
```

---

## OfferConditionDisplayEnhancer

Displays offer conditions with progress tracking.

### Basic Display

```html
<div data-next-offer-condition
     data-next-offer-id="123">
  <p data-condition-description></p>
  <p data-condition-status></p>
</div>
```

### With Progress Bar

```html
<div data-next-offer-condition
     data-next-offer-id="123"
     data-next-show-progress="true">

  <div data-condition-description></div>

  <!-- Progress bar -->
  <div data-condition-progress-bar class="progress-bar">
    <div data-condition-progress-fill class="progress-fill"></div>
  </div>

  <!-- Progress text -->
  <div data-condition-progress-text></div>
  <div data-condition-progress-percent></div>

</div>
```

### With Validation Messages

```html
<div data-next-offer-condition
     data-next-offer-id="123"
     data-next-show-validation="true">

  <div data-condition-description></div>

  <!-- Shown when condition is met -->
  <div data-condition-met-message class="success">
    ✓ You qualify for this offer!
  </div>

  <!-- Shown when condition is not met -->
  <div data-condition-not-met-message class="warning">
    Add {remaining} more items to qualify
  </div>

</div>
```

### Display Elements

| Element | Content |
|---------|---------|
| `data-condition-description` | Condition description |
| `data-condition-current` | Current value (e.g., 2) |
| `data-condition-value` | Required value (e.g., 3) |
| `data-condition-remaining` | Remaining (e.g., 1) |
| `data-condition-progress-text` | Progress text (e.g., "2/3") |
| `data-condition-progress-percent` | Percentage (e.g., "66%") |

### Events

```javascript
eventBus.on('condition:met', (data) => {
  console.log('Condition met for offer:', data.offerId);
});

eventBus.on('condition:progress-changed', (data) => {
  console.log('Progress:', data.progress);
});
```

---

## Complete Example

Here's a complete implementation combining all enhancers:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Offer Package Example</title>
  <style>
    /* See Styling Guide below */
  </style>
</head>
<body>

<!-- Offer Package Selector -->
<section class="offer-section">
  <h2>Choose your package</h2>

  <!-- Offer Condition Display -->
  <div data-next-offer-condition
       data-next-offer-id="123"
       data-next-show-progress="true"
       data-next-show-validation="true">
    <div data-condition-not-met-message>
      Add {remaining} more items to get this offer
    </div>
  </div>

  <!-- Package Selection -->
  <div data-next-offer-selector
       data-next-offer-id="123"
       data-next-selection-mode="swap"
       class="package-selector">

    <!-- 1x Package -->
    <div data-next-offer-package-card
         data-next-package-id="100"
         data-next-quantity="1"
         class="package-card">

      <div class="package-header">
        <h3>1x Unit</h3>
        <div class="package-subtitle">Next Commerce Shirts</div>
      </div>

      <div class="package-pricing">
        <div class="price-current">$39.98</div>
        <div class="price-original">$79.96</div>
      </div>

      <div class="package-savings">Save 50% OFF</div>
    </div>

    <!-- 2x Package (Most Popular) -->
    <div data-next-offer-package-card
         data-next-package-id="101"
         data-next-quantity="1"
         data-next-selected="true"
         class="package-card highlighted">

      <!-- Auto-detected badge -->
      <div data-next-offer-badge
           data-next-offer-id="123"
           data-next-auto-detect="true">
      </div>

      <div class="package-header">
        <h3>2x Units</h3>
        <div class="package-subtitle">Next Commerce Shirts</div>
      </div>

      <div class="package-pricing">
        <div class="price-current">$19.99<span>/ea</span></div>
        <div class="price-original">$39.98</div>
      </div>

      <div class="package-savings">Save 55% OFF</div>
    </div>

    <!-- 3x Package (Best Deal) -->
    <div data-next-offer-package-card
         data-next-package-id="102"
         data-next-quantity="1"
         class="package-card best-deal">

      <div data-next-offer-badge
           data-next-badge-text="Best Deal"
           data-next-badge-type="deal"
           data-next-badge-icon="⭐">
      </div>

      <div class="package-header">
        <h3>3x Units</h3>
        <div class="package-subtitle">Next Commerce Shirts</div>
      </div>

      <div class="package-pricing">
        <div class="price-current">$15.99<span>/ea</span></div>
        <div class="price-original">$39.98</div>
      </div>

      <div class="package-savings">Save 60% OFF</div>
    </div>

  </div>

  <!-- Variant Selection -->
  <section class="variant-selection">
    <h3>Select your color and size</h3>

    <div data-next-offer-variant-selector
         data-next-package-id="101"
         data-next-units="2"
         data-next-require-all="true">

      <!-- Unit 1 -->
      <div data-next-variant-unit="1" class="variant-unit">
        <div class="unit-header">
          <span class="unit-number">#1</span>
          <img src="product-image.jpg" alt="Product">
        </div>

        <div data-next-variant-group="color" data-next-unit="1">
          <label>Select Color:</label>
          <select data-next-variant-selector class="variant-select">
            <option value="">Choose...</option>
            <option value="black">⚫ Black</option>
            <option value="white">⚪ White</option>
            <option value="red">🔴 Red</option>
          </select>
        </div>

        <div data-next-variant-group="size" data-next-unit="1">
          <label>Select Size:</label>
          <select data-next-variant-selector class="variant-select">
            <option value="">Choose...</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div class="unit-pricing">
          <span class="original-price">$39.98</span>
          <strong class="sale-price">$19.99/ea</strong>
          <span class="savings">Save 55% OFF</span>
        </div>
      </div>

      <!-- Unit 2 -->
      <div data-next-variant-unit="2" class="variant-unit">
        <div class="unit-header">
          <span class="unit-number">#2</span>
          <img src="product-image.jpg" alt="Product">
        </div>

        <div data-next-variant-group="color" data-next-unit="2">
          <label>Select Color:</label>
          <select data-next-variant-selector class="variant-select">
            <option value="">Choose...</option>
            <option value="black">⚫ Black</option>
            <option value="white">⚪ White</option>
            <option value="red">🔴 Red</option>
          </select>
        </div>

        <div data-next-variant-group="size" data-next-unit="2">
          <label>Select Size:</label>
          <select data-next-variant-selector class="variant-select">
            <option value="">Choose...</option>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>

        <div class="unit-pricing">
          <span class="original-price">$39.98</span>
          <strong class="sale-price">$19.99/ea</strong>
          <span class="savings">Save 55% OFF</span>
        </div>
      </div>

    </div>
  </section>

  <!-- Offer Details -->
  <div data-next-offer-display
       data-next-offer-id="123"
       class="offer-details">
    <h4 data-offer-name></h4>
    <p data-offer-benefit-description></p>
  </div>

</section>

<script src="campaign-cart.js"></script>
</body>
</html>
```

---

## Styling Guide

### CSS for Package Selector

```css
/* Package Selector Container */
.package-selector {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin: 20px 0;
}

/* Package Card */
.package-card {
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  background: white;
}

.package-card:hover {
  border-color: #4CAF50;
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}

/* Selected state */
.package-card.next-selected,
.package-card.next-offer-selected {
  border-color: #4CAF50;
  border-width: 3px;
  background: #f1f8f4;
}

/* Highlighted/Popular card */
.package-card.highlighted {
  border-color: #FF9800;
}

/* Best Deal card */
.package-card.best-deal {
  border-color: #2196F3;
}

/* Package Header */
.package-header h3 {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
}

.package-subtitle {
  color: #666;
  font-size: 14px;
}

/* Pricing */
.package-pricing {
  margin: 16px 0;
}

.price-current {
  font-size: 32px;
  font-weight: 700;
  color: #2196F3;
}

.price-current span {
  font-size: 16px;
  font-weight: 400;
  color: #666;
}

.price-original {
  font-size: 18px;
  color: #999;
  text-decoration: line-through;
  margin-top: 4px;
}

/* Savings */
.package-savings {
  background: #FF5722;
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-weight: 600;
  display: inline-block;
  margin-top: 12px;
}
```

### CSS for Badges

```css
/* Badge Container */
.next-offer-badge {
  position: absolute;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* Badge Positions */
.badge-top-right {
  top: -10px;
  right: -10px;
}

.badge-top-left {
  top: -10px;
  left: -10px;
}

.badge-bottom-right {
  bottom: -10px;
  right: -10px;
}

.badge-bottom-left {
  bottom: -10px;
  left: -10px;
}

/* Badge Types */
.badge-popular {
  background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
  color: white;
}

.badge-deal {
  background: linear-gradient(135deg, #4CAF50 0%, #45B7D1 100%);
  color: white;
}

.badge-limited {
  background: linear-gradient(135deg, #FFA726 0%, #FB8C00 100%);
  color: white;
}

.badge-discount {
  background: #2196F3;
  color: white;
}

/* Highlighted Badge Animation */
.badge-highlight {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
```

### CSS for Variant Selector

```css
/* Variant Units Container */
.variant-unit {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  background: white;
}

.variant-unit.variant-unit-complete {
  border-color: #4CAF50;
  background: #f1f8f4;
}

.variant-unit.variant-unit-incomplete {
  border-color: #FF9800;
}

/* Unit Header */
.unit-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.unit-number {
  background: #2196F3;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
}

.unit-header img {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

/* Variant Selects */
.variant-select {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 14px;
  margin-top: 4px;
}

.variant-select:focus {
  outline: none;
  border-color: #2196F3;
}

/* Unit Pricing */
.unit-pricing {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e0e0e0;
  text-align: right;
}

.original-price {
  color: #999;
  text-decoration: line-through;
  font-size: 14px;
  margin-right: 8px;
}

.sale-price {
  color: #2196F3;
  font-size: 18px;
  font-weight: 700;
}

.savings {
  display: block;
  color: #FF5722;
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
}
```

### CSS for Condition Display

```css
/* Condition Container */
.condition-met {
  background: #E8F5E9;
  border: 2px solid #4CAF50;
  padding: 16px;
  border-radius: 8px;
}

.condition-not-met {
  background: #FFF3E0;
  border: 2px solid #FF9800;
  padding: 16px;
  border-radius: 8px;
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4CAF50 0%, #45B7D1 100%);
  transition: width 0.3s ease;
  border-radius: 4px;
}

/* Validation Messages */
[data-condition-met-message] {
  color: #2E7D32;
  font-weight: 600;
  padding: 12px;
  background: #E8F5E9;
  border-radius: 6px;
}

[data-condition-not-met-message] {
  color: #E65100;
  font-weight: 600;
  padding: 12px;
  background: #FFF3E0;
  border-radius: 6px;
}
```

---

## Best Practices

### 1. Always Validate Variants

```javascript
// Before allowing checkout, check if all variants are selected
const variantSelector = document.querySelector('[data-next-offer-variant-selector]');
if (variantSelector._isValid && !variantSelector._isValid()) {
  alert('Please select all variants');
  return;
}
```

### 2. Show Clear Pricing

Always display:
- Original price (struck through)
- Current price (prominent)
- Savings amount or percentage
- Price per unit for multi-unit packages

### 3. Use Badges Strategically

- Only one "Most Popular" per offer set
- "Best Deal" for highest discount tier
- Use sparingly to maintain impact

### 4. Mobile Responsiveness

```css
@media (max-width: 768px) {
  .package-selector {
    grid-template-columns: 1fr;
  }

  .package-card {
    padding: 16px;
  }

  .price-current {
    font-size: 24px;
  }
}
```

### 5. Accessibility

```html
<!-- Add ARIA labels -->
<div data-next-offer-package-card
     role="button"
     aria-label="Select 2x Units package, save 55%"
     tabindex="0">
  <!-- content -->
</div>
```

---

## TypeScript Integration

```typescript
import { OfferPackageSelectorEnhancer } from '@/enhancers/offers/OfferPackageSelectorEnhancer';
import { OfferVariantSelectorEnhancer } from '@/enhancers/offers/OfferVariantSelectorEnhancer';

// Access enhancer programmatically
const selectorElement = document.querySelector('[data-next-offer-selector]');
const selectedPackage = (selectorElement as any)._getSelectedPackage();

console.log('Selected package ID:', selectedPackage?.packageId);
console.log('Savings:', selectedPackage?.savingsPercent + '%');

// Get variant selections
const variantElement = document.querySelector('[data-next-offer-variant-selector]');
const selections = (variantElement as any)._getSelections();

console.log('Variant selections:', selections);
// Output: { 1: { color: 'black', size: 'medium' }, 2: { color: 'white', size: 'large' } }
```

---

## Troubleshooting

### Package not adding to cart
- Check `data-next-package-id` is correct
- Verify package exists in campaign data
- Check browser console for errors

### Variants not validating
- Ensure `data-next-variant-group` matches across units
- Check `data-next-unit` numbers are correct
- Verify `data-next-variant-selector` is on input/select element

### Badges not showing
- Check parent element has `position: relative`
- Verify badge type is valid
- Check z-index stacking

---

## Need Help?

For issues or questions:
- Check the [main documentation](../README.md)
- Review the [enhancer examples](../examples/)
- Submit an issue on GitHub

