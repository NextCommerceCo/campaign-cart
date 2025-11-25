# Analytics Enhancement Proposal - Simplified

**Date**: 2025-11-19
**Updated**: 2025-11-25
**Status**: Proposal - Simplified Version
**Version**: 3.0

---

## Executive Summary

This proposal outlines a **minimal, practical enhancement** to the Campaign Cart analytics system. The goal is to enable simple, declarative control over analytics events through HTML attributes and meta tags - without writing JavaScript.

### Core Philosophy

**Build on existing patterns, not new ones.**

The codebase already has:
- Strong `data-next-*` attribute patterns
- Meta tag configuration loading
- Transform function system
- Package data lookup from campaign store

We'll extend these patterns rather than create entirely new systems.

---

## Event Control Hierarchy (IMPORTANT)

Understanding the priority of different blocking/control mechanisms is critical:

```
┌─────────────────────────────────────────────────────────────────────┐
│  LEVEL 1: Provider-Specific blockedEvents (Most Granular)          │
│  ─────────────────────────────────────────────────────────────────  │
│  Blocks event for THAT PROVIDER ONLY                               │
│                                                                     │
│  gtm: { blockedEvents: ['dl_view_item_list'] }   → GTM won't get it│
│  facebook: { blockedEvents: ['dl_view_item'] }   → FB won't get it │
│                                                                     │
│  Other providers still receive the event normally.                 │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LEVEL 2: Meta Tag disable/enable-only (Global Block)              │
│  ─────────────────────────────────────────────────────────────────  │
│  Blocks event for ALL PROVIDERS                                    │
│                                                                     │
│  <meta name="next-analytics-disable" content="dl_view_item">       │
│  → Event won't fire AT ALL (no provider receives it)               │
│                                                                     │
│  <meta name="next-analytics-enable-only" content="dl_purchase">    │
│  → ONLY dl_purchase fires, everything else blocked globally        │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│  LEVEL 3: Meta Tag view-item/view-item-list (Auto-Event Override)  │
│  ─────────────────────────────────────────────────────────────────  │
│  REPLACES auto-detection entirely (not additive)                   │
│                                                                     │
│  <meta name="next-analytics-view-item-list" content="1,2,3">       │
│  → Auto-detected dl_view_item_list is REPLACED                     │
│  → No need to block first - meta tag takes priority                │
│                                                                     │
│  This is simpler for content creators!                             │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Decision: Meta Tags Override Auto-Events

If a meta tag like `<meta name="next-analytics-view-item-list" content="1,2,3">` is present:
- It **REPLACES** the auto-detected `dl_view_item_list` entirely
- **No need to manually block it first** in the config
- The meta tag always takes priority over auto-detection

This makes it simpler for content creators who don't have access to JS config.

### Provider blockedEvents vs Meta Tag Blocking

| Method | Scope | Use Case |
|--------|-------|----------|
| `blockedEvents` in GTM config | GTM only | "Send to FB but not GTM" |
| `blockedEvents` in FB config | FB only | "Send to GTM but not FB" |
| `<meta name="next-analytics-disable">` | ALL providers | "Don't fire this event at all" |
| `<meta name="next-analytics-view-item-list">` | ALL providers (replaces auto) | "Fire with these specific items instead" |

---

## Three Simple Enhancements

### Enhancement 1: Meta Tag Event Control
Control which events fire on each page using simple meta tags.

### Enhancement 2: Click Event Attributes
Fire analytics events from button clicks using data attributes.

### Enhancement 3: Queue Before Redirect
Ensure events fire before page navigation.

**Total implementation**: ~250 lines of code, 5-6 days

---

## Enhancement 1: Meta Tag Event Control

### Goal
Control auto-tracking behavior per page without JavaScript.

### Implementation

#### A. Disable Specific Events (Global Block)

```html
<!-- Disable view_item auto-tracking on this page for ALL providers -->
<meta name="next-analytics-disable" content="dl_view_item,dl_view_item_list">
```

#### B. Whitelist Mode (Enable Only)

```html
<!-- Only fire these events on this page (blocks everything else globally) -->
<meta name="next-analytics-enable-only" content="dl_add_to_cart,dl_purchase">
```

#### C. Auto-Fire View Item Event (Replaces Auto-Detection)

When this meta tag is present, it **replaces** auto-detected `dl_view_item` - no need to block first.

**Option 1: Fire immediately on page load**
```html
<meta name="next-analytics-view-item" content="123">
```

**Option 2: Fire after user views for X seconds (engagement signal)**
```html
<meta name="next-analytics-view-item" content="123" trigger="time:3000">
```

**Option 3: Fire when specific section scrolls into view**
```html
<meta name="next-analytics-view-item" content="123" trigger="view:#product-details">
```

**Option 4: Read package ID from URL parameter (NEW)**
```html
<!-- Reads from ?package_id=123 or ?pid=123 -->
<meta name="next-analytics-view-item" content="url:package_id">
<meta name="next-analytics-view-item" content="url:pid">
```

**Trigger Format**: `type:value`
- `time:3000` = wait 3000ms (3 seconds) after page load
- `view:#selector` = fire when CSS selector scrolls into view (50% threshold)
- `url:param_name` = read package ID from URL parameter

