# Analytics Enhancement Proposal - Simplified

**Date**: 2025-11-19
**Status**: Proposal - Simplified Version
**Version**: 2.0

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

## Three Simple Enhancements

### Enhancement 1: Meta Tag Event Control
Control which events fire on each page using simple meta tags.

### Enhancement 2: Click Event Attributes
Fire analytics events from button clicks using data attributes.

### Enhancement 3: Queue Before Redirect
Ensure events fire before page navigation.

**Total implementation**: ~200 lines of code, 3-5 days

---

## Enhancement 1: Meta Tag Event Control

### Goal
Control auto-tracking behavior per page without JavaScript.

### Implementation

#### A. Disable Specific Events

```html
<!-- Disable view_item auto-tracking on this page -->
<meta name="next-analytics-disable" content="dl_view_item,dl_view_item_list">
```

#### B. Whitelist Mode (Enable Only)

```html
<!-- Only fire these events on this page -->
<meta name="next-analytics-enable-only" content="dl_add_to_cart,dl_purchase">
```

#### C. Auto-Fire View Item Event

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

**Trigger Format**: `type:value`
- `time:3000` = wait 3000ms (3 seconds) after page load
- `view:#selector` = fire when CSS selector scrolls into view (50% threshold)

The system will:
1. Look up package 123 from campaign store
2. Extract product_sku, product_name, price, qty, etc.
3. Fire `dl_view_item` event based on trigger condition
4. Use existing `EcommerceEvents.createViewItemEvent()` builder

**No need to manually specify item properties!**

#### C2. Auto-Fire View Item List Event

```html
<!-- Automatically fire dl_view_item_list for multiple packages on page load -->
<meta name="next-analytics-view-item-list" content="123,456,789">
```

The system will:
1. Parse comma-separated package IDs
2. Look up each package from campaign store
3. Extract full product data for each
4. Fire `dl_view_item_list` event with all items
5. Use existing `EcommerceEvents.createViewItemListEvent()` builder

**Perfect for collection/category pages!**

#### D. Set Page-Level List Context

```html
<!-- All add-to-cart events on this page will include this list context -->
<meta name="next-analytics-list-id" content="pdp">
<meta name="next-analytics-list-name" content="Product Detail Page">
```

#### E. Track Scroll Depth

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

**New File**: `src/utils/analytics/tracking/MetaTagController.ts` (~60 lines)

