# Analytics JavaScript API

Track e-commerce events and user interactions with automatic Google Analytics, Facebook Pixel, and custom analytics integration.

The Next Commerce SDK provides a comprehensive analytics system that automatically tracks e-commerce events and user interactions. It supports Google Analytics 4, Facebook Pixel, RudderStack, and custom analytics platforms.

## Quick Start

Analytics tracking is automatically enabled when the SDK initializes. Common e-commerce events are tracked automatically, or you can track events manually using the JavaScript API.

### Automatic Event Tracking

The SDK automatically tracks these events:

- **Product Views** - When products are displayed
- **Add to Cart** - When items are added to cart
- **Remove from Cart** - When items are removed
- **Begin Checkout** - When checkout process starts
- **Purchase** - When orders are completed

### Manual Event Tracking

Use the SDK's tracking methods for custom events:

```javascript
window.nextReady.push(function() {
  // Track individual product view
  next.trackViewItem('123');

  // Track product list view
  next.trackViewItemList(['123', '456', '789'], 'homepage');

  // Track add to cart (usually automatic)
  next.trackAddToCart('123', 2);

  // Track purchase (usually automatic)
  next.trackPurchase({
    id: 'ORDER_123',
    total: 99.99,
    currency: 'USD',
    items: [...]
  });
});
```

## Tracking Methods API Reference

All tracking methods are available via the `next` object. These methods provide a simple API for tracking events programmatically.

### E-commerce Events

#### trackViewItemList()

Track when a list of products is viewed (e.g., collection pages, search results).

**Syntax:**
```javascript
next.trackViewItemList(packageIds, listId, listName)
```

**Parameters:**
- `packageIds` (`Array<string|number>`) - Array of package IDs being displayed
- `listId` (string, optional) - Unique identifier for the list
- `listName` (string, optional) - Human-readable name for the list

**Example:**
```javascript
window.nextReady.push(function() {
  // Track homepage product grid
  next.trackViewItemList(
    ['101', '102', '103', '104'],
    'homepage-grid',
    'Featured Products'
  );

  // Track search results
  next.trackViewItemList(
    ['201', '202'],
    'search-results',
    'Search: "drone"'
  );

  // Track collection page
  next.trackViewItemList(
    ['301', '302', '303'],
    'collection-bestsellers',
    'Best Sellers'
  );
});
```

**Fires:** `dl_view_item_list` event to all analytics providers

---

#### trackViewItem()

Track when a single product is viewed (e.g., product detail page).

**Syntax:**
```javascript
next.trackViewItem(packageId)
```

**Parameters:**
- `packageId` (string|number) - The package ID being viewed

**Example:**
```javascript
window.nextReady.push(function() {
  // Track product page view
  next.trackViewItem('123');

  // Track when user clicks to view product details
  document.querySelectorAll('.product-card').forEach(card => {
    card.addEventListener('click', function() {
      const packageId = this.dataset.packageId;
      next.trackViewItem(packageId);
    });
  });
});
```

**Fires:** `dl_view_item` event to all analytics providers

---

#### trackAddToCart()

Track when a product is added to cart.

**Syntax:**
```javascript
next.trackAddToCart(packageId, quantity)
```

**Parameters:**
- `packageId` (string|number) - The package ID being added
- `quantity` (number, optional) - Number of items to add (default: 1)

**Example:**
```javascript
window.nextReady.push(function() {
  // Track add to cart with default quantity
  next.trackAddToCart('123');

  // Track add to cart with specific quantity
  next.trackAddToCart('123', 2);

  // Track from custom button
  document.getElementById('custom-add-btn').addEventListener('click', function() {
    const packageId = this.dataset.packageId;
    const quantity = document.getElementById('qty-input').value;
    next.trackAddToCart(packageId, parseInt(quantity));
  });
});
```

**Fires:** `dl_add_to_cart` event to all analytics providers

**Note:** This is automatically tracked when using `data-next-action="add-to-cart"` buttons.

---

#### trackRemoveFromCart()

Track when a product is removed from cart.

**Syntax:**
```javascript
next.trackRemoveFromCart(packageId, quantity)
```

**Parameters:**
- `packageId` (string|number) - The package ID being removed
- `quantity` (number, optional) - Number of items to remove (default: 1)