The system will:
1. Look up package from campaign store (or URL param)
2. Extract product_sku, product_name, price, qty, etc.
3. Fire `dl_view_item` event based on trigger condition
4. Use existing `EcommerceEvents.createViewItemEvent()` builder
5. **Skip auto-detection** since meta tag takes priority

**No need to manually specify item properties or block auto-events!**

#### D. Auto-Fire View Item List Event (Replaces Auto-Detection)

When this meta tag is present, it **replaces** auto-detected `dl_view_item_list`.

```html
<!-- Automatically fire dl_view_item_list for multiple packages on page load -->
<!-- This REPLACES auto-detection - no need to block first -->
<meta name="next-analytics-view-item-list" content="123,456,789">
```

**With URL parameters (NEW):**
```html
<!-- Read comma-separated IDs from URL param: ?products=123,456,789 -->
<meta name="next-analytics-view-item-list" content="url:products">
```

The system will:
1. Parse comma-separated package IDs (or read from URL param)
2. Look up each package from campaign store
3. Extract full product data for each
4. Fire `dl_view_item_list` event with all items
5. Use existing `EcommerceEvents.createViewItemListEvent()` builder
6. **Skip auto-detection** since meta tag takes priority

**Perfect for collection/category pages and landing pages with URL params!**

#### E. Set Page-Level List Context

```html
<!-- All add-to-cart events on this page will include this list context -->
<meta name="next-analytics-list-id" content="pdp">
<meta name="next-analytics-list-name" content="Product Detail Page">
```

#### F. Track Scroll Depth

```html
<!-- Track when user scrolls to 25%, 50%, 75%, 90% of page -->
<meta name="next-analytics-scroll-tracking" content="25,50,75,90">
```

The system will:
1. Add a passive scroll listener on page load
2. Calculate scroll percentage: `(window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100`
3. Fire `dl_scroll_depth` event when each threshold is reached (fires once per threshold)
4. Include scroll percentage and threshold in event data

**Perfect for engagement tracking!**

### Technical Implementation

**New File**: `src/utils/analytics/tracking/MetaTagController.ts` (~80 lines)

