# Configuration & Modes

Complete analytics configuration reference including tracking modes, provider settings, and runtime options.

Configure the analytics system through `window.nextConfig` to control tracking behavior, enable providers, and set operational modes.

## Basic Configuration

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  storeName: 'my-store',  // Important for Facebook deduplication
  analytics: {
    enabled: true,
    debug: false,
    mode: 'auto',
    providers: {
      gtm: { enabled: true },
      facebook: {
        enabled: true,
        settings: { pixelId: 'YOUR_PIXEL_ID' }
      },
      rudderstack: { enabled: true },
      custom: {
        enabled: true,
        settings: { endpoint: 'https://api.yourapp.com/analytics' }
      }
    }
  }
};
```

## Configuration Options

### Top-Level Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Master switch for all analytics tracking |
| `debug` | boolean | `false` | Enable detailed console logging for troubleshooting |
| `mode` | string | `'auto'` | Tracking mode: `'auto'` or `'manual'` |
| `providers` | object | `{}` | Provider configurations (GTM, Facebook, RudderStack, custom) |

### Store-Level Options

| Option | Type | Description |
|--------|------|-------------|
| `storeName` | string | **Required for Facebook Pixel** - Used for purchase deduplication |

## Tracking Modes

### Auto Mode (Recommended)

Auto mode automatically tracks common e-commerce events without manual intervention.

```javascript
analytics: {
  mode: 'auto'
}
```

**Automatically tracked events:**

| Event | Trigger | Description |
|-------|---------|-------------|
| `dl_user_data` | Page load, route changes | Base user event with cart contents |
| `dl_view_item_list` | Collection/category pages | Product list views (when URL matches patterns) |
| `dl_view_item` | Single product pages | Product detail view (1 product with data-next-package-id) |
| `dl_add_to_cart` | Cart additions | When using data attributes or cart methods |
| `dl_remove_from_cart` | Cart removals | When using cart methods |
| `dl_begin_checkout` | Checkout page load | Checkout process initiation |
| `dl_add_shipping_info` | Shipping form submission | Shipping information entered |
| `dl_add_payment_info` | Payment form submission | Payment method selected |
| `dl_purchase` | Order completion | Queued and fired on confirmation page |

**Events requiring manual tracking:**
- `dl_sign_up` - User registration
- `dl_login` - User login
- Custom business events

**Event Queue:**

Events with redirects (like `dl_purchase`) are queued to `sessionStorage` and automatically fired after navigation completes.

**When to use auto mode:**
- Standard e-commerce implementations
- Minimal custom tracking requirements
- Want to minimize code complexity
- Need consistent tracking across pages

### Manual Mode

Full control over when and how events are tracked.

```javascript
analytics: {
  mode: 'manual'
}
```

**All events must be manually tracked** using the tracking API.

**When to use manual mode:**
- Need complete control over event timing
- Custom e-commerce flows that don't match standard patterns
- Want to track only specific events
- Implementing custom event logic

**Example manual tracking:**

```javascript
// View item
window.NextAnalytics.trackViewItem({ id: '123', title: 'Product', price: 99.99 });

// Add to cart
window.NextAnalytics.trackAddToCart({ id: '123', quantity: 1 });

// Begin checkout
window.NextAnalytics.trackBeginCheckout();

// Purchase
window.NextAnalytics.trackPurchase(orderData);
```

## Provider Configuration

### Google Tag Manager

```javascript
providers: {
  gtm: {
    enabled: true,
    blockedEvents: ['dl_test_event', 'internal_event']  // Optional
  }
}
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable GTM integration |
| `blockedEvents` | string[] | Events to exclude from GTM |

Events are pushed to `window.dataLayer` and `window.ElevarDataLayer`.

See [Google Tag Manager Setup](./google-tag-manager.md) for detailed configuration.

### Facebook Pixel

```javascript
storeName: 'my-store',  // CRITICAL for deduplication
analytics: {
  providers: {
    facebook: {
      enabled: true,
      settings: {
        pixelId: 'YOUR_PIXEL_ID'
      },
      blockedEvents: []  // Optional
    }
  }
}
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable Facebook Pixel integration |
| `settings.pixelId` | string | **Required** - Facebook Pixel ID |
| `blockedEvents` | string[] | Events to exclude from Facebook |

> **Caution:** Always set `storeName` in your config when using Facebook Pixel to ensure proper purchase deduplication with server-side events.

See [Facebook Pixel Setup](./facebook-pixel.md) for event mapping and deduplication details.

### RudderStack

```javascript
providers: {
  rudderstack: {
    enabled: true,
    blockedEvents: []  // Optional
  }
}
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable RudderStack integration |
| `blockedEvents` | string[] | Events to exclude from RudderStack |

Events are mapped to Segment specification format.

See [RudderStack Setup](./rudderstack.md) for event mapping details.

### Custom Webhook

