# Custom Events & Advanced Tracking

Create custom analytics events and implement advanced tracking patterns with transform functions.

Track custom business events and transform events before they're sent to providers.

## Simple Custom Events

Track custom events with arbitrary data:

```javascript
window.NextAnalytics.track({
  event: 'newsletter_subscribe',
  email: 'user@example.com',
  list_name: 'Weekly Newsletter',
  source: 'footer_form'
});
```

Custom events are sent to **all enabled providers** and stored in `window.NextDataLayer`.

### Automatic Enrichment

Every event is automatically enriched with:
- **event_id** - Unique event identifier
- **event_time** - ISO timestamp
- **user_properties** - Current user data (visitor_type, customer_email, etc.)
- **attribution** - UTM parameters, funnel, affiliate data
- **session_id** - Current session identifier
- **Context** - page_location, page_title, user_agent, screen_resolution, viewport_size

You don't need to add these manually - they're included automatically.

### Common Custom Event Examples

**Newsletter:**

```javascript
// Newsletter subscription
window.NextAnalytics.track({
  event: 'newsletter_subscribe',
  email: 'user@example.com',
  list: 'weekly_digest',
  source: 'footer'
});
```

**Video:**

```javascript
// Video engagement
window.NextAnalytics.track({
  event: 'video_played',
  video_id: 'intro-demo',
  video_title: 'Product Introduction',
  duration: 120
});

window.NextAnalytics.track({
  event: 'video_completed',
  video_id: 'intro-demo',
  percent_watched: 100
});
```

**Form:**

```javascript
// Form submission
window.NextAnalytics.track({
  event: 'form_submitted',
  form_id: 'contact',
  form_type: 'contact_us',
  fields_filled: 5
});
```

**Feature:**

```javascript
// Feature usage
window.NextAnalytics.track({
  event: 'feature_used',
  feature_name: 'product_comparison',
  items_compared: 3,
  user_id: currentUserId
});
```

## E-commerce Custom Events

For custom e-commerce events, include product data using the GA4 ecommerce format:

```javascript
window.NextAnalytics.track({
  event: 'wishlist_add',
  ecommerce: {
    currency: 'USD',
    value: 99.99,
    items: [{
      item_id: 'SKU-123',
      item_name: 'Product Name',
      item_category: 'Electronics',
      price: 99.99,
      quantity: 1
    }]
  }
});
```

### Custom E-commerce Examples

**Wishlist:**

```javascript
function trackWishlistAdd(item) {
  window.NextAnalytics.track({
    event: 'wishlist_add',
    ecommerce: {
      currency: 'USD',
      value: item.price,
      items: [{
        item_id: item.sku,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: 1
      }]
    }
  });
}
```

**Comparison:**

```javascript
function trackProductComparison(products) {
  window.NextAnalytics.track({
    event: 'product_compare',
    comparison_count: products.length,
    ecommerce: {
      currency: 'USD',
      items: products.map((product, index) => ({
        item_id: product.sku,
        item_name: product.name,
        item_category: product.category,
        price: product.price,
        quantity: 1,
        index: index
      }))
    }
  });
}
```

**Quick View:**

```javascript
function trackQuickView(item) {
  window.NextAnalytics.track({
    event: 'quick_view',
    view_type: 'modal',
    ecommerce: {
      currency: 'USD',
      value: item.price,
      items: [{
        item_id: item.sku,
        item_name: item.name,
        item_category: item.category,
        price: item.price,
        quantity: 1
      }]
    }
  });
}
```

## Transform Functions

Modify ALL events before they're sent to providers using transform functions.

### Using DataLayerManager

```javascript
// Access the data layer manager
const dataLayer = window.NextDataLayerManager;

dataLayer.setTransformFunction((event) => {
  // Add custom fields to every event
  event.app_version = '1.0.0';
  event.environment = 'production';
  event.custom_user_id = getCurrentUserId();

  // Filter out events
  if (event.event === 'internal_test') {
    return null; // Event won't be sent
  }

  // Modify specific events
  if (event.event === 'dl_purchase') {
    event.ecommerce.custom_order_type = getOrderType();
    event.fulfillment_center = 'US-WEST';
  }

  return event;
});
```