```typescript
export class MetaTagController {
  private static instance: MetaTagController;
  private config: {
    disabledEvents: string[];
    enabledOnlyEvents: string[];
    listContext: { id?: string; name?: string };
    viewItem?: { packageId: string; trigger?: string; fromUrl?: boolean };
    viewItemListPackageIds?: string[];
    viewItemListFromUrl?: string;
    scrollThresholds?: number[];
  };

  public initialize(): void {
    // Parse meta tags
    this.config = {
      disabledEvents: this.parseArray('next-analytics-disable'),
      enabledOnlyEvents: this.parseArray('next-analytics-enable-only'),
      listContext: this.parseListContext(),
      viewItem: this.parseViewItemConfig(),
      viewItemListPackageIds: this.parseViewItemListConfig(),
      scrollThresholds: this.parseScrollThresholds()
    };

    // Auto-fire view_item if specified (REPLACES auto-detection)
    if (this.config.viewItem) {
      this.fireViewItemEvent(this.config.viewItem);
    }

    // Auto-fire view_item_list if specified (REPLACES auto-detection)
    if (this.config.viewItemListPackageIds && this.config.viewItemListPackageIds.length > 0) {
      this.fireViewItemListEvent(this.config.viewItemListPackageIds);
    }

    // Setup scroll tracking if specified
    if (this.config.scrollThresholds && this.config.scrollThresholds.length > 0) {
      this.setupScrollTracking();
    }

    // Update list attribution if specified
    if (this.config.listContext.id || this.config.listContext.name) {
      ListAttributionTracker.getInstance().setListContext(
        this.config.listContext.id,
        this.config.listContext.name
      );
    }
  }

  /**
   * Check if event should be blocked globally (all providers)
   */
  public shouldBlockEvent(eventName: string): boolean {
    // Whitelist mode - only allow specified events
    if (this.config.enabledOnlyEvents.length > 0) {
      return !this.config.enabledOnlyEvents.includes(eventName);
    }

    // Blacklist mode - block specified events
    return this.config.disabledEvents.includes(eventName);
  }

  /**
   * Check if meta tag should override auto-detection for this event
   */
  public hasMetaTagOverride(eventName: string): boolean {
    if (eventName === 'dl_view_item' && this.config.viewItem) {
      return true;
    }
    if (eventName === 'dl_view_item_list' && this.config.viewItemListPackageIds?.length > 0) {
      return true;
    }
    return false;
  }

  private parseViewItemConfig(): { packageId: string; trigger?: string; fromUrl?: boolean } | undefined {
    const meta = document.querySelector('meta[name="next-analytics-view-item"]') as HTMLMetaElement;
    if (!meta || !meta.content) return undefined;

    const content = meta.content;
    const trigger = meta.getAttribute('trigger') || undefined;

    // Check if reading from URL param
    if (content.startsWith('url:')) {
      const paramName = content.substring(4);
      const urlParams = new URLSearchParams(window.location.search);
      const packageId = urlParams.get(paramName);

      if (!packageId) {
        console.warn(`URL param "${paramName}" not found for view_item event`);
        return undefined;
      }

      return { packageId, trigger, fromUrl: true };
    }

    return { packageId: content, trigger };
  }

  private parseViewItemListConfig(): string[] {
    const meta = document.querySelector('meta[name="next-analytics-view-item-list"]') as HTMLMetaElement;
    if (!meta || !meta.content) return [];

    const content = meta.content;

    // Check if reading from URL param
    if (content.startsWith('url:')) {
      const paramName = content.substring(4);
      const urlParams = new URLSearchParams(window.location.search);
      const paramValue = urlParams.get(paramName);

      if (!paramValue) {
        console.warn(`URL param "${paramName}" not found for view_item_list event`);
        return [];
      }

      return paramValue.split(',').map(s => s.trim());
    }

    return content.split(',').map(s => s.trim());
  }

  private fireViewItemEvent(config: { packageId: string; trigger?: string }): void {
    // Look up package from campaign store (existing pattern)
    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.data?.packages?.find(
      (p: any) => String(p.ref_id) === config.packageId || String(p.external_id) === config.packageId
    );

    if (!packageData) {
      console.warn(`Package ${config.packageId} not found for view_item event`);
      return;
    }

    const fireEvent = () => {
      const event = EcommerceEvents.createViewItemEvent({
        packageId: packageData.ref_id,
      });
      dataLayer.push(event);
    };

    // Handle different trigger types
    if (!config.trigger) {
      fireEvent();
      return;
    }

    const [triggerType, triggerValue] = config.trigger.split(':');

    if (triggerType === 'time') {
      const duration = parseInt(triggerValue);
      if (!isNaN(duration)) {
        setTimeout(fireEvent, duration);
      } else {
        console.warn(`Invalid time trigger: ${config.trigger}`);
        fireEvent();
      }
    } else if (triggerType === 'view') {
      const selector = triggerValue;
      const element = document.querySelector(selector);
      if (element) {
        const observer = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            fireEvent();
            observer.disconnect();
          }
        }, { threshold: 0.5 });
        observer.observe(element);
      } else {
        console.warn(`Element ${selector} not found for view_item trigger`);
        fireEvent();
      }
    } else {
      console.warn(`Unknown trigger type: ${triggerType}`);
      fireEvent();
    }
  }

  private fireViewItemListEvent(packageIds: string[]): void {
    const campaignStore = useCampaignStore.getState();
    const items: any[] = [];

    packageIds.forEach(packageId => {
      const packageData = campaignStore.data?.packages?.find(
        (p: any) => String(p.ref_id) === packageId || String(p.external_id) === packageId
      );

      if (packageData) {
        items.push({ packageId: packageData.ref_id });
      } else {
        console.warn(`Package ${packageId} not found for view_item_list event`);
      }
    });

    if (items.length === 0) {
      console.warn('No valid packages found for view_item_list event');
      return;
    }

    const event = EcommerceEvents.createViewItemListEvent(
      items,
      this.config.listContext.id,
      this.config.listContext.name
    );

    dataLayer.push(event);
  }

  private parseListContext(): { id?: string; name?: string } {
    const id = this.getMeta('next-analytics-list-id');
    const name = this.getMeta('next-analytics-list-name');
    return { id: id || undefined, name: name || undefined };
  }

  private parseArray(metaName: string): string[] {
    const content = this.getMeta(metaName);
    return content ? content.split(',').map(s => s.trim()) : [];
  }

  private parseScrollThresholds(): number[] {
    const content = this.getMeta('next-analytics-scroll-tracking');
    if (!content) return [];

    return content
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0 && n <= 100)
      .sort((a, b) => a - b);
  }

  private setupScrollTracking(): void {
    const thresholds = this.config.scrollThresholds || [];
    if (thresholds.length === 0) return;

    const reachedThresholds = new Set<number>();

    const scrollHandler = () => {
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;

      thresholds.forEach(threshold => {
        if (scrollPercent >= threshold && !reachedThresholds.has(threshold)) {
          reachedThresholds.add(threshold);

          const event = EventBuilder.createEvent('dl_scroll_depth', {
            user_properties: EventBuilder.getUserProperties(),
            scroll_depth: Math.round(scrollPercent),
            scroll_threshold: threshold,
            page_height: document.body.scrollHeight,
            viewport_height: window.innerHeight
          });

          dataLayer.push(event);
        }
      });

      if (reachedThresholds.size === thresholds.length) {
        window.removeEventListener('scroll', scrollHandler);
      }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });
    scrollHandler();
  }

  private getMeta(name: string): string | null {
    const meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    return meta?.content || null;
  }
}
```