```javascript
providers: {
  custom: {
    enabled: true,
    settings: {
      // Required
      endpoint: 'https://api.yourapp.com/analytics',

      // Optional headers
      headers: {
        'Authorization': 'Bearer YOUR_TOKEN',
        'Content-Type': 'application/json',
        'X-Store-ID': 'store-123'
      },

      // Batching settings
      batchSize: 10,           // Events per batch (default: 10)
      batchIntervalMs: 5000,   // Max time before sending (default: 5000ms)

      // Retry configuration
      maxRetries: 3,           // Retry attempts (default: 3)
      retryDelayMs: 1000,      // Initial retry delay (default: 1000ms)

      // Transform function
      transformFunction: (event) => {
        event.app_version = '1.0.0';
        return event;
      }
    },
    blockedEvents: []  // Optional
  }
}
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `enabled` | boolean | Enable custom webhook integration |
| `settings.endpoint` | string | **Required** - Your webhook URL |
| `settings.headers` | object | Custom HTTP headers |
| `settings.batchSize` | number | Events per batch (default: 10) |
| `settings.batchIntervalMs` | number | Max batch wait time (default: 5000ms) |
| `settings.maxRetries` | number | Retry attempts on failure (default: 3) |
| `settings.retryDelayMs` | number | Initial retry delay with exponential backoff (default: 1000ms) |
| `settings.transformFunction` | function | Transform events before sending |
| `blockedEvents` | string[] | Events to exclude from webhook |

See [Custom Webhook Setup](./custom-webhook.md) for batching, retry logic, and implementation details.

## Multiple Providers

Enable all providers simultaneously - each operates independently:

```javascript
providers: {
  gtm: { enabled: true },
  facebook: { enabled: true, settings: { pixelId: 'xxx' } },
  rudderstack: { enabled: true },
  custom: { enabled: true, settings: { endpoint: 'https://...' } }
}
```

**How it works:**
- Each event sent to ALL enabled providers
- Providers operate independently (one failure doesn't affect others)
- Events always stored in `NextDataLayer` regardless of provider status
- Debug mode shows which providers received each event

## Runtime Configuration

### Enable Debug Mode

**Configuration:**

```javascript
analytics: {
  debug: true
}
```

**Runtime:**

```javascript
// Enable at runtime
window.NextAnalytics.setDebugMode(true);

// Disable
window.NextAnalytics.setDebugMode(false);
```

### Check Analytics Status

```javascript
const status = window.NextAnalytics.getStatus();
console.log(status);

// Output:
// {
//   enabled: true,
//   mode: 'auto',
//   providers: ['GTM', 'Facebook', 'RudderStack'],
//   eventsTracked: 15,
//   debugMode: false
// }
```

### Disable Tracking Temporarily

Add `?ignore=true` to URL:

```
https://yoursite.com?ignore=true
```

This disables ALL tracking for the entire session.

To clear ignore flag:
```javascript
window.NextAnalyticsClearIgnore();
```

## Configuration Examples

### Minimal Configuration (GTM Only)

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  analytics: {
    enabled: true,
    mode: 'auto',
    providers: {
      gtm: { enabled: true }
    }
  }
};
```

### E-commerce with Facebook Ads

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  storeName: 'my-store',
  analytics: {
    enabled: true,
    mode: 'auto',
    providers: {
      gtm: { enabled: true },
      facebook: {
        enabled: true,
        settings: { pixelId: 'YOUR_PIXEL_ID' }
      }
    }
  }
};
```

### Development Configuration

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  analytics: {
    enabled: true,
    debug: true,  // Enable debug logging
    mode: 'auto',
    providers: {
      gtm: { enabled: false },  // Disable GTM in dev
      custom: {
        enabled: true,
        settings: {
          endpoint: 'http://localhost:3000/analytics',
          headers: { 'X-Dev-Mode': 'true' }
        }
      }
    }
  }
};
```

### Enterprise Multi-Platform Setup

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  storeName: 'enterprise-store',
  analytics: {
    enabled: true,
    mode: 'auto',
    providers: {
      gtm: {
        enabled: true,
        blockedEvents: ['internal_test', 'dev_event']
      },
      facebook: {
        enabled: true,
        settings: { pixelId: 'PROD_PIXEL_ID' }
      },
      rudderstack: { enabled: true },
      custom: {
        enabled: true,
        settings: {
          endpoint: 'https://api.yourapp.com/analytics',
          headers: {
            'Authorization': 'Bearer YOUR_PRODUCTION_TOKEN',
            'X-Environment': 'production',
            'X-Region': 'US-WEST'
          },
          batchSize: 20,
          batchIntervalMs: 3000,
          maxRetries: 5,
          transformFunction: (event) => {
            // Add custom metadata
            event.app_version = window.APP_VERSION;
            event.environment = 'production';
            event.region = 'us-west-1';

            // Filter sensitive data
            if (event.user_properties?.customer_phone) {
              delete event.user_properties.customer_phone;
            }

            return event;
          }
        }
      }
    }
  }
};
```

## Configuration Best Practices

### 1. Always Set storeName for Facebook

```javascript
{
  storeName: 'my-store',  // Required for purchase deduplication
  analytics: {
    providers: {
      facebook: { enabled: true, settings: { pixelId: 'xxx' } }
    }
  }
}
```

### 2. Use Auto Mode for Standard Implementations

```javascript
analytics: {
  mode: 'auto'  // Handles 90% of tracking automatically
}
```

### 3. Enable Debug in Development

```javascript
analytics: {
  debug: process.env.NODE_ENV === 'development'
}
```

### 4. Block Internal Events

```javascript
providers: {
  gtm: {
    enabled: true,
    blockedEvents: ['internal_test', 'dev_event', 'debug_event']
  }
}
```

### 5. Use Transform Functions for Custom Data

```javascript
custom: {
  settings: {
    transformFunction: (event) => {
      event.custom_field = getCustomData();
      return event;
    }
  }
}
```

## Related Documentation

- [Tracking API Reference](./tracking-api.md) - Complete API documentation
- [Providers Overview](./providers.md) - Provider-specific setup guides
- [Event Reference](./events.md) - Complete event schemas
- [Debugging Guide](./debugging.md) - Troubleshooting and testing