```typescript
export class MetaTagController {
  private static instance: MetaTagController;
  private config: {
    disabledEvents: string[];
    enabledOnlyEvents: string[];
    listContext: { id?: string; name?: string };
    viewItem?: { packageId: string; trigger?: string };
    viewItemListPackageIds?: string[];
    scrollThresholds?: number[];
  };

  public initialize(): void {
    // Parse meta tags
    this.config = {
      disabledEvents: this.parseArray('next-analytics-disable'),
      enabledOnlyEvents: this.parseArray('next-analytics-enable-only'),
      listContext: this.parseListContext(),
      viewItem: this.parseViewItemConfig(),
      viewItemListPackageIds: this.parseArray('next-analytics-view-item-list'),
      scrollThresholds: this.parseScrollThresholds()
    };

    // Auto-fire view_item if specified
    if (this.config.viewItem) {
      this.fireViewItemEvent(this.config.viewItem.packageId, this.config.viewItem.trigger);
    }

    // Auto-fire view_item_list if specified
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

  public shouldBlockEvent(eventName: string): boolean {
    // Whitelist mode - only allow specified events
    if (this.config.enabledOnlyEvents.length > 0) {
      return !this.config.enabledOnlyEvents.includes(eventName);
    }

    // Blacklist mode - block specified events
    return this.config.disabledEvents.includes(eventName);
  }

  private fireViewItemEvent(packageId: string, trigger?: string): void {
    // Look up package from campaign store (existing pattern)
    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.data?.packages?.find(
      (p: any) => String(p.ref_id) === packageId || String(p.external_id) === packageId
    );

    if (!packageData) {
      console.warn(`Package ${packageId} not found for view_item event`);
      return;
    }

    const fireEvent = () => {
      const event = EcommerceEvents.createViewItemEvent({
        packageId: packageData.ref_id,
      });
      dataLayer.push(event);
    };

    // Handle different trigger types
    if (!trigger) {
      // No trigger - fire immediately
      fireEvent();
      return;
    }

    // Parse trigger format: "time:3000" or "view:#selector"
    const [triggerType, triggerValue] = trigger.split(':');

    if (triggerType === 'time') {
      // Time trigger - fire after X milliseconds
      const duration = parseInt(triggerValue);
      if (!isNaN(duration)) {
        setTimeout(fireEvent, duration);
      } else {
        console.warn(`Invalid time trigger: ${trigger}`);
        fireEvent(); // Fallback to immediate
      }
    } else if (triggerType === 'view') {
      // View trigger - fire when selector scrolls into view
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
        fireEvent(); // Fallback to immediate
      }
    } else {
      console.warn(`Unknown trigger type: ${triggerType}`);
      fireEvent(); // Fallback to immediate
    }
  }

  private fireViewItemListEvent(packageIds: string[]): void {
    // Look up all packages from campaign store
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

    // Use existing event builder with list context
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

  private parseViewItemConfig(): { packageId: string; trigger?: string } | undefined {
    const meta = document.querySelector('meta[name="next-analytics-view-item"]') as HTMLMetaElement;
    if (!meta || !meta.content) return undefined;

    return {
      packageId: meta.content,
      trigger: meta.getAttribute('trigger') || undefined
    };
  }

  private parseScrollThresholds(): number[] {
    const content = this.getMeta('next-analytics-scroll-tracking');
    if (!content) return [];

    return content
      .split(',')
      .map(s => parseFloat(s.trim()))
      .filter(n => !isNaN(n) && n > 0 && n <= 100)
      .sort((a, b) => a - b); // Sort ascending
  }

  private setupScrollTracking(): void {
    const thresholds = this.config.scrollThresholds || [];
    if (thresholds.length === 0) return;

    const reachedThresholds = new Set<number>();

    const scrollHandler = () => {
      const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;

      // Check each threshold
      thresholds.forEach(threshold => {
        if (scrollPercent >= threshold && !reachedThresholds.has(threshold)) {
          reachedThresholds.add(threshold);

          // Fire scroll depth event
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

      // Remove listener if all thresholds reached
      if (reachedThresholds.size === thresholds.length) {
        window.removeEventListener('scroll', scrollHandler);
      }
    };

    // Add passive scroll listener for performance
    window.addEventListener('scroll', scrollHandler, { passive: true });

    // Check immediately in case user already scrolled
    scrollHandler();
  }

  private getMeta(name: string): string | null {
    const meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement;
    return meta?.content || null;
  }
}
```

**Integration**: Add to `AutoEventListener.shouldProcessEvent()`:

```typescript
private shouldProcessEvent(eventName: string): boolean {
  // Check meta tag blocking (NEW - 3 lines)
  if (MetaTagController.getInstance().shouldBlockEvent(eventName)) {
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
  // Initialize meta tag controller FIRST (NEW - 1 line)
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
- `trigger` = `click`, `view`, `hover`
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

#### B. Custom Event Properties

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

#### C. Override List Context Per Element

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

    // Setup view/hover triggers
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

    // Build the analytics event
    const analyticsEvent = this.buildEvent(config.eventName, packageId, eventData);

    // Fire the event
    dataLayer.push(analyticsEvent);

    logger.debug('Attribute event fired:', config.eventName, analyticsEvent);
  }

  /**
   * Parse compact or traditional syntax
   */
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

  /**
   * Setup view/hover triggers using IntersectionObserver
   */
  private setupViewTriggers(): void {
    // Find all elements with view triggers
    const viewElements = document.querySelectorAll('[data-next-analytics^="view:"]');

    if (viewElements.length === 0) return;

    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const config = this.parseAnalyticsConfig(element);

          if (!config || config.trigger !== 'view') return;

          // If duration specified, wait before firing
          if (config.duration) {
            setTimeout(() => {
              // Check if still visible
              if (entry.isIntersecting) {
                this.fireViewEvent(element, config.eventName);
              }
            }, config.duration);
          } else {
            // Fire immediately
            this.fireViewEvent(element, config.eventName);
          }

          // Unobserve after firing
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

  /**
   * Extract all data-next-analytics-* attributes as event properties
   */
  private extractEventData(element: Element): Record<string, any> {
    const data: Record<string, any> = {};

    Array.from(element.attributes).forEach((attr) => {
      // Skip the event name itself
      if (attr.name === 'data-next-analytics-event') return;

      // Extract analytics properties
      if (attr.name.startsWith('data-next-analytics-')) {
        const key = attr.name
          .replace('data-next-analytics-', '')
          .replace(/-/g, '_'); // Convert kebab-case to snake_case

        // Try to parse as number or boolean
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

  /**
   * Build analytics event using existing builders when possible
   */
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
    // Cleanup if needed
  }
}
```