**Example:**
```javascript
window.nextReady.push(function() {
  // Track remove from cart
  next.trackRemoveFromCart('123');

  // Track remove with specific quantity
  next.trackRemoveFromCart('123', 2);

  // Listen to cart events for automatic tracking
  next.on('cart:item-removed', function(data) {
    console.log('Item removed automatically tracked:', data.packageId);
  });
});
```

**Fires:** `dl_remove_from_cart` event to all analytics providers

**Note:** This is automatically tracked when items are removed from cart via SDK methods.

---

#### trackBeginCheckout()

Track when the checkout process begins.

**Syntax:**
```javascript
next.trackBeginCheckout()
```

**Parameters:** None

**Example:**
```javascript
window.nextReady.push(function() {
  // Track checkout start
  document.getElementById('checkout-btn').addEventListener('click', function() {
    next.trackBeginCheckout();
  });

  // Or listen for automatic tracking
  next.on('checkout:started', function(data) {
    console.log('Checkout started - automatically tracked');
  });
});
```

**Fires:** `dl_begin_checkout` event to all analytics providers

**Note:** This is automatically tracked when checkout forms are initialized.

---

#### trackPurchase()

Track when a purchase is completed.

**Syntax:**
```javascript
next.trackPurchase(orderData)
```

**Parameters:**
- `orderData` (object) - Order information object

**Order Data Structure:**
```javascript
{
  id: 'ORDER_123',           // Order ID (required)
  total: 99.99,              // Order total (required)
  currency: 'USD',           // Currency code (optional, default: 'USD')
  tax: 5.99,                 // Tax amount (optional)
  shipping: 10.00,           // Shipping cost (optional)
  coupon: 'SAVE10',          // Coupon code (optional)
  items: [                   // Order items (optional)
    {
      packageId: '123',
      quantity: 1,
      price: 29.99
    }
  ]
}
```

**Example:**
```javascript
window.nextReady.push(function() {
  // Track purchase with minimal data
  next.trackPurchase({
    id: 'ORDER_789',
    total: 149.99
  });

  // Track purchase with full details
  next.trackPurchase({
    id: 'ORDER_790',
    total: 149.99,
    currency: 'USD',
    tax: 12.50,
    shipping: 10.00,
    coupon: 'SUMMER20',
    items: [
      { packageId: '123', quantity: 1, price: 99.99 },
      { packageId: '456', quantity: 2, price: 25.00 }
    ]
  });

  // Listen for automatic purchase tracking
  next.on('order:completed', function(orderData) {
    console.log('Purchase automatically tracked:', orderData);
  });
});
```

**Fires:** `dl_purchase` event to all analytics providers

**Note:** This is automatically tracked when orders are completed via the SDK.

---

### User Events

#### trackSignUp()

Track when a user signs up or registers.

**Syntax:**
```javascript
next.trackSignUp(email)
```

**Parameters:**
- `email` (string) - User's email address

**Example:**
```javascript
window.nextReady.push(function() {
  // Track sign up after form submission
  document.getElementById('signup-form').addEventListener('submit', function(e) {
    const email = document.getElementById('email').value;
    next.trackSignUp(email);
  });

  // Track newsletter subscription
  document.getElementById('newsletter-form').addEventListener('submit', function(e) {
    const email = document.getElementById('newsletter-email').value;
    next.trackSignUp(email);
  });
});
```

**Fires:** `dl_sign_up` event to all analytics providers

---

#### trackLogin()

Track when a user logs in.

**Syntax:**
```javascript
next.trackLogin(email)
```

**Parameters:**
- `email` (string) - User's email address

**Example:**
```javascript
window.nextReady.push(function() {
  // Track login
  document.getElementById('login-form').addEventListener('submit', function(e) {
    const email = document.getElementById('email').value;
    next.trackLogin(email);
  });

  // Track after successful authentication
  function onAuthSuccess(userData) {
    next.trackLogin(userData.email);
  }
});
```

**Fires:** `dl_login` event to all analytics providers

---

### Custom Events

#### trackCustomEvent()

Track custom events with arbitrary data.

**Syntax:**
```javascript
next.trackCustomEvent(eventName, data)
```

**Parameters:**
- `eventName` (string) - Name of the custom event
- `data` (object, optional) - Additional event data

