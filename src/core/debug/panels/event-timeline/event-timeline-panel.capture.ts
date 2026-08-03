/**
 * Hooks the four event sources the timeline records from: GTM's dataLayer,
 * the internal EventBus, DOM CustomEvents, and the Performance API. Extracted
 * verbatim from `event-timeline-panel.ts` (see docs/code-findings.md #137) —
 * logic unchanged; `this` became an explicit `EventCaptureHost` context
 * because these overrides fire asynchronously (long after `watchDataLayer`
 * etc. return), so they must read the panel's *current* `isRecording`/
 * `events`/`updateTimeout`, not a value snapshotted at setup time. `events`
 * and `updateTimeout` are live get/set accessors for the same reason
 * `saveTimeout` is in `event-timeline-panel.persistence.ts`.
 *
 * `watchDOMEvents` keeps the original's dynamic instance lookup (it takes a
 * `getHost` callback re-invoked at fire time) rather than closing over one
 * fixed host like the other three watchers — that mirrors the original's use
 * of the class's static `EventTimelinePanel.getInstance()` registry inside
 * the `dispatchEvent` override, instead of the constructing instance's `this`.
 */
import type { EventBus } from '../../../events';
import type { TimelineEvent } from './event-timeline-panel.types';

// Map internal events from global.ts EventMap
const INTERNAL_EVENT_PATTERNS = [
  'cart:updated',
  'cart:item-added',
  'cart:item-removed',
  'cart:quantity-changed',
  'cart:package-swapped',
  'campaign:loaded',
  'checkout:started',
  'checkout:form-initialized',
  'checkout:spreedly-ready',
  'checkout:express-started',
  'order:completed',
  'order:redirect-missing',
  'error:occurred',
  'timer:expired',
  'config:updated',
  'coupon:applied',
  'coupon:removed',
  'coupon:validation-failed',
  'selector:item-selected',
  'selector:action-completed',
  'selector:selection-changed',
  'shipping:method-selected',
  'shipping:method-changed',
  'action:success',
  'action:failed',
  'upsell:accepted',
  'upsell-selector:item-selected',
  'upsell:quantity-changed',
  'upsell:option-selected',
  'message:displayed',
  'payment:tokenized',
  'payment:error',
  'checkout:express-completed',
  'checkout:express-failed',
  'express-checkout:initialized',
  'express-checkout:error',
  'express-checkout:started',
  'express-checkout:failed',
  'express-checkout:completed',
  'express-checkout:redirect-missing',
  'address:autocomplete-filled',
  'address:location-fields-shown',
  'checkout:location-fields-shown',
  'checkout:billing-location-fields-shown',
  'upsell:initialized',
  'upsell:adding',
  'upsell:added',
  'upsell:error',
  'accordion:toggled',
  'accordion:opened',
  'accordion:closed',
  'upsell:skipped',
  'upsell:viewed',
  'exit-intent:shown',
  'exit-intent:clicked',
  'exit-intent:dismissed',
  'exit-intent:closed',
  'exit-intent:action',
  'fomo:shown',
];

// Events to filter out (noise events)
const FILTERED_EVENTS = [
  'dataLayer.push',
  'gtm.dom',
  'gtm.js',
  'gtm.load',
  'gtm.click',
  'gtm.linkClick',
  'gtm.scrollDepth',
  'gtm.timer',
  'gtm.historyChange',
  'gtm.video',
];

/** What the capture hooks need from their owning `EventTimelinePanel` instance. */
export interface EventCaptureHost {
  readonly isRecording: boolean;
  events: TimelineEvent[];
  readonly maxEvents: number;
  updateTimeout: ReturnType<typeof setTimeout> | null;
  readonly eventBus: EventBus;
  readonly panelId: string;
  formatRelativeTime(timestamp: number): string;
  saveEvents(): void;
}

