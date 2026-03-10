# Custom Webhook Integration

Send analytics events to your own backend with batching, retry logic, and custom transformations.

Send events to your own backend or third-party APIs with control over data transformation, batching, and delivery.

## Configuration

Configure the custom webhook provider with your endpoint and optional settings:

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
      batchSize: 10,           // Events per batch
      batchIntervalMs: 5000,   // Max time before sending

      // Retry configuration
      maxRetries: 3,
      retryDelayMs: 1000,      // Exponential backoff: 1s, 2s, 4s

      // Transform events before sending
      transformFunction: (event) => {
        return {
          ...event,
          app_version: '1.0.0',
          environment: 'production',
          timestamp: new Date().toISOString()
        };
      }
    }
  }
}
```

### Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `endpoint` | string | Yes | - | The URL of your backend endpoint that receives analytics events |
| `headers` | object | No | `{}` | Custom HTTP headers to include in each request (e.g., auth tokens) |
| `batchSize` | number | No | 10 | Number of events to accumulate before sending a batch |
| `batchIntervalMs` | number | No | 5000 | Maximum milliseconds to wait before sending a batch, regardless of size |
| `maxRetries` | number | No | 3 | Number of times to retry failed requests |
| `retryDelayMs` | number | No | 1000 | Initial delay in milliseconds for retry attempts (exponential backoff) |
| `transformFunction` | function | No | - | Function to transform each event before sending (receives event, returns modified event) |

## Request Format

Events are sent as POST requests in batches to your endpoint:

```
POST https://api.yourapp.com/analytics
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "events": [
    {
      "event": "dl_add_to_cart",
      "event_id": "sess_123_1_1234567890",
      "event_time": "2025-01-12T10:30:00Z",
      "ecommerce": {
        "items": [
          {
            "item_id": "SKU123",
            "item_name": "Product Name",
            "price": 29.99,
            "quantity": 1
          }
        ],
        "value": 29.99,
        "currency": "USD"
      },
      "user_properties": {
        "user_id": "user_123",
        "session_id": "sess_123",
        "country": "US"
      },
      "attribution": {
        "source": "google",
        "medium": "cpc",
        "campaign": "summer_sale"
      }
    },
    {
      "event": "dl_view_item",
      "event_id": "sess_123_2_1234567891",
      "event_time": "2025-01-12T10:30:02Z",
      ...
    }
  ],
  "batch_info": {
    "size": 2,
    "timestamp": "2025-01-12T10:30:05Z",
    "source": "next-campaign-cart"
  }
}
```

### Request Body Fields

| Field | Type | Description |
|-------|------|-------------|
| `events` | array | Array of event objects (max 100 per batch) |
| `batch_info.size` | number | Number of events in this batch |
| `batch_info.timestamp` | string | ISO 8601 timestamp when batch was sent |
| `batch_info.source` | string | Always "next-campaign-cart" |

## Response Expected

Your endpoint should return appropriate HTTP status codes:

- **`200 OK`** - Events processed successfully
- **`201 Created`** - Events created successfully
- **`202 Accepted`** - Events accepted for processing (recommended)
- **`4xx`** - Client error (SDK will retry based on specific status)
- **`5xx`** - Server error (SDK will retry with exponential backoff)

### Response Body (Optional)

While not required, you can return a response body:

```json
{
  "success": true,
  "message": "Analytics events received",
  "batch_id": "batch_abc123xyz",
  "events_processed": 2
}
```

## Batching Behavior

Events are batched to reduce network requests and server load. Batches are sent when:

1. **Size Threshold**: `batchSize` events have been queued
2. **Time Threshold**: `batchIntervalMs` milliseconds have elapsed since the first event in the batch
3. **Page Unload**: Immediately before navigation or window close to ensure data is not lost
4. **Manual Flush**: When explicitly requested through the SDK API (if available)

### Example Batching Timeline

With `batchSize: 10` and `batchIntervalMs: 5000`:

```
Time    Event              Batch Status
0ms     Event 1 arrives    Queue: [1] → Start 5s timer
100ms   Event 2 arrives    Queue: [1, 2]
500ms   Event 3 arrives    Queue: [1, 2, 3]
1000ms  Event 4 arrives    Queue: [1, 2, 3, 4]
1500ms  Event 5 arrives    Queue: [1, 2, 3, 4, 5]
2000ms  Event 6 arrives    Queue: [1, 2, 3, 4, 5, 6]
2500ms  Event 7 arrives    Queue: [1, 2, 3, 4, 5, 6, 7]
3000ms  Event 8 arrives    Queue: [1, 2, 3, 4, 5, 6, 7, 8]
3500ms  Event 9 arrives    Queue: [1, 2, 3, 4, 5, 6, 7, 8, 9]
4000ms  Event 10 arrives   Queue: [1-10] → SEND BATCH (size threshold met)
4050ms  Event 11 arrives   Queue: [11] → Start new 5s timer
5000ms  (5s elapsed)       Queue: [11-15] → SEND BATCH (time threshold met)
```

## Retry Logic

Failed requests retry with exponential backoff to prevent overwhelming your server during temporary outages.

### Retry Schedule

- **Attempt 1**: Immediate, no delay
- **Attempt 2**: Wait `retryDelayMs` (default: 1s)
- **Attempt 3**: Wait `retryDelayMs * 2` (default: 2s)
- **Attempt 4**: Wait `retryDelayMs * 4` (default: 4s)

After `maxRetries` attempts, events are dropped and logged.

### Example with Default Settings

```
Time    Event                Status
0ms     Send batch          Fails (500 error)
0ms     Schedule retry 1
1000ms  Retry attempt 1     Fails (500 error)
1000ms  Schedule retry 2
3000ms  Retry attempt 2     Fails (503 timeout)
3000ms  Schedule retry 3
7000ms  Retry attempt 3     Succeeds (200 OK)
        Batch sent!
