# Event Transformers

Build custom event transformers to convert NextDataLayer events to any platform's format.

## Overview

Event transformers are scripts that intercept events from `window.NextDataLayer` and convert them to formats required by different analytics platforms. This pattern allows you to:

- Send events to platforms not natively supported by the SDK
- Convert SDK events to platform-specific formats
- Add custom logic for event processing
- Route events to multiple destinations with different formats

## How It Works

The transformer pattern:

1. **Waits** for `window.NextDataLayer` to be available
2. **Intercepts** events by overriding the `push()` method
3. **Transforms** events to platform-specific format
4. **Routes** transformed events to the destination
5. **Prevents duplicates** using event deduplication

### Basic Flow

```
Campaign Cart SDK
       ↓
window.NextDataLayer.push()
       ↓
Transformer (intercepts)
       ↓
Convert format
       ↓
window.platformLayer.push()
       ↓
Platform (GA4, TikTok, etc.)
```

## Basic Transformer Template

Here's a generic template you can adapt for any platform:

```javascript
(function() {
  'use strict';

  // Track processed events to avoid duplicates
  const processedEvents = new Set();

  // Your event mapping
  const EVENT_MAP = {
    'dl_view_item': 'ViewContent',       // Platform-specific name
    'dl_add_to_cart': 'AddToCart',
    'dl_purchase': 'Purchase'
    // Add more mappings...
  };

  // Wait for NextDataLayer
  const initTransformer = () => {
    if (!window.NextDataLayer) {
      setTimeout(initTransformer, 100);
      return;
    }

    console.log('[Transformer] Initializing...');

    // Override the push method
    const originalPush = window.NextDataLayer.push;

    window.NextDataLayer.push = function(...args) {
      // Call original push first
      const result = originalPush.apply(window.NextDataLayer, args);

      // Process each pushed item
      args.forEach(item => {
        if (item && typeof item === 'object' && item.event) {
          processEvent(item);
        }
      });

      return result;
    };

    // Process existing events
    window.NextDataLayer.forEach(item => {
      if (item && typeof item === 'object' && item.event) {
        processEvent(item);
      }
    });

    console.log('[Transformer] Initialized successfully');
  };

  // Process individual events
  const processEvent = (event) => {
    // Skip if not mapped
    if (!EVENT_MAP[event.event]) {
      return;
    }

    // Create unique ID to prevent duplicates
    const eventId = `${event.event}_${event._metadata?.sequence_number || Date.now()}`;

    if (processedEvents.has(eventId)) {
      return;
    }

    processedEvents.add(eventId);

    // Get platform-specific event name
    const platformEventName = EVENT_MAP[event.event];

    // Build platform-specific event
    const platformEvent = {
      event: platformEventName,
      // Add your platform-specific fields...
    };

    // Send to platform (customize this!)
    window.yourPlatformLayer = window.yourPlatformLayer || [];
    window.yourPlatformLayer.push(platformEvent);

    console.log(`[Transformer] Converted ${event.event} → ${platformEventName}`, platformEvent);
  };

  // Clean up old events periodically (prevent memory leak)
  setInterval(() => {
    if (processedEvents.size > 1000) {
      const entriesToKeep = Array.from(processedEvents).slice(-500);
      processedEvents.clear();
      entriesToKeep.forEach(entry => processedEvents.add(entry));
    }
  }, 60000);

  // Start the transformer
  initTransformer();
})();
```

## Platform-Specific Examples

### GA4 Transformer

Convert events to Google Analytics 4 format and send to `window.dataLayer`:

```javascript
const EVENT_MAP = {
  'dl_add_to_cart': 'add_to_cart',
  'dl_remove_from_cart': 'remove_from_cart',
  'dl_view_item': 'view_item',
  'dl_view_item_list': 'view_item_list',
  'dl_begin_checkout': 'begin_checkout',
  'dl_purchase': 'purchase',
  'dl_add_payment_info': 'add_payment_info',
  'dl_add_shipping_info': 'add_shipping_info',
  'dl_login': 'login',
  'dl_sign_up': 'sign_up'
};

const processEvent = (event) => {
  if (!EVENT_MAP[event.event]) return;

  const ga4Event = {
    event: EVENT_MAP[event.event],
    event_id: event.event_id
  };

  // Handle ecommerce events
  if (event.ecommerce) {
    // Clear ecommerce first (GTM best practice)
    window.dataLayer.push({ ecommerce: null });

    ga4Event.ecommerce = {
      ...event.ecommerce,
      items: event.ecommerce.items?.map(item => ({
        item_id: item.item_id || item.id,
        item_name: item.item_name || item.name,
        price: item.price,
        quantity: item.quantity,
        currency: item.currency
      }))
    };
  }

  window.dataLayer.push(ga4Event);
};
```

