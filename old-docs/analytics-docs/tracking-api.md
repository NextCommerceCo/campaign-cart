# Tracking API Reference

Complete reference for tracking e-commerce events using the simple next.* API or advanced window.NextAnalytics methods.

The SDK provides two complementary APIs for tracking analytics events. Choose the simple API for quick implementations or the advanced API for full control.

## API Overview

### Simple API (next.*)

**Best for:** Quick implementations, minimal code

```javascript
// Simple, clean method calls
next.trackAddToCart(packageId, quantity);
next.trackViewItem(packageId);
next.trackBeginCheckout();
next.trackPurchase(orderData);
```

**Features:**
- Handles async loading automatically
- Simple parameter signatures
- Works before SDK fully loads (queued)
- Ideal for most use cases

### Advanced API (NextAnalytics)

**Best for:** Advanced tracking, custom events, full control

```javascript
// Direct access to analytics engine
window.NextAnalytics.trackAddToCart(item, listId, listName);
window.NextAnalytics.track({ event: 'custom', data: '...' });
window.NextAnalytics.setDebugMode(true);
```

**Features:**
- Full item data objects
- List attribution support
- Custom event tracking
- Debug and status methods
- Direct analytics engine access

---

## E-commerce Events

### Add to Cart

Track when items are added to the cart.

#### Simple API

```javascript
// Track with package ID and quantity
next.trackAddToCart('123', 1);

// With quantity
next.trackAddToCart('456', 2);
```

**Parameters:**
- `packageId` (string|number) - Product/package identifier
- `quantity` (number, optional) - Quantity added (default: 1)

**Auto-tracked when:**
- Using `data-next-action="add-to-cart"` attributes
- Calling cart methods like `next.addToCart()`

#### Advanced API

```javascript
// With full item data
window.NextAnalytics.trackAddToCart({
  id: 'pkg-123',
  packageId: '123',
  title: 'Premium Package',
  price: 99.99,
  quantity: 1
});

// With list attribution
window.NextAnalytics.trackAddToCart({
  id: 'pkg-123',
  packageId: '123',
  title: 'Premium Package',
  price: 99.99,
  quantity: 1
}, 'summer-collection', 'Summer Sale 2025');
```

**Parameters:**
- `item` (object) - Full item data
  - `id` (string) - Unique item identifier
  - `packageId` (string|number) - Package ID
  - `title` (string) - Product name
  - `price` (number) - Unit price
  - `quantity` (number) - Quantity
- `listId` (string, optional) - Product list ID for attribution
- `listName` (string, optional) - Product list name for attribution

### Remove from Cart

Track when items are removed from the cart.

#### Simple API

```javascript
// Track removal
next.trackRemoveFromCart('123', 1);
```

**Parameters:**
- `packageId` (string|number) - Product identifier
- `quantity` (number, optional) - Quantity removed

#### Advanced API

```javascript
// Using EcommerceEvents helper
import { EcommerceEvents } from '@/utils/analytics';
import { dataLayer } from '@/utils/analytics';

const event = EcommerceEvents.createRemoveFromCartEvent(item);
dataLayer.push(event);
```

**Auto-tracked when:**
- Using cart removal methods

### View Item

Track product detail page views.

#### Simple API

```javascript
// Track product view
next.trackViewItem('123');
```

**Parameters:**
- `packageId` (string|number) - Product identifier

**Auto-tracked when:**
- Page has exactly 1 product with `data-next-package-id`
- Selected items in `data-next-selection-mode="select"` selectors
- Selected items in `data-next-selection-mode="swap"` selectors

#### Advanced API

```javascript
// With full product data
window.NextAnalytics.trackViewItem({
  id: 'pkg-123',
  packageId: '123',
  title: 'Premium Package',
  price: 99.99
});
```

**Parameters:**
- `item` (object) - Product data
  - `id` (string) - Unique identifier
  - `packageId` (string|number) - Package ID
  - `title` (string) - Product name
  - `price` (number) - Price

### View Item List

Track product list/collection views.

#### Simple API

```javascript
// Track list view
next.trackViewItemList(
  ['123', '456', '789'],
  'summer-sale',
  'Summer Sale Collection'
);
```

**Parameters:**
- `packageIds` (array) - Array of product IDs
- `listId` (string) - List identifier
- `listName` (string) - List display name

**Auto-tracked when:**
- URL matches collection/category patterns
- Page type detected as product list

#### Advanced API

```javascript
window.NextAnalytics.trackViewItemList(items, listId, listName);
```

**Parameters:**
- `items` (array) - Array of item objects
- `listId` (string) - List identifier
- `listName` (string) - List display name