**Integration**: Modify `AutoEventListener.shouldProcessEvent()`:

```typescript
private shouldProcessEvent(eventName: string): boolean {
  const metaController = MetaTagController.getInstance();

  // Check if meta tag should override auto-detection (NEW)
  if (metaController.hasMetaTagOverride(eventName)) {
    this.logger.debug(`Event ${eventName} handled by meta tag - skipping auto-detection`);
    return false;
  }

  // Check meta tag blocking (global block)
  if (metaController.shouldBlockEvent(eventName)) {
    this.logger.debug(`Event ${eventName} blocked by meta tag configuration`);
    return false;
  }

  // Existing debounce logic...
  const lastTime = this.lastEventTimes.get(eventName);
  // ...
}
```

**Initialization**: Add to `NextAnalytics.initialize()`:

```typescript
if (config.analytics.mode === 'auto') {
  // Initialize meta tag controller FIRST (handles overrides)
  MetaTagController.getInstance().initialize();

  // Then existing trackers
  UserDataTracker.initialize();
  ListAttributionTracker.getInstance().initialize();
  // ...
}
```

---

## Enhancement 2: Click Event Attributes

### Goal
Fire analytics events from button clicks without JavaScript.

### Supported Events

**Top-of-funnel events** (Full support via meta tags + data attributes):
- `dl_view_item` - Product detail view
- `dl_view_item_list` - Product list view
- `dl_add_to_cart` - Add to cart
- `dl_select_item` - Item selection
- Custom events (any `dl_*` event name)

**Checkout events** (Data attributes only - require form context):
- `dl_begin_checkout` - Checkout initiation
- `dl_add_shipping_info` - Shipping info added
- `dl_add_payment_info` - Payment info added

**Purchase events** (Automatic only - tied to order completion):
- `dl_purchase` - Should remain automatic (tied to order flow)

### Implementation

#### A. Compact Syntax (Recommended)

```html
<!-- Fire add_to_cart on click - compact syntax -->
<button data-next-package-id="123" data-next-analytics="click:dl_add_to_cart">
  Add to Cart
</button>

<!-- Fire view_item when element is viewed for 3+ seconds -->
<div data-next-package-id="123" data-next-analytics="view:dl_view_item:3000">
  Product Details
</div>

<!-- Fire custom event when section scrolls into view -->
<section id="hero" data-next-analytics="view:dl_hero_viewed">
  Hero Content
</section>

<!-- Fire custom event on click with properties -->
<button data-next-analytics="click:dl_cta_clicked" data-next-analytics-cta-name="hero-primary">
  Shop Now
</button>
```

**Compact Syntax Format**: `trigger:eventName:duration`
- `trigger` = `click`, `view`
- `eventName` = event to fire (e.g., `dl_add_to_cart`)
- `duration` (optional) = milliseconds to wait for view triggers (e.g., `3000` = 3 seconds)

#### B. Traditional Syntax (Still Supported)

```html
<!-- Traditional multi-attribute syntax also works -->
<button
  data-next-package-id="123"
  data-next-analytics-event="dl_add_to_cart"
  data-next-analytics-trigger="click">
  Add to Cart
</button>
```

#### C. Custom Event Properties

Any attribute starting with `data-next-analytics-*` becomes an event property:

```html
<button
  data-next-analytics-event="dl_button_clicked"
  data-next-analytics-button-name="newsletter-signup"
  data-next-analytics-section="footer"
  data-next-analytics-variant="blue">
  Subscribe
</button>
```

Results in event:
```javascript
{
  event: "dl_button_clicked",
  button_name: "newsletter-signup",
  section: "footer",
  variant: "blue"
}
```

#### D. Override List Context Per Element

```html
<!-- Use page-level list context from meta tags -->
<button data-next-package-id="123" data-next-analytics-event="dl_add_to_cart">
  Add to Cart
</button>

<!-- Override with element-specific list context -->
<button
  data-next-package-id="456"
  data-next-analytics-event="dl_add_to_cart"
  data-next-analytics-list-id="related-products"
  data-next-analytics-list-name="You May Also Like">
  Add to Cart
</button>
```

### Technical Implementation

**New File**: `src/utils/analytics/tracking/AttributeEventListener.ts` (~100 lines)