**Integration**: Add to `NextAnalytics.initialize()`:

```typescript
if (config.analytics.mode === 'auto') {
  // ... existing trackers ...

  // Add attribute event listener (NEW - 1 line)
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

### Technical Implementation

**Modify**: `AttributeEventListener.handleClick()` to detect redirect scenarios:

```typescript
private handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement;
  const element = target.closest('[data-next-analytics-event]');

  if (!element) return;

  const eventName = element.getAttribute('data-next-analytics-event');
  const packageId = element.getAttribute('data-next-package-id');
  const eventData = this.extractEventData(element);

  // Check if this should queue before redirect (NEW)
  const queueBeforeRedirect = element.getAttribute('data-next-analytics-queue-before-redirect') === 'true';
  const redirectUrl = element.getAttribute('data-next-redirect') ||
                     (element.tagName === 'A' ? (element as HTMLAnchorElement).href : null);

  // Build event
  const analyticsEvent = this.buildEvent(eventName, packageId, eventData);

  // Handle redirect queueing (NEW)
  if (queueBeforeRedirect && redirectUrl) {
    // Mark for queueing
    (analyticsEvent as any)._willRedirect = true;

    // Prevent default navigation
    event.preventDefault();

    // Queue event (uses existing PendingEventsHandler)
    dataLayer.push(analyticsEvent);

    // Navigate after brief delay
    setTimeout(() => {
      window.location.href = redirectUrl;
    }, 100);

    return;
  }

  // Normal event firing
  dataLayer.push(analyticsEvent);
}
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

### Example 1: Product Detail Page (With Compact Syntax)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Drone Hawk - Product</title>

  <!-- Auto-fire view_item after user views for 3 seconds (engagement signal) -->
  <meta name="next-analytics-view-item" content="123" trigger="time:3000">

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

  <!-- Buy now - queue event before redirect (traditional syntax) -->
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
    <!-- Reviews content -->
  </section>

  <!-- Related products section -->
  <div class="related-products">
    <h2>You May Also Like</h2>

    <!-- COMPACT: Override list context with custom properties -->
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
1. Page loads → waits 3 seconds → `dl_view_item` fires (confirms user is actually viewing)
2. User scrolls → `dl_scroll_depth` fires at 25%, 50%, 75%, 90%
3. Video section scrolls into view → `dl_video_section_viewed` fires immediately
4. Reviews section visible for 2+ seconds → `dl_reviews_engaged` fires
5. Click "Add to Cart" → `dl_add_to_cart` fires with list context from meta tags
6. Click "Buy Now" → `dl_add_to_cart` queues, then redirects
7. Click related product → `dl_add_to_cart` fires with "Related Products" list

---

### Example 2: Upsell Page

```html
<!DOCTYPE html>
<html>
<head>
  <title>Special Offer!</title>

  <!-- Disable auto-tracking of cart events on upsell page -->
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
    data-next-analytics-event="dl_upsell_purchase"
    data-next-analytics-queue-before-redirect="true"
    data-next-redirect="/thank-you">
    Yes, Add This Deal!
  </button>

  <!-- Skip upsell - queue before redirect -->
  <a
    href="/thank-you"
    data-next-analytics-event="dl_skipped_upsell"
    data-next-analytics-package-id="789"
    data-next-analytics-queue-before-redirect="true">
    No Thanks, Continue
  </a>
</body>
</html>
```

