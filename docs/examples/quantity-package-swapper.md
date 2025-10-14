# Quantity-Based Package Swapper (Standalone)

A fully standalone script that handles quantity controls and package swapping. **No SDK selector enhancer needed** - this script manages everything directly.

## Features

- ✅ **Fully Standalone**: Handles its own quantity controls, no SDK selector enhancer
- ✅ **Zero Conflicts**: Doesn't interfere with SDK's PackageSelectorEnhancer
- ✅ **Automatic Sync**: Syncs selector from cart on page load
- ✅ **Flexible Config**: Easy quantity → package mapping
- ✅ **Multiple Selectors**: Support for multiple selectors on one page
- ✅ **Debug Logging**: Built-in debugging support
- ✅ **Zero Flicker**: Single cart update per action using `next.swapCart()`

## Installation

### Option 1: Inline Script

```html
<script src="path/to/quantity-package-swapper.js"></script>
```

### Option 2: Inline

Copy the script content and paste it in a `<script>` tag before your closing `</body>` tag.

## Configuration

Edit the `QUANTITY_MAPS` object in the script. Three formats are supported:

### Format 1: Simple (Package ID Only)
Quantity in cart matches selector quantity:

```javascript
const QUANTITY_MAPS = {
  'limos-card': {
    1: 2,   // Selector qty 1 → Package 2, cart qty 1
    2: 3,   // Selector qty 2 → Package 3, cart qty 2
    3: 4,   // Selector qty 3 → Package 4, cart qty 3
  }
};
```

### Format 2: Custom Quantity
Specify different quantity in cart:

```javascript
const QUANTITY_MAPS = {
  'limos-card': {
    1: { packageId: 2, quantity: 1 },   // Selector qty 1 → Package 2, cart qty 1
    2: { packageId: 3, quantity: 5 },   // Selector qty 2 → Package 3, cart qty 5
    3: { packageId: 4, quantity: 10 },  // Selector qty 3 → Package 4, cart qty 10
  }
};
```

### Format 3: Multiple Packages
Add multiple packages to cart:

```javascript
const QUANTITY_MAPS = {
  'limos-card': {
    1: 2,   // Simple format
    2: { packageId: 3, quantity: 3 },  // Custom quantity
    3: [    // Multiple packages!
      { packageId: 4, quantity: 2 },
      { packageId: 10, quantity: 1 }
    ],
  }
};
```

### Mix All Formats

```javascript
const QUANTITY_MAPS = {
  'product-bundle': {
    1: 10,                               // Simple
    2: { packageId: 11, quantity: 5 },   // Custom qty
    3: [                                 // Multiple packages
      { packageId: 12, quantity: 2 },
      { packageId: 13, quantity: 1 },
      { packageId: 14, quantity: 1 }
    ]
  }
};
```

### Configuration Options

```javascript
const CONFIG = {
  debug: true,        // Enable console logging
  syncOnLoad: true,   // Sync selector from cart on page load
};
```

## HTML Setup

Uses **custom `data-qty-*` attributes** to avoid conflicts with SDK's native selector system.

```html
<!-- Custom quantity selector (independent from SDK selectors) -->
<div data-qty-selector="limos-card">

  <div data-qty-card
       data-next-package-id="2"
       data-qty-current="1"
       data-qty-min="1"
       data-qty-max="10">

    <!-- SDK display attributes still work -->
    <h3 data-next-display="package.name">Product</h3>
    <p data-next-display="package.finalPrice">$19.99</p>

    <!-- Custom quantity controls -->
    <div class="quantity-controls">
      <button data-qty-decrease type="button">−</button>
      <span data-qty-display>1</span>
      <button data-qty-increase type="button">+</button>
    </div>

  </div>
</div>
```

### Required Attributes

**Custom Quantity Attributes:**
- `data-qty-selector` - Selector ID, must match a key in `QUANTITY_MAPS`
- `data-qty-card` - Container for the package
- `data-qty-current` - Current quantity (default: 1)
- `data-qty-increase` - Button to increase quantity
- `data-qty-decrease` - Button to decrease quantity
- `data-qty-display` - Element to show current quantity

**SDK Attributes:**
- `data-next-package-id` - Package ID for SDK display system

### Optional Attributes

- `data-qty-min` - Minimum quantity (default: 1)
- `data-qty-max` - Maximum quantity (default: 999)

## How It Works

### On Page Load

1. Script waits for `next:initialized` event (SDK ready)
2. Reads cart via `next.getCartData()`
3. **Reverse lookup**: Finds which quantity maps to the cart's package ID
4. Updates selector UI to match cart state
5. **Attaches click handlers** to quantity buttons

**Example:**
- Cart has package 4
- Reverse map: package 4 → quantity 3
- Selector updates to show quantity 3

### On Quantity Change

