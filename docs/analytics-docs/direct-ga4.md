# Direct GA4 Integration (No GTM)

Send events directly to Google Analytics 4 without using Google Tag Manager using an event transformer.

## Overview

This guide shows how to send Campaign Cart SDK events directly to Google Analytics 4 **without using Google Tag Manager** by using an event transformer script.

> **Tip:** This is a specific implementation of the general [Event Transformers](./event-transformers.md) pattern. You can use the same approach for TikTok, Snapchat, Pinterest, or any other platform.

## When to Use This

Use the GA4 Bridge when:
- You want to send events directly to GA4 without GTM
- You're already using GA4 and don't want to set up GTM
- You need simpler setup with fewer moving parts
- You want to avoid GTM's additional layer

> **Tip:** If you're using Google Tag Manager, you don't need this script - the SDK already pushes events to `window.dataLayer` that GTM can consume.

## Setup

### 1. Add Google Analytics 4

Add the GA4 tracking code to your page:

```html
<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Replace `G-XXXXXXXXXX` with your GA4 Measurement ID.

### 2. Add the Bridge Script

Add the NextDataLayer GA4 Bridge script **after** the Campaign Cart SDK:

```html
<!-- Campaign Cart SDK -->
<script src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.3.8/dist/loader.js" type="module"></script>

<!-- NextDataLayer GA4 Bridge -->
<script src="/path/to/NextDataLayer_GA4.js"></script>
```

### 3. Enable Analytics in SDK Config

```javascript
window.nextConfig = {
  apiKey: 'your-api-key',
  analytics: {
    enabled: true,
    mode: 'auto'
  }
};
```

That's it! Events will automatically flow from Campaign Cart SDK → NextDataLayer → GA4.

## How It Works

The bridge script:

1. **Waits for NextDataLayer** to be available
2. **Intercepts events** pushed to `window.NextDataLayer`
3. **Converts event names** from `dl_*` format to standard GA4 format
4. **Formats ecommerce data** according to GA4 specification
5. **Pushes to window.dataLayer** for GA4 to consume
6. **Prevents duplicates** using event deduplication
7. **Handles upsells** by converting them to purchase events

### Event Conversion Flow

```
Campaign Cart SDK Event
       ↓
NextDataLayer (dl_add_to_cart)
       ↓
GA4 Bridge Script (converts)
       ↓
window.dataLayer (add_to_cart)
       ↓
Google Analytics 4
```

## Event Mapping

The bridge automatically converts SDK events to GA4 standard events:

### E-commerce Events

| SDK Event | GA4 Event | Description |
|-----------|-----------|-------------|
| `dl_view_item` | `view_item` | Product viewed |
| `dl_view_item_list` | `view_item_list` | Product list viewed |
| `dl_add_to_cart` | `add_to_cart` | Item added to cart |
| `dl_remove_from_cart` | `remove_from_cart` | Item removed from cart |
| `dl_view_cart` | `view_cart` | Cart page viewed |
| `dl_begin_checkout` | `begin_checkout` | Checkout started |
| `dl_add_shipping_info` | `add_shipping_info` | Shipping info added |
| `dl_add_payment_info` | `add_payment_info` | Payment info added |
| `dl_purchase` | `purchase` | Order completed |

### Upsell Events

| SDK Event | GA4 Event | Special Handling |
|-----------|-----------|------------------|
| `dl_viewed_upsell` | `view_item` | Upsell viewed as product view |
| `dl_accepted_upsell` | `purchase` | **Upsell converted to purchase with same transaction_id** |

> **Caution:** Upsell events are converted to `purchase` events using the **same transaction_id** as the original purchase. This allows GA4 to track upsells as additional revenue on the same order.

### User Events

| SDK Event | GA4 Event |
|-----------|-----------|
| `dl_sign_up` | `sign_up` |
| `dl_login` | `login` |

## Features

### 1. Duplicate Prevention

The bridge tracks processed events and prevents duplicates:

```javascript
// Events are deduplicated using:
// - Event name
// - Sequence number
// - Item ID
// - Order ID
```

### 2. Upsell Tracking

Upsells are automatically converted to purchase events with the original transaction ID:

```javascript
// Original purchase
{
  event: 'purchase',
  transaction_id: 'ORD-12345',
  value: 99.99
}

// Upsell (automatically uses same transaction_id)
{
  event: 'purchase',
  transaction_id: 'ORD-12345',  // Same as original!
  value: 29.99,
  items: [{ item_category: 'Upsell', ... }]
}
```

This allows GA4 to track total order value including upsells.

### 3. Ecommerce Object Clearing

The bridge follows GA4 best practices by clearing the ecommerce object before each event:

```javascript
// Clear ecommerce first
window.dataLayer.push({ ecommerce: null });