```

### Retry Configuration Examples

**Aggressive Retries** (for critical analytics):
```javascript
maxRetries: 5,
retryDelayMs: 500,  // 0.5s, 1s, 2s, 4s, 8s = 15.5s total
```

**Conservative Retries** (for high-volume events):
```javascript
maxRetries: 2,
retryDelayMs: 2000,  // 2s, 4s = 6s total
```

**No Retries** (if endpoint is highly available):
```javascript
maxRetries: 0,  // Send once, drop on failure
```

## Transform Function

The `transformFunction` option allows you to modify, filter, or enrich events before they're sent to your backend. This function is called once for each event.

### Basic Transform Function

```javascript
transformFunction: (event) => {
  // Add custom fields
  event.app_version = '1.0.0';
  event.environment = 'production';
  event.server_timestamp = Date.now();

  // Filter sensitive data
  if (event.user_properties) {
    delete event.user_properties.customer_phone;
  }

  // Add business context
  if (event.event === 'dl_purchase') {
    event.custom_order_type = 'online';
    event.fulfillment_center = 'US-WEST';
  }

  return event;
}
```

### Advanced Transform Examples

#### Conditional Field Addition

```javascript
transformFunction: (event) => {
  // Add fields only for specific events
  if (event.event === 'dl_purchase') {
    event.revenue_category = event.ecommerce?.value > 100 ? 'high' : 'normal';
  }

  // Add user tier information
  if (event.user_properties?.user_id) {
    event.user_tier = calculateUserTier(event.user_properties.user_id);
  }

  return event;
}
```

#### Data Validation and Sanitization

```javascript
transformFunction: (event) => {
  // Ensure required fields
  if (!event.event_time) {
    event.event_time = new Date().toISOString();
  }

  // Sanitize strings
  if (event.user_properties?.session_id) {
    event.user_properties.session_id =
      event.user_properties.session_id.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  // Convert currencies
  if (event.ecommerce?.currency === 'EUR') {
    event.ecommerce.value_usd = event.ecommerce.value * 0.92;
  }

  return event;
}
```

#### PII Redaction

```javascript
transformFunction: (event) => {
  const sensitiveFields = ['email', 'phone', 'ssn', 'credit_card'];

  if (event.user_properties) {
    sensitiveFields.forEach(field => {
      if (event.user_properties[field]) {
        delete event.user_properties[field];
      }
    });
  }

  return event;
}
```

#### Event Sampling

```javascript
transformFunction: (event) => {
  // Sample non-purchase events at 10% to reduce volume
  if (event.event !== 'dl_purchase') {
    if (Math.random() > 0.1) {
      return null; // Drop this event
    }
  }

  return event;
}
```

#### Regional Routing

```javascript
transformFunction: (event) => {
  const region = getUserRegion();
  event.endpoint_region = region;

  // Set processing priority
  event.processing_priority = event.event === 'dl_purchase' ? 'high' : 'normal';

  // Add regional context
  event.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return event;
}
```

## Use Cases

### Data Warehouse Integration

Forward events to your data warehouse for long-term analysis and reporting:

```javascript
endpoint: 'https://api.yourdata.com/ingest/analytics',
headers: {
  'Authorization': 'Bearer warehouse-token',
  'X-Dataset-ID': 'campaign-cart-events'
},
batchSize: 50,  // Larger batches for warehouse efficiency
batchIntervalMs: 10000,
transformFunction: (event) => {
  return {
    ...event,
    warehouse_partition: new Date().toISOString().split('T')[0],
    ingestion_source: 'campaign-cart'
  };
}
```

**Supported**: Snowflake, BigQuery, Redshift, Databricks, etc.

### Custom Analytics Platform

Send events to your own analytics infrastructure:

```javascript
endpoint: 'https://analytics.yourcompany.com/api/v1/events',
headers: {
  'Authorization': 'Bearer api-key',
  'X-App-ID': 'campaign-cart'
},
maxRetries: 3,
transformFunction: (event) => {
  return {
    ...event,
    event_version: '2.0',
    company_id: 'comp_123',
    received_at: new Date().toISOString()
  };
}
```

### Marketing Automation

Trigger marketing workflows based on analytics events:

```javascript
endpoint: 'https://api.marketing-platform.com/webhooks/events',
headers: {
  'Authorization': 'Bearer webhook-key',
  'X-Integration-ID': 'cart-system'
},
batchSize: 1,  // Send events immediately
batchIntervalMs: 100,
transformFunction: (event) => {
  // Only send customer conversion events
  if (!['dl_purchase', 'dl_view_item'].includes(event.event)) {
    return null;
  }

  return {
    ...event,
    trigger_type: event.event === 'dl_purchase' ? 'purchase' : 'view',
    automation_enabled: true
  };
}
```

**Platforms**: HubSpot, Klaviyo, Braze, Marketo, etc.

### Real-time Processing

Process events in real-time systems for immediate action:

```javascript
endpoint: 'https://streaming.yourcompany.com/events',
headers: {
  'Authorization': 'Bearer stream-key'
},
batchSize: 5,
batchIntervalMs: 1000,
transformFunction: (event) => {
  return {
    ...event,
    processing_timestamp: Date.now(),
    priority: ['dl_purchase', 'dl_error'].includes(event.event) ? 'high' : 'normal'
  };
}
```

**Platforms**: Kafka, RabbitMQ, Apache Pulsar, AWS Kinesis, etc.

## Troubleshooting

### Events Not Being Sent

**Problem**: Analytics events are not reaching your endpoint.

**Solutions**:
1. **Check endpoint URL**: Ensure the `endpoint` is correct and accessible
   ```javascript
   // Test in browser console
   fetch('https://api.yourapp.com/analytics', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ test: true })
   })
   ```

2. **Verify CORS headers**: Ensure your endpoint allows requests from your domain
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Methods: POST, OPTIONS
   Access-Control-Allow-Headers: Content-Type, Authorization
   ```