```typescript
export class AttributeEventListener {
  private static instance: AttributeEventListener;
  private intersectionObserver: IntersectionObserver | null = null;

  public initialize(): void {
    // Single delegated click listener for performance
    document.addEventListener('click', (e) => this.handleClick(e), true);

    // Setup view triggers
    this.setupViewTriggers();
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;

    // Find closest element with analytics (compact or traditional syntax)
    const element = target.closest('[data-next-analytics]') ||
                   target.closest('[data-next-analytics-event]');

    if (!element) return;

    // Parse compact or traditional syntax
    const config = this.parseAnalyticsConfig(element);
    if (!config || config.trigger !== 'click') return;

    // Extract package ID if present
    const packageId = element.getAttribute('data-next-package-id');

    // Extract all custom properties
    const eventData = this.extractEventData(element);

    // Check if this should queue before redirect
    const queueBeforeRedirect = element.getAttribute('data-next-analytics-queue-before-redirect') === 'true';
    const redirectUrl = element.getAttribute('data-next-redirect') ||
                       (element.tagName === 'A' ? (element as HTMLAnchorElement).href : null);

    // Build the analytics event
    const analyticsEvent = this.buildEvent(config.eventName, packageId, eventData);

    // Handle redirect queueing
    if (queueBeforeRedirect && redirectUrl) {
      (analyticsEvent as any)._willRedirect = true;
      event.preventDefault();
      dataLayer.push(analyticsEvent);

      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 100);

      return;
    }

    // Normal event firing
    dataLayer.push(analyticsEvent);

    logger.debug('Attribute event fired:', config.eventName, analyticsEvent);
  }

  private parseAnalyticsConfig(element: Element): { trigger: string; eventName: string; duration?: number } | null {
    // Compact syntax: data-next-analytics="click:dl_add_to_cart" or "view:dl_view_item:3000"
    const compact = element.getAttribute('data-next-analytics');
    if (compact) {
      const [trigger, eventName, duration] = compact.split(':');
      return {
        trigger: trigger || 'click',
        eventName: eventName || '',
        duration: duration ? parseInt(duration) : undefined
      };
    }

    // Traditional syntax: data-next-analytics-event + data-next-analytics-trigger
    const eventName = element.getAttribute('data-next-analytics-event');
    const trigger = element.getAttribute('data-next-analytics-trigger') || 'click';

    if (eventName) {
      return { trigger, eventName };
    }

    return null;
  }

  private setupViewTriggers(): void {
    const viewElements = document.querySelectorAll('[data-next-analytics^="view:"]');

    if (viewElements.length === 0) return;

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const config = this.parseAnalyticsConfig(element);

          if (!config || config.trigger !== 'view') return;

          if (config.duration) {
            setTimeout(() => {
              if (entry.isIntersecting) {
                this.fireViewEvent(element, config.eventName);
              }
            }, config.duration);
          } else {
            this.fireViewEvent(element, config.eventName);
          }

          this.intersectionObserver?.unobserve(element);
        }
      });
    }, { threshold: 0.5 });

    viewElements.forEach(el => this.intersectionObserver?.observe(el));
  }

  private fireViewEvent(element: HTMLElement, eventName: string): void {
    const packageId = element.getAttribute('data-next-package-id');
    const eventData = this.extractEventData(element);
    const analyticsEvent = this.buildEvent(eventName, packageId, eventData);
    dataLayer.push(analyticsEvent);
  }

  private extractEventData(element: Element): Record<string, any> {
    const data: Record<string, any> = {};

    Array.from(element.attributes).forEach((attr) => {
      if (attr.name === 'data-next-analytics-event') return;
      if (attr.name === 'data-next-analytics') return;
      if (attr.name === 'data-next-analytics-trigger') return;

      if (attr.name.startsWith('data-next-analytics-')) {
        const key = attr.name
          .replace('data-next-analytics-', '')
          .replace(/-/g, '_');

        let value: any = attr.value;
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && String(numValue) === value) {
            value = numValue;
          }
        }

        data[key] = value;
      }
    });

    return data;
  }

  private buildEvent(
    eventName: string,
    packageId: string | null,
    eventData: Record<string, any>
  ): DataLayerEvent {
    // For standard ecommerce events with package ID, use builders
    if (packageId) {
      if (eventName === 'dl_add_to_cart') {
        return EcommerceEvents.createAddToCartEvent(
          { packageId },
          eventData.list_id,
          eventData.list_name
        );
      }

      if (eventName === 'dl_select_item') {
        return EcommerceEvents.createSelectItemEvent(
          { packageId },
          eventData.list_id,
          eventData.list_name
        );
      }

      if (eventName === 'dl_view_item') {
        return EcommerceEvents.createViewItemEvent({ packageId });
      }
    }

    // For custom events, use EventBuilder
    return EventBuilder.createEvent(eventName, {
      user_properties: EventBuilder.getUserProperties(),
      ...eventData
    });
  }

  public destroy(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
  }
}
```

**Integration**: Add to `NextAnalytics.initialize()`:

```typescript
if (config.analytics.mode === 'auto') {
  // ... existing trackers ...

  // Add attribute event listener
  AttributeEventListener.getInstance().initialize();
}
```

---

## Enhancement 3: Queue Before Redirect

### Goal
Ensure analytics events fire before page navigation (prevent data loss).

### Implementation

#### A. Queue Events Before Link Navigation

