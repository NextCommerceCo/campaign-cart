# Google Tag Manager Setup

Complete guide to integrating Google Tag Manager with Campaign Cart SDK analytics.

## Overview

Google Tag Manager (GTM) is a tag management system that manages marketing tags without modifying code directly. Campaign Cart SDK integrates with GTM by pushing analytics events to the standard data layer.

## Setup

### 1. Add GTM Container

Add the GTM container snippet to your page **before** the Campaign Cart SDK:

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-XXXXXX');</script>
<!-- End Google Tag Manager -->
```

Replace `GTM-XXXXXX` with your actual GTM container ID.

### 2. Enable GTM in SDK Config

```javascript
analytics: {
  providers: {
    gtm: {
      enabled: true,
      blockedEvents: ['dl_test_event']  // Optional
    }
  }
}
```

### 3. Create GTM Triggers

In Google Tag Manager:
- Trigger Type: **Custom Event**
- Event Name: `dl_*` (matches all events) or specific events like `dl_add_to_cart`

## Where Events Are Pushed

Events are automatically pushed to **two data layers**:

1. **window.dataLayer** - Standard GTM data layer
2. **window.ElevarDataLayer** - Elevar-compatible format

This dual-layer approach provides compatibility with both standard GTM implementations and ecommerce tracking platforms.

## Event Format

All events follow this standardized format in the data layer:

```javascript
{
  event: 'dl_add_to_cart',
  ecommerce: {
    currency: 'USD',
    value: 99.99,
    items: [...]
  },
  user_properties: {
    visitor_type: 'guest',
    customer_email: 'user@example.com'
  },
  // Attribution fields at root level for easy GTM access
  utm_source: 'google',
  utm_medium: 'cpc',
  funnel: 'main',
  affiliate: 'partner-123'
}
```

### Common Events

The SDK pushes the following event types:

- `dl_view_item` - User views a product
- `dl_add_to_cart` - Item added to shopping cart
- `dl_remove_from_cart` - Item removed from cart
- `dl_view_cart` - User views the cart
- `dl_begin_checkout` - Checkout process initiated
- `dl_add_shipping_info` - Shipping information provided
- `dl_add_payment_info` - Payment information provided
- `dl_purchase` - Order completed

## GTM Variables

Create these variables in GTM for easy access to event data:

| Variable Name | Type | Value |
|--------------|------|-------|
| DL - Event | Data Layer Variable | `event` |
| DL - Ecommerce | Data Layer Variable | `ecommerce` |
| DL - User Properties | Data Layer Variable | `user_properties` |
| DL - UTM Source | Data Layer Variable | `utm_source` |
| DL - UTM Medium | Data Layer Variable | `utm_medium` |
| DL - Funnel | Data Layer Variable | `funnel` |
| DL - Currency | Data Layer Variable | `ecommerce.currency` |
| DL - Value | Data Layer Variable | `ecommerce.value` |
| DL - Items | Data Layer Variable | `ecommerce.items` |

### Creating Variables in GTM

1. Open your GTM container
2. Navigate to **Variables** → **User-Defined Variables**
3. Click **New** for each variable
4. Select **Data Layer Variable** as the type
5. Enter the variable name and path
6. Save and publish your changes

## GA4 Tag Setup

To send Campaign Cart analytics events to Google Analytics 4:

1. Create GA4 Event Tag
2. Event Name: `{{DL - Event}}`
3. Event Parameters:
   - `currency`: `{{ecommerce.currency}}`
   - `value`: `{{ecommerce.value}}`
   - `items`: `{{ecommerce.items}}`
4. Trigger: Custom Event `dl_*`

### Complete GA4 Configuration Example

```
Tag Type: Google Analytics: GA4 Event
Measurement ID: G-XXXXXXXXXX
Event Name: {{DL - Event}}
Event Parameters:
  - currency: {{ecommerce.currency}}
  - value: {{ecommerce.value}}
  - items: {{ecommerce.items}}
  - user_id: {{user_properties.user_id}}