1. User clicks +/− buttons
2. **Script's click handler** fires (not SDK event)
3. Updates quantity display and button states
4. **Forward lookup**: Maps quantity to package ID(s)
5. Calls `next.swapCart([{ packageId, quantity }])`
6. Cart updates with new package(s)

**Example:**
- User increases to quantity 2
- Forward map: quantity 2 → package 3
- Cart swaps to package 3 with quantity 2

### No SDK Selector Conflicts

This script handles quantity controls **completely independently** from the SDK's PackageSelectorEnhancer. It directly manages click events, so there's no conflict or double updates.

## API

The script exposes a global API for manual control:

```javascript
// Manually sync a selector from cart
QuantityPackageSwapper.syncSelectorFromCart('limos-card');

// Sync all selectors
QuantityPackageSwapper.syncAllSelectorsFromCart();

// Manually swap to a package
await QuantityPackageSwapper.swapToPackage(4, 2);

// Get current cart state
const cart = QuantityPackageSwapper.getCartState();

// Access configuration
QuantityPackageSwapper.config.debug = false;

// Access maps
console.log(QuantityPackageSwapper.maps);
```

## Example Workflow

### Initial State
```
HTML:     package 2, quantity 1
Cart:     empty
Display:  Shows package 2 data
```

### User Action: Click + (3 times)
```
Quantity: 1 → 2 → 3 → 4
Package:  2 → 3 → 4 → 20 (auto-swapped)
Cart:     Updates to package 20, quantity 4
```

### Page Refresh
```
HTML:     package 2, quantity 1 (static)
Cart:     package 20, quantity 4 (from session)
↓ Script runs ↓
Reverse lookup: package 20 → quantity 4
Selector UI: Updates to show quantity 4
Cart: Unchanged (already correct)
```

## Troubleshooting

### Selector not syncing on load

Check console for logs:
```javascript
// Look for:
[QuantitySwapper] Syncing all selectors from cart...
[QuantitySwapper] Found package X in cart → quantity Y
```

If not appearing, check:
1. Script is loaded after SDK
2. `syncOnLoad: true` in CONFIG
3. Selector ID matches configuration

### Quantity changes not swapping packages

Check console:
```javascript
[QuantitySwapper] Quantity changed: selector=..., qty=...
[QuantitySwapper] Swapping X → Y
```

If swap not happening:
1. Check quantity is in QUANTITY_MAPS
2. Verify selector ID matches
3. Look for error messages

### Enable Debug Mode

```javascript
// In the script, set:
const CONFIG = {
  debug: true,  // Shows all operations
  syncOnLoad: true,
};
```

## Advantages Over Event Listener Approach

| Feature | Event Listener | This Script |
|---------|---------------|-------------|
| Page load sync | Manual | ✅ Automatic |
| Reverse lookup | Manual | ✅ Built-in |
| Multiple selectors | Manual setup | ✅ Config object |
| Cart method | Manual swap | ✅ Uses `swapCart()` |
| Flicker | Possible | ✅ None |
| Error handling | Manual | ✅ Built-in |
| Debugging | Manual logs | ✅ Debug mode |

## Complete Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Limo Checkout</title>
</head>
<body>

  <!-- Custom quantity selector -->
  <div data-qty-selector="limos-card">
    <div data-qty-card
         data-next-package-id="2"
         data-qty-current="1"
         data-qty-min="1"
         data-qty-max="10">

      <h3 data-next-display="package.name">Limo Service</h3>
      <p data-next-display="package.finalPrice">$19.99</p>

      <div class="quantity-controls">
        <button data-qty-decrease type="button">−</button>
        <span data-qty-display>1</span>
        <button data-qty-increase type="button">+</button>
      </div>
    </div>
  </div>

  <!-- Campaign Cart SDK -->
  <script src="https://cdn.nextcommerce.com/sdk.js"></script>

  <!-- Quantity Package Swapper -->
  <script>
    (function() {
      'use strict';

      const QUANTITY_MAPS = {
        'limos-card': {
          1: 2,
          2: 3,
          3: 4,
          4: 20,
        }
      };

      const CONFIG = {
        debug: true,
        syncOnLoad: true,
      };

      // ... rest of script ...

    })();
  </script>

</body>
</html>
```

## Notes

- **Fully Standalone**: Uses custom `data-qty-*` attributes, zero conflict with SDK
- **No SDK Selector Enhancer**: No `data-next-cart-selector` needed
- **Display Attributes Work**: Keep `data-next-display` and `data-next-package-id` for SDK display system
- Requires SDK with `next.swapCart()` and `next.clearCart()` (for cart operations only)
- Handles its own quantity button click events
- Package swapping is atomic (single cart update via `swapCart`)
- Clears cart and resets to quantity 1 on page load
- No SDK modifications required