// Then push new event
window.dataLayer.push({
  event: 'add_to_cart',
  ecommerce: { ... }
});
```

### 4. Memory Management

Automatically cleans up old data to prevent memory leaks:
- Keeps last 500 processed events
- Keeps last 50 transaction IDs
- Runs cleanup every 60 seconds

### 5. Debug Mode

Debug logging is automatically enabled on:
- `localhost`
- URLs with `?debug=true`

View logs in browser console:

```
[GA4 Bridge] Initializing dataLayer bridge
[GA4 Bridge] Converted dl_add_to_cart → add_to_cart
[GA4 Bridge] Upsell converted to purchase with transaction_id: ORD-12345
```

## Bridge API

The bridge exposes debugging utilities on `window.GA4Bridge`:

### Get Processed Event Count

```javascript
const count = window.GA4Bridge.getProcessedCount();
console.log(`Processed ${count} events`);
```

### View Event Mapping

```javascript
const mapping = window.GA4Bridge.getEventMap();
console.log(mapping);
// {
//   'dl_add_to_cart': 'add_to_cart',
//   'dl_purchase': 'purchase',
//   ...
// }
```

### View Transaction Map

```javascript
const transactions = window.GA4Bridge.getTransactionMap();
console.log(transactions);
// {
//   '123': { transaction_id: 'ORD-12345', order_number: '12345' },
//   ...
// }
```

### Check Bridge Status

```javascript
const isActive = window.GA4Bridge.isActive();
console.log(`Bridge active: ${isActive}`);
```

## Example Event Flow

### Cart Event

SDK fires:
```javascript
window.NextDataLayer.push({
  event: 'dl_add_to_cart',
  event_id: '1234567890_abc123',
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
```

Bridge converts to:
```javascript
window.dataLayer.push({ ecommerce: null }); // Clear first
window.dataLayer.push({
  event: 'add_to_cart',
  event_id: '1234567890_abc123',
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
```

### Purchase Event

SDK fires:
```javascript
window.NextDataLayer.push({
  event: 'dl_purchase',
  ecommerce: {
    transaction_id: 'ORD-12345',
    order_number: '12345',
    value: 159.99,
    currency: 'USD',
    tax: 9.99,
    shipping: 10.00,
    items: [...]
  }
});
```

Bridge stores transaction ID and converts to:
```javascript
window.dataLayer.push({ ecommerce: null });
window.dataLayer.push({
  event: 'purchase',
  ecommerce: {
    transaction_id: 'ORD-12345',
    order_number: '12345',
    value: 159.99,
    currency: 'USD',
    tax: 9.99,
    shipping: 10.00,
    items: [...]
  }
});
```

### Upsell Event

SDK fires:
```javascript
window.NextDataLayer.push({
  event: 'dl_accepted_upsell',
  order_id: '123',
  upsell: {
    package_id: 'warranty-extended',
    package_name: 'Extended Warranty',
    price: 29.99,
    quantity: 1
  }
});
```

Bridge converts to:
```javascript
window.dataLayer.push({ ecommerce: null });
window.dataLayer.push({
  event: 'purchase',  // Converted to purchase!
  ecommerce: {
    transaction_id: 'ORD-12345',  // Same as original purchase
    order_number: '12345',
    value: 29.99,
    currency: 'USD',
    items: [{
      item_id: 'warranty-extended',
      item_name: 'Extended Warranty',
      price: 29.99,
      quantity: 1,
      item_category: 'Upsell'
    }]
  }
});
```

## Troubleshooting

### Events Not Appearing in GA4

1. **Check GA4 is loaded**
   ```javascript
   console.log(typeof gtag); // Should be 'function'
   ```

2. **Check bridge is active**
   ```javascript
   console.log(window.GA4Bridge.isActive()); // Should be true
   ```

3. **Check events are being converted**
   - Open browser console
   - Add `?debug=true` to URL
   - Look for `[GA4 Bridge]` log messages

4. **Verify NextDataLayer exists**
   ```javascript
   console.log(window.NextDataLayer); // Should be an array
   ```

### Duplicate Events

The bridge automatically prevents duplicates, but if you see duplicates:

1. Make sure you're only loading the bridge script once
2. Check that you're not also pushing events to `window.dataLayer` manually
3. Verify the bridge is loaded after the SDK

### Upsells Not Tracking

If upsells aren't showing up as purchases:

1. **Check transaction map**
   ```javascript
   console.log(window.GA4Bridge.getTransactionMap());
   ```

2. **Verify purchase event fired first**
   - The initial purchase must fire before upsells
   - Transaction ID is stored from the purchase event

3. **Check order_id is present**
   - Upsell events need `order_id` to look up transaction_id

### Missing Transaction IDs

If upsells show `undefined` transaction_id:

- The initial `dl_purchase` event must include `ecommerce.transaction_id`
- The upsell event must include `order_id` matching the purchase
- Check the transaction map: `window.GA4Bridge.getTransactionMap()`

## Performance

The bridge is lightweight and efficient:
- **~5KB** minified
- Processes events in **<1ms**
- Memory-safe with automatic cleanup
- No external dependencies

## Comparison: Bridge vs GTM

| Feature | GA4 Bridge | Google Tag Manager |
|---------|------------|-------------------|
| Setup complexity | Simple (1 script) | Complex (container setup) |
| Event conversion | Automatic | Manual triggers/tags |
| Upsell handling | Built-in | Manual configuration |
| Deduplication | Automatic | Must configure |
| Additional tracking | Limited | Unlimited |
| Tag management | None | Full tag management |
| Best for | Direct GA4 | Multiple platforms |

## When NOT to Use This

Don't use the GA4 Bridge if:
- You're already using GTM successfully
- You need to send data to multiple platforms (Facebook, TikTok, etc.)
- You need complex tag management and triggering
- You want to manage tags without code deployments

In these cases, use Google Tag Manager instead. See [Google Tag Manager Setup](./google-tag-manager.md).

## Build Your Own Transformer

Want to adapt this pattern for other platforms (TikTok, Snapchat, Pinterest)?

See **[Event Transformers](./event-transformers.md)** for:
- Generic transformer template
- Examples for TikTok, Snapchat, Pinterest
- Multi-platform routing
- Best practices and patterns

## Related Documentation

- **[Event Transformers](./event-transformers.md)** - General pattern for any platform
- [Google Tag Manager Setup](./google-tag-manager.md) - Alternative using GTM
- [Analytics Overview](./index.md) - Main analytics documentation
- [Event Reference](./events.md) - All available events
- [Configuration](./configuration.md) - SDK configuration options
