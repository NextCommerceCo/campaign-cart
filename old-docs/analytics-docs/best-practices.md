# Best Practices

Patterns and recommendations for implementing Campaign Cart analytics including configuration strategies, event naming conventions, tracking patterns, and optimization techniques.

This guide covers patterns and recommendations for implementing Campaign Cart analytics across your application.

## Configuration Best Practices

### 1. Use Auto Mode

Auto mode handles most tracking automatically:

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  analytics: {
    enabled: true,
    mode: 'auto'  // Automatic tracking
  }
};
```

**Auto Mode Tracks:**
- `dl_user_data` - Every page load
- `dl_view_item_list` - Collection/category pages
- `dl_add_to_cart` - Cart additions
- `dl_begin_checkout` - Checkout initiation

**Manual Tracking Required:**
- Purchase events (order confirmation page)
- Login/signup events
- Custom business events

### 2. Set storeName for Facebook Pixel

The `storeName` parameter is required for Facebook Pixel purchase deduplication. Without it, duplicate purchases may be reported:

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  storeName: 'my-store',  // Required for Facebook deduplication
  analytics: {
    enabled: true,
    providers: {
      facebook: {
        enabled: true,
        settings: { pixelId: 'YOUR_PIXEL_ID' }
      }
    }
  }
};
```

Use a consistent, unique store identifier across all environments to prevent duplicate purchase attribution in Facebook Ads Manager.

### 3. Use Debug Mode in Development

Enable debug mode only during development to see detailed console logs without polluting production data:

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  analytics: {
    enabled: true,
    debug: process.env.NODE_ENV === 'development'  // Enable only in dev
  }
};
```

**Debug Mode Shows:**
- Event names and data
- Provider routing decisions
- Validation errors
- Transform function results

### 4. Environment-Specific Configuration

Use environment variables to manage different configurations across environments:

```javascript
window.nextConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  analytics: {
    enabled: process.env.REACT_APP_ANALYTICS_ENABLED === 'true',
    debug: process.env.NODE_ENV === 'development',
    mode: 'auto',
    providers: {
      gtm: { enabled: true },
      facebook: {
        enabled: true,
        settings: { pixelId: process.env.REACT_APP_FACEBOOK_PIXEL_ID }
      }
    }
  }
};
```

## Event Naming Conventions

### Use Consistent snake_case Format

Adopt a consistent naming convention across all custom events. Use snake_case (lowercase with underscores):

```javascript
// Good - Consistent snake_case
'newsletter_subscribe'
'video_completed'
'form_submitted'
'feature_enabled'
'product_reviewed'
'wishlist_added'

// Avoid - Inconsistent formats
'subscribeNewsletter'      // camelCase
'VideoCompleted'           // PascalCase
'form-submitted'           // kebab-case
'FEATURE_ENABLED'          // UPPER_CASE
```

### Naming Patterns by Category

Follow these naming patterns to make event names self-documenting:

**Action + Object:**

```javascript
// Format: [verb]_[noun]
'newsletter_subscribe'
'video_play'
'form_submit'
'product_add'
'account_create'
'payment_process'
```

**Object + Status:**

```javascript
// Format: [noun]_[status]
'video_started'
'video_completed'
'download_finished'
'upload_error'
'sync_failed'
```

**Object + Action + Context:**

```javascript
// Format: [noun]_[verb]_[context]
'product_view_search'
'product_add_recommendation'
'video_complete_onboarding'
'form_submit_footer'
'checkout_error_payment'
```

## Tracking Patterns

### 1. Track Purchase Events ASAP

Track purchase events on the order confirmation page immediately when the page loads, before users navigate away:

```javascript
// On order confirmation page
window.addEventListener('DOMContentLoaded', () => {
  // Get order data from page or API
  const orderData = window.__ORDER_DATA__ || getOrderFromAPI();

  if (orderData) {
    // Track immediately
    next.trackPurchase({
      id: orderData.orderId,
      total: orderData.total,
      currency: orderData.currency,
      items: orderData.items
    });
  }
});
```

Users often navigate away quickly. Track immediately to capture the event before they leave.

### 2. Track Before Navigation

For events that might cause navigation, track before the navigation occurs:

```javascript
// Bad - Event might not send before navigation
document.getElementById('checkout-btn').addEventListener('click', () => {
  next.trackBeginCheckout();
  window.location.href = '/checkout';  // May interrupt tracking
});