```html
<!-- Event will be queued before navigating to /checkout -->
<a
  href="/checkout"
  data-next-analytics-event="dl_checkout_clicked"
  data-next-analytics-queue-before-redirect="true">
  Continue to Checkout
</a>
```

#### B. Queue Events Before Form Submit

```html
<!-- Event fires before form navigates to success page -->
<form action="/order-success" method="POST">
  <button
    type="submit"
    data-next-analytics-event="dl_form_submitted"
    data-next-analytics-form-name="checkout"
    data-next-analytics-queue-before-redirect="true">
    Place Order
  </button>
</form>
```

#### C. Queue Add-to-Cart Before Redirect

```html
<!-- Add to cart, queue event, then redirect -->
<button
  data-next-package-id="123"
  data-next-analytics-event="dl_add_to_cart"
  data-next-analytics-queue-before-redirect="true"
  data-next-redirect="/checkout">
  Buy Now
</button>
```

**How It Works**:
1. Detects `data-next-analytics-queue-before-redirect="true"`
2. Prevents default link/form navigation
3. Fires event with `_willRedirect` flag (existing system)
4. `DataLayerManager` queues event in sessionStorage (existing `PendingEventsHandler`)
5. Navigates to new page
6. New page loads and processes queued events (existing system)

**No new code needed** - just exposes existing `_willRedirect` flag via attribute!

---

## Complete Examples

### Example 1: Product Detail Page (With URL Params Support)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Drone Hawk - Product</title>

  <!-- Auto-fire view_item - reads package ID from URL: ?pid=123 -->
  <!-- This REPLACES auto-detection - no need to block first -->
  <meta name="next-analytics-view-item" content="url:pid" trigger="time:3000">

  <!-- Set list context for all add-to-cart on this page -->
  <meta name="next-analytics-list-id" content="pdp">
  <meta name="next-analytics-list-name" content="Product Detail Page">

  <!-- Track scroll engagement -->
  <meta name="next-analytics-scroll-tracking" content="25,50,75,90">
</head>
<body>
  <h1>Drone Hawk Premium</h1>
  <p class="price">$199.99</p>

  <!-- COMPACT SYNTAX: click trigger -->
  <button data-next-package-id="123" data-next-analytics="click:dl_add_to_cart">
    Add to Cart
  </button>

  <!-- Buy now - queue event before redirect -->
  <button
    data-next-package-id="123"
    data-next-analytics-event="dl_add_to_cart"
    data-next-analytics-queue-before-redirect="true"
    data-next-redirect="/checkout">
    Buy Now
  </button>

  <!-- Product video section - track when viewed -->
  <section id="video-section" data-next-analytics="view:dl_video_section_viewed">
    <video src="product-demo.mp4"></video>
  </section>

  <!-- Reviews section - track when user scrolls here and stays 2 seconds -->
  <section
    id="reviews"
    data-next-package-id="123"
    data-next-analytics="view:dl_reviews_engaged:2000">
    <h2>Customer Reviews</h2>
  </section>

  <!-- Related products section -->
  <div class="related-products">
    <h2>You May Also Like</h2>

    <!-- Override list context with custom properties -->
    <button
      data-next-package-id="456"
      data-next-analytics="click:dl_add_to_cart"
      data-next-analytics-list-id="related"
      data-next-analytics-list-name="Related Products">
      Add to Cart
    </button>
  </div>
</body>
</html>
```

**What happens**:
1. Page loads → reads `pid` from URL → waits 3 seconds → `dl_view_item` fires
2. User scrolls → `dl_scroll_depth` fires at 25%, 50%, 75%, 90%
3. Video section scrolls into view → `dl_video_section_viewed` fires
4. Reviews section visible for 2+ seconds → `dl_reviews_engaged` fires
5. Click "Add to Cart" → `dl_add_to_cart` fires with list context from meta tags
6. Click "Buy Now" → `dl_add_to_cart` queues, then redirects
7. Click related product → `dl_add_to_cart` fires with "Related Products" list

---

### Example 2: Landing Page with URL Params

```html
<!DOCTYPE html>
<html>
<head>
  <title>Black Friday Sale</title>

  <!-- Read product IDs from URL: ?products=100,101,102 -->
  <!-- This REPLACES auto-detection - no need to block in config -->
  <meta name="next-analytics-view-item-list" content="url:products">

  <!-- Set list context -->
  <meta name="next-analytics-list-id" content="bf-landing">
  <meta name="next-analytics-list-name" content="Black Friday Landing">

  <!-- Track scroll engagement -->
  <meta name="next-analytics-scroll-tracking" content="25,50,75,90">
</head>
<body>
  <!-- Hero CTA -->
  <section class="hero">
    <button
      data-next-analytics="click:dl_cta_clicked"
      data-next-analytics-cta-name="hero-primary"
      data-next-analytics-campaign="black-friday">
      Shop Now - 50% Off
    </button>
  </section>

  <!-- Product grid -->
  <div class="products">
    <button
      data-next-package-id="100"
      data-next-analytics="click:dl_add_to_cart">
      Add to Cart
    </button>
  </div>
