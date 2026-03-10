# Variant Selector Quick Start Guide

**Build variant selection UIs in minutes with zero JavaScript!**

This quick guide shows frontend developers how to implement common variant selector patterns using simple HTML data attributes.

---

## ⚡ 3-Minute Setup

### 1. Basic Button Selector (Most Common)

```html
<!-- Size selector that swaps cart when clicked -->
<div data-next-variant-selector
     data-next-attribute-code="size"
     data-next-swap-mode="true">

  <button data-next-variant-option data-next-variant-value="Small">S</button>
  <button data-next-variant-option data-next-variant-value="Medium" data-next-selected="true">M</button>
  <button data-next-variant-option data-next-variant-value="Large">L</button>
</div>

<style>
  .next-variant-option.next-selected {
    background: blue;
    color: white;
  }
</style>
```

**That's it!** The enhancer handles:
- ✅ Selection state management
- ✅ Cart updates (swap mode)
- ✅ CSS class toggling
- ✅ Availability tracking

---

## 🎨 Common Patterns

### Pattern 1: Auto-Generate from Campaign Data

**No need to write option elements manually!**

```html
<div data-next-variant-selector
     data-next-attribute-code="color"
     data-next-base-package-id="100"
     data-next-auto-populate="true"
     data-next-template="button"
     data-next-auto-select="true"
     data-next-swap-mode="true">
  <!-- Options auto-generated here -->
</div>
```

The enhancer reads your campaign data and creates buttons automatically.

---

### Pattern 2: Dropdown Selector

```html
<select data-next-variant-selector
        data-next-attribute-code="material"
        data-next-swap-mode="true">

  <option data-next-variant-option data-next-variant-value="Cotton">Cotton</option>
  <option data-next-variant-option data-next-variant-value="Silk">Silk</option>
</select>
```

---

### Pattern 3: Color Swatches

```html
<div data-next-variant-selector
     data-next-attribute-code="color"
     data-next-swap-mode="true"
     class="color-grid">

  <div data-next-variant-option
       data-next-variant-value="Red"
       class="swatch"
       style="background: red;"></div>

  <div data-next-variant-option
       data-next-variant-value="Blue"
       class="swatch"
       style="background: blue;"></div>
</div>

<style>
  .swatch {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid transparent;
    cursor: pointer;
  }

  .swatch.next-selected {
    border-color: black;
  }
</style>
```

---

## 📋 Attribute Reference

### Container Attributes

```html
<div data-next-variant-selector              <!-- Required: Activates enhancer -->
     data-next-attribute-code="size"          <!-- Required: Variant attribute name -->
     data-next-base-package-id="100"          <!-- Optional: Base package for auto-populate -->
     data-next-auto-populate="true"           <!-- Optional: Auto-generate options -->
     data-next-template="button"              <!-- Optional: button|option|card -->
     data-next-auto-select="true"             <!-- Optional: Auto-select first -->
     data-next-swap-mode="true">              <!-- Optional: Update cart on select -->
</div>
```

### Option Attributes

```html
<button data-next-variant-option             <!-- Required: Marks as selectable option -->
        data-next-variant-value="Large"       <!-- Required: Variant value -->
        data-next-package-id="102"            <!-- Optional: Explicit package ID -->
        data-next-selected="true">            <!-- Optional: Pre-select this -->
  Large
</button>
```

---

## 🎯 Key Features

### Automatic CSS Classes

The enhancer automatically adds these classes:

```css
.next-variant-option        /* Applied to all options */
.next-selected              /* Currently selected option */
.next-unavailable           /* Out of stock options */
```

### Events (Optional JavaScript)

Listen for changes:

```javascript
document.addEventListener('variant:option-selected', (event) => {
  const { value, packageId } = event.detail;
  console.log(`Selected: ${value} (Package ${packageId})`);
});
```

### Access Selected Value

```javascript
const selector = document.querySelector('[data-next-variant-selector]');
const selectedValue = selector._getSelectedValue();
const selectedPackageId = selector._getSelectedPackageId();
```

---

## 💡 Tips for Frontend Developers