### Global Transform Function

You can also set a transform function globally in the window:

```javascript
window.NextDataLayerTransformFn = function(event) {
  event.custom_property = 'value';
  return event;
};
```

This runs before the configured transform function.

### Transform Function Use Cases

**Enrich Events:**

```javascript
window.NextDataLayerTransformFn = function(event) {
  // Add app context to all events
  event.app_version = window.APP_VERSION;
  event.environment = window.ENV;
  event.build_number = window.BUILD_NUM;

  // Add user context
  if (window.userSession) {
    event.session_duration = Date.now() - window.userSession.startTime;
    event.page_views = window.userSession.pageViews;
  }

  return event;
};
```

**Filter Events:**

```javascript
window.NextDataLayerTransformFn = function(event) {
  // Filter out internal events
  const internalEvents = ['internal_test', 'dev_event', 'debug'];
  if (internalEvents.includes(event.event)) {
    return null; // Don't send
  }

  // Filter test users
  if (event.user_properties?.customer_email?.includes('@test.com')) {
    return null;
  }

  return event;
};
```

**Privacy:**

```javascript
window.NextDataLayerTransformFn = function(event) {
  // Remove PII in certain environments
  if (window.ENV === 'development') {
    if (event.user_properties) {
      event.user_properties.customer_email = 'redacted@example.com';
      event.user_properties.customer_phone = 'REDACTED';
      delete event.user_properties.customer_address_1;
    }
  }

  return event;
};
```

**Multi-region:**

```javascript
window.NextDataLayerTransformFn = function(event) {
  // Add region-specific data
  const region = getUserRegion();
  event.region = region;
  event.currency_override = getRegionalCurrency(region);

  // Route high-value purchases
  if (event.event === 'dl_purchase' && event.ecommerce.value > 1000) {
    event.priority = 'high';
    event.fraud_check_required = true;
  }

  return event;
};
```

## Advanced Event Patterns

### Event Chaining

Track sequences of related events:

```javascript
// Start checkout flow
window.NextAnalytics.track({
  event: 'checkout_flow_started',
  flow_id: generateFlowId(),
  entry_point: 'cart_page'
});

// Track each step
window.NextAnalytics.track({
  event: 'checkout_step_completed',
  flow_id: currentFlowId,
  step: 'shipping_info',
  duration_ms: stepDuration
});

// Track completion
window.NextAnalytics.track({
  event: 'checkout_flow_completed',
  flow_id: currentFlowId,
  total_duration_ms: totalDuration,
  steps_completed: 4
});
```

### Conditional Event Tracking

Track events based on business logic:

```javascript
function trackCartMilestone(cartValue) {
  const milestones = [
    { threshold: 50, name: 'free_shipping_eligible' },
    { threshold: 100, name: 'discount_eligible' },
    { threshold: 200, name: 'premium_tier_reached' }
  ];

  milestones.forEach(milestone => {
    if (cartValue >= milestone.threshold && !hasMilestone(milestone.name)) {
      window.NextAnalytics.track({
        event: 'cart_milestone',
        milestone: milestone.name,
        cart_value: cartValue,
        threshold: milestone.threshold
      });

      saveMilestone(milestone.name);
    }
  });
}
```

### Time-based Event Tracking

Track engagement duration:

```javascript
class VideoTracker {
  constructor(videoId) {
    this.videoId = videoId;
    this.startTime = Date.now();
    this.milestones = [25, 50, 75, 100];
    this.tracked = new Set();
  }

  trackProgress(percentComplete) {
    this.milestones.forEach(milestone => {
      if (percentComplete >= milestone && !this.tracked.has(milestone)) {
        window.NextAnalytics.track({
          event: 'video_progress',
          video_id: this.videoId,
          milestone: milestone,
          duration_watched: Date.now() - this.startTime
        });

        this.tracked.add(milestone);
      }
    });
  }

  trackComplete() {
    window.NextAnalytics.track({
      event: 'video_completed',
      video_id: this.videoId,
      total_duration: Date.now() - this.startTime
    });
  }
}
```