// Good - Track with callback
document.getElementById('checkout-btn').addEventListener('click', (e) => {
  e.preventDefault();
  next.trackBeginCheckout();
  // Give the event time to send
  setTimeout(() => {
    window.location.href = '/checkout';
  }, 100);
});

// Better - Use async tracking
document.getElementById('checkout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  await window.NextAnalytics.trackAsync({
    event: 'checkout_initiated',
    from_page: window.location.pathname
  });
  window.location.href = '/checkout';
});
```

### 3. Include Context in Events

Provide context data with custom events:

```javascript
// Good - With context
window.NextAnalytics.track({
  event: 'video_completed',
  video_id: 'intro-video',
  video_title: 'Product Introduction',
  video_duration: 120,
  video_category: 'onboarding',
  user_watched_percent: 100,
  completion_time_seconds: 118,
  playback_quality: '720p'
});

// Avoid - Minimal context
window.NextAnalytics.track({
  event: 'video_completed'
  // Missing critical context
});
```

### 4. Track User Journey Flows

For multi-step flows, track key checkpoints using consistent flow IDs:

```javascript
// Generate a unique flow ID
const flowId = generateUUID();

// Track flow start
window.NextAnalytics.track({
  event: 'checkout_flow_started',
  flow_id: flowId,
  entry_point: 'cart_page',
  cart_value: cartTotal,
  item_count: cartItems.length
});

// Track each step
window.NextAnalytics.track({
  event: 'checkout_step_completed',
  flow_id: flowId,
  step: 'shipping_info',
  step_number: 1,
  duration_ms: Date.now() - stepStartTime
});

// Track completion or abandonment
window.NextAnalytics.track({
  event: 'checkout_flow_completed',
  flow_id: flowId,
  steps_completed: 4,
  total_duration_ms: Date.now() - flowStartTime,
  conversion: true
});
```

### 5. Track Errors and Edge Cases

Capture error events for debugging and monitoring:

```javascript
// Track checkout errors
window.NextAnalytics.track({
  event: 'checkout_error',
  error_code: 'PAYMENT_DECLINED',
  error_message: 'Your card was declined',
  step: 'payment_processing',
  attempted_amount: 99.99
});

// Track form validation failures
window.NextAnalytics.track({
  event: 'form_validation_error',
  form_id: 'contact_form',
  field_errors: ['email', 'phone'],
  error_count: 2
});

// Track API failures
window.NextAnalytics.track({
  event: 'api_call_failed',
  endpoint: '/api/orders',
  status_code: 500,
  retry_attempt: 1,
  error_type: 'server_error'
});
```

## Error Handling

### Wrap Tracking in Try-Catch Blocks

Never let analytics errors break your application functionality:

```javascript
function trackAnalyticsEvent(eventName, eventData) {
  try {
    window.NextAnalytics.track({
      event: eventName,
      ...eventData
    });
  } catch (error) {
    // Log the error for monitoring
    console.error('Analytics tracking failed:', {
      event: eventName,
      error: error.message,
      stack: error.stack
    });

    // Don't re-throw - continue with app functionality
    // Consider sending to error tracking service
    if (window.errorReporter) {
      window.errorReporter.captureException(error);
    }
  }
}

// Usage
trackAnalyticsEvent('form_submitted', {
  form_id: 'contact',
  fields_count: 5
});
```

### Implement Graceful Degradation

Ensure the app works even if analytics fails:

```javascript
// Wrap the entire initialization
try {
  window.nextConfig = {
    apiKey: 'your-api-key',
    analytics: { enabled: true }
  };
} catch (error) {
  console.warn('Analytics initialization failed:', error);
  // App continues to work without analytics
}

// For critical tracking, use a wrapper
async function trackPurchaseWithFallback(orderData) {
  try {
    await window.NextAnalytics.trackAsync({
      event: 'purchase',
      ...orderData
    });
  } catch (error) {
    console.error('Failed to track purchase:', error);

    // Fallback: Send to error service
    if (window.errorReporter) {
      window.errorReporter.captureException(error, {
        tags: { event: 'purchase_tracking_failed' },
        extra: { orderData }
      });
    }
  }
}
```

## Performance Optimization

### 1. Batch Events

For multiple events in quick succession, batch them together:

```javascript
// Avoid - Multiple individual calls
items.forEach(item => {
  window.NextAnalytics.track({
    event: 'item_viewed',
    item_id: item.id
  });
});