Trigger: Custom Event matching dl_*
```

## Blocked Events

Block specific events from being sent to GTM to reduce noise and focus on important conversions:

```javascript
gtm: {
  enabled: true,
  blockedEvents: [
    'dl_test_event',
    'internal_debug',
    'dev_event'
  ]
}
```

### Why Block Events?

- Prevent low-priority events from cluttering your GTM logs
- Reduce GTM traffic (GTM charges based on page views)
- Focus on events that matter for your business
- Block test or debug events from production

## Troubleshooting

### Events Not Appearing in GTM

**Problem**: You've configured GTM but aren't seeing events in the preview/debug mode.

**Solutions**:
1. Verify the GTM container snippet is loaded **before** the Campaign Cart SDK
2. Check that `analytics.providers.gtm.enabled` is set to `true`
3. Verify the GTM container ID is correct (GTM-XXXXXX)
4. Open GTM Preview mode and reload the page to see real-time events
5. Check browser console for any JavaScript errors

### Events Not Triggering GA4 Tags

**Problem**: Events appear in GTM but aren't reaching Google Analytics 4.

**Solutions**:
1. Verify your GA4 Event Tag is created and enabled
2. Check the trigger configuration - ensure it matches `dl_*` or the specific event name
3. Verify the Measurement ID in your GA4 tag is correct
4. Check GA4 real-time report to confirm events are arriving
5. Ensure Event Parameters are correctly mapped to data layer variables

### Incorrect Event Data

**Problem**: Events are reaching GTM but with missing or incorrect data.

**Solutions**:
1. Verify data layer variables point to the correct data layer paths
2. Use GTM's Preview mode to inspect the raw event payload
3. Check the `ecommerce` object structure matches GA4 requirements
4. Verify `user_properties` are being populated correctly
5. Ensure custom dimensions are correctly named and configured

### Performance Issues

**Problem**: Site performance degrades after implementing GTM.

**Solutions**:
1. Load the GTM container asynchronously (it should load async by default)
2. Review the number of tags firing on each page
3. Consider delaying non-critical tag execution
4. Use GTM's tag sequencing to optimize load order
5. Monitor tag firing frequency and optimize trigger conditions

## Best Practices

### 1. Use Consistent Event Names

Keep event names consistent:

```javascript
// Good
'dl_add_to_cart'
'dl_purchase'
'dl_begin_checkout'

// Avoid
'dl_event1'
'dl_tracking'
'dl_data'
```

### 2. Structure Data Consistently

The ecommerce object should follow the GA4 schema:

```javascript
ecommerce: {
  currency: 'USD',
  value: 99.99,
  items: [
    {
      item_id: 'SKU123',
      item_name: 'Product Name',
      price: 99.99,
      quantity: 1
    }
  ]
}
```

### 3. Test Before Deploying

1. Use GTM's Preview mode during development
2. Test each event type on staging
3. Verify data flows to GA4 before production
4. Monitor real-time reports after deploying

### 4. Document Your Implementation

Maintain documentation of:
- Which events you're tracking
- What GTM variables you created
- Which tags use which triggers
- Any custom event modifications

### 5. Monitor and Iterate

- Regularly review GTM reports for data quality
- Check GA4 for anomalies or missing events
- Adjust blockedEvents list based on actual needs
- Update documentation as your implementation evolves

### 6. Use Version Control for GTM

- Export your GTM container configuration
- Store it in your project repository
- Document significant changes
- Maintain a changelog of GTM updates

### 7. Use Attribution Tracking

Use the root-level attribution fields:

```javascript
{
  event: 'dl_purchase',
  utm_source: 'google',
  utm_medium: 'cpc',
  utm_campaign: 'summer_sale',
  funnel: 'main',
  affiliate: 'partner-123'
}
```

Create GTM variables for each attribution field to enable advanced segmentation and attribution analysis.

### 8. Handle Blocked Events Wisely

Only block events that:
- Are used for internal testing
- Generate excessive noise
- Aren't needed for business analysis
- Can be filtered elsewhere

Document which events are blocked and why.

## Migration Guide

If migrating from another analytics setup to GTM with Campaign Cart SDK:

1. **Inventory existing events** - Document all events you're currently tracking
2. **Map to Campaign Cart events** - Match existing events to SDK event types
3. **Set up GTM container** - Follow the Setup section above
4. **Test in parallel** - Run both old and new tracking simultaneously
5. **Validate data quality** - Compare reports between old and new setup
6. **Monitor initial period** - Watch for discrepancies in first 2-4 weeks
7. **Phase out old tracking** - Gradually disable legacy tracking when confident

## Additional Resources

- [Google Tag Manager Documentation](https://support.google.com/tagmanager)
- [GA4 Event Schema](https://support.google.com/analytics/answer/11137820)
- [Analytics Overview](./index.md)
- [Event Reference](./events.md)