### TikTok Pixel Transformer

Convert events to TikTok Pixel format:

```javascript
const EVENT_MAP = {
  'dl_view_item': 'ViewContent',
  'dl_add_to_cart': 'AddToCart',
  'dl_begin_checkout': 'InitiateCheckout',
  'dl_purchase': 'CompletePayment',
  'dl_view_item_list': 'ViewContent'
};

const processEvent = (event) => {
  if (!EVENT_MAP[event.event]) return;

  const tiktokEventName = EVENT_MAP[event.event];

  // Build TikTok event data
  const tiktokData = {
    content_type: 'product'
  };

  if (event.ecommerce) {
    tiktokData.currency = event.ecommerce.currency;
    tiktokData.value = event.ecommerce.value;

    if (event.ecommerce.items?.[0]) {
      tiktokData.content_id = event.ecommerce.items[0].item_id;
      tiktokData.content_name = event.ecommerce.items[0].item_name;
    }

    // For purchase events
    if (event.event === 'dl_purchase') {
      tiktokData.content_ids = event.ecommerce.items?.map(i => i.item_id);
      tiktokData.contents = event.ecommerce.items?.map(i => ({
        content_id: i.item_id,
        content_name: i.item_name,
        quantity: i.quantity,
        price: i.price
      }));
    }
  }

  // Send to TikTok Pixel
  if (window.ttq) {
    window.ttq.track(tiktokEventName, tiktokData);
    console.log(`[TikTok] ${event.event} → ${tiktokEventName}`, tiktokData);
  }
};
```

### Snapchat Pixel Transformer

Convert events to Snapchat Pixel format:

```javascript
const EVENT_MAP = {
  'dl_view_item': 'VIEW_CONTENT',
  'dl_add_to_cart': 'ADD_CART',
  'dl_begin_checkout': 'START_CHECKOUT',
  'dl_purchase': 'PURCHASE',
  'dl_sign_up': 'SIGN_UP'
};

const processEvent = (event) => {
  if (!EVENT_MAP[event.event]) return;

  const snapEventName = EVENT_MAP[event.event];

  const snapData = {};

  if (event.ecommerce) {
    snapData.currency = event.ecommerce.currency;
    snapData.price = event.ecommerce.value;

    if (event.ecommerce.transaction_id) {
      snapData.transaction_id = event.ecommerce.transaction_id;
    }

    if (event.ecommerce.items?.length > 0) {
      snapData.item_ids = event.ecommerce.items.map(i => i.item_id);
      snapData.item_category = event.ecommerce.items[0].item_category;
      snapData.number_items = event.ecommerce.items.length;
    }
  }

  // Send to Snapchat Pixel
  if (window.snaptr) {
    window.snaptr('track', snapEventName, snapData);
    console.log(`[Snapchat] ${event.event} → ${snapEventName}`, snapData);
  }
};
```

### Pinterest Tag Transformer

Convert events to Pinterest Tag format:

```javascript
const EVENT_MAP = {
  'dl_view_item': 'pagevisit',
  'dl_add_to_cart': 'addtocart',
  'dl_begin_checkout': 'checkout',
  'dl_purchase': 'checkout',
  'dl_sign_up': 'signup',
  'dl_view_item_list': 'viewcategory'
};

const processEvent = (event) => {
  if (!EVENT_MAP[event.event]) return;

  const pinterestEventName = EVENT_MAP[event.event];

  const pinterestData = {};

  if (event.ecommerce) {
    pinterestData.currency = event.ecommerce.currency;
    pinterestData.value = event.ecommerce.value;

    if (event.ecommerce.items?.length > 0) {
      pinterestData.line_items = event.ecommerce.items.map(item => ({
        product_name: item.item_name,
        product_id: item.item_id,
        product_price: item.price,
        product_quantity: item.quantity
      }));
    }

    if (event.event === 'dl_purchase' && event.ecommerce.transaction_id) {
      pinterestData.order_id = event.ecommerce.transaction_id;
      pinterestData.order_quantity = event.ecommerce.items?.reduce((sum, i) => sum + i.quantity, 0);
    }
  }

  // Send to Pinterest Tag
  if (window.pintrk) {
    window.pintrk('track', pinterestEventName, pinterestData);
    console.log(`[Pinterest] ${event.event} → ${pinterestEventName}`, pinterestData);
  }
};
```