// Better - Batch in a single event
window.NextAnalytics.track({
  event: 'items_batch_viewed',
  items: items.map(item => ({
    item_id: item.id,
    item_title: item.title
  })),
  batch_size: items.length,
  timestamp: Date.now()
});
```

### 2. Lazy Load Analytics

For non-critical tracking, defer analytics initialization:

```javascript
// Defer analytics to idle time
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    initializeAnalytics();
  });
} else {
  // Fallback for browsers without requestIdleCallback
  setTimeout(initializeAnalytics, 2000);
}

function initializeAnalytics() {
  window.nextConfig = {
    apiKey: 'your-api-key',
    analytics: { enabled: true }
  };
}
```

### 3. Use Appropriate API Based on Timing

Choose the API that matches your timing needs:

```javascript
// Immediate tracking (synchronous)
next.trackAddToCart('item-123', 1);

// For critical events that must complete
await window.NextAnalytics.trackAsync({
  event: 'purchase_confirmation',
  order_id: 'ORD-12345'
});

// For background tracking
window.NextAnalytics.track({
  event: 'page_interaction',
  interaction_type: 'scroll'
  // Fires in background, doesn't block
});
```

### 4. Debounce Frequent Events

For high-frequency events, debounce to reduce overhead:

```javascript
// Debounce scroll tracking
let scrollTimeout;
window.addEventListener('scroll', () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    window.NextAnalytics.track({
      event: 'page_scrolled',
      scroll_depth: (window.scrollY / document.body.scrollHeight) * 100
    });
  }, 1000);  // Track once per second max
});

// Debounce resize events
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    window.NextAnalytics.track({
      event: 'viewport_changed',
      width: window.innerWidth,
      height: window.innerHeight
    });
  }, 500);
});
```

## Custom Events Best Practices

### 1. Use EventBuilder for E-commerce Events

Use EventBuilder for e-commerce events to ensure GA4 compliance:

```javascript
import { EventBuilder, dataLayer } from '@/utils/analytics';

// Track wishlist addition
const item = {
  id: 'pkg-123',
  title: 'Premium Package',
  price: 99.99,
  category: 'packages'
};

const event = EventBuilder.createEvent('wishlist_add', {
  ecommerce: {
    currency: EventBuilder.getCurrency(),
    items: [EventBuilder.formatEcommerceItem(item, 0)]
  }
});

dataLayer.push(event);
```

### 2. Use Transform Functions for Data Enrichment

Enrich events globally without modifying every tracking call:

```javascript
import { dataLayer } from '@/utils/analytics';

// Add context to all events
dataLayer.setTransformFunction((event) => {
  // Add app metadata
  event.app_version = window.APP_VERSION;
  event.environment = window.ENV;

  // Add user context
  if (window.currentUser) {
    event.user_id = window.currentUser.id;
    event.user_tier = window.currentUser.tier;
  }

  // Add session data
  event.session_duration = Date.now() - window.sessionStartTime;

  return event;
});
```

### 3. Filter Events Strategically

Use transform functions to filter out unwanted events:

```javascript
dataLayer.setTransformFunction((event) => {
  // Filter out internal events in production
  const internalEvents = ['internal_test', 'dev_event'];
  if (internalEvents.includes(event.event) && window.ENV === 'production') {
    return null;  // Event won't be sent
  }

  // Filter test users
  if (event.user_properties?.customer_email?.includes('@test.com')) {
    return null;
  }

  return event;
});
```

### 4. Validate Events in Development

Enable event validation to catch issues early:

```javascript
if (process.env.NODE_ENV === 'development') {
  import { EventValidator } from '@/utils/analytics';

  const validator = new EventValidator(true);

  // Create a wrapper function
  const trackWithValidation = (eventName, eventData) => {
    const event = {
      event: eventName,
      ...eventData
    };

    // Validate before tracking
    const result = validator.validateEvent(event);
    if (!result.valid) {
      console.error('Invalid event:', {
        event: eventName,
        errors: result.errors,
        data: eventData
      });
      return;  // Don't send invalid events
    }

    window.NextAnalytics.track(event);
  };

  // Use throughout app
  window.trackWithValidation = trackWithValidation;
}
```

## Provider-Specific Best Practices

### Google Tag Manager

**Configuration:**

```javascript
window.nextConfig = {
  analytics: {
    providers: {
      gtm: {
        enabled: true
        // Optional: custom settings
      }
    }
  }
};
```

**Best Practices:**

1. **Test in GTM Preview Mode**: Always test events in GTM's preview mode before publishing containers.

```javascript
// Verify GTM is loading
console.log('GTM ready:', typeof dataLayer !== 'undefined');

