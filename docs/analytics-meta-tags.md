# Analytics Meta Tags Guide

Control analytics events declaratively through HTML meta tags - no JavaScript required.

---

## Quick Reference

| Meta Tag | Purpose |
|----------|---------|
| `next-analytics-view-item` | Fire `dl_view_item` for a package (replaces auto-detection) |
| `next-analytics-view-item-list` | Fire `dl_view_item_list` for packages (replaces auto-detection) |
| `next-analytics-list-id` | Set page-level list ID for all events |
| `next-analytics-list-name` | Set page-level list name for all events |
| `next-analytics-scroll-tracking` | Track scroll depth at specified thresholds |
| `next-analytics-disable` | Block specific events globally (all providers) |
| `next-analytics-enable-only` | Whitelist mode - only fire these events |

---

## `dl_view_item` Examples

### Basic - Fire immediately on page load
```html
<meta name="next-analytics-view-item" content="123">
```
Replace `123` with an actual package `ref_id` from your campaign.

### With Time Delay (engagement signal)
```html
<meta name="next-analytics-view-item" content="123" trigger="time:3000">
```
The event fires 3 seconds (3000ms) after the page loads.

### With Scroll Trigger
```html
<meta name="next-analytics-view-item" content="123" trigger="view:#product-details">
```
The event fires when the element `#product-details` scrolls into view (50% visible).

### From URL Parameter
```html
<meta name="next-analytics-view-item" content="url:pid">
```
Reads the package ID from the URL query string: `?pid=123`

**Trigger Format**: `type:value`
- `time:3000` = wait 3000ms (3 seconds) after page load
- `view:#selector` = fire when CSS selector scrolls into view (50% threshold)

---

## `dl_view_item_list` Examples

### Multiple packages (comma-separated)
```html
<meta name="next-analytics-view-item-list" content="123,456,789">
```
Fires `dl_view_item_list` with all specified packages.

### From URL Parameter
```html
<meta name="next-analytics-view-item-list" content="url:products">
```
Reads comma-separated IDs from URL: `?products=123,456,789`

---

## List Context (Attribution)

Set page-level list context that will be included in all add-to-cart events:

```html
<meta name="next-analytics-list-id" content="pdp">
<meta name="next-analytics-list-name" content="Product Detail Page">
```

This ensures proper attribution tracking when users add items to cart.

---

## Scroll Depth Tracking

Track when users scroll to specific percentages of the page:

```html
<meta name="next-analytics-scroll-tracking" content="25,50,75,90">
```

Fires `dl_scroll_depth` events at 25%, 50%, 75%, and 90% scroll depth. Each threshold fires only once.

---

## Event Blocking

### Disable Specific Events (Global Block)
```html
<meta name="next-analytics-disable" content="dl_view_item,dl_view_item_list">
```
Blocks these events from firing for ALL providers.

### Whitelist Mode (Only Allow These Events)
```html
<meta name="next-analytics-enable-only" content="dl_add_to_cart,dl_purchase">
```
Only these events will fire - everything else is blocked globally.

---

## Complete Examples

### Product Detail Page
```html
<head>
  <!-- Fire view_item for package 123 after 3 seconds of viewing -->
  <meta name="next-analytics-view-item" content="123" trigger="time:3000">

  <!-- Set list context for add-to-cart attribution -->
  <meta name="next-analytics-list-id" content="pdp">
  <meta name="next-analytics-list-name" content="Product Detail Page">

  <!-- Track scroll engagement -->
  <meta name="next-analytics-scroll-tracking" content="25,50,75,90">
</head>
```

### Landing Page with URL Parameters
```html
<head>
  <!-- Read product IDs from URL: ?products=100,101,102 -->
  <meta name="next-analytics-view-item-list" content="url:products">

  <!-- Set list context -->
  <meta name="next-analytics-list-id" content="landing">
  <meta name="next-analytics-list-name" content="Landing Page">
</head>
```

### Upsell Page (Block Unwanted Events)
```html
<head>
  <!-- Disable auto-tracking of certain events on upsell page -->
  <meta name="next-analytics-disable" content="dl_remove_from_cart,dl_view_item_list">

  <!-- Set upsell list context -->
  <meta name="next-analytics-list-id" content="upsell-1">
  <meta name="next-analytics-list-name" content="Post-Purchase Upsell">
</head>
```

---

## How It Works

### Priority: Meta Tags Override Auto-Detection

When a meta tag like `<meta name="next-analytics-view-item" content="123">` is present:
- It **REPLACES** auto-detected `dl_view_item` entirely
- **No need to manually block it first** in the config
- The meta tag always takes priority over auto-detection

### Event Control Hierarchy

```
┌─────────────────────────────────────────────────────────────────────┐
│  LEVEL 1: Provider-Specific blockedEvents (Most Granular)          │
│  Blocks event for THAT PROVIDER ONLY                               │
│  gtm: { blockedEvents: ['dl_view_item_list'] } → GTM won't get it  │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LEVEL 2: Meta Tag disable/enable-only (Global Block)              │
│  Blocks event for ALL PROVIDERS                                    │
│  <meta name="next-analytics-disable" content="dl_view_item">       │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LEVEL 3: Meta Tag view-item/view-item-list (Auto-Event Override)  │
│  REPLACES auto-detection entirely (not additive)                   │
│  <meta name="next-analytics-view-item-list" content="1,2,3">       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Debugging

After the page loads, you can check the status in the browser console:

```javascript
// Check MetaTagController status
NextMetaTagController.getStatus()

// Check if events were fired
NextMetaTagController.wasViewItemFired()
NextMetaTagController.wasViewItemListFired()

// Check the parsed config
NextMetaTagController.getStatus().config

// Check disabled events
NextMetaTagController.getStatus().config.disabledEvents

// Check list context
NextMetaTagController.getListContext()
```

---

## Events Reference

| Event Name | Description |
|------------|-------------|
| `dl_view_item` | Single product view |
| `dl_view_item_list` | Multiple products viewed (list/collection) |
| `dl_add_to_cart` | Item added to cart |
| `dl_remove_from_cart` | Item removed from cart |
| `dl_begin_checkout` | Checkout started |
| `dl_purchase` | Order completed |
| `dl_scroll_depth` | User scrolled to threshold |

---

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

No polyfills required - uses standard DOM APIs.