</body>
</html>
```

---

### Example 3: Upsell Page

```html
<!DOCTYPE html>
<html>
<head>
  <title>Special Offer!</title>

  <!-- Disable auto-tracking of cart events on upsell page (global block) -->
  <meta name="next-analytics-disable" content="dl_remove_from_cart,dl_view_item_list">

  <!-- Set upsell list context -->
  <meta name="next-analytics-list-id" content="upsell-1">
  <meta name="next-analytics-list-name" content="Post-Purchase Upsell">
</head>
<body>
  <h1>Wait! Special One-Time Offer</h1>
  <p>Add this upgrade for just $49</p>

  <!-- Accept upsell - queue before redirect -->
  <button
    data-next-package-id="789"
    data-next-analytics-event="dl_upsell_accepted"
    data-next-analytics-queue-before-redirect="true"
    data-next-redirect="/thank-you">
    Yes, Add This Deal!
  </button>

  <!-- Skip upsell - queue before redirect -->
  <a
    href="/thank-you"
    data-next-analytics-event="dl_upsell_skipped"
    data-next-analytics-package-id="789"
    data-next-analytics-queue-before-redirect="true">
    No Thanks, Continue
  </a>
</body>
</html>
```

---

## API Reference

### Meta Tags

| Meta Tag | Purpose | Example |
|----------|---------|---------|
| `next-analytics-disable` | Block events globally (all providers) | `<meta name="next-analytics-disable" content="dl_view_item">` |
| `next-analytics-enable-only` | Whitelist mode - only fire these events globally | `<meta name="next-analytics-enable-only" content="dl_purchase">` |
| `next-analytics-view-item` | Fire dl_view_item (REPLACES auto-detection) | `<meta name="next-analytics-view-item" content="123">` |
| | With trigger attribute (time-based) | `<meta name="next-analytics-view-item" content="123" trigger="time:3000">` |
| | With trigger attribute (view-based) | `<meta name="next-analytics-view-item" content="123" trigger="view:#product-details">` |
| | With URL parameter | `<meta name="next-analytics-view-item" content="url:pid">` |
| `next-analytics-view-item-list` | Fire dl_view_item_list (REPLACES auto-detection) | `<meta name="next-analytics-view-item-list" content="123,456,789">` |
| | With URL parameter | `<meta name="next-analytics-view-item-list" content="url:products">` |
| `next-analytics-scroll-tracking` | Track scroll depth (fires `dl_scroll_depth`) | `<meta name="next-analytics-scroll-tracking" content="25,50,75,90">` |
| `next-analytics-list-id` | Default list ID for all events on page | `<meta name="next-analytics-list-id" content="pdp">` |
| `next-analytics-list-name` | Default list name for all events | `<meta name="next-analytics-list-name" content="Product Detail">` |

### Element Attributes

#### Compact Syntax (Recommended)

| Attribute | Format | Example |
|-----------|--------|---------|
| `data-next-analytics` | `trigger:eventName:duration` | `data-next-analytics="click:dl_add_to_cart"` |
| | Click trigger | `data-next-analytics="click:dl_button_clicked"` |
| | View trigger (immediate) | `data-next-analytics="view:dl_section_viewed"` |
| | View trigger (with duration) | `data-next-analytics="view:dl_engaged:3000"` |

**Format breakdown**:
- `trigger` = `click`, `view`
- `eventName` = event to fire (e.g., `dl_add_to_cart`)
- `duration` = (optional) milliseconds for view triggers (e.g., `3000` = 3 seconds)

#### Traditional Syntax (Also Supported)

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-next-analytics-event` | Event name to fire on interaction | `data-next-analytics-event="dl_add_to_cart"` |
| `data-next-analytics-trigger` | Trigger type (click, view) | `data-next-analytics-trigger="click"` |
| `data-next-package-id` | Package ID for ecommerce events | `data-next-package-id="123"` |
| `data-next-analytics-queue-before-redirect` | Queue event before navigation | `data-next-analytics-queue-before-redirect="true"` |
| `data-next-redirect` | URL to navigate to after event fires | `data-next-redirect="/checkout"` |
| `data-next-analytics-list-id` | Override list ID for this element | `data-next-analytics-list-id="related"` |
| `data-next-analytics-list-name` | Override list name for this element | `data-next-analytics-list-name="Related Products"` |
| `data-next-analytics-*` | Custom event properties (any name) | `data-next-analytics-button-name="hero-cta"` |

### JavaScript API

```typescript
// MetaTagController
MetaTagController.getInstance().shouldBlockEvent('dl_view_item'); // boolean - global block
MetaTagController.getInstance().hasMetaTagOverride('dl_view_item'); // boolean - replaces auto

// AttributeEventListener
AttributeEventListener.getInstance().initialize();
AttributeEventListener.getInstance().destroy();

// Pending Events (existing - enhanced)
window.NextAnalytics.getPendingEvents(); // Debug helper
```