## Advanced Patterns

### Multi-Platform Transformer

Send events to multiple platforms from one transformer:

```javascript
const processEvent = (event) => {
  // Send to GA4
  if (window.dataLayer && GA4_EVENT_MAP[event.event]) {
    const ga4Event = buildGA4Event(event);
    window.dataLayer.push(ga4Event);
  }

  // Send to TikTok
  if (window.ttq && TIKTOK_EVENT_MAP[event.event]) {
    const tiktokData = buildTikTokEvent(event);
    window.ttq.track(TIKTOK_EVENT_MAP[event.event], tiktokData);
  }

  // Send to Snapchat
  if (window.snaptr && SNAP_EVENT_MAP[event.event]) {
    const snapData = buildSnapEvent(event);
    window.snaptr('track', SNAP_EVENT_MAP[event.event], snapData);
  }
};
```

### Conditional Routing

Route events based on conditions:

```javascript
const processEvent = (event) => {
  // Only send high-value purchases to premium platforms
  if (event.event === 'dl_purchase' && event.ecommerce?.value > 1000) {
    sendToPremiumPlatform(event);
  }

  // Send all events to GA4
  sendToGA4(event);

  // Filter test users
  if (event.user_properties?.customer_email?.includes('@test.com')) {
    return; // Don't send to paid platforms
  }

  sendToFacebookPixel(event);
};
```

### Event Enrichment

Add additional data before sending:

```javascript
const processEvent = (event) => {
  // Enrich with custom data
  const enrichedEvent = {
    ...event,
    app_version: window.APP_VERSION,
    environment: window.ENV,
    user_segment: getUserSegment(),
    ab_test_variant: getActiveVariant()
  };

  // Send enriched event
  sendToPlatform(enrichedEvent);
};
```

## Installation

### 1. Create transformer script

Save your transformer as a `.js` file (e.g., `transformer-tiktok.js`)

### 2. Add to page after SDK

```html
<!-- Campaign Cart SDK -->
<script src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.3.8/dist/loader.js" type="module"></script>

<!-- Your Transformer -->
<script src="/path/to/transformer-tiktok.js"></script>
```

### 3. Load platform script

Ensure the target platform's script loads before the transformer:

```html
<!-- TikTok Pixel -->
<script src="https://analytics.tiktok.com/i18n/pixel/sdk.js?sdkid=YOUR_PIXEL_ID"></script>

<!-- Campaign Cart SDK -->
<script src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.3.8/dist/loader.js" type="module"></script>

<!-- TikTok Transformer -->
<script src="/path/to/transformer-tiktok.js"></script>
```

## Best Practices

### 1. Deduplicate Events

Always track processed events to prevent duplicates:

```javascript
const processedEvents = new Set();

const processEvent = (event) => {
  const eventId = `${event.event}_${event._metadata?.sequence_number}`;

  if (processedEvents.has(eventId)) {
    return; // Skip duplicate
  }

  processedEvents.add(eventId);
  // Process event...
};
```

### 2. Clean Up Memory

Prevent memory leaks by periodically cleaning old data:

```javascript
setInterval(() => {
  if (processedEvents.size > 1000) {
    const entriesToKeep = Array.from(processedEvents).slice(-500);
    processedEvents.clear();
    entriesToKeep.forEach(entry => processedEvents.add(entry));
  }
}, 60000); // Every minute
```

### 3. Handle Missing Data

Gracefully handle missing or malformed data:

```javascript
const processEvent = (event) => {
  if (!event || !event.event) {
    console.warn('[Transformer] Invalid event', event);
    return;
  }

  const value = event.ecommerce?.value ?? 0;
  const items = event.ecommerce?.items || [];

  // Use defaults...
};
```

### 4. Debug Logging

Add conditional debug logging:

```javascript
const DEBUG = window.location.hostname === 'localhost' ||
              window.location.search.includes('debug=true');

const processEvent = (event) => {
  // Process event...

  if (DEBUG) {
    console.log(`[Transformer] Converted ${event.event}`, platformEvent);
  }
};
```

### 5. Error Handling

Wrap platform calls in try-catch:

```javascript
const processEvent = (event) => {
  try {
    const platformEvent = buildEvent(event);
    window.platform.track(platformEvent);
  } catch (error) {
    console.error('[Transformer] Error processing event:', error, event);
    // Don't throw - let other code continue
  }
};
```

## Debugging

### Check Transformer Status

```javascript
// Check if NextDataLayer exists
console.log(window.NextDataLayer);

// Check if transformer modified push
console.log(window.NextDataLayer.push.toString());

// View all events
console.log(window.NextDataLayer);
```

### Enable Debug Mode

Add `?debug=true` to your URL to see console logs:

```
https://yoursite.com?debug=true
```

### Verify Platform Script Loaded

```javascript
// TikTok
console.log(typeof window.ttq); // Should be 'object'

// Snapchat
console.log(typeof window.snaptr); // Should be 'function'

// Pinterest
console.log(typeof window.pintrk); // Should be 'function'

// GA4
console.log(typeof window.gtag); // Should be 'function'
```

## Full Example: TikTok Transformer

Complete working example for TikTok Pixel:

```javascript
(function() {
  'use strict';

  const processedEvents = new Set();
  const DEBUG = window.location.search.includes('debug=true');

  const EVENT_MAP = {
    'dl_view_item': 'ViewContent',
    'dl_add_to_cart': 'AddToCart',
    'dl_begin_checkout': 'InitiateCheckout',
    'dl_purchase': 'CompletePayment'
  };

  const initTransformer = () => {
    if (!window.NextDataLayer) {
      setTimeout(initTransformer, 100);
      return;
    }

    if (DEBUG) console.log('[TikTok Transformer] Initializing...');

    const originalPush = window.NextDataLayer.push;

    window.NextDataLayer.push = function(...args) {
      const result = originalPush.apply(window.NextDataLayer, args);

      args.forEach(item => {
        if (item && typeof item === 'object' && item.event) {
          processEvent(item);
        }
      });

      return result;
    };

    window.NextDataLayer.forEach(item => {
      if (item && typeof item === 'object' && item.event) {
        processEvent(item);
      }
    });

    if (DEBUG) console.log('[TikTok Transformer] Initialized');
  };

  const processEvent = (event) => {
    if (!EVENT_MAP[event.event]) return;

    const eventId = `${event.event}_${event._metadata?.sequence_number || Date.now()}`;
    if (processedEvents.has(eventId)) return;
    processedEvents.add(eventId);

    const tiktokEventName = EVENT_MAP[event.event];
    const tiktokData = {
      content_type: 'product'
    };

    if (event.ecommerce) {
      tiktokData.currency = event.ecommerce.currency || 'USD';
      tiktokData.value = event.ecommerce.value || 0;

      if (event.ecommerce.items?.length > 0) {
        tiktokData.content_id = event.ecommerce.items[0].item_id;
        tiktokData.content_name = event.ecommerce.items[0].item_name;

        if (event.event === 'dl_purchase') {
          tiktokData.content_ids = event.ecommerce.items.map(i => i.item_id);
          tiktokData.contents = event.ecommerce.items.map(i => ({
            content_id: i.item_id,
            content_name: i.item_name,
            quantity: i.quantity,
            price: i.price
          }));
        }
      }
    }

    try {
      if (window.ttq) {
        window.ttq.track(tiktokEventName, tiktokData);
        if (DEBUG) {
          console.log(`[TikTok] ${event.event} → ${tiktokEventName}`, tiktokData);
        }
      }
    } catch (error) {
      console.error('[TikTok Transformer] Error:', error);
    }
  };

  setInterval(() => {
    if (processedEvents.size > 1000) {
      const entriesToKeep = Array.from(processedEvents).slice(-500);
      processedEvents.clear();
      entriesToKeep.forEach(entry => processedEvents.add(entry));
    }
  }, 60000);

  initTransformer();
})();
```

## Download Example Scripts

Get ready-to-use transformer scripts:
- **GA4 Transformer** - Google Analytics 4
- **TikTok Transformer** - Copy from example above
- **Snapchat Transformer** - Copy from example above
- **Pinterest Transformer** - Copy from example above

## Related Documentation

- [Analytics Overview](./index.md) - Main analytics documentation
- [Custom Events](./custom-events.md) - Creating custom events
- [Providers](./providers.md) - Built-in provider integrations
- [Configuration](./configuration.md) - SDK configuration options