### Begin Checkout

Track when checkout process starts.

#### Simple API

```javascript
// Track checkout start
next.trackBeginCheckout();
```

**No parameters required** - automatically includes cart items

**Auto-tracked when:**
- Checkout page loads (in auto mode)

#### Advanced API

```javascript
window.NextAnalytics.trackBeginCheckout();
```

Automatically includes:
- All current cart items
- Cart total value
- Currency
- User properties

### Purchase

Track completed orders.

#### Simple API

```javascript
// Minimal purchase tracking
next.trackPurchase({
  id: 'ORDER_123',
  total: 159.99,
  currency: 'USD',
  tax: 9.99,
  shipping: 10.00
});

// With items
next.trackPurchase({
  id: 'ORDER_123',
  total: 159.99,
  currency: 'USD',
  items: [
    {
      id: 'SKU-123',
      name: 'Product Name',
      price: 149.99,
      quantity: 1
    }
  ]
});
```

**Parameters:**
- `orderData` (object)
  - `id` (string) - **Required** - Order ID
  - `total` (number) - **Required** - Order total
  - `currency` (string) - Currency code (default: 'USD')
  - `tax` (number, optional) - Tax amount
  - `shipping` (number, optional) - Shipping cost
  - `items` (array, optional) - Order line items

#### Advanced API

```javascript
// Full order data from backend
window.NextAnalytics.trackPurchase({
  order: {
    ref_id: 'ORD-12345',
    number: '12345',
    total_incl_tax: '159.99',
    total_tax: '9.99',
    shipping_incl_tax: '10.00',
    currency: 'USD',
    user: {
      email: 'user@example.com',
      first_name: 'John',
      last_name: 'Doe'
    },
    lines: [
      {
        product_sku: 'SKU-123',
        product_title: 'Product Name',
        price_incl_tax: '149.99',
        quantity: 1
      }
    ],
    billing_address: {
      first_name: 'John',
      last_name: 'Doe',
      city: 'San Francisco',
      state: 'CA',
      postcode: '94102',
      country: 'US'
    }
  }
});
```

**Parameters:**
- `orderData` (object)
  - `order` (object) - Complete order object from backend
    - Automatically transforms to GA4 format
    - Includes user properties, items, transaction details

**Auto-tracked:** Yes (queued and fired on confirmation page)

**Event Queue:** Purchase events are queued to `sessionStorage` when order completes, then automatically fired on the confirmation page after redirect.

**Manual tracking (optional):**

You can manually trigger purchase events if needed (e.g., for testing or special integrations):

```javascript
// Manually track with order data from sessionStorage['next-order']
const orderData = JSON.parse(sessionStorage.getItem('next-order'))?.state?.order;
if (orderData) {
  next.trackPurchase({ order: orderData });
}

// Or provide custom order data
next.trackPurchase({
  id: 'ORDER_123',
  total: 159.99,
  currency: 'USD'
});
```

---

## User Events

### Sign Up

Track user registration.

#### Simple API

```javascript
// Track registration
next.trackSignUp('user@example.com');
```

**Parameters:**
- `email` (string) - User email address

#### Advanced API

```javascript
window.NextAnalytics.trackSignUp('user@example.com');
```

Automatically includes:
- User email
- Timestamp
- Session data
- Attribution

### Login

Track user login.

#### Simple API

```javascript
// Track login
next.trackLogin('user@example.com');
```

**Parameters:**
- `email` (string) - User email address

#### Advanced API

```javascript
window.NextAnalytics.trackLogin('user@example.com');
```

---

## Custom Events

Track custom business events.

```javascript
// Only available via advanced API
window.NextAnalytics.track({
  event: 'newsletter_subscribe',
  email: 'user@example.com',
  list_name: 'Weekly Newsletter',
  source: 'footer_form'
});

// Video engagement
window.NextAnalytics.track({
  event: 'video_played',
  video_id: 'intro-demo',
  video_title: 'Product Introduction',
  duration: 120
});

// Feature usage
window.NextAnalytics.track({
  event: 'feature_used',
  feature_name: 'product_comparison',
  items_compared: 3
});
```

**Parameters:**
- `eventData` (object) - Custom event object
  - `event` (string) - **Required** - Event name (use snake_case)
  - Any additional properties as needed

Custom events are sent to **all enabled providers**.

See [Custom Events Guide](./custom-events.md) for advanced patterns and EventBuilder usage.

---

## Utility Methods

### setDebugMode

Enable or disable debug logging.

```javascript
// Enable debug mode
window.NextAnalytics.setDebugMode(true);

// Disable
window.NextAnalytics.setDebugMode(false);
```