---

## Implementation Checklist

### Phase 1: Meta Tag Controller (2 days)
- [ ] Create `MetaTagController.ts`
- [ ] Parse `next-analytics-disable` meta tag (global block)
- [ ] Parse `next-analytics-enable-only` meta tag
- [ ] Parse `next-analytics-view-item` meta tag (with URL param support)
- [ ] Parse `next-analytics-view-item-list` meta tag (with URL param support)
- [ ] Parse list context meta tags
- [ ] Implement `hasMetaTagOverride()` method
- [ ] Auto-fire view_item/view_item_list on initialization
- [ ] Integrate with `AutoEventListener.shouldProcessEvent()`
- [ ] Unit tests for meta tag parsing

### Phase 2: Attribute Event Listener (2 days)
- [ ] Create `AttributeEventListener.ts`
- [ ] Implement click event delegation
- [ ] Implement view triggers with IntersectionObserver
- [ ] Extract `data-next-analytics-*` attributes
- [ ] Build events using existing event builders
- [ ] Support custom events with EventBuilder
- [ ] Integrate with `NextAnalytics.initialize()`
- [ ] Unit tests for attribute extraction

### Phase 3: Queue Before Redirect (1 day)
- [ ] Add redirect detection to `AttributeEventListener`
- [ ] Prevent default navigation for queued events
- [ ] Use existing `_willRedirect` flag
- [ ] Support both links and buttons
- [ ] Test cross-browser navigation
- [ ] Integration tests for event queueing

### Phase 4: Documentation & Examples (1 day)
- [ ] Complete API documentation
- [ ] Add JSDoc comments to all methods
- [ ] Create example HTML templates
- [ ] Update main README
- [ ] Document hierarchy/priority clearly

**Total: 6 days**

---

## Migration Guide

### From Manual JavaScript

**Before** (manual event firing):
```javascript
document.querySelector('.add-to-cart').addEventListener('click', () => {
  const event = EcommerceEvents.createAddToCartEvent(
    { packageId: 123 },
    'pdp',
    'Product Detail Page'
  );
  dataLayer.push(event);
});
```

**After** (declarative attributes):
```html
<meta name="next-analytics-list-id" content="pdp">
<meta name="next-analytics-list-name" content="Product Detail Page">

<button class="add-to-cart"
        data-next-package-id="123"
        data-next-analytics="click:dl_add_to_cart">
  Add to Cart
</button>
```

### From Transform Functions

**Before** (blocking events via transform):
```javascript
window.NextDataLayerTransformFn = (event) => {
  if (event.event === 'dl_view_item') {
    return null; // Block
  }
  return event;
};
```

**After** (meta tag - global block):
```html
<meta name="next-analytics-disable" content="dl_view_item">
```

### From Provider blockedEvents

Provider `blockedEvents` is still useful for **per-provider control**:

```javascript
// Block dl_view_item_list for GTM only (FB still receives it)
gtm: {
  enabled: true,
  blockedEvents: ['dl_view_item_list']
}
```

Use meta tags for **global control** (all providers):

```html
<!-- Block dl_view_item_list for ALL providers -->
<meta name="next-analytics-disable" content="dl_view_item_list">
```

---

## Performance Considerations

### Optimizations

1. **Single event delegation** - One click listener for entire document
2. **WeakMap/WeakSet** - Automatic garbage collection for tracked elements
3. **Lazy initialization** - Parse meta tags only once on page load
4. **No polling** - Event-driven architecture only
5. **Passive scroll listeners** - No blocking during scroll

### Performance Budget

- Meta tag parsing: < 10ms
- Click event handling: < 5ms per click
- Event queueing: < 5ms
- **Total initialization overhead: < 20ms**

---

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Polyfills**: None required (uses only standard DOM APIs)

---

## Security

### XSS Prevention
- No `eval()` usage
- Attribute values sanitized before use
- Event data validated against schemas

### CSP Compliance
- No inline scripts required
- Compatible with strict CSP policies

---

## Summary

This proposal delivers **90% of the value with 10% of the complexity**:

✅ **Clear hierarchy** - Provider blockedEvents → Meta tag blocks → Meta tag overrides
✅ **7 meta tags total** (disable, enable-only, view-item, view-item-list, scroll-tracking, list-id, list-name)
✅ **URL parameter support** for dynamic landing pages
✅ **Meta tags override auto-detection** - No need to block first
✅ **Simple attribute pattern** (`data-next-analytics-*`)
✅ **Builds on existing systems** (campaign store lookup, event builders, pending queue)
✅ **~250 lines of code**
✅ **6 day implementation**
✅ **Zero breaking changes**

The key insight: **Don't reinvent patterns, extend what works.**

---

## Next Steps

1. Review this updated proposal
2. Approve scope and timeline
3. Begin Phase 1 implementation
4. Iterate based on real-world usage

---

**Questions or feedback?** Please review and provide input on scope, priority, and timeline.