### 1. Use `swap-mode` for Product Pages

When users are viewing a single product and selecting variants, enable `swap-mode` to automatically update the cart:

```html
<div data-next-variant-selector
     data-next-attribute-code="size"
     data-next-swap-mode="true">
```

### 2. Disable `swap-mode` for Listing Pages

When showing multiple products on a page, disable swap mode:

```html
<div data-next-variant-selector
     data-next-attribute-code="size">
     <!-- No swap-mode, user must click "Add to Cart" -->
```

### 3. Combine with Display Enhancers

Show dynamic prices and data:

```html
<!-- Size selector -->
<div data-next-variant-selector
     data-next-attribute-code="size"
     data-next-swap-mode="true">
  <button data-next-variant-option data-next-variant-value="Small" data-next-package-id="100">S</button>
  <button data-next-variant-option data-next-variant-value="Large" data-next-package-id="102">L</button>
</div>

<!-- Price updates automatically when variant changes -->
<div data-next-display="selection.price"></div>
```

### 4. Style Unavailable Options

```css
.next-variant-option.next-unavailable {
  opacity: 0.5;
  cursor: not-allowed;
  text-decoration: line-through;
}
```

### 5. Pre-select Common Options

```html
<!-- Pre-select "Medium" as default -->
<button data-next-variant-option
        data-next-variant-value="Medium"
        data-next-selected="true">
  Medium
</button>
```

---

## 🚀 Advanced: Multi-Attribute Selection

For products with multiple variant dimensions (Size + Color):

```html
<!-- Size Selector -->
<div data-next-variant-selector
     data-next-attribute-code="size"
     id="size-selector">
  <button data-next-variant-option data-next-variant-value="S">S</button>
  <button data-next-variant-option data-next-variant-value="M">M</button>
  <button data-next-variant-option data-next-variant-value="L">L</button>
</div>

<!-- Color Selector -->
<div data-next-variant-selector
     data-next-attribute-code="color"
     id="color-selector">
  <button data-next-variant-option data-next-variant-value="Red">Red</button>
  <button data-next-variant-option data-next-variant-value="Blue">Blue</button>
</div>

<script type="module">
  import { VariantHelper } from '@nextcommerce/campaign-cart';

  // Listen to both selectors
  let selectedSize = 'M';
  let selectedColor = 'Red';

  document.addEventListener('variant:option-selected', (event) => {
    if (event.detail.attributeCode === 'size') {
      selectedSize = event.detail.value;
    } else if (event.detail.attributeCode === 'color') {
      selectedColor = event.detail.value;
    }

    // Find matching package
    const packages = /* get from campaign */;
    const matchedPackage = VariantHelper.findPackageByVariant(packages, {
      size: selectedSize,
      color: selectedColor
    });

    console.log('Matched package:', matchedPackage);
  });
</script>
```

---

## 🔧 Troubleshooting

### Options Not Showing (Auto-Populate)

**Problem:** `auto-populate="true"` but no options appear.

**Solutions:**
1. Check `data-next-base-package-id` is correct
2. Verify campaign data has loaded (check Network tab)
3. Ensure packages have `product.variant.attributes` in API response

### Selection Not Working

**Problem:** Clicking options doesn't change selection.

**Solutions:**
1. Verify SDK is loaded and initialized
2. Check console for errors
3. Ensure `data-next-variant-value` is present on options

### Cart Not Updating

**Problem:** `swap-mode` enabled but cart doesn't update.

**Solutions:**
1. Check that `data-next-package-id` is set on options
2. Verify package IDs exist in campaign data
3. Check console for cart errors

---

## 📖 Full Documentation

For complete documentation, see [VariantSelectorEnhancer.md](./VariantSelectorEnhancer.md)

For working examples, see [examples/variant-selector-examples.html](../examples/variant-selector-examples.html)

---

## 📞 Need Help?

- View live examples: Open `examples/variant-selector-examples.html`
- Read full docs: `docs/VariantSelectorEnhancer.md`
- Helper utilities: Import `VariantHelper` for advanced use cases

**Happy coding! 🎉**