---

### Example 3: Landing Page with Custom Events & Scroll Tracking

```html
<!DOCTYPE html>
<html>
<head>
  <title>Black Friday Sale</title>

  <!-- Only track specific events on this landing page -->
  <meta name="next-analytics-enable-only" content="dl_cta_clicked,dl_add_to_cart,dl_scroll_depth">

  <!-- Track scroll engagement at 25%, 50%, 75% and 90% -->
  <meta name="next-analytics-scroll-tracking" content="25,50,75,90">
</head>
<body>
  <!-- Hero CTA -->
  <section class="hero">
    <button
      data-next-analytics-event="dl_cta_clicked"
      data-next-analytics-cta-name="hero-primary"
      data-next-analytics-cta-text="Shop Now"
      data-next-analytics-campaign="black-friday"
      data-next-analytics-variant="version-a">
      Shop Now - 50% Off
    </button>
  </section>

  <!-- Product grid -->
  <div class="products">
    <button
      data-next-package-id="100"
      data-next-analytics-event="dl_add_to_cart"
      data-next-analytics-list-id="bf-landing"
      data-next-analytics-list-name="Black Friday Landing">
      Add to Cart
    </button>
  </div>

  <!-- Newsletter signup -->
  <button
    data-next-analytics-event="dl_newsletter_signup_clicked"
    data-next-analytics-source="footer"
    data-next-analytics-campaign="black-friday">
    Get Exclusive Deals
  </button>
</body>
</html>
```

**What happens**:
- As user scrolls, `dl_scroll_depth` fires at 25%, 50%, 75%, and 90%
- Each event includes `scroll_depth`, `scroll_threshold`, `page_height`, `viewport_height`
- Scroll listener automatically removes itself after all thresholds reached (performance optimization)

---

### Example 4: Checkout Page

```html
<!DOCTYPE html>
<html>
<head>
  <title>Checkout</title>

  <!-- Disable cart modification events on checkout -->
  <meta name="next-analytics-disable" content="dl_add_to_cart,dl_remove_from_cart">
</head>
<body>
  <h1>Complete Your Order</h1>

  <form id="checkout-form" action="/process-order" method="POST">
    <!-- Form fields -->
    <input type="email" name="email" required>
    <input type="text" name="name" required>

    <!-- Track checkout submission -->
    <button
      type="submit"
      data-next-analytics-event="dl_checkout_submitted"
      data-next-analytics-form-name="checkout"
      data-next-analytics-queue-before-redirect="true">
      Place Order
    </button>
  </form>

  <!-- Back to cart link -->
  <a
    href="/cart"
    data-next-analytics-event="dl_back_to_cart_clicked"
    data-next-analytics-source="checkout">
    ← Back to Cart
  </a>
</body>
</html>
```

---

## API Reference

### Meta Tags

| Meta Tag | Purpose | Example |
|----------|---------|---------|
| `next-analytics-disable` | Comma-separated list of events to block | `<meta name="next-analytics-disable" content="dl_view_item">` |
| `next-analytics-enable-only` | Whitelist mode - only fire these events | `<meta name="next-analytics-enable-only" content="dl_purchase">` |
| `next-analytics-view-item` | Auto-fire dl_view_item with package ID | `<meta name="next-analytics-view-item" content="123">` |
| | With trigger attribute (time-based) | `<meta name="next-analytics-view-item" content="123" trigger="time:3000">` |
| | With trigger attribute (view-based) | `<meta name="next-analytics-view-item" content="123" trigger="view:#product-details">` |
| `next-analytics-view-item-list` | Auto-fire dl_view_item_list with package IDs | `<meta name="next-analytics-view-item-list" content="123,456,789">` |
| `next-analytics-scroll-tracking` | Track scroll depth at percentages (fires `dl_scroll_depth` event) | `<meta name="next-analytics-scroll-tracking" content="25,50,75,90">` |
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
- `trigger` = `click`, `view`, `hover`
- `eventName` = event to fire (e.g., `dl_add_to_cart`)
- `duration` = (optional) milliseconds for view triggers (e.g., `3000` = 3 seconds)

