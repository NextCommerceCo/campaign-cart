# Offer Enhancers - Quick Start Guide

Quick reference for implementing offer packages like the example in your screenshot.

## Your Example Implementation

Based on your screenshot showing "Choose your package" with 1x, 2x, 3x units:

```html
<!-- Timer/Reservation Display -->
<div class="reservation-timer">
  Your order is reserved for: <strong>06:26</strong>. Stay on this page.
</div>

<!-- Package Selector -->
<section class="package-selection">
  <h2>Choose your package</h2>

  <div data-next-offer-selector
       data-next-offer-id="123"
       data-next-selection-mode="swap"
       class="package-grid">

    <!-- 1x Unit Package -->
    <div data-next-offer-package-card
         data-next-package-id="100"
         data-next-quantity="1"
         class="package-card">

      <div class="package-header">
        <h3>1x Unit</h3>
        <p>Next Commerce Shirts</p>
      </div>

      <div class="pricing">
        <span class="sale-price">$39.98</span>
      </div>

      <div class="savings-badge">Save 50% OFF</div>
    </div>

    <!-- 2x Units Package (Most Popular) -->
    <div data-next-offer-package-card
         data-next-package-id="101"
         data-next-quantity="1"
         data-next-selected="true"
         class="package-card featured">

      <!-- Auto Badge -->
      <div data-next-offer-badge
           data-next-badge-text="⭐ Most Popular"
           data-next-badge-type="popular"
           data-next-badge-position="top-right">
      </div>

      <div class="package-header">
        <h3>2x Units</h3>
        <p>Next Commerce Shirts</p>
      </div>

      <div class="pricing">
        <span class="original-price">$39.98</span>
        <span class="sale-price">$19.99<small>/ea</small></span>
      </div>

      <div class="savings-badge highlighted">Save 55% OFF</div>
    </div>

    <!-- 3x Units Package (Best Deal) -->
    <div data-next-offer-package-card
         data-next-package-id="102"
         data-next-quantity="1"
         class="package-card best">

      <!-- Auto Badge -->
      <div data-next-offer-badge
           data-next-badge-text="★ Best Deal"
           data-next-badge-type="deal"
           data-next-badge-position="top-right">
      </div>

      <div class="package-header">
        <h3>3x Units</h3>
        <p>Next Commerce Shirts</p>
      </div>

      <div class="pricing">
        <span class="original-price">$39.98</span>
        <span class="sale-price">$15.99<small>/ea</small></span>
      </div>

      <div class="savings-badge highlighted">Save 60% OFF</div>
    </div>

  </div>
</section>

<!-- Variant Selection for Multiple Units -->
<section class="variant-selection">
  <h3>Select your color and size</h3>

  <div data-next-offer-variant-selector
       data-next-package-id="101"
       data-next-units="2"
       data-next-require-all="true">

    <!-- Unit #1 -->
    <div data-next-variant-unit="1" class="variant-unit-card">
      <div class="unit-header">
        <span class="unit-badge">#1</span>
        <img src="/product.jpg" alt="Product" class="product-thumb">
      </div>

      <!-- Color Selector -->
      <div data-next-variant-group="color" data-next-unit="1" class="variant-group">
        <label>Select Color:</label>
        <div class="color-selector">
          <select data-next-variant-selector>
            <option value="">Choose...</option>
            <option value="black">● Black</option>
            <option value="white">○ White</option>
          </select>
        </div>
      </div>

      <!-- Size Selector -->
      <div data-next-variant-group="size" data-next-unit="1" class="variant-group">
        <label>Select Size:</label>
        <select data-next-variant-selector>
          <option value="">Choose...</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <!-- Unit Pricing -->
      <div class="unit-price">
        <span class="old-price">$39.98</span>
        <strong class="new-price">$19.99/ea</strong>
        <span class="savings">Save 55% OFF</span>
      </div>
    </div>

    <!-- Unit #2 -->
    <div data-next-variant-unit="2" class="variant-unit-card">
      <div class="unit-header">
        <span class="unit-badge">#2</span>
        <img src="/product.jpg" alt="Product" class="product-thumb">
      </div>

      <div data-next-variant-group="color" data-next-unit="2" class="variant-group">
        <label>Select Color:</label>
        <select data-next-variant-selector>
          <option value="">Choose...</option>
          <option value="black">● Black</option>
          <option value="white">○ White</option>
        </select>
      </div>

      <div data-next-variant-group="size" data-next-unit="2" class="variant-group">
        <label>Select Size:</label>
        <select data-next-variant-selector>
          <option value="">Choose...</option>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </div>

      <div class="unit-price">
        <span class="old-price">$39.98</span>
        <strong class="new-price">$19.99/ea</strong>
        <span class="savings">Save 55% OFF</span>
      </div>
    </div>

  </div>
</section>
```

## Minimal CSS to Match Your Screenshot