**Example:**
```javascript
window.nextReady.push(function() {
  // Track video play
  next.trackCustomEvent('video_played', {
    video_id: 'demo-video-1',
    video_title: 'Product Demo',
    duration: 120
  });

  // Track feature usage
  next.trackCustomEvent('feature_used', {
    feature_name: 'product_comparison',
    products_compared: ['123', '456']
  });

  // Track user interaction
  next.trackCustomEvent('button_clicked', {
    button_name: 'get_quote',
    button_location: 'header'
  });

  // Track milestone reached
  next.trackCustomEvent('cart_milestone', {
    milestone: 'free_shipping_reached',
    cart_value: 75.00
  });
});
```

**Fires:** Custom event to all analytics providers

---

### Advanced Methods

#### setDebugMode()

Enable or disable analytics debug mode for troubleshooting.

**Syntax:**
```javascript
next.setDebugMode(enabled)
```

**Parameters:**
- `enabled` (boolean) - `true` to enable debug mode, `false` to disable

**Example:**
```javascript
window.nextReady.push(function() {
  // Enable debug mode
  next.setDebugMode(true);

  // Disable debug mode
  next.setDebugMode(false);

  // Enable debug mode based on URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('debug') === 'true') {
    next.setDebugMode(true);
  }
});
```

**Effect:** When enabled, all analytics events are logged to the browser console with detailed information.

---

#### invalidateAnalyticsContext()

Invalidate the current analytics context (useful for SPA route changes).

**Syntax:**
```javascript
next.invalidateAnalyticsContext()
```

**Parameters:** None

**Example:**
```javascript
window.nextReady.push(function() {
  // Call after SPA route change
  window.addEventListener('popstate', function() {
    next.invalidateAnalyticsContext();
  });

  // Or in your routing library
  router.afterEach((to, from) => {
    next.invalidateAnalyticsContext();
  });
});
```

**Effect:** Resets session context and fires new `dl_user_data` event for the new page context.

---

### Quick Reference Table

| Method | Parameters | Use Case | Auto-Tracked? |
|--------|------------|----------|---------------|
| `trackViewItemList()` | packageIds, listId, listName | Product list views | Yes* |
| `trackViewItem()` | packageId | Product detail views | No |
| `trackAddToCart()` | packageId, quantity | Add to cart actions | Yes |
| `trackRemoveFromCart()` | packageId, quantity | Remove from cart | Yes |
| `trackBeginCheckout()` | - | Checkout started | Yes |
| `trackPurchase()` | orderData | Order completed | Yes |
| `trackSignUp()` | email | User registration | No |
| `trackLogin()` | email | User login | No |
| `trackCustomEvent()` | eventName, data | Custom tracking | No |
| `setDebugMode()` | enabled | Enable debugging | - |
| `invalidateAnalyticsContext()` | - | SPA route changes | - |

\* Auto-tracked when using specific data attributes

---

## Event Listening

Listen to SDK events for custom analytics implementations:

### Cart Events

```javascript
window.nextReady.push(function() {
  // Listen for add to cart events
  next.on('cart:item-added', function(data) {
    console.log('Item added:', data);
    // data contains: packageId, quantity, source, item details
  });

  // Listen for remove from cart events
  next.on('cart:item-removed', function(data) {
    console.log('Item removed:', data);
    // data contains: packageId, item details
  });

  // Listen for cart updates
  next.on('cart:updated', function(cartState) {
    console.log('Cart updated:', cartState);
    // cartState contains: items, totals, counts
  });

  // Listen for quantity changes
  next.on('cart:quantity-changed', function(data) {
    console.log('Quantity changed:', data);
    // data contains: packageId, quantity, oldQuantity
  });
});
```

### Checkout Events

```javascript
window.nextReady.push(function() {
  // Checkout process started
  next.on('checkout:started', function(data) {
    console.log('Checkout started:', data);
    // Automatically tracked as 'begin_checkout' in GA4
  });

  // Order completed
  next.on('order:completed', function(orderData) {
    console.log('Order completed:', orderData);
    // Automatically tracked as 'purchase' in GA4
  });

  // Express checkout events
  next.on('checkout:express-started', function(data) {
    console.log('Express checkout started:', data.method);
    // data.method: 'paypal' | 'apple_pay' | 'google_pay'
  });
});
```

### User Interaction Events