function addEvent(
  ctx: EventCaptureHost,
  eventData: Partial<TimelineEvent>
): void {
  // Filter out noise events
  if (FILTERED_EVENTS.includes(eventData.name || '')) {
    return;
  }

  const now = Date.now();
  const event: TimelineEvent = {
    id: `event_${now}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: eventData.timestamp || now,
    type: eventData.type || 'internal',
    name: eventData.name || 'unknown',
    data: eventData.data || {},
    source: eventData.source || 'Unknown',
    relativeTime: ctx.formatRelativeTime(eventData.timestamp || now),
    isInternal: eventData.isInternal || false,
  };

  ctx.events.unshift(event); // Add to beginning for chronological order

  // Limit event history
  if (ctx.events.length > ctx.maxEvents) {
    ctx.events = ctx.events.slice(0, ctx.maxEvents);
  }

  // Save events to localStorage
  ctx.saveEvents();

  // Trigger content update for real-time updates
  if (typeof document !== 'undefined') {
    // Debounce updates to avoid too frequent re-renders
    if (ctx.updateTimeout) {
      clearTimeout(ctx.updateTimeout);
    }

    ctx.updateTimeout = setTimeout(() => {
      // Dispatch event to update content
      document.dispatchEvent(
        new CustomEvent('debug:event-added', {
          detail: {
            panelId: ctx.panelId,
            event: event,
          },
        })
      );
    }, 100); // Small delay to batch rapid events
  }
}

export function watchDataLayer(ctx: EventCaptureHost): void {
  if (typeof window === 'undefined') return;

  // Initialize dataLayer if it doesn't exist
  window.dataLayer = window.dataLayer || [];

  // Store original push method
  const originalPush = window.dataLayer.push;

  // Override push to capture events
  window.dataLayer.push = (...args: any[]) => {
    if (ctx.isRecording) {
      args.forEach(event => {
        // Determine source based on event content
        let source = 'GTM DataLayer';
        let isInternal = false;

        if (event.event && event.event.startsWith('gtm_')) {
          source = 'GTM Internal';
          isInternal = true;
        } else if (event.timestamp || event.event_context) {
          source = 'Analytics Manager';
        }

        // Check if it's an internal SDK event
        if (event.event && INTERNAL_EVENT_PATTERNS.includes(event.event)) {
          isInternal = true;
        }

        addEvent(ctx, {
          type: 'dataLayer',
          name: event.event || 'dataLayer.push',
          data: event,
          source,
          isInternal,
        });
      });
    }
    return originalPush.apply(window.dataLayer, args);
  };

  // Watch for existing events
  if (window.dataLayer.length > 0) {
    window.dataLayer.forEach(event => {
      if (typeof event === 'object' && event.event) {
        addEvent(ctx, {
          type: 'dataLayer',
          name: event.event,
          data: event,
          source: 'GTM DataLayer (Historical)',
          isInternal: INTERNAL_EVENT_PATTERNS.includes(event.event),
        });
      }
    });
  }
}

export function watchInternalEvents(ctx: EventCaptureHost): void {
  // Subscribe to all EventBus events
  const eventHandler = (eventName: string, data: any) => {
    // Skip error events to prevent infinite loops
    if (eventName.includes('error') || eventName.includes('Error')) {
      return;
    }

    if (ctx.isRecording) {
      addEvent(ctx, {
        type: 'internal',
        name: eventName,
        data: data,
        source: 'SDK EventBus',
        isInternal: true,
      });
    }
  };

  // Hook into EventBus emit method
  const originalEmit = ctx.eventBus.emit.bind(ctx.eventBus);
  (ctx.eventBus as any).emit = (event: string, data?: any) => {
    eventHandler(event, data);
    return originalEmit(event as any, data);
  };
}

export function watchDOMEvents(getHost: () => EventCaptureHost | null): void {
  if (typeof window === 'undefined') return;

  const eventsToWatch = [
    'click',
    'submit',
    'change',
    'focus',
    'blur',
    'scroll',
    'resize',
    'load',
    // Removed 'error' to prevent infinite loops
  ];

  // Events to ignore (debug panel internal events and Webflow events)
  const eventsToIgnore = [
    'debug:event-added',
    'debug:update-content',
    'debug:panel-switched',
    // Webflow interaction events
    'ix2-animation-started',
    'ix2-animation-stopped',
    'ix2-animation-completed',
    'ix2-animation-paused',
    'ix2-animation-resumed',
    'ix2-animation',
    'ix2-element-hover',
    'ix2-element-unhover',
    'ix2-element-click',
    'ix2-page-start',
    'ix2-page-finish',
    'ix2-scroll',
    'ix2-tabs-change',
    'ix2-slider-change',
    'ix2-dropdown-open',
    'ix2-dropdown-close',
    // Other Webflow events
    'w-close',
    'w-open',
    'w-tab-active',
    'w-tab-inactive',
    'w-slider-move',
    'w-dropdown-toggle',
  ];

  // Override dispatchEvent for CustomEvents
  const originalDispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (event: Event) {
    // Skip error events, debug events, and Webflow events to prevent infinite loops and noise
    if (
      event instanceof CustomEvent &&
      !eventsToWatch.includes(event.type) &&
      !eventsToIgnore.includes(event.type) &&
      !event.type.startsWith('debug:') &&
      !event.type.startsWith('ix2-') &&
      !event.type.startsWith('w-') &&
      !event.type.includes('error') &&
      !event.type.includes('Error')
    ) {
      const self = getHost();
      if (self && self.isRecording) {
        try {
          addEvent(self, {
            type: 'dom',
            name: event.type,
            data: event.detail || {},
            source: 'DOM CustomEvent',
            isInternal: INTERNAL_EVENT_PATTERNS.includes(event.type),
          });
        } catch (e) {
          // Silently ignore errors in event tracking to prevent loops
        }
      }
    }
    return originalDispatch.call(this, event);
  };
}

export function watchPerformanceEvents(ctx: EventCaptureHost): void {
  if (typeof window === 'undefined' || !window.performance) return;

  // Watch performance marks
  const originalMark = performance.mark;
  performance.mark = function (name: string) {
    const result = originalMark.call(performance, name);
    if (ctx.isRecording) {
      addEvent(ctx, {
        type: 'performance',
        name: `mark: ${name}`,
        data: { markName: name },
        source: 'Performance API',
        isInternal: true,
      });
    }
    return result;
  };

  // Watch performance measures
  const originalMeasure = performance.measure;
  performance.measure = function (
    name: string,
    startMark?: string,
    endMark?: string
  ) {
    const result = originalMeasure.call(
      performance,
      name,
      startMark,
      endMark
    );
    if (ctx.isRecording) {
      addEvent(ctx, {
        type: 'performance',
        name: `measure: ${name}`,
        data: { measureName: name, startMark, endMark },
        source: 'Performance API',
        isInternal: true,
      });
    }
    return result;
  };
}