#### Traditional Syntax (Also Supported)

| Attribute | Purpose | Example |
|-----------|---------|---------|
| `data-next-analytics-event` | Event name to fire on interaction | `data-next-analytics-event="dl_add_to_cart"` |
| `data-next-analytics-trigger` | Trigger type (click, view, hover) | `data-next-analytics-trigger="click"` |
| `data-next-package-id` | Package ID for ecommerce events | `data-next-package-id="123"` |
| `data-next-analytics-queue-before-redirect` | Queue event before navigation | `data-next-analytics-queue-before-redirect="true"` |
| `data-next-redirect` | URL to navigate to after event fires | `data-next-redirect="/checkout"` |
| `data-next-analytics-list-id` | Override list ID for this element | `data-next-analytics-list-id="related"` |
| `data-next-analytics-list-name` | Override list name for this element | `data-next-analytics-list-name="Related Products"` |
| `data-next-analytics-*` | Custom event properties (any name) | `data-next-analytics-button-name="hero-cta"` |

### JavaScript API

```typescript
// MetaTagController
MetaTagController.getInstance().shouldBlockEvent('dl_view_item'); // boolean

// AttributeEventListener
AttributeEventListener.getInstance().initialize();
AttributeEventListener.getInstance().destroy();

// Pending Events (existing - enhanced)
window.NextAnalytics.getPendingEvents(); // Debug helper (NEW)
```

---

## Implementation Checklist

### Phase 1: Meta Tag Controller (1-2 days)
- [ ] Create `MetaTagController.ts`
- [ ] Parse `next-analytics-disable` meta tag
- [ ] Parse `next-analytics-enable-only` meta tag
- [ ] Parse `next-analytics-view-item` meta tag
- [ ] Parse list context meta tags
- [ ] Auto-fire view_item on initialization
- [ ] Integrate with `AutoEventListener.shouldProcessEvent()`
- [ ] Unit tests for meta tag parsing

### Phase 2: Attribute Event Listener (2 days)
- [ ] Create `AttributeEventListener.ts`
- [ ] Implement click event delegation
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
- [ ] Video tutorial (optional)

**Total: 5-6 days**

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
        data-next-analytics-event="dl_add_to_cart">
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

**After** (meta tag):
```html
<meta name="next-analytics-disable" content="dl_view_item">
```

---

## Performance Considerations

### Optimizations

1. **Single event delegation** - One click listener for entire document
2. **WeakMap/WeakSet** - Automatic garbage collection for tracked elements
3. **Lazy initialization** - Parse meta tags only once on page load
4. **No polling** - Event-driven architecture only

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

## Testing Strategy

### Unit Tests
- Meta tag parsing
- Attribute extraction
- Event building
- Redirect detection

### Integration Tests
- Meta tags blocking events
- Click events firing
- Queue before redirect
- List context inheritance

### E2E Tests
- Full page flows
- Multi-page journeys
- Cross-browser testing

---

## Success Metrics

### Developer Experience
- **90% reduction** in custom analytics JavaScript
- **< 5 minutes** to add analytics to new page
- **Zero learning curve** (uses familiar HTML attributes)

### Performance
- **< 20ms** initialization overhead
- **100% event delivery** before redirects
- **Zero duplicate events**

### Reliability
- **99.9%** event firing accuracy
- **Complete attribution** across redirects

---

## Summary

This simplified proposal delivers **90% of the value with 10% of the complexity**:

✅ **7 meta tags total** (disable, enable-only, view-item, view-item-list, scroll-tracking, list-id, list-name)
✅ **Simple attribute pattern** (`data-next-analytics-*`)
✅ **Builds on existing systems** (campaign store lookup, event builders, pending queue, scroll calc)
✅ **~250 lines of code**
✅ **5-6 day implementation**
✅ **Zero breaking changes**

The key insight: **Don't reinvent patterns, extend what works.**

---

## Next Steps

1. Review this simplified proposal
2. Approve scope and timeline
3. Begin Phase 1 implementation
4. Iterate based on real-world usage

---

**Questions or feedback?** Please review and provide input on scope, priority, and timeline.