```javascript
window.nextReady.push(function() {
  // Product selector changes
  next.on('selector:item-selected', function(data) {
    console.log('Product variant selected:', data);
    // Track product detail interactions
  });

  // Coupon events
  next.on('coupon:applied', function(data) {
    console.log('Coupon applied:', data);
    // Track promotion usage
  });

  // Timer events
  next.on('timer:expired', function(data) {
    console.log('Timer expired:', data);
    // Track urgency feature effectiveness
  });
});
```

## Google Analytics 4 Integration

The SDK automatically sends events to Google Analytics 4 when `gtag` is available:

### Automatic GA4 Events

- `view_item` - Product page views
- `view_item_list` - Product list views
- `add_to_cart` - Items added to cart
- `remove_from_cart` - Items removed from cart
- `begin_checkout` - Checkout started
- `purchase` - Orders completed

### Custom GA4 Tracking

```javascript
window.nextReady.push(function() {
  // Custom event tracking
  next.on('selector:item-selected', function(data) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'select_item', {
        item_list_id: data.selectorId,
        item_list_name: 'Product Options',
        items: [{
          item_id: data.packageId.toString(),
          item_name: data.item?.name || 'Unknown Product',
          price: data.item?.price?.value || 0
        }]
      });
    }
  });

  // Track promotion views
  next.on('coupon:applied', function(data) {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'view_promotion', {
        creative_name: data.code,
        promotion_id: data.code,
        promotion_name: data.code
      });
    }
  });
});
```

### Enhanced E-commerce Parameters

All e-commerce events include enhanced parameters:

```javascript
// Example add_to_cart event data:
{
  currency: 'USD',
  value: 99.99,
  items: [{
    item_id: '123',
    item_name: 'Premium Package',
    item_category: 'Software',
    item_variant: 'Annual',
    price: 99.99,
    quantity: 1
  }]
}
```

## Facebook Pixel Integration

The SDK automatically sends events to Facebook Pixel when `fbq` is available:

### Automatic Facebook Events

- `ViewContent` - Product views
- `AddToCart` - Items added to cart
- `InitiateCheckout` - Checkout started
- `Purchase` - Orders completed

### Custom Facebook Tracking

```javascript
window.nextReady.push(function() {
  // Custom Facebook events
  next.on('selector:item-selected', function(data) {
    if (typeof fbq !== 'undefined') {
      fbq('trackCustom', 'ProductVariantSelected', {
        content_ids: [data.packageId.toString()],
        content_name: data.item?.name || 'Product Variant',
        content_type: 'product',
        value: data.item?.price?.value || 0,
        currency: 'USD'
      });
    }
  });
});
```

## Custom Analytics Integration

### Third-Party Platforms

```javascript
window.nextReady.push(function() {
  // Klaviyo integration
  next.on('cart:item-added', function(data) {
    if (window._learnq) {
      _learnq.push(['track', 'Added to Cart', {
        ProductName: data.item?.name,
        ProductID: data.packageId.toString(),
        Categories: data.item?.categories || [],
        ItemPrice: data.item?.price?.value,
        Value: data.item?.price?.value * data.quantity
      }]);
    }
  });

  // Mixpanel integration
  next.on('order:completed', function(orderData) {
    if (window.mixpanel) {
      mixpanel.track('Purchase Completed', {
        order_id: orderData.id,
        revenue: orderData.total?.value,
        currency: orderData.currency,
        item_count: orderData.items?.length
      });
    }
  });
});
```

### Custom Analytics API

```javascript
// Custom analytics wrapper
const CustomAnalytics = {
  track: function(event, properties = {}) {
    // Add common properties
    const payload = {
      event: event,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        user_agent: navigator.userAgent,
        session_id: this.getSessionId()
      }
    };

    // Send to your analytics endpoint
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(error => {
      console.error('Analytics tracking failed:', error);
    });
  },

  getSessionId: function() {
    // Generate or retrieve session ID
    return sessionStorage.getItem('session_id') || 'anonymous';
  }
};

// Wire up to SDK events
window.nextReady.push(function() {
  next.on('cart:item-added', function(data) {
    CustomAnalytics.track('Item Added to Cart', {
      product_id: data.packageId,
      product_name: data.item?.name,
      price: data.item?.price?.value,
      quantity: data.quantity,
      category: data.item?.category
    });
  });
});
```

## Advanced Analytics Features

### User Data Tracking

The SDK automatically collects user data for enhanced tracking:

```javascript
window.nextReady.push(function() {
  // Access collected user data
  next.on('checkout:started', function(data) {
    const userData = next.getUserData();
    console.log('User data:', userData);
    // Contains: email, name, phone (if provided in forms)
  });
});
```

### Attribution Tracking

Track campaign attribution and UTM parameters:

```javascript
window.nextReady.push(function() {
  // Get attribution data
  const attribution = next.getAttribution();
  console.log('Attribution:', attribution);
  // Contains: utm_source, utm_medium, utm_campaign, etc.

  // Include in analytics events
  next.on('order:completed', function(orderData) {
    CustomAnalytics.track('Purchase', {
      ...orderData,
      ...attribution
    });
  });
});
```

### Revenue Tracking

Track revenue and lifetime value:

```javascript
window.nextReady.push(function() {
  next.on('order:completed', function(orderData) {
    const revenueData = {
      order_id: orderData.id,
      revenue: orderData.total?.value,
      currency: orderData.currency,
      tax: orderData.tax?.value,
      shipping: orderData.shipping?.value,
      discount: orderData.discounts?.value,
      items: orderData.items?.map(item => ({
        id: item.packageId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        price: item.price?.value
      }))
    };

    // Send to revenue tracking system
    CustomAnalytics.track('Revenue', revenueData);
  });
});
```

## Analytics Configuration

### Disable Analytics

```javascript
// Disable analytics globally
window.nextReady.push(function() {
  // Method 1: URL parameter
  // Add ?ignore=true to disable for session

  // Method 2: Programmatic
  next.analytics.disable();
});
```

### Transform Data Layer Events

Modify analytics data before sending:

```javascript
// Set global transform function
window.NextDataLayerTransformFn = function(event) {
  // Add custom properties to all events
  event.custom_property = 'custom_value';

  // Modify specific events
  if (event.event === 'purchase') {
    event.custom_order_type = 'online';
  }

  return event;
};
```

## Debugging Analytics

### Enable Debug Mode

```javascript
// Enable analytics debugging
window.nextReady.push(function() {
  // Log all analytics events to console
  next.on('analytics:event', function(event) {
    console.group('Analytics Event');
    console.log('Event:', event.event);
    console.log('Data:', event);
    console.log('Timestamp:', new Date().toISOString());
    console.groupEnd();
  });
});
```

### Verify Event Firing

```javascript
// Check if events are being sent
window.nextReady.push(function() {
  const events = [];

  // Capture all analytics events
  next.on('analytics:event', function(event) {
    events.push({
      event: event.event,
      timestamp: Date.now(),
      data: event
    });
  });

  // Expose for debugging
  window.analyticsEvents = events;

  // Log summary
  setTimeout(() => {
    console.log(`Captured ${events.length} analytics events`);
    console.table(events.map(e => ({
      event: e.event,
      timestamp: new Date(e.timestamp).toLocaleTimeString()
    })));
  }, 5000);
});
```

## Best Practices

### 1. Event Naming

Use consistent, descriptive event names:

```javascript
// Good
'Product Viewed'
'Cart Item Added'
'Checkout Started'

// Avoid
'pv'
'aic'
'cs'
```

### 2. Property Consistency

Keep property names consistent across events:

```javascript
// Use consistent property names
{
  product_id: '123',        // Not: productId, id, product
  product_name: 'Widget',   // Not: name, productName, title
  price: 99.99,            // Not: cost, amount, value
  currency: 'USD'          // Always include currency
}
```

### 3. Error Handling

Always handle analytics errors gracefully:

```javascript
next.on('cart:item-added', function(data) {
  try {
    // Analytics tracking
    if (window.gtag) {
      gtag('event', 'add_to_cart', { /* ... */ });
    }
  } catch (error) {
    console.error('Analytics tracking failed:', error);
    // Don't let analytics errors break the user experience
  }
});
```

### 4. Privacy Compliance

Respect user privacy preferences:

```javascript
function shouldTrackUser() {
  // Check for consent
  return localStorage.getItem('analytics_consent') === 'true';
}

next.on('cart:item-added', function(data) {
  if (shouldTrackUser()) {
    // Track the event
  }
});
```

## Related Documentation

- [Events](./events.md) - Complete list of SDK events
- [Configuration](./configuration.md) - Analytics configuration options