**Parameters:**
- `enabled` (boolean) - Enable/disable debug logs

**Debug output includes:**
- Event names and data
- Provider dispatch confirmations
- Validation warnings
- Error messages

### getStatus

Get current analytics status and configuration.

```javascript
const status = window.NextAnalytics.getStatus();
console.log(status);
```

**Returns:**
```javascript
{
  enabled: true,
  mode: 'auto',
  providers: ['GTM', 'Facebook', 'RudderStack', 'Custom'],
  eventsTracked: 15,
  debugMode: false,
  sessionId: 'sess_abc123',
  version: '0.2.0'
}
```

---

## Method Reference Tables

### Simple API (next.*)

| Method | Parameters | Description | Auto-Tracked |
|--------|------------|-------------|--------------|
| `trackViewItem()` | packageId | Product detail view | Yes* |
| `trackAddToCart()` | packageId, quantity? | Add item to cart | Yes* |
| `trackRemoveFromCart()` | packageId, quantity? | Remove from cart | Yes* |
| `trackViewItemList()` | packageIds[], listId, listName | Product list view | Yes* |
| `trackBeginCheckout()` | - | Checkout initiation | Yes* |
| `trackPurchase()` | orderData | Order completion | Yes* |
| `trackSignUp()` | email | User registration | No |
| `trackLogin()` | email | User login | No |

*Auto-tracked only in auto mode

### Advanced API (window.NextAnalytics)

| Method | Parameters | Description |
|--------|------------|-------------|
| `trackAddToCart()` | item, listId?, listName? | Add to cart with list attribution |
| `trackRemoveFromCart()` | item | Remove from cart |
| `trackViewItem()` | item | Product detail view |
| `trackViewItemList()` | items[], listId, listName | Product list view |
| `trackBeginCheckout()` | - | Checkout initiation |
| `trackPurchase()` | orderData | Order completion |
| `trackSignUp()` | email | User registration |
| `trackLogin()` | email | User login |
| `track()` | eventData | Custom event |
| `setDebugMode()` | enabled | Enable/disable debug logs |
| `getStatus()` | - | Get analytics status |

---

## Usage Patterns

### Track on Page Load

```javascript
window.addEventListener('DOMContentLoaded', () => {
  // Product page
  if (productData) {
    next.trackViewItem(productData.id);
  }

  // Order confirmation
  if (orderData) {
    next.trackPurchase(orderData);
  }
});
```

### Track Before SDK Loads

Use the nextReady queue:

```javascript
window.nextReady = window.nextReady || [];
window.nextReady.push(function() {
  next.trackAddToCart('123', 1);
  next.trackBeginCheckout();
});
```

### Track from Event Handlers

```javascript
// Button click
document.getElementById('subscribe-btn').addEventListener('click', () => {
  window.NextAnalytics.track({
    event: 'newsletter_subscribe',
    source: 'hero_section'
  });
});

// Form submission
form.addEventListener('submit', (e) => {
  window.NextAnalytics.track({
    event: 'form_submitted',
    form_id: 'contact'
  });
});
```

### Track with List Attribution

```javascript
// Set list attribution when viewing a collection
window.NextAnalytics.trackViewItemList(
  items,
  'summer-sale-2025',
  'Summer Sale Collection'
);

// Attribution automatically included when user adds to cart
next.trackAddToCart('123', 1);
// Event includes: item_list_id: 'summer-sale-2025', item_list_name: 'Summer Sale Collection'
```

---

## Error Handling

The SDK handles analytics errors gracefully:

```javascript
// Analytics errors never break your app
try {
  next.trackPurchase(orderData);
} catch (error) {
  // Error automatically logged in debug mode
  // App continues functioning normally
}
```

**Error behavior:**
- Errors logged to console in debug mode
- Events still stored in NextDataLayer
- Failed provider doesn't affect others
- SDK functionality unaffected

---

## TypeScript Support

Type definitions available for TypeScript projects:

```typescript
// Import types
import type { OrderData, ItemData } from 'next-campaign-cart';

// Typed parameters
const orderData: OrderData = {
  id: 'ORDER_123',
  total: 159.99,
  currency: 'USD'
};

next.trackPurchase(orderData);
```

---

## Related Documentation

- [Configuration & Modes](./configuration.md) - Configure tracking modes and providers
- [Event Reference](./events.md) - Complete event schemas and examples
- [Custom Events](./custom-events.md) - Advanced tracking patterns with EventBuilder
- [Debugging Guide](./debugging.md) - Troubleshooting and testing