// Check event in Preview
window.NextAnalytics.track({
  event: 'test_event',
  timestamp: new Date().toISOString()
});
```

2. **Use GTM's Debug View**: Enable GTM's Real-time Debug View in Google Analytics for verification.

3. **Version Control Containers**: Use GTM's version history feature to manage changes.

### Facebook Pixel

**Configuration:**

```javascript
window.nextConfig = {
  storeName: 'my-store',  // Critical for deduplication
  analytics: {
    providers: {
      facebook: {
        enabled: true,
        settings: {
          pixelId: 'YOUR_PIXEL_ID'
        }
      }
    }
  }
};
```

**Best Practices:**

1. **Set storeName**: Required for purchase deduplication across web and app.

```javascript
window.nextConfig = {
  storeName: 'consistent-store-name',  // Use same name in app SDK
  analytics: { ... }
};
```

2. **Track Purchase Immediately**: Track purchases on confirmation page before navigation.

```javascript
window.addEventListener('DOMContentLoaded', () => {
  next.trackPurchase(orderData);
});
```

3. **Use Correct Currency**: Ensure currency matches your Facebook Ads account settings.

```javascript
window.nextConfig = {
  currency: 'USD',  // Match your ad account currency
  analytics: { ... }
};
```

4. **Verify in Pixel Helper**: Use Facebook's Pixel Helper browser extension to verify events.

### RudderStack

**Configuration:**

```javascript
window.nextConfig = {
  analytics: {
    providers: {
      rudderstack: {
        enabled: true,
        settings: {
          writeKey: 'YOUR_WRITE_KEY',
          dataPlaneURL: 'https://your-dataplane.rudderstack.com'
        }
      }
    }
  }
};
```

**Best Practices:**

1. **Identify Users**: Set user context for better tracking.

```javascript
// After login
window.NextAnalytics.setUserProperties({
  user_id: user.id,
  email: user.email,
  name: user.name,
  plan: user.plan
});
```

2. **Use Traits**: Attach user traits for segmentation.

```javascript
window.NextAnalytics.track({
  event: 'feature_used',
  feature: 'advanced_search',
  traits: {
    plan: 'premium',
    company: 'acme-corp'
  }
});
```

3. **Monitor Transformations**: Use RudderStack's transformations for event routing.

### Custom Webhooks

**Configuration:**

```javascript
window.nextConfig = {
  analytics: {
    providers: {
      custom: {
        enabled: true,
        settings: {
          endpoint: 'https://api.yourapp.com/events',
          batchSize: 10,
          flushInterval: 5000
        }
      }
    }
  }
};
```

**Best Practices:**

1. **Implement Retry Logic**: Handle failed requests gracefully.

```javascript
// Server-side webhook handler
app.post('/events', async (req, res) => {
  const events = req.body.events;

  try {
    await processEvents(events);
    res.json({ success: true, processedCount: events.length });
  } catch (error) {
    // Client will retry
    res.status(500).json({ error: 'Processing failed' });
  }
});
```

2. **Validate Signatures**: Verify webhook authenticity if sensitive.

3. **Handle Batch Events**: Custom webhooks receive batched events for efficiency.

## Testing Strategies

### 1. Development Testing Checklist

Use this checklist when testing analytics implementation:

```javascript
// 1. Verify initialization
console.assert(
  typeof window.NextAnalytics !== 'undefined',
  'NextAnalytics not initialized'
);

// 2. Check debug mode
window.NextAnalytics.setDebugMode(true);

// 3. Test simple event
window.NextAnalytics.track({
  event: 'test_event',
  timestamp: new Date().toISOString()
});