```css
/* Package Grid */
.package-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 24px 0;
}

/* Package Card */
.package-card {
  position: relative;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  cursor: pointer;
  background: white;
  transition: all 0.3s ease;
}

.package-card:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

/* Selected State */
.package-card.next-selected,
.package-card.next-offer-selected {
  border-color: #3b82f6;
  border-width: 3px;
  background: #eff6ff;
}

/* Featured Package */
.package-card.featured {
  border-color: #f59e0b;
}

/* Pricing */
.pricing {
  margin: 16px 0;
}

.original-price {
  display: block;
  color: #9ca3af;
  text-decoration: line-through;
  font-size: 16px;
  margin-bottom: 4px;
}

.sale-price {
  display: block;
  color: #3b82f6;
  font-size: 28px;
  font-weight: 700;
}

.sale-price small {
  font-size: 14px;
  color: #6b7280;
}

/* Savings Badge */
.savings-badge {
  background: #ef4444;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  display: inline-block;
  margin-top: 12px;
}

.savings-badge.highlighted {
  background: linear-gradient(135deg, #ef4444 0%, #f97316 100%);
  animation: pulse 2s infinite;
}

/* Badge Styling */
.next-offer-badge {
  position: absolute;
  top: -12px;
  right: -12px;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: white;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.badge-deal {
  background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%);
}

/* Variant Units */
.variant-unit-card {
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  background: white;
}

.variant-unit-card.variant-unit-complete {
  border-color: #10b981;
  background: #f0fdf4;
}

.unit-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.unit-badge {
  background: #3b82f6;
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

.product-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
}

/* Variant Selects */
.variant-group {
  margin-bottom: 16px;
}

.variant-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  font-size: 14px;
}

.variant-group select {
  width: 100%;
  padding: 10px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
}

.variant-group select:focus {
  outline: none;
  border-color: #3b82f6;
}

/* Unit Pricing */
.unit-price {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
  text-align: right;
}

.old-price {
  color: #9ca3af;
  text-decoration: line-through;
  font-size: 14px;
  margin-right: 8px;
}

.new-price {
  color: #3b82f6;
  font-size: 18px;
  font-weight: 700;
}

.unit-price .savings {
  display: block;
  color: #ef4444;
  font-size: 12px;
  font-weight: 600;
  margin-top: 4px;
}

/* Responsive */
@media (max-width: 768px) {
  .package-grid {
    grid-template-columns: 1fr;
  }
}

/* Animation */
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
```

## Quick Tips

### 1. Making Packages from Your Campaign Data

If you have offer data in your campaign:

```html
<!-- The enhancer will automatically load pricing from campaign -->
<div data-next-offer-selector
     data-next-offer-id="123">  <!-- Loads from campaign.offers -->
</div>
```

### 2. Auto-Selecting Best Deal

```html
<div data-next-offer-selector
     data-next-auto-select-best="true">
  <!-- Automatically selects package with highest savings -->
</div>
```

### 3. Syncing Variants Across All Units

```html
<!-- When user selects "Black" for unit 1, all units become "Black" -->
<div data-next-offer-variant-selector
     data-next-sync-all="true">
</div>
```

### 4. Auto-Detecting Badges

```html
<!-- Badge automatically shows based on savings % -->
<div data-next-offer-badge
     data-next-offer-id="123"
     data-next-auto-detect="true">
</div>
```

Rules:
- ≥60% = "Best Deal" ⭐
- ≥50% = "Most Popular" 🔥
- Otherwise = "X% OFF"

## JavaScript Integration

### Get Selected Package

```javascript
const selector = document.querySelector('[data-next-offer-selector]');
const selectedPkg = selector._getSelectedPackage();

console.log(selectedPkg.packageId);
console.log(selectedPkg.savingsPercent + '%');
```

### Get Variant Selections

```javascript
const variantSelector = document.querySelector('[data-next-offer-variant-selector]');
const selections = variantSelector._getSelections();

// Returns: { 1: { color: 'black', size: 'medium' }, 2: { color: 'white', size: 'large' } }
console.log(selections);
```

### Validate Before Checkout

```javascript
const variantSelector = document.querySelector('[data-next-offer-variant-selector]');

if (!variantSelector._isValid()) {
  alert('Please select color and size for all items');
  return;
}

// Proceed to checkout
```

## Event Handling

```javascript
import { EventBus } from '@nextcommerce/campaign-cart';

// Package selected
EventBus.on('offer-package:selected', (data) => {
  console.log('Package:', data.packageId);
  console.log('Savings:', data.savings + '%');
});

// Variant selected
EventBus.on('variant:selected', (data) => {
  console.log(`Unit ${data.unit}: ${data.attribute} = ${data.value}`);
});

// All variants complete
EventBus.on('variant:all-selected', (data) => {
  console.log('All selections:', data.selections);
  // Enable checkout button
});
```

## Common Patterns

### Pattern 1: Simple Package Selector (No Variants)

Just packages, no per-unit customization:

```html
<div data-next-offer-selector data-next-offer-id="123">
  <div data-next-offer-package-card data-next-package-id="100">1x</div>
  <div data-next-offer-package-card data-next-package-id="101">2x</div>
  <div data-next-offer-package-card data-next-package-id="102">3x</div>
</div>
```

### Pattern 2: Package + Variants

Packages with per-unit customization (like your screenshot):

```html
<!-- Package selector -->
<div data-next-offer-selector>...</div>

<!-- Variant selector (shown conditionally) -->
<div data-next-offer-variant-selector data-next-units="2">...</div>
```

### Pattern 3: Bundle with Conditions

Show progress toward qualifying:

```html
<div data-next-offer-condition
     data-next-offer-id="123"
     data-next-show-progress="true">
  <div data-condition-progress-bar>
    <div data-condition-progress-fill></div>
  </div>
  <div data-condition-not-met-message>
    Add {remaining} more to get this deal!
  </div>
</div>
```

## Need More Help?

- Full Documentation: [OfferEnhancers.md](./OfferEnhancers.md)
- Main SDK Docs: [../README.md](../README.md)
- Examples: [../examples/](../examples/)
