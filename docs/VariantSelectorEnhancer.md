# Variant Option Selector Enhancer

The **Variant Option Selector Enhancer** simplifies building variant selection UIs (Size, Color, Material, etc.) for frontend developers. It automatically handles variant data extraction, selection state, and cart integration.

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Templates](#templates)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)
- [Events](#events)
- [Helper Utilities](#helper-utilities)

---

## Quick Start

### Simple Size Selector

```html
<div data-next-variant-selector
     data-next-attribute-code="size"
     data-next-base-package-id="100"
     data-next-swap-mode="true">

  <button data-next-variant-option
          data-next-variant-value="Small"
          data-next-package-id="100">
    Small
  </button>

  <button data-next-variant-option
          data-next-variant-value="Medium"
          data-next-package-id="101">
    Medium
  </button>

  <button data-next-variant-option
          data-next-variant-value="Large"
          data-next-package-id="102">
    Large
  </button>
</div>
```

### Auto-Populated Selector

```html
<div data-next-variant-selector
     data-next-attribute-code="color"
     data-next-base-package-id="100"
     data-next-auto-populate="true"
     data-next-template="button"
     data-next-auto-select="true">
  <!-- Options will be auto-generated from campaign data -->
</div>
```

### Dropdown Selector

```html
<select data-next-variant-selector
        data-next-attribute-code="size"
        data-next-base-package-id="100"
        data-next-swap-mode="true">

  <option data-next-variant-option
          data-next-variant-value="Small">
    Small
  </option>

  <option data-next-variant-option
          data-next-variant-value="Medium"
          data-next-selected="true">
    Medium
  </option>

  <option data-next-variant-option
          data-next-variant-value="Large">
    Large
  </option>
</select>
```

---

## Configuration

### Main Selector Attributes

| Attribute | Required | Description | Default |
|-----------|----------|-------------|---------|
| `data-next-variant-selector` | ✅ Yes | Identifies the enhancer | - |
| `data-next-attribute-code` | ✅ Yes | Variant attribute code (e.g., "size", "color") | - |
| `data-next-base-package-id` | No | Base package ID to find related variants | - |
| `data-next-auto-populate` | No | Auto-generate options from campaign data | `false` |
| `data-next-template` | No | Template type: "button", "option", "card" | `"button"` |
| `data-next-auto-select` | No | Auto-select first available option | `false` |
| `data-next-swap-mode` | No | Enable cart swap when variant selected | `false` |

### Option Attributes

| Attribute | Required | Description |
|-----------|----------|-------------|
| `data-next-variant-option` | ✅ Yes | Identifies a selectable variant option |
| `data-next-variant-value` | ✅ Yes | The variant attribute value (e.g., "Small") |
| `data-next-package-id` | No | Explicit package ID for this variant |
| `data-next-selected` | No | Pre-select this option |

---

## Templates

### Button Template (Default)

Creates clickable button elements for each variant option.

```html
<div data-next-variant-selector
     data-next-attribute-code="size"
     data-next-base-package-id="100"
     data-next-auto-populate="true"
     data-next-template="button">
  <!-- Generated output: -->
  <!-- <button class="next-variant-button" data-next-variant-option data-next-variant-value="Small">Small</button> -->
</div>
```

**CSS Classes Added:**
- `next-variant-button` - Applied to button element
- `next-variant-option` - Applied to all options
- `next-selected` - Applied to selected option
- `next-unavailable` - Applied to out-of-stock options

### Option Template

Creates `<option>` elements for `<select>` dropdowns.

```html
<select data-next-variant-selector
        data-next-attribute-code="color"
        data-next-base-package-id="100"
        data-next-auto-populate="true"
        data-next-template="option">
  <!-- Generated output: -->
  <!-- <option data-next-variant-option data-next-variant-value="Red">Red</option> -->
</select>
```

### Card Template

Creates card-style elements with value and price display.

```html
<div data-next-variant-selector
     data-next-attribute-code="size"
     data-next-base-package-id="100"
     data-next-auto-populate="true"
     data-next-template="card">
  <!-- Generated output: -->
  <!--
  <div class="next-variant-card" data-next-variant-option data-next-variant-value="Medium">
    <div class="variant-value">Medium</div>
    <div class="variant-price" data-next-display-price="101"></div>
  </div>
  -->
</div>
```

---

## Use Cases

### 1. Basic Size Selector with Manual Options

Perfect when you want full control over the HTML structure.

```html
<div class="size-selector">
  <h3>Choose Your Size</h3>

  <div data-next-variant-selector
       data-next-attribute-code="size"
       data-next-swap-mode="true">

    <button data-next-variant-option
            data-next-variant-value="Small"
            data-next-package-id="100"
            class="size-btn">
      S
    </button>

    <button data-next-variant-option
            data-next-variant-value="Medium"
            data-next-package-id="101"
            data-next-selected="true"
            class="size-btn">
      M
    </button>

    <button data-next-variant-option
            data-next-variant-value="Large"
            data-next-package-id="102"
            class="size-btn">
      L
    </button>
  </div>
</div>

<style>
  .size-btn {
    padding: 12px 24px;
    border: 2px solid #ddd;
    background: white;
    cursor: pointer;
  }

  .size-btn.next-selected {
    border-color: #007bff;
    background: #007bff;
    color: white;
  }

  .size-btn.next-unavailable {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
```

### 2. Auto-Populated Color Selector

Let the enhancer generate options from campaign data.

```html
<div class="color-selector">
  <label>Select Color:</label>

  <div data-next-variant-selector
       data-next-attribute-code="color"
       data-next-base-package-id="100"
       data-next-auto-populate="true"
       data-next-template="button"
       data-next-auto-select="true"
       data-next-swap-mode="true"
       class="color-options">
  </div>
</div>

<style>
  .color-options {
    display: flex;
    gap: 10px;
  }

  .next-variant-button {
    padding: 8px 16px;
    border-radius: 4px;
    border: 2px solid transparent;
    transition: all 0.2s;
  }

  .next-variant-button.next-selected {
    border-color: #28a745;
  }
</style>
```

### 3. Dropdown Variant Selector

Classic dropdown pattern for variant selection.

```html
<div class="variant-dropdown">
  <label for="material-select">Material:</label>

  <select id="material-select"
          data-next-variant-selector
          data-next-attribute-code="material"
          data-next-base-package-id="200"
          data-next-swap-mode="true">

    <option value="">Choose Material</option>

    <option data-next-variant-option
            data-next-variant-value="Cotton"
            data-next-package-id="200">
      Cotton
    </option>

    <option data-next-variant-option
            data-next-variant-value="Polyester"
            data-next-package-id="201">
      Polyester
    </option>

    <option data-next-variant-option
            data-next-variant-value="Silk"
            data-next-package-id="202">
      Silk - Premium
    </option>
  </select>
</div>
```

### 4. Card-Style Variant Display

Rich card layout with prices and descriptions.

```html
<div class="variant-cards">
  <h3>Choose Your Package</h3>

  <div data-next-variant-selector
       data-next-attribute-code="quantity"
       data-next-base-package-id="300"
       data-next-auto-populate="true"
       data-next-template="card"
       data-next-swap-mode="true"
       class="card-grid">
  </div>
</div>

<style>
  .card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  .next-variant-card {
    padding: 20px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .next-variant-card:hover {
    border-color: #007bff;
  }

  .next-variant-card.next-selected {
    border-color: #007bff;
    background: #f0f8ff;
  }

  .variant-value {
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 8px;
  }

  .variant-price {
    font-size: 24px;
    color: #28a745;
  }
</style>
```

### 5. Multi-Attribute Selection

Combine multiple variant selectors for complex products.

```html
<div class="product-variants">
  <!-- Size Selector -->
  <div class="variant-group">
    <label>Size:</label>
    <div data-next-variant-selector
         data-next-attribute-code="size"
         data-next-base-package-id="400"
         id="size-selector">

      <button data-next-variant-option data-next-variant-value="S">S</button>
      <button data-next-variant-option data-next-variant-value="M" data-next-selected="true">M</button>
      <button data-next-variant-option data-next-variant-value="L">L</button>
    </div>
  </div>

  <!-- Color Selector -->
  <div class="variant-group">
    <label>Color:</label>
    <div data-next-variant-selector
         data-next-attribute-code="color"
         data-next-base-package-id="400"
         id="color-selector">

      <button data-next-variant-option data-next-variant-value="Red">Red</button>
      <button data-next-variant-option data-next-variant-value="Blue">Blue</button>
      <button data-next-variant-option data-next-variant-value="Green" data-next-selected="true">Green</button>
    </div>
  </div>
</div>

<script>
  // Listen to both selectors and resolve the correct package
  document.addEventListener('variant:package-changed', (event) => {
    console.log('Variant changed:', event.detail);

    // You can use VariantHelper.resolveVariantPackage() to find the matching package
    // based on both size and color selections
  });
</script>
```

---

## API Reference

### JavaScript API

Access the enhancer's API via the element:

```javascript
const selectorEl = document.querySelector('[data-next-variant-selector]');

// Get selected option
const selectedOption = selectorEl._getSelectedOption();
console.log(selectedOption);
// { value: "Medium", packageId: 101, isAvailable: true, ... }

// Get selected package ID
const packageId = selectorEl._getSelectedPackageId();
console.log(packageId); // 101

// Get selected value
const value = selectorEl._getSelectedValue();
console.log(value); // "Medium"
```

### Selected Option Object

```typescript
interface VariantOption {
  element: HTMLElement;
  value: string;              // "Small", "Red", etc.
  packageId?: number;         // Associated package ID
  package?: Package;          // Full package data
  isSelected: boolean;
  isAvailable: boolean;       // Based on inventory
  attributes?: VariantAttribute[];
}
```

---

## Events

### `variant:option-selected`

Fired when a variant option is selected.

```javascript
document.addEventListener('variant:option-selected', (event) => {
  const {
    attributeCode,    // "size"
    value,            // "Large"
    packageId,        // 102
    previousValue,    // "Medium"
    previousPackageId // 101
  } = event.detail;

  console.log(`Variant changed from ${previousValue} to ${value}`);
});
```

### `variant:package-changed`

Fired when the selected package changes (package ID differs).

```javascript
document.addEventListener('variant:package-changed', (event) => {
  const {
    attributeCode,      // "color"
    packageId,          // 203
    previousPackageId,  // 201
    package             // Full Package object
  } = event.detail;

  // Update product images, descriptions, etc.
  updateProductDisplay(package);
});
```

---

## Helper Utilities

Use the `VariantHelper` utilities for advanced variant handling:

```javascript
import {
  extractVariantAttributes,
  findPackageByVariant,
  getVariantValues,
  resolveVariantPackage,
  buildVariantMatrix
} from '@/utils/variant/VariantHelper';

// Get all variant attributes from packages
const attributes = extractVariantAttributes(campaign.packages);
console.log(attributes);
// [
//   { code: "size", name: "Size", values: ["S", "M", "L"], options: [...] },
//   { code: "color", name: "Color", values: ["Red", "Blue"], options: [...] }
// ]

// Find package by variant combination
const pkg = findPackageByVariant(campaign.packages, {
  size: "Large",
  color: "Red"
});

// Get all possible values for a variant attribute
const sizes = getVariantValues(campaign.packages, "size");
console.log(sizes); // ["Small", "Medium", "Large"]

// Resolve package from multi-variant selection
const selectedVariants = {
  size: "Medium",
  color: "Blue"
};
const matchedPkg = resolveVariantPackage(campaign.packages, selectedVariants);

// Build variant matrix for complex UI
const matrix = buildVariantMatrix(campaign.packages, ["size", "color"]);
console.log(matrix);
// [
//   { combination: { size: "S", color: "Red" }, package: {...}, isAvailable: true },
//   { combination: { size: "M", color: "Blue" }, package: {...}, isAvailable: true },
//   ...
// ]
```

---

## Styling Guide

### CSS Classes

The enhancer adds these classes automatically:

```css
/* Base option class */
.next-variant-option {
  /* Your base styles */
}

/* Selected option */
.next-variant-option.next-selected {
  /* Highlight selected state */
}

/* Unavailable (out of stock) */
.next-variant-option.next-unavailable {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* Auto-generated buttons */
.next-variant-button {
  /* Style for button template */
}

/* Auto-generated cards */
.next-variant-card {
  /* Style for card template */
}
```

### Example Styling

```css
/* Clean button group */
.next-variant-option {
  padding: 10px 20px;
  border: 2px solid #ddd;
  background: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.next-variant-option:hover:not(.next-unavailable) {
  border-color: #007bff;
}

.next-variant-option.next-selected {
  border-color: #007bff;
  background: #007bff;
  color: white;
}

.next-variant-option.next-unavailable {
  background: #f5f5f5;
  color: #999;
  text-decoration: line-through;
}
```

---

## Advanced Examples

### Example: Dynamic Price Display

Show price updates when variant changes:

```html
<div class="product">
  <h2>T-Shirt</h2>

  <div class="price" id="product-price">$19.99</div>

  <div data-next-variant-selector
       data-next-attribute-code="size"
       data-next-base-package-id="100"
       data-next-swap-mode="true">

    <button data-next-variant-option data-next-variant-value="Small" data-next-package-id="100">S</button>
    <button data-next-variant-option data-next-variant-value="Medium" data-next-package-id="101">M</button>
    <button data-next-variant-option data-next-variant-value="Large" data-next-package-id="102">L</button>
  </div>
</div>

<script>
  document.addEventListener('variant:package-changed', (event) => {
    const { package } = event.detail;
    if (package) {
      document.getElementById('product-price').textContent = `$${package.price}`;
    }
  });
</script>
```

### Example: Availability Indicator

```html
<div data-next-variant-selector
     data-next-attribute-code="color"
     data-next-base-package-id="200"
     id="color-selector">

  <button data-next-variant-option data-next-variant-value="Red">
    <span class="color-swatch" style="background: red;"></span>
    <span>Red</span>
  </button>

  <button data-next-variant-option data-next-variant-value="Blue">
    <span class="color-swatch" style="background: blue;"></span>
    <span>Blue</span>
  </button>
</div>

<div id="availability-message"></div>

<script>
  const selector = document.getElementById('color-selector');

  document.addEventListener('variant:option-selected', (event) => {
    const selectedOption = selector._getSelectedOption();
    const message = document.getElementById('availability-message');

    if (selectedOption?.isAvailable) {
      message.textContent = '✓ In Stock';
      message.style.color = 'green';
    } else {
      message.textContent = '✗ Out of Stock';
      message.style.color = 'red';
    }
  });
</script>
```

---

## Troubleshooting

### Options Not Appearing (Auto-Populate)

**Problem:** Auto-populate mode doesn't generate options.

**Solutions:**
1. Verify `data-next-base-package-id` is correct
2. Check that campaign data is loaded
3. Ensure packages have `product.variant.attributes` data
4. Check console for warnings

### Selection Not Working

**Problem:** Clicking options doesn't change selection.

**Solutions:**
1. Verify `data-next-variant-option` attribute is present
2. Check that `data-next-variant-value` matches actual variant values
3. Ensure enhancer is initialized (check SDK initialization)

### Cart Not Updating (Swap Mode)

**Problem:** Swap mode enabled but cart doesn't update.

**Solutions:**
1. Verify `data-next-swap-mode="true"` is set
2. Check that `data-next-package-id` attributes are correct
3. Ensure cart store is initialized

---

## Best Practices

1. **Use Auto-Populate** when variant data is in campaign API - less code to maintain
2. **Use Manual Options** when you need custom HTML structure or styling
3. **Enable Swap Mode** for single-product pages where variant selection should update cart
4. **Disable Swap Mode** for product listing pages where users browse multiple products
5. **Pre-select** the most popular or default variant with `data-next-selected="true"`
6. **Show Availability** by styling `.next-unavailable` class clearly
7. **Combine with Display Enhancers** to show prices, images dynamically

---

## Summary

The Variant Option Selector Enhancer provides:

✅ **Automatic variant extraction** from campaign data
✅ **Multiple templates** (buttons, dropdowns, cards)
✅ **Cart integration** with swap mode
✅ **Availability tracking** (in stock / out of stock)
✅ **Easy styling** with CSS classes
✅ **Event-driven** architecture for custom integrations
✅ **Helper utilities** for complex variant logic

Perfect for building clean, maintainable variant selection UIs with minimal JavaScript! 🎨