// 4. Test add to cart
next.trackAddToCart('test-item', 1);

// 5. Test begin checkout
next.trackBeginCheckout();

// 6. Verify in console
const status = window.NextAnalytics.getStatus();
console.log('Analytics status:', status);
```

### 2. Browser Console Testing

Monitor events in real-time using the browser console:

```javascript
// Enable debug mode
window.NextAnalytics.setDebugMode(true);

// Monitor all events
window.addEventListener('NextAnalyticsEvent', (event) => {
  console.log('Event tracked:', event.detail);
});

// Check data layer
console.log('Data layer:', window.NextDataLayer);

// Verify provider routing
const status = window.NextAnalytics.getStatus();
console.table(status.providers);
```

### 3. Testing Purchase Flow

Test the complete purchase flow:

```javascript
// Simulate checkout initiation
window.addEventListener('DOMContentLoaded', () => {
  // Step 1: View items
  next.trackViewItem('item-1');
  next.trackViewItem('item-2');

  // Step 2: Add to cart
  next.trackAddToCart('item-1', 1);
  next.trackAddToCart('item-2', 2);

  // Step 3: Begin checkout
  next.trackBeginCheckout();

  // Step 4: Track purchase
  next.trackPurchase({
    id: 'ORDER_' + Date.now(),
    total: 199.99,
    currency: 'USD',
    items: [
      { id: 'item-1', title: 'Item 1', price: 99.99 },
      { id: 'item-2', title: 'Item 2', price: 100.00 }
    ]
  });
});
```

### 4. Error Scenario Testing

Test error handling:

```javascript
// Test error tracking
window.NextAnalytics.track({
  event: 'payment_error',
  error_code: 'CARD_DECLINED',
  error_message: 'Your card was declined',
  attempted_amount: 99.99
});

// Test recovery
window.NextAnalytics.track({
  event: 'payment_retry',
  retry_attempt: 2,
  original_error: 'CARD_DECLINED'
});

// Verify error is tracked but doesn't break app
console.assert(
  document.body !== null,
  'App broken after tracking error'
);
```

## Production Checklist

Before deploying analytics to production, verify:

**Configuration:**
- [ ] Analytics enabled in production config
- [ ] Debug mode disabled (set based on environment)
- [ ] storeName set for Facebook Pixel
- [ ] All required API keys configured via environment variables
- [ ] Mode set to 'auto' (unless specific reason for manual)
- [ ] All required providers enabled
- [ ] Custom webhook endpoints verified if using custom provider

**Implementation:**
- [ ] All purchase tracking implemented on confirmation page
- [ ] All custom events use consistent snake_case naming
- [ ] Error handling wrapped around all tracking calls
- [ ] Critical events (purchase, signup) have error handling
- [ ] Transform functions added for data enrichment
- [ ] Event validation enabled in development
- [ ] No PII tracked (emails, phone numbers) in non-critical events

**Testing:**
- [ ] Tested with GTM Debug View (if using GTM)
- [ ] Tested with Facebook Pixel Helper (if using Facebook)
- [ ] Verified purchase events on test transaction
- [ ] Verified custom events in GA4 Real-time Report
- [ ] Tested error scenarios (failed payment, form errors)
- [ ] Verified browser console has no analytics errors
- [ ] Cross-browser testing completed
- [ ] Mobile testing completed

**Monitoring:**
- [ ] Set up alerting for tracking failures
- [ ] Monitor event delivery rates
- [ ] Check for unexpected event spikes
- [ ] Review GA4 real-time dashboard for first 24 hours
- [ ] Verify revenue data matches internal records
- [ ] Monitor error event rates
- [ ] Set up weekly data quality checks

**Documentation:**
- [ ] Document all custom events and their parameters
- [ ] Document any event transform functions
- [ ] Document custom webhook endpoint schema
- [ ] Document any environment-specific configuration
- [ ] Create runbook for disabling analytics if needed
- [ ] Document provider credentials location
- [ ] Keep change log of analytics modifications

## Summary

Following these practices:
- Events reach their destinations consistently
- Events contain context for analysis
- Analytics doesn't slow down your application
- Consistent patterns make code easier to understand
- Error handling and configuration provide stable systems

Review this guide regularly and update your implementation as needed.