3. **Check browser console**: Look for network errors (404, 403, CORS errors)
   - Open DevTools → Network tab → Filter for your endpoint
   - Check Request/Response headers and body

4. **Verify configuration**: Ensure custom provider is enabled
   ```javascript
   providers: {
     custom: {
       enabled: true,  // Must be true
       settings: { ... }
     }
   }
   ```

### 401 Unauthorized Errors

**Problem**: Requests are rejected with 401 status.

**Solutions**:
1. **Check authorization header**:
   ```javascript
   headers: {
     'Authorization': 'Bearer YOUR_VALID_TOKEN'  // Use actual token
   }
   ```

2. **Verify token expiration**: Ensure tokens are refreshed periodically
   ```javascript
   headers: {
     'Authorization': `Bearer ${getValidToken()}`
   }
   ```

3. **Test endpoint authentication**:
   ```bash
   curl -X POST https://api.yourapp.com/analytics \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"events": [], "batch_info": {}}'
   ```

### Transform Function Issues

**Problem**: Events are being modified incorrectly or transform function has errors.

**Solutions**:
1. **Add error handling**:
   ```javascript
   transformFunction: (event) => {
     try {
       // Your transform logic
       return {
         ...event,
         custom_field: calculateValue(event)
       };
     } catch (error) {
       console.error('Transform error:', error);
       return event; // Return original if transform fails
     }
   }
   ```

2. **Validate return value**: Always return an event object or null
   ```javascript
   transformFunction: (event) => {
     // WRONG: return undefined
     // CORRECT: return event or null

     if (shouldDropEvent(event)) {
       return null;
     }

     return modifiedEvent;
   }
   ```

3. **Test transform function independently**:
   ```javascript
   const testEvent = { event: 'dl_view_item', ... };
   const result = transformFunction(testEvent);
   console.log('Transform result:', result);
   ```

### Duplicate Events at Endpoint

**Problem**: Events appear to be received multiple times.

**Solutions**:
1. **Implement idempotency**:
   - Use `event_id` field (already unique per event)
   - Store processed event IDs to detect duplicates
   ```javascript
   // In your backend
   const processedEventIds = new Set();

   if (processedEventIds.has(event.event_id)) {
     return { success: true }; // Already processed
   }

   processedEventIds.add(event.event_id);
   // Process event...
   ```

2. **Check batch_info**: Events in same batch have unique IDs

## Best Practices

1. **Always return a 2xx status** from your endpoint when events are received
2. **Make endpoints idempotent** using event IDs to handle retries safely
3. **Log all received events** for debugging and auditing
4. **Monitor endpoint performance** to catch issues early
5. **Use appropriate batch sizes** based on your network and server capacity
6. **Implement rate limiting** on your endpoint to prevent abuse
7. **Validate incoming data** to ensure it matches your schema
8. **Archive analytics data** for historical analysis
9. **Alert on errors** (via email, Slack, etc.) for critical endpoints
10. **Version your endpoint** (e.g., `/api/v1/analytics`) for backward compatibility