## Best Practices

### 1. Consistent Event Naming

Use snake_case for all custom events:

```javascript
// Good
'newsletter_subscribe'
'video_completed'
'form_submitted'
'feature_enabled'

// Avoid
'subscribeNewsletter'
'VideoCompleted'
'form-submitted'
'FEATURE_ENABLED'
```

### 2. Include Context

Provide event context:

```javascript
// Good - With context
window.NextAnalytics.track({
  event: 'video_completed',
  video_id: 'intro-video',
  video_title: 'Product Introduction',
  video_duration: 120,
  video_category: 'onboarding',
  user_watched_percent: 100,
  completion_time_seconds: 118
});

// Avoid - Minimal context
window.NextAnalytics.track({
  event: 'video_completed'
});
```

### 3. Use GA4 Ecommerce Format

For e-commerce events, use the GA4 standard format:

```javascript
// Good - GA4 format
window.NextAnalytics.track({
  event: 'wishlist_add',
  ecommerce: {
    currency: 'USD',
    value: 99.99,
    items: [{
      item_id: 'SKU-123',
      item_name: 'Product Name',
      price: 99.99,
      quantity: 1
    }]
  }
});

// Avoid - Non-standard format
window.NextAnalytics.track({
  event: 'wishlist_add',
  product: item  // Wrong structure
});
```

### 4. Handle Errors Gracefully

Never let analytics errors break your app:

```javascript
try {
  window.NextAnalytics.track(customEvent);
} catch (error) {
  console.error('Analytics tracking failed:', error);
  // Don't throw - continue with app functionality
}
```

### 5. Debug in Development

Enable debug mode to see detailed logs:

```javascript
// In browser console
window.NextAnalytics.setDebugMode(true);

// Or via config
window.nextConfig = {
  analytics: {
    debug: true
  }
};
```

## Examples

### Product Recommendation Tracking

```javascript
function trackRecommendationClick(item, recommendationType) {
  window.NextAnalytics.track({
    event: 'recommendation_clicked',
    item_id: item.id,
    item_name: item.title,
    recommendation_type: recommendationType, // 'similar', 'upsell', 'cross-sell'
    recommendation_position: item.position,
    algorithm: 'collaborative_filtering'
  });
}
```

### A/B Test Tracking

```javascript
function trackExperiment(experimentId, variantId) {
  window.NextAnalytics.track({
    event: 'experiment_viewed',
    experiment_id: experimentId,
    variant_id: variantId,
    user_id: getCurrentUserId()
  });
}

function trackExperimentConversion(experimentId, variantId) {
  window.NextAnalytics.track({
    event: 'experiment_converted',
    experiment_id: experimentId,
    variant_id: variantId,
    conversion_value: getCartValue()
  });
}
```

### Search Tracking

```javascript
function trackSearch(query, resultsCount) {
  window.NextAnalytics.track({
    event: 'search_performed',
    search_query: query,
    results_count: resultsCount,
    search_filters: getActiveFilters(),
    search_sort: getCurrentSort()
  });
}

function trackSearchResultClick(query, item, position) {
  window.NextAnalytics.track({
    event: 'search_result_clicked',
    search_query: query,
    item_id: item.id,
    item_position: position,
    results_count: getTotalResults()
  });
}
```

## Accessing the Data Layer

View all tracked events:

```javascript
// View all events
console.log(window.NextDataLayer);

// Get event count
const count = window.NextDataLayerManager.getEventCount();
console.log(`Tracked ${count} events`);

// Get analytics status
const status = window.NextAnalytics.getStatus();
console.log(status);
// {
//   initialized: true,
//   debugMode: false,
//   providers: ['GTM', 'Facebook'],
//   eventsTracked: 15,
//   ignored: false
// }
```

## Related Documentation

- [Analytics Overview](./index.md) - Main analytics documentation
- [Tracking API](./tracking-api.md) - Core tracking methods and events
- [Configuration](./configuration.md) - SDK configuration options
- [Providers](./providers.md) - Provider setup guides
