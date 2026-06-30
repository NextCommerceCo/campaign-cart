/**
 * Event Timeline Panel - Advanced debugging for events and dataLayer
 *
 * Provides real-time monitoring of:
 * - GTM dataLayer events
 * - Internal SDK events
 * - DOM CustomEvents
 * - Performance timeline
 */

import { DebugPanel, PanelAction } from '../DebugPanels';
import { EventBus } from '../../events';
import { RawDataHelper } from './RawDataHelper';
import {
  validateDataLayerEvent,
  auditDataLayerEvent,
  worstLevel,
  type EventValidationIssue,
  type EventCheck,
  type CheckStatus,
} from './EcommerceEventValidator';
import {
  analyticsDebug,
  type DeliveryRecord,
  type DeliveryStatus,
  type ProviderDebugInfo,
} from '../../analytics/debug/AnalyticsDebugTracker';
import { lucide, type IconName } from '../icons';

/** Which detail tab is shown in the event modal. */
type DetailTab = 'payload' | 'delivery' | 'validation';

const DELIVERY_STATUS_ICON: Record<DeliveryStatus, IconName> = {
  sent: 'check-circle',
  blocked: 'ban',
  failed: 'x-circle',
  pending: 'clock',
};

const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, string> = {
  sent: '#1f9d55',
  blocked: '#9aa0a6',
  failed: '#e3342f',
  pending: '#d6a700',
};

interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'dataLayer' | 'internal' | 'dom' | 'performance';
  name: string;
  data: any;
  source: string;
  duration?: number;
  relativeTime: string;
  isInternal?: boolean;
}

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

export class EventTimelinePanel implements DebugPanel {
  id = 'event-timeline';
  title = 'Analytics & Events';
  icon = lucide('activity');

  private events: TimelineEvent[] = [];
  private maxEvents = 1000;
  private isRecording = true;
  private showInternalEvents = false;
  /**
   * Which view is active:
   *  - `analytics`: only GTM dataLayer events (names starting `dl_`), with
   *    ecommerce columns (value, items) and provider delivery — the marketing
   *    signal most developers care about.
   *  - `events`: every captured event (dataLayer, internal SDK, DOM,
   *    performance) for low-level debugging.
   * Persisted across reloads.
   */
  private view: 'analytics' | 'events' = 'analytics';
  private updateTimeout: NodeJS.Timeout | null = null;
  private saveTimeout: NodeJS.Timeout | null = null;
  private selectedEventId: string | null = null;
  /** Active tab in the event detail modal. */
  private selectedDetailTab: DetailTab = 'payload';
  /** Delivery-record ids whose per-provider payload is expanded in the modal. */
  private expandedDeliveries = new Set<string>();
  /** Active provider sub-tab in the modal's Delivery tab. null = "All". */
  private selectedDeliveryProvider: string | null = null;
  /** Provider-name filter for the Delivery tab sub-tabs (many-provider case). */
  private deliveryProviderSearch = '';

  // ── Timeline filters (transient — reset on reload) ──
  /** Case-insensitive substring match on event name / source. */
  private searchTerm = '';
  /** When set, show only events a given provider handled. */
  private providerFilter: string | null = null;
  /** When true, show only events with a delivery problem or validation issue. */
  private issuesOnly = false;
  /** Whether the right-side filter drawer is open. */
  private filterDrawerOpen = false;

  private eventBus = EventBus.getInstance();

  // Storage keys
  private static readonly EVENTS_STORAGE_KEY = 'debug-events-history';
  private static readonly SHOW_INTERNAL_KEY = 'debug-events-show-internal';
  private static readonly VIEW_KEY = 'debug-events-view';
  private static readonly MAX_STORED_EVENTS = 100; // Reduced from 500 to keep localStorage smaller
  private static readonly STORAGE_EXPIRY_KEY = 'debug-events-expiry';
  private static readonly STORAGE_EXPIRY_HOURS = 2; // Clear after 2 hours

  constructor() {
    // Check if debug mode is actually enabled before initializing
    const urlParams = new URLSearchParams(window.location.search);
    const windowConfig = (window as any).nextConfig;
    const isDebugMode =
      urlParams.get('debugger') === 'true' ||
      urlParams.get('debug') === 'true' ||
      windowConfig?.debugger === true ||
      windowConfig?.debug === true;

    if (isDebugMode) {
      this.loadSavedState();
      this.initializeEventWatching();
      EventTimelinePanel.instance = this;
    }
  }

  private loadSavedState(): void {
    // Check if stored events have expired
    this.checkAndCleanExpiredStorage();

    // Load show internal events preference
    const savedShowInternal = localStorage.getItem(
      EventTimelinePanel.SHOW_INTERNAL_KEY
    );
    if (savedShowInternal !== null) {
      this.showInternalEvents = savedShowInternal === 'true';
    }

    // Load active view (defaults to 'analytics').
    const savedView = localStorage.getItem(EventTimelinePanel.VIEW_KEY);
    if (savedView === 'analytics' || savedView === 'events') {
      this.view = savedView;
    }

    // Load saved events
    try {
      const savedEvents = localStorage.getItem(
        EventTimelinePanel.EVENTS_STORAGE_KEY
      );
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        if (Array.isArray(parsed)) {
          // Only load recent events (last hour)
          const oneHourAgo = Date.now() - 60 * 60 * 1000;
          this.events = parsed
            .filter(event => event.timestamp > oneHourAgo)
            .slice(0, EventTimelinePanel.MAX_STORED_EVENTS)
            .map(event => ({
              ...event,
              relativeTime: this.formatRelativeTime(event.timestamp),
            }));
        }
      }
    } catch (error) {
      console.error('Failed to load saved events:', error);
      // Clear corrupted data
      localStorage.removeItem(EventTimelinePanel.EVENTS_STORAGE_KEY);
    }
  }

  private checkAndCleanExpiredStorage(): void {
    try {
      const expiryTime = localStorage.getItem(
        EventTimelinePanel.STORAGE_EXPIRY_KEY
      );
      const now = Date.now();

      if (!expiryTime || parseInt(expiryTime) < now) {
        // Clear expired events
        localStorage.removeItem(EventTimelinePanel.EVENTS_STORAGE_KEY);

        // Set new expiry time
        const newExpiry =
          now + EventTimelinePanel.STORAGE_EXPIRY_HOURS * 60 * 60 * 1000;
        localStorage.setItem(
          EventTimelinePanel.STORAGE_EXPIRY_KEY,
          newExpiry.toString()
        );
      }
    } catch (error) {
      console.error('Failed to check storage expiry:', error);
    }
  }

  private saveEvents(): void {
    // Debounce saves to avoid too many localStorage writes
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      try {
        // Filter out old events (only keep last hour) and limit count
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const recentEvents = this.events
          .filter(event => event.timestamp > oneHourAgo)
          .slice(0, EventTimelinePanel.MAX_STORED_EVENTS);

        // Only save if we have events
        if (recentEvents.length > 0) {
          // Simplify event data to reduce size
          const simplifiedEvents = recentEvents.map(event => ({
            id: event.id,
            timestamp: event.timestamp,
            type: event.type,
            name: event.name,
            // Limit data size to first 200 chars if it's a string
            data:
              typeof event.data === 'string' && event.data.length > 200
                ? event.data.substring(0, 200) + '...'
                : event.data,
            source: event.source,
            isInternal: event.isInternal,
          }));

          const serialized = this.safeStringify(simplifiedEvents);

          // Check size before saving (localStorage typically has 5-10MB limit)
          if (serialized.length > 500000) {
            // 500KB limit per key
            // If still too large, save only half the events
            const halfEvents = simplifiedEvents.slice(
              0,
              Math.floor(simplifiedEvents.length / 2)
            );
            localStorage.setItem(
              EventTimelinePanel.EVENTS_STORAGE_KEY,
              this.safeStringify(halfEvents)
            );
          } else {
            localStorage.setItem(
              EventTimelinePanel.EVENTS_STORAGE_KEY,
              serialized
            );
          }
        }

        // Update expiry if not set
        if (!localStorage.getItem(EventTimelinePanel.STORAGE_EXPIRY_KEY)) {
          const expiry =
            Date.now() +
            EventTimelinePanel.STORAGE_EXPIRY_HOURS * 60 * 60 * 1000;
          localStorage.setItem(
            EventTimelinePanel.STORAGE_EXPIRY_KEY,
            expiry.toString()
          );
        }
      } catch (error) {
        console.error('Failed to save events:', error);
        // If we hit quota exceeded, clear the events
        if (
          error instanceof DOMException &&
          error.name === 'QuotaExceededError'
        ) {
          localStorage.removeItem(EventTimelinePanel.EVENTS_STORAGE_KEY);
        }
      }
    }, 500); // Debounce for 500ms
  }

  private safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (_key, value) => {
      // Handle circular references
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular Reference]';
        }
        seen.add(value);
      }

      // Filter out DOM elements and Window objects
      if (value instanceof Window) return '[Window]';
      if (value instanceof Document) return '[Document]';
      if (value instanceof HTMLElement) return '[HTMLElement]';
      if (value instanceof Node) return '[Node]';
      if (value instanceof Event) {
        // Extract safe properties from Event objects
        return {
          type: value.type,
          target: value.target ? '[EventTarget]' : undefined,
          timeStamp: value.timeStamp,
          bubbles: value.bubbles,
          cancelable: value.cancelable,
        };
      }

      // Filter out functions
      if (typeof value === 'function') return '[Function]';

      return value;
    });
  }

  public toggleInternalEvents(): void {
    this.showInternalEvents = !this.showInternalEvents;
    localStorage.setItem(
      EventTimelinePanel.SHOW_INTERNAL_KEY,
      String(this.showInternalEvents)
    );
  }

  public setView(view: 'analytics' | 'events'): void {
    this.view = view;
    localStorage.setItem(EventTimelinePanel.VIEW_KEY, view);
  }

  private initializeEventWatching(): void {
    this.watchDataLayer();
    this.watchInternalEvents();
    this.watchDOMEvents();
    this.watchPerformanceEvents();
  }

  private watchDataLayer(): void {
    if (typeof window === 'undefined') return;

    // Initialize dataLayer if it doesn't exist
    window.dataLayer = window.dataLayer || [];

    // Store original push method
    const originalPush = window.dataLayer.push;

    // Override push to capture events
    window.dataLayer.push = (...args: any[]) => {
      if (this.isRecording) {
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

          this.addEvent({
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
          this.addEvent({
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

  private watchInternalEvents(): void {
    // Subscribe to all EventBus events
    const eventHandler = (eventName: string, data: any) => {
      // Skip error events to prevent infinite loops
      if (eventName.includes('error') || eventName.includes('Error')) {
        return;
      }

      if (this.isRecording) {
        this.addEvent({
          type: 'internal',
          name: eventName,
          data: data,
          source: 'SDK EventBus',
          isInternal: true,
        });
      }
    };

    // Hook into EventBus emit method
    const originalEmit = this.eventBus.emit.bind(this.eventBus);
    (this.eventBus as any).emit = (event: string, data?: any) => {
      eventHandler(event, data);
      return originalEmit(event as any, data);
    };
  }

  private watchDOMEvents(): void {
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
        const self = EventTimelinePanel.getInstance();
        if (self && self.isRecording) {
          try {
            self.addEvent({
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

  private static instance: EventTimelinePanel | null = null;

  private static getInstance(): EventTimelinePanel | null {
    return EventTimelinePanel.instance;
  }

  private watchPerformanceEvents(): void {
    if (typeof window === 'undefined' || !window.performance) return;

    const self = this;

    // Watch performance marks
    const originalMark = performance.mark;
    performance.mark = function (name: string) {
      const result = originalMark.call(performance, name);
      if (self.isRecording) {
        self.addEvent({
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
      if (self.isRecording) {
        self.addEvent({
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

  private addEvent(eventData: Partial<TimelineEvent>): void {
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
      relativeTime: this.formatRelativeTime(eventData.timestamp || now),
      isInternal: eventData.isInternal || false,
    };

    this.events.unshift(event); // Add to beginning for chronological order

    // Limit event history
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    // Save events to localStorage
    this.saveEvents();

    // Trigger content update for real-time updates
    if (typeof document !== 'undefined') {
      // Debounce updates to avoid too frequent re-renders
      if (this.updateTimeout) {
        clearTimeout(this.updateTimeout);
      }

      this.updateTimeout = setTimeout(() => {
        // Dispatch event to update content
        document.dispatchEvent(
          new CustomEvent('debug:event-added', {
            detail: {
              panelId: this.id,
              event: event,
            },
          })
        );
      }, 100); // Small delay to batch rapid events
    }
  }

  private formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s ago`;
    if (seconds > 0) return `${seconds}s ago`;
    return 'just now';
  }

  private formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const time = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  }

  private getFilteredEvents(): TimelineEvent[] {
    // The view sets the baseline population: Analytics = dataLayer `dl_*` only;
    // Events = everything (with the internal-events toggle as a secondary trim).
    let events: TimelineEvent[];
    if (this.view === 'analytics') {
      events = this.events.filter(event => event.name.startsWith('dl_'));
    } else if (this.showInternalEvents) {
      events = this.events;
    } else {
      events = this.events.filter(event => !event.isInternal);
    }

    const term = this.searchTerm.trim().toLowerCase();
    if (term) {
      events = events.filter(
        e =>
          e.name.toLowerCase().includes(term) ||
          e.source.toLowerCase().includes(term)
      );
    }

    if (this.providerFilter) {
      events = events.filter(e =>
        this.getDeliveriesForEvent(e).some(
          d => d.provider === this.providerFilter
        )
      );
    }

    if (this.issuesOnly) {
      events = events.filter(e => this.eventHasIssues(e));
    }

    return events;
  }

  /** True when an event failed/was blocked by a provider, or fails validation. */
  private eventHasIssues(event: TimelineEvent): boolean {
    const deliveryProblem = this.getDeliveriesForEvent(event).some(
      d => d.status === 'failed' || d.status === 'blocked'
    );
    return deliveryProblem || Boolean(worstLevel(this.getEventIssues(event)));
  }

  /** True when any timeline filter (search/provider/issues) is active. */
  private hasActiveFilters(): boolean {
    return this.activeFilterCount() > 0;
  }

  /** Number of active narrowing filters — drives the filter button badge. */
  private activeFilterCount(): number {
    let n = 0;
    if (this.searchTerm.trim() !== '') n += 1;
    if (this.providerFilter !== null) n += 1;
    if (this.issuesOnly) n += 1;
    return n;
  }

  private getEventTypeColor(type: string): string {
    const colors = {
      dataLayer: '#4CAF50',
      internal: '#2196F3',
      dom: '#FF9800',
      performance: '#9C27B0',
    };
    return colors[type as keyof typeof colors] || '#666';
  }

  private getEventTypeBadge(type: string): string {
    const badges = {
      dataLayer: 'GTM',
      internal: 'SDK',
      dom: 'DOM',
      performance: 'PERF',
    };
    return badges[type as keyof typeof badges] || type.toUpperCase();
  }

  /** Validation issues for an event's ecommerce payload (dataLayer only). */
  private getEventIssues(event: TimelineEvent): EventValidationIssue[] {
    if (event.type !== 'dataLayer') return [];
    return validateDataLayerEvent(event.data);
  }

  /** Full validation checklist (pass + fail + skipped) for the detail view. */
  private getEventChecks(event: TimelineEvent): EventCheck[] {
    if (event.type !== 'dataLayer') return [];
    return auditDataLayerEvent(event.data);
  }

  /** Why a given event has no checklist — shown in the empty Validation tab. */
  private noValidationReason(event: TimelineEvent): string {
    if (event.type !== 'dataLayer') {
      return `Validation applies to dataLayer (<code>dl_</code>) events. This is a ${event.type} event — nothing to validate.`;
    }
    return `Not a <code>dl_</code> event, so there is no dataLayer contract to validate.`;
  }

  private renderValidationBadge(event: TimelineEvent): string {
    const level = worstLevel(this.getEventIssues(event));
    if (!level) return '';
    const isError = level === 'error';
    const cls = isError
      ? 'validation-badge validation-badge-error'
      : 'validation-badge validation-badge-warning';
    const ico = lucide(isError ? 'x-circle' : 'alert', { size: 12 });
    return `<span class="${cls}">${ico} ${isError ? 'INVALID' : 'CHECK'}</span>`;
  }

  private static readonly CHECK_ICON: Record<CheckStatus, IconName> = {
    pass: 'check-circle',
    warning: 'alert',
    error: 'x-circle',
    skipped: 'minus-circle',
  };

  private renderCheckRow(check: EventCheck): string {
    const icon = EventTimelinePanel.CHECK_ICON[check.status];
    return `
      <li class="event-check event-check-${check.status}">
        <span class="event-check-status">${lucide(icon, { size: 14 })}</span>
        <div class="event-check-body">
          <div class="event-check-head">
            <span class="event-check-label">${this.escapeHtml(check.label)}</span>
            <code class="event-check-field">${this.escapeHtml(check.field)}</code>
          </div>
          <div class="event-check-detail">${this.escapeHtml(check.detail)}</div>
        </div>
      </li>`;
  }

  private renderValidationSection(event: TimelineEvent): string {
    const checks = this.getEventChecks(event);
    if (checks.length === 0) return '';

    const errors = checks.filter(c => c.status === 'error').length;
    const warnings = checks.filter(c => c.status === 'warning').length;
    const passed = checks.filter(c => c.status === 'pass').length;
    const checked = checks.filter(c => c.status !== 'skipped').length;

    const summaryClass = errors
      ? 'event-validation-fail'
      : warnings
        ? 'event-validation-warn'
        : 'event-validation-ok';
    const summaryIcon = errors
      ? 'x-circle'
      : warnings
        ? 'alert'
        : 'check-circle';
    const summaryText = errors
      ? `${errors} failed, ${warnings} warning${warnings === 1 ? '' : 's'} of ${checked} checks`
      : warnings
        ? `${warnings} warning${warnings === 1 ? '' : 's'} of ${checked} checks`
        : `All ${passed} checks passed`;

    const rows = checks.map(c => this.renderCheckRow(c)).join('');
    return `
      <div class="event-validation ${summaryClass}">
        <div class="event-validation-summary">
          <span class="event-validation-icon">${lucide(summaryIcon, { size: 14 })}</span>
          <span class="event-validation-summary-text">${summaryText}</span>
        </div>
        <ul class="event-check-list">${rows}</ul>
      </div>`;
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Provider delivery correlation ──────────────────────────────────────────
  // dataLayer events carry `event_id`; provider delivery records carry the same
  // id, so a timeline event can be joined to "who received it".

  private getEventId(event: TimelineEvent): string | undefined {
    const id = event.data?.event_id;
    return typeof id === 'string' ? id : undefined;
  }

  /** Delivery records that belong to this timeline event (matched by event_id). */
  private getDeliveriesForEvent(event: TimelineEvent): DeliveryRecord[] {
    const eventId = this.getEventId(event);
    if (!eventId) return [];
    return analyticsDebug
      .getDeliveries()
      .filter(record => record.eventId === eventId);
  }

  private formatDeliveryDuration(ms?: number): string {
    if (ms === undefined) return '';
    return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
  }

  /**
   * Per-provider delivery chips shown on an event row — one chip per provider
   * that handled the event, tinted by its delivery status (sent/failed/…), so
   * you can see at a glance who received it without opening the modal.
   */
  private renderDeliverySummary(event: TimelineEvent): string {
    const deliveries = this.getDeliveriesForEvent(event);
    if (deliveries.length === 0) return '';

    const chips = deliveries
      .map(d => {
        const color = DELIVERY_STATUS_COLOR[d.status];
        const duration = this.formatDeliveryDuration(d.durationMs);
        const title =
          `${d.provider}: ${d.status}` +
          (duration ? ` · ${duration}` : '') +
          (d.error ? ` · ${d.error}` : d.detail ? ` · ${d.detail}` : '');
        // Lead with the provider's brand glyph when it has one; otherwise the
        // status icon. Either way the chip colour still encodes delivery status.
        const brand = this.providerIcon(d.provider);
        const glyph = brand
          ? lucide(brand, { size: 11 })
          : lucide(DELIVERY_STATUS_ICON[d.status], { size: 11 });
        return `<span class="delivery-chip" style="--chip:${color}" title="${this.escapeAttr(title)}">${glyph}<span class="delivery-chip-name">${this.escapeHtml(this.providerAbbrev(d.provider))}</span></span>`;
      })
      .join('');

    return `<span class="delivery-summary" title="Provider delivery">${chips}</span>`;
  }

  /**
   * Short provider label for compact row chips (Facebook → FB, RudderStack → RS).
   * Falls back to the capital-letter acronym, then the first 3 characters.
   */
  private providerAbbrev(name: string): string {
    const known: Record<string, string> = {
      NextCampaign: 'NEXT',
      GTM: 'GTM',
      Facebook: 'FB',
      RudderStack: 'RS',
    };
    if (known[name]) return known[name];
    const caps = name.replace(/[^A-Z]/g, '');
    return (caps.length >= 2 ? caps : name.slice(0, 3)).toUpperCase();
  }

  /**
   * Brand icon for a provider, when one exists (GTM → Google, Facebook → its
   * logo). Returns null for providers without a brand glyph (e.g. RudderStack),
   * so callers fall back to a generic/status icon.
   */
  private providerIcon(name: string): IconName | null {
    const map: Record<string, IconName> = {
      // NextCampaign is the SDK's own provider — its "N" brand mark.
      NextCampaign: 'next',
      GTM: 'gtm',
      Facebook: 'facebook',
    };
    return map[name] ?? null;
  }

  /** Per-provider delivery breakdown for the modal's Delivery tab. */
  private renderDeliveryDetail(event: TimelineEvent): string {
    const deliveries = this.getDeliveriesForEvent(event);
    if (deliveries.length === 0) {
      return `
        <div class="delivery-empty">
          No provider deliveries recorded for this event.
          ${
            this.getEventId(event)
              ? 'Providers may have been disabled, or this event is not dispatched to the provider layer.'
              : 'This event has no <code>event_id</code>, so it cannot be matched to a provider delivery.'
          }
        </div>`;
    }

    // Provider sub-tabs derived from this event's own deliveries. Selecting one
    // narrows the list to that provider's record + dispatched payload.
    const providers = Array.from(new Set(deliveries.map(d => d.provider)));
    const search = this.deliveryProviderSearch.trim().toLowerCase();
    const showSearch = providers.length > 4;
    const visibleProviders =
      showSearch && search
        ? providers.filter(p => p.toLowerCase().includes(search))
        : providers;

    // The remembered provider only applies if this event was delivered to it.
    const selected =
      this.selectedDeliveryProvider &&
      providers.includes(this.selectedDeliveryProvider)
        ? this.selectedDeliveryProvider
        : null;

    const shown = selected
      ? deliveries.filter(d => d.provider === selected)
      : deliveries.filter(d => visibleProviders.includes(d.provider));

    const subTab = (
      id: string | null,
      label: string,
      count: number
    ): string => {
      const isActive = selected === id || (id === null && selected === null);
      const arg = id === null ? 'null' : `'${this.escapeAttr(id)}'`;
      return `
        <button class="delivery-subtab ${isActive ? 'active' : ''}"
                onclick="window.eventTimelinePanel_setDeliveryProvider(${arg})">
          ${this.escapeHtml(label)}<span class="delivery-subtab-count">${count}</span>
        </button>`;
    };

    const tabs =
      subTab(null, 'All', deliveries.length) +
      visibleProviders
        .map(p =>
          subTab(p, p, deliveries.filter(d => d.provider === p).length)
        )
        .join('');

    const searchBox = showSearch
      ? `<input class="delivery-subtab-search" type="text"
                placeholder="Filter providers…"
                value="${this.escapeAttr(this.deliveryProviderSearch)}"
                oninput="window.eventTimelinePanel_searchDeliveryProvider(this.value)" />`
      : '';

    const rows = shown.map(record => this.renderDeliveryRow(record)).join('');

    return `
      <div class="delivery-subtabs">
        <div class="delivery-subtab-strip">${tabs}</div>
        ${searchBox}
      </div>
      <div class="delivery-list">${rows}</div>`;
  }

  /** A single provider's delivery row + its expandable dispatched payload. */
  private renderDeliveryRow(record: DeliveryRecord): string {
    const note = record.error
      ? `<span class="delivery-note delivery-note-error">${this.escapeHtml(record.error)}</span>`
      : record.detail
        ? `<span class="delivery-note">${this.escapeHtml(record.detail)}</span>`
        : '';
    const duration = this.formatDeliveryDuration(record.durationMs);

    // Raw data this provider handled: the transformed payload it dispatched
    // when reported, otherwise the original event it received.
    const payload =
      record.sentPayload !== undefined ? record.sentPayload : record.payload;
    const canExpand = payload !== undefined;
    const expanded = this.expandedDeliveries.has(record.id);
    const payloadLabel =
      record.sentPayload !== undefined
        ? `Payload dispatched to ${this.escapeHtml(record.provider)}`
        : 'Original event received (provider reported no transformed payload)';

    return `
      <div class="delivery-item">
        <div class="delivery-row ${canExpand ? 'delivery-row-clickable' : ''}"
             ${canExpand ? `onclick="window.eventTimelinePanel_toggleDelivery('${this.escapeAttr(record.id)}')"` : ''}>
          <span class="delivery-provider">
            ${canExpand ? `<span class="delivery-caret">${expanded ? '▾' : '▸'}</span>` : '<span class="delivery-caret-spacer"></span>'}
            ${this.escapeHtml(record.provider)}
          </span>
          <span class="delivery-right">
            ${note}
            ${duration ? `<span class="delivery-duration">${duration}</span>` : ''}
            <span class="delivery-status" style="color:${DELIVERY_STATUS_COLOR[record.status]}">
              ${lucide(DELIVERY_STATUS_ICON[record.status], { size: 14 })} ${record.status}
            </span>
          </span>
        </div>
        ${
          expanded && canExpand
            ? `
          <div class="delivery-payload">
            <div class="delivery-payload-label">${payloadLabel}</div>
            <div class="delivery-payload-view">${RawDataHelper.generateRawDataContent(payload)}</div>
          </div>`
            : ''
        }
      </div>`;
  }

  /** Tabbed detail body for the event modal: Payload / Delivery / Validation. */
  private renderDetailTabs(event: TimelineEvent): string {
    const deliveryCount = this.getDeliveriesForEvent(event).length;
    const issues = this.getEventIssues(event);
    const issueLevel = worstLevel(issues);

    const deliveryBadge =
      deliveryCount > 0
        ? `<span class="tab-count">${deliveryCount}</span>`
        : '';
    const validationBadge = issueLevel
      ? `<span class="tab-count tab-count-${issueLevel}">${issues.length}</span>`
      : '';

    const tab = (id: DetailTab, label: string, badge = ''): string => `
      <button
        class="detail-tab ${this.selectedDetailTab === id ? 'active' : ''}"
        onclick="window.eventTimelinePanel_setTab('${id}')">
        ${label}${badge}
      </button>`;

    let body = '';
    if (this.selectedDetailTab === 'delivery') {
      body = this.renderDeliveryDetail(event);
    } else if (this.selectedDetailTab === 'validation') {
      body =
        this.renderValidationSection(event) ||
        `<div class="delivery-empty">${this.noValidationReason(event)}</div>`;
    } else {
      body = `<div class="event-modal-data-content">${RawDataHelper.generateRawDataContent(event.data)}</div>`;
    }

    return `
      <div class="detail-tabs">
        ${tab('payload', 'Payload')}
        ${tab('delivery', 'Delivery', deliveryBadge)}
        ${tab('validation', 'Validation', validationBadge)}
      </div>
      <div class="detail-tab-body detail-tab-body-${this.selectedDetailTab}">${body}</div>`;
  }

  /** Top strip: which analytics providers are registered and ready. */
  private renderProviderStrip(): string {
    const providers = analyticsDebug.getProviders();
    if (providers.length === 0) {
      return `
        <div class="provider-strip provider-strip-empty">
          No analytics providers registered (analytics disabled or not yet initialized).
        </div>`;
    }

    const chips = providers
      .map((p: ProviderDebugInfo) => {
        const status = !p.enabled
          ? lucide('pause', { size: 13, style: 'color:#9aa0a6' })
          : p.ready
            ? lucide('check-circle', { size: 13, style: 'color:#1f9d55' })
            : lucide('clock', { size: 13, style: 'color:#d6a700' });
        // Lead with the provider's brand glyph when it has one; the ready/
        // disabled state stays as a trailing status icon.
        const brand = this.providerIcon(p.name);
        const brandIcon = brand
          ? `<span class="provider-chip-brand">${lucide(brand, { size: 13 })}</span>`
          : '';
        const state = !p.enabled ? 'disabled' : p.ready ? 'ready' : 'not ready';
        const blocked =
          p.blockedEvents.length > 0
            ? ` · blocks ${p.blockedEvents.length}`
            : '';
        const active = this.providerFilter === p.name ? ' active' : '';
        const hint = `${p.name}: ${state}${blocked} · click to filter timeline`;
        return `
          <button
            class="provider-chip${active}"
            title="${this.escapeHtml(hint)}"
            onclick="window.eventTimelinePanel_filterProvider('${this.escapeAttr(p.name)}')">
            ${brandIcon}
            <span class="provider-chip-name">${this.escapeHtml(p.name)}</span>
            <span class="provider-chip-icon">${status}</span>
          </button>`;
      })
      .join('');

    return `
      <div class="provider-strip">
        <span class="provider-strip-label">Providers</span>
        ${chips}
      </div>`;
  }

  /** Empty-state message, aware of the dl_-only default filter. */
  private renderEmptyState(): string {
    if (this.events.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">${lucide('inbox', { size: 44 })}</div>
          <div class="empty-state-text">No events captured yet</div>
        </div>`;
    }

    // Analytics view shows only dl_ events; surface non-dl_ events captured.
    const hiddenByView =
      this.view === 'analytics' &&
      this.events.some(e => !e.name.startsWith('dl_'));
    if (hiddenByView && !this.hasActiveFilters()) {
      const other = this.events.filter(e => !e.name.startsWith('dl_')).length;
      return `
        <div class="empty-state">
          <div class="empty-state-icon">${lucide('inbox', { size: 44 })}</div>
          <div class="empty-state-text">No <code>dl_</code> events yet</div>
          <div class="empty-state-sub">${other} non-dl_ event${other === 1 ? '' : 's'} captured — switch to the Events view to see them.</div>
          <button class="filter-clear" onclick="window.eventTimelinePanel_setView('events')">Go to Events</button>
        </div>`;
    }

    return `
      <div class="empty-state">
        <div class="empty-state-icon">${lucide('search-x', { size: 44 })}</div>
        <div class="empty-state-text">No events match the current filters</div>
        ${
          this.hasActiveFilters()
            ? `
          <button class="filter-clear" onclick="window.eventTimelinePanel_clearFilters()">
            Clear filters
          </button>`
            : ''
        }
      </div>`;
  }

  /** Segmented control switching between the Analytics and Events views. */
  private renderViewTabs(): string {
    const dlCount = this.events.filter(e => e.name.startsWith('dl_')).length;
    const allCount = this.events.length;
    const tab = (
      id: 'analytics' | 'events',
      label: string,
      ico: IconName,
      count: number
    ): string => `
      <button class="view-tab ${this.view === id ? 'active' : ''}"
              onclick="window.eventTimelinePanel_setView('${id}')">
        ${lucide(ico, { size: 14 })}
        <span>${label}</span>
        <span class="view-tab-count">${count}</span>
      </button>`;
    return `
      <div class="view-tabs">
        ${tab('analytics', 'Analytics', 'chart', dlCount)}
        ${tab('events', 'Events', 'bolt', allCount)}
      </div>`;
  }

  /** Compact ecommerce figures for an Analytics row: total value and item count. */
  private getEcommerceSummary(event: TimelineEvent): {
    value: string | null;
    items: number | null;
  } {
    const ec = (event.data as any)?.ecommerce;
    if (!ec || typeof ec !== 'object') return { value: null, items: null };

    const raw = ec.value ?? ec.value_change;
    const num =
      typeof raw === 'number'
        ? raw
        : typeof raw === 'string'
          ? parseFloat(raw)
          : NaN;
    const currency = typeof ec.currency === 'string' ? ec.currency : '';
    const value = Number.isFinite(num)
      ? `${num.toFixed(2)}${currency ? ` ${currency}` : ''}`
      : null;

    const arr = Array.isArray(ec.items)
      ? ec.items
      : Array.isArray(ec.items_added)
        ? ec.items_added
        : null;
    return { value, items: arr ? arr.length : null };
  }

  private renderTableHead(): string {
    const cols =
      this.view === 'analytics'
        ? `<th style="width:13%">Time</th>
           <th style="width:33%">Event</th>
           <th style="width:16%">Value</th>
           <th style="width:9%">Items</th>
           <th style="width:29%">Delivery</th>`
        : `<th style="width:14%">Time</th>
           <th style="width:11%">Type</th>
           <th style="width:41%">Event</th>
           <th style="width:34%">Source</th>`;
    return `<thead><tr>${cols}</tr></thead>`;
  }

  private renderEventRow(event: TimelineEvent): string {
    const open = `window.eventTimelinePanel_showModal('${event.id}')`;
    const time = `<td class="event-time">${this.formatTimestamp(event.timestamp)}</td>`;
    const typeBadge = `<span class="event-type-badge" style="background:${this.getEventTypeColor(event.type)}22;color:${this.getEventTypeColor(event.type)};">${this.getEventTypeBadge(event.type)}</span>`;

    if (this.view === 'analytics') {
      const { value, items } = this.getEcommerceSummary(event);
      const delivery = this.renderDeliverySummary(event);
      return `
        <tr class="event-row" onclick="${open}">
          ${time}
          <td>
            <span class="event-name">${event.name}</span>
            ${this.renderValidationBadge(event)}
          </td>
          <td class="event-num">${value ?? '<span class="event-muted">—</span>'}</td>
          <td class="event-num">${items ?? '<span class="event-muted">—</span>'}</td>
          <td>${delivery || '<span class="event-muted">—</span>'}</td>
        </tr>`;
    }

    return `
      <tr class="event-row" onclick="${open}">
        ${time}
        <td>${typeBadge}</td>
        <td>
          <span class="event-name">${event.name}</span>
          ${event.isInternal ? '<span class="internal-badge">INTERNAL</span>' : ''}
          ${this.renderValidationBadge(event)}
        </td>
        <td class="event-source">${event.source}</td>
      </tr>`;
  }

  /**
   * Right-side filter drawer. The single home for all timeline filters — add
   * future filters as new `.filter-section` blocks here. Rendered only when
   * open; a transparent backdrop closes it on outside click.
   */
  private renderFilterDrawer(): string {
    if (!this.filterDrawerOpen) return '';

    const providers = analyticsDebug.getProviders();
    const providerSection = providers.length
      ? providers
          .map(p => {
            const on = this.providerFilter === p.name;
            return `
              <button class="filter-chip ${on ? 'active' : ''}"
                      onclick="window.eventTimelinePanel_filterProvider('${this.escapeAttr(p.name)}')">
                ${on ? lucide('check', { size: 13 }) : ''}
                ${this.escapeHtml(p.name)}
              </button>`;
          })
          .join('')
      : `<span class="filter-hint">No providers registered.</span>`;

    const toggle = (
      active: boolean,
      label: string,
      onclick: string
    ): string => `
      <button class="filter-row-toggle ${active ? 'active' : ''}" onclick="${onclick}">
        <span class="filter-checkbox">${active ? lucide('check', { size: 12 }) : ''}</span>
        ${label}
      </button>`;

    return `
      <div class="filter-backdrop" onclick="window.eventTimelinePanel_toggleDrawer()"></div>
      <aside class="filter-drawer" role="dialog" aria-label="Timeline filters">
        <header class="filter-drawer-header">
          <span class="filter-drawer-title">${lucide('filter', { size: 15 })} Filters</span>
          <button class="filter-drawer-close" title="Close" onclick="window.eventTimelinePanel_toggleDrawer()">
            ${lucide('x', { size: 16 })}
          </button>
        </header>

        <div class="filter-drawer-body">
          <div class="filter-section">
            <label class="filter-label">Search</label>
            <div class="events-search-wrap">
              ${lucide('search', { size: 14, style: 'opacity:0.6' })}
              <input
                class="events-search"
                data-debug-search
                type="search"
                placeholder="Event name or source…"
                value="${this.escapeHtml(this.searchTerm).replace(/"/g, '&quot;')}"
                oninput="window.eventTimelinePanel_search(this.value)" />
            </div>
          </div>

          <div class="filter-section">
            <label class="filter-label">Provider</label>
            <div class="filter-chips">${providerSection}</div>
          </div>

          ${
            this.view === 'events'
              ? `
            <div class="filter-section">
              <label class="filter-label">Events</label>
              ${toggle(this.showInternalEvents, 'Include internal SDK events', 'window.eventTimelinePanel_toggleInternal()')}
            </div>`
              : ''
          }

          <div class="filter-section">
            <label class="filter-label">Status</label>
            ${toggle(this.issuesOnly, 'Issues only (failed/blocked or invalid)', 'window.eventTimelinePanel_toggleIssues()')}
          </div>
        </div>

        <footer class="filter-drawer-footer">
          <span class="filter-hint">${this.activeFilterCount()} active</span>
          ${
            this.hasActiveFilters()
              ? `<button class="filter-clear" onclick="window.eventTimelinePanel_clearFilters()">Clear all</button>`
              : ''
          }
        </footer>
      </aside>`;
  }

  private escapeAttr(value: string): string {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  /** Ask the overlay to re-render this panel's content. */
  private requestRerender(): void {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('debug:update-content', {
          detail: { panelId: this.id },
        })
      );
    }
  }

  private showEventModal(eventId: string): void {
    this.selectedEventId = eventId;
    // Trigger re-render
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('debug:update-content', {
          detail: { panelId: this.id },
        })
      );
    }
  }

  private closeEventModal(): void {
    this.selectedEventId = null;
    // Trigger re-render
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('debug:update-content', {
          detail: { panelId: this.id },
        })
      );
    }
  }

  getContent(): string {
    const filteredEvents = this.getFilteredEvents();
    const invalidCount = filteredEvents.filter(
      e => worstLevel(this.getEventIssues(e)) === 'error'
    ).length;
    const selectedEvent = this.selectedEventId
      ? this.events.find(e => e.id === this.selectedEventId)
      : null;

    // Add modal HTML if an event is selected
    const modalHtml = selectedEvent
      ? `
      <div class="event-modal-overlay" onclick="window.eventTimelinePanel_closeModal()">
        <div class="event-modal" onclick="event.stopPropagation()">
          <div class="event-modal-header">
            <h3 class="event-modal-title">${selectedEvent.name}</h3>
            <button class="event-modal-close" onclick="window.eventTimelinePanel_closeModal()">${lucide('x', { size: 16 })}</button>
          </div>
          <div class="event-modal-body">
            <div class="event-modal-meta">
              <div class="event-modal-meta-item">
                <span class="event-modal-meta-label">Type:</span>
                <span class="event-type-badge" style="background: ${this.getEventTypeColor(selectedEvent.type)}22; color: ${this.getEventTypeColor(selectedEvent.type)};">
                  ${this.getEventTypeBadge(selectedEvent.type)}
                </span>
              </div>
              <div class="event-modal-meta-item">
                <span class="event-modal-meta-label">Source:</span>
                <span>${selectedEvent.source}</span>
              </div>
              <div class="event-modal-meta-item">
                <span class="event-modal-meta-label">Time:</span>
                <span>${this.formatTimestamp(selectedEvent.timestamp)}</span>
              </div>
              <div class="event-modal-meta-item">
                <span class="event-modal-meta-label">Relative:</span>
                <span>${selectedEvent.relativeTime}</span>
              </div>
            </div>
            ${this.renderDetailTabs(selectedEvent)}
          </div>
        </div>
      </div>
    `
      : '';

    // Setup global functions for modal interaction
    if (typeof window !== 'undefined') {
      (window as any).eventTimelinePanel_showModal = (eventId: string) => {
        this.showEventModal(eventId);
      };
      (window as any).eventTimelinePanel_closeModal = () => {
        this.closeEventModal();
      };
      (window as any).eventTimelinePanel_setTab = (tab: DetailTab) => {
        this.selectedDetailTab = tab;
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_toggleDelivery = (id: string) => {
        if (this.expandedDeliveries.has(id)) this.expandedDeliveries.delete(id);
        else this.expandedDeliveries.add(id);
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_setDeliveryProvider = (
        provider: string | null
      ) => {
        // Toggle: clicking the active provider sub-tab returns to "All".
        this.selectedDeliveryProvider =
          this.selectedDeliveryProvider === provider ? null : provider;
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_searchDeliveryProvider = (
        value: string
      ) => {
        this.deliveryProviderSearch = value;
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_search = (value: string) => {
        this.searchTerm = value;
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_filterProvider = (
        provider: string
      ) => {
        // Toggle: clicking the active provider clears the filter.
        this.providerFilter =
          this.providerFilter === provider ? null : provider;
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_toggleIssues = () => {
        this.issuesOnly = !this.issuesOnly;
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_clearFilters = () => {
        this.searchTerm = '';
        this.providerFilter = null;
        this.issuesOnly = false;
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_toggleDrawer = () => {
        this.filterDrawerOpen = !this.filterDrawerOpen;
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_toggleInternal = () => {
        this.toggleInternalEvents();
        this.requestRerender();
      };
      (window as any).eventTimelinePanel_setView = (
        view: 'analytics' | 'events'
      ) => {
        this.setView(view);
        this.requestRerender();
      };
    }

    return `
      <style>
        .events-table-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: #0f0f0f;
          position: relative; /* anchors the filter drawer */
        }
        /* Modal Styles */
        .event-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100000;
          backdrop-filter: blur(4px);
        }
        .event-modal {
          background: #1a1a1a;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          width: 90%;
          max-width: 800px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
        }
        .event-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .event-modal-title {
          margin: 0;
          font-size: 1.2em;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 600;
        }
        .event-modal-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.2s;
        }
        .event-modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }
        .event-modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }
        .event-modal-meta {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .event-modal-meta-item {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .event-modal-meta-label {
          color: rgba(255, 255, 255, 0.5);
          font-size: 0.9em;
        }
        .event-modal-data {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          overflow: hidden;
        }
        .event-modal-data-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .event-modal-data-content {
          /* Wraps RawDataHelper's viewer, which is height:100% — needs a
             definite height here so the JSON scrolls inside the modal. */
          height: min(400px, 55vh);
          margin: 0;
          border-radius: 6px;
          overflow: hidden;
        }
        /* ── Provider strip ── */
        .provider-strip {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          padding: 8px 20px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.85em;
        }
        .provider-strip-empty { color: rgba(255, 255, 255, 0.5); }
        .provider-strip-label {
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 0.8em;
          margin-right: 4px;
        }
        .provider-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 9px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #e6e6e6;
          cursor: pointer;
          font: inherit;
          transition: background 0.15s, border-color 0.15s;
        }
        .provider-chip:hover { background: rgba(255, 255, 255, 0.12); }
        .provider-chip.active {
          background: rgba(60, 125, 255, 0.22);
          border-color: #3C7DFF;
          color: #fff;
        }
        .provider-chip-icon { font-size: 0.9em; }
        .provider-chip-brand {
          display: inline-flex;
          align-items: center;
          opacity: 0.95;
        }
        /* ── Filter controls ── */
        .events-search-wrap {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 6px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .events-search-icon { font-size: 0.85em; opacity: 0.6; }
        .events-search {
          background: none;
          border: none;
          outline: none;
          color: #fff;
          font: inherit;
          font-size: 0.85em;
          width: 150px;
        }
        .events-search::placeholder { color: rgba(255, 255, 255, 0.4); }
        .filter-toggle {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.75);
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.82em;
          transition: all 0.15s;
        }
        .filter-toggle:hover { color: #fff; }
        .filter-toggle.active {
          background: rgba(214, 167, 0, 0.2);
          border-color: #d6a700;
          color: #ffd84d;
        }
        .filter-clear {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          font-size: 0.82em;
          text-decoration: underline;
        }
        .filter-clear:hover { color: #fff; }
        /* ── Filter button (opens drawer) ── */
        .filter-button {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.85);
          cursor: pointer;
          font: inherit;
          font-size: 0.85em;
          transition: all 0.15s;
        }
        .filter-button:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
        .filter-button.open,
        .filter-button.active {
          border-color: #3C7DFF;
          color: #fff;
        }
        .filter-button.active { background: rgba(60, 125, 255, 0.18); }
        .filter-button-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 17px;
          height: 17px;
          padding: 0 5px;
          border-radius: 9px;
          background: #3C7DFF;
          color: #fff;
          font-size: 0.72em;
          font-weight: 700;
        }
        /* ── Filter drawer (right side) ── */
        .filter-backdrop {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
          z-index: 20;
        }
        .filter-drawer {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          width: 290px;
          max-width: 85%;
          z-index: 21;
          background: #161616;
          border-left: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow: -8px 0 24px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
          animation: filter-drawer-in 0.16s ease-out;
        }
        @keyframes filter-drawer-in {
          from { transform: translateX(12px); opacity: 0.4; }
          to { transform: translateX(0); opacity: 1; }
        }
        .filter-drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .filter-drawer-title {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #fff;
          font-weight: 600;
          font-size: 0.95em;
        }
        .filter-drawer-close {
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          padding: 2px;
          display: inline-flex;
        }
        .filter-drawer-close:hover { color: #fff; }
        .filter-drawer-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .filter-section { display: flex; flex-direction: column; gap: 8px; }
        .filter-label {
          color: rgba(255, 255, 255, 0.45);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-size: 0.72em;
          font-weight: 600;
        }
        .filter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .filter-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          font: inherit;
          font-size: 0.82em;
          transition: all 0.15s;
        }
        .filter-chip:hover { color: #fff; }
        .filter-chip.active {
          background: rgba(60, 125, 255, 0.22);
          border-color: #3C7DFF;
          color: #fff;
        }
        .filter-row-toggle {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 7px 8px;
          border-radius: 6px;
          background: none;
          border: 1px solid transparent;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          font: inherit;
          font-size: 0.85em;
          text-align: left;
          width: 100%;
        }
        .filter-row-toggle:hover { background: rgba(255, 255, 255, 0.05); }
        .filter-row-toggle.active { color: #fff; }
        .filter-checkbox {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          flex-shrink: 0;
        }
        .filter-row-toggle.active .filter-checkbox {
          background: #3C7DFF;
          border-color: #3C7DFF;
          color: #fff;
        }
        .filter-drawer-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .filter-hint { color: rgba(255, 255, 255, 0.45); font-size: 0.8em; }
        .delivery-count { display: inline-flex; align-items: center; gap: 2px; }
        /* ── Per-row delivery summary (provider chips) ── */
        .delivery-summary {
          display: inline-flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-left: 8px;
          vertical-align: middle;
        }
        .delivery-chip {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 1px 6px;
          border-radius: 9px;
          font-size: 0.72em;
          font-weight: 600;
          line-height: 1.5;
          color: var(--chip, #9aa0a6);
          background: color-mix(in srgb, var(--chip, #9aa0a6) 16%, transparent);
          border: 1px solid
            color-mix(in srgb, var(--chip, #9aa0a6) 38%, transparent);
        }
        .delivery-chip-name { letter-spacing: 0.02em; }
        /* ── Detail modal tabs ── */
        .detail-tabs {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          margin-bottom: 12px;
        }
        .detail-tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255, 255, 255, 0.6);
          padding: 8px 14px;
          cursor: pointer;
          font-size: 0.9em;
          transition: color 0.15s, border-color 0.15s;
        }
        .detail-tab:hover { color: rgba(255, 255, 255, 0.9); }
        .detail-tab.active {
          color: #fff;
          border-bottom-color: #3C7DFF;
        }
        .tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          font-size: 0.75em;
        }
        .tab-count-error { background: #e3342f; }
        .tab-count-warning { background: #d6a700; color: #1a1a1a; }
        .detail-tab-body { min-height: 80px; }
        /* ── Delivery tab: provider sub-tabs ── */
        .delivery-subtabs {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }
        .delivery-subtab-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }
        .delivery-subtab {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid transparent;
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.6);
          padding: 3px 9px;
          cursor: pointer;
          font-size: 0.82em;
          transition: color 0.15s, background 0.15s, border-color 0.15s;
        }
        .delivery-subtab:hover {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.09);
        }
        .delivery-subtab.active {
          color: #fff;
          background: rgba(60, 125, 255, 0.18);
          border-color: rgba(60, 125, 255, 0.6);
        }
        .delivery-subtab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.12);
          font-size: 0.85em;
        }
        .delivery-subtab-search {
          flex: 0 0 auto;
          width: 140px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #fff;
          padding: 3px 8px;
          font-size: 0.82em;
        }
        .delivery-subtab-search::placeholder { color: rgba(255, 255, 255, 0.4); }
        /* ── Delivery tab body ── */
        .delivery-list { display: flex; flex-direction: column; gap: 4px; }
        .delivery-item {
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.03);
          overflow: hidden;
        }
        .delivery-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 10px;
        }
        .delivery-row-clickable { cursor: pointer; }
        .delivery-row-clickable:hover { background: rgba(255, 255, 255, 0.05); }
        .delivery-provider {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #e6e6e6;
          font-size: 0.9em;
        }
        .delivery-caret { color: rgba(255, 255, 255, 0.4); font-size: 0.8em; width: 10px; }
        .delivery-caret-spacer { display: inline-block; width: 10px; }
        .delivery-payload {
          padding: 0 10px 10px;
        }
        .delivery-payload-label {
          color: rgba(255, 255, 255, 0.45);
          font-size: 0.75em;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 2px 0 6px;
        }
        .delivery-payload-view {
          height: 220px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          overflow: hidden;
        }
        .delivery-right { display: flex; align-items: center; gap: 10px; }
        .delivery-note { color: rgba(255, 255, 255, 0.55); font-size: 0.82em; }
        .delivery-note-error { color: #e3342f; }
        .delivery-duration { color: rgba(255, 255, 255, 0.4); font-size: 0.82em; }
        .delivery-status {
          font-size: 0.85em;
          font-weight: 600;
          min-width: 84px;
          text-align: right;
        }
        .delivery-empty {
          color: rgba(255, 255, 255, 0.5);
          line-height: 1.5;
          padding: 12px 4px;
        }
        /* ── View segmented tabs (Analytics | Events) ── */
        .view-tabs {
          display: flex;
          gap: 2px;
          padding: 8px 12px 0;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .view-tab {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: rgba(255, 255, 255, 0.55);
          cursor: pointer;
          font: inherit;
          font-size: 0.92em;
          transition: color 0.15s, border-color 0.15s;
        }
        .view-tab:hover { color: rgba(255, 255, 255, 0.9); }
        .view-tab.active { color: #fff; border-bottom-color: #3C7DFF; }
        .view-tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: rgba(255, 255, 255, 0.1);
          font-size: 0.72em;
          font-weight: 600;
        }
        .view-tab.active .view-tab-count { background: rgba(60, 125, 255, 0.3); color: #fff; }
        .event-num {
          font-family: 'SF Mono', monospace;
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.85);
          white-space: nowrap;
        }
        .event-muted { color: rgba(255, 255, 255, 0.3); }
        .events-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          padding: 12px 20px;
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .events-stats {
          display: flex;
          gap: 20px;
          align-items: center;
        }
        .event-stat {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .event-stat-value {
          font-weight: 600;
          color: #3C7DFF;
        }
        .event-stat-label {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.9em;
        }
        .events-controls {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .toggle-internal {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: rgba(255, 255, 255, 0.8);
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .toggle-internal:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        .toggle-internal.active {
          background: rgba(60, 125, 255, 0.2);
          border-color: #3C7DFF;
        }
        .recording-status {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: ${this.isRecording ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
          border: 1px solid ${this.isRecording ? '#EF4444' : 'rgba(255, 255, 255, 0.1)'};
          border-radius: 6px;
          color: ${this.isRecording ? '#EF4444' : 'rgba(255, 255, 255, 0.6)'};
        }
        .recording-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: currentColor;
          ${this.isRecording ? 'animation: pulse 1.5s infinite;' : ''}
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .events-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9em;
        }
        .events-table th {
          /* Opaque background is required: a translucent sticky header lets the
             scrolled rows bleed through and looks like it overlaps the data. */
          background: #1e1e1e;
          padding: 10px;
          text-align: left;
          border-bottom: 2px solid rgba(255, 255, 255, 0.1);
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .events-table td {
          padding: 10px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.7);
        }
        .events-table tr:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .event-type-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.75em;
          font-weight: 600;
          text-transform: uppercase;
        }
        .event-name {
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
        }
        .event-source {
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.5);
        }
        .event-time {
          font-family: 'SF Mono', monospace;
          font-size: 0.85em;
          color: rgba(255, 255, 255, 0.5);
        }
        .event-row {
          cursor: pointer;
          transition: background 0.2s;
        }
        .event-row:hover {
          background: rgba(255, 255, 255, 0.02);
        }
        .internal-badge {
          display: inline-block;
          padding: 1px 6px;
          background: rgba(156, 39, 176, 0.2);
          color: #9C27B0;
          border-radius: 3px;
          font-size: 0.7em;
          font-weight: 600;
          margin-left: 6px;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: rgba(255, 255, 255, 0.4);
        }
        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .empty-state .filter-clear { margin-top: 12px; }
        .empty-state-text {
          font-size: 1.1em;
        }
        .empty-state-sub {
          font-size: 0.9em;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 6px;
        }
        .empty-state code {
          font-family: 'SF Mono', monospace;
          background: rgba(255, 255, 255, 0.1);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .validation-badge {
          display: inline-block;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 0.7em;
          font-weight: 700;
          margin-left: 6px;
        }
        .validation-badge-error { background: rgba(244, 67, 54, 0.2); color: #f44336; }
        .validation-badge-warning { background: rgba(255, 152, 0, 0.2); color: #ff9800; }
        .event-validation {
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-size: 0.9em;
        }
        .event-validation-ok {
          background: rgba(76, 175, 80, 0.12);
          color: #81c784;
          border: 1px solid rgba(76, 175, 80, 0.3);
        }
        .event-validation-warn {
          background: rgba(255, 152, 0, 0.1);
          border: 1px solid rgba(255, 152, 0, 0.3);
        }
        .event-validation-fail {
          background: rgba(244, 67, 54, 0.1);
          border: 1px solid rgba(244, 67, 54, 0.3);
        }
        .event-validation-summary {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          margin-bottom: 10px;
        }
        .event-validation-ok .event-validation-summary { color: #81c784; }
        .event-validation-warn .event-validation-summary { color: #ffb74d; }
        .event-validation-fail .event-validation-summary { color: #ef5350; }
        .event-check-list { list-style: none; margin: 0; padding: 0; }
        .event-check {
          display: flex;
          gap: 8px;
          align-items: flex-start;
          padding: 6px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .event-check:first-child { border-top: none; }
        .event-check-status { flex: 0 0 auto; line-height: 1; margin-top: 1px; }
        .event-check-pass .event-check-status { color: #66bb6a; }
        .event-check-warning .event-check-status { color: #ffa726; }
        .event-check-error .event-check-status { color: #ef5350; }
        .event-check-skipped { opacity: 0.55; }
        .event-check-skipped .event-check-status { color: rgba(255, 255, 255, 0.5); }
        .event-check-body { flex: 1 1 auto; min-width: 0; }
        .event-check-head {
          display: flex;
          gap: 8px;
          align-items: baseline;
          flex-wrap: wrap;
        }
        .event-check-label { font-weight: 600; color: rgba(255, 255, 255, 0.92); }
        .event-check-field {
          color: #4fc3f7;
          font-family: 'SF Mono', monospace;
          font-size: 0.85em;
          white-space: nowrap;
        }
        .event-check-detail {
          color: rgba(255, 255, 255, 0.7);
          font-size: 0.88em;
          margin-top: 2px;
        }
      </style>
      
      <div class="events-table-container">
        ${this.renderViewTabs()}
        ${this.view === 'analytics' ? this.renderProviderStrip() : ''}
        <div class="events-header">
          <div class="events-stats">
            <div class="event-stat">
              <span class="event-stat-value">${filteredEvents.length}</span>
              <span class="event-stat-label">${this.view === 'analytics' ? 'dl_ events' : 'Events'}</span>
            </div>
            ${
              this.view === 'analytics'
                ? `
              <div class="event-stat">
                <span class="event-stat-value" style="color: ${invalidCount > 0 ? '#f44336' : 'inherit'};">${invalidCount}</span>
                <span class="event-stat-label">Invalid</span>
              </div>
            `
                : `
              <div class="event-stat">
                <span class="event-stat-value">${this.events.length}</span>
                <span class="event-stat-label">Total captured</span>
              </div>
            `
            }
          </div>

          <div class="events-controls">
            <button class="filter-button ${this.activeFilterCount() > 0 ? 'active' : ''} ${this.filterDrawerOpen ? 'open' : ''}"
                    title="Filters"
                    onclick="window.eventTimelinePanel_toggleDrawer()">
              ${lucide('filter', { size: 15 })}
              <span>Filters</span>
              ${
                this.activeFilterCount() > 0
                  ? `<span class="filter-button-badge">${this.activeFilterCount()}</span>`
                  : ''
              }
            </button>

            <div class="recording-status">
              <span class="recording-dot"></span>
              <span>${this.isRecording ? 'Recording' : 'Paused'}</span>
            </div>
          </div>
        </div>

        ${
          filteredEvents.length === 0
            ? this.renderEmptyState()
            : `
          <div style="flex: 1; overflow-y: auto;">
            <table class="events-table">
              ${this.renderTableHead()}
              <tbody>
                ${filteredEvents
                  .slice(0, 100)
                  .map(event => this.renderEventRow(event))
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
        ${this.renderFilterDrawer()}
      </div>
      ${modalHtml}
    `;
  }

  getActions(): PanelAction[] {
    return [
      {
        label: this.isRecording ? 'Pause' : 'Resume',
        variant: this.isRecording ? 'secondary' : 'primary',
        action: () => {
          this.isRecording = !this.isRecording;
        },
      },
      {
        label: 'Clear Events',
        variant: 'danger',
        action: () => {
          this.events = [];
          localStorage.removeItem(EventTimelinePanel.EVENTS_STORAGE_KEY);
          analyticsDebug.clear();
        },
      },
      {
        label: 'Export Events',
        variant: 'primary',
        action: () => {
          const dataStr = JSON.stringify(this.events, null, 2);
          const dataBlob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(dataBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `events-${Date.now()}.json`;
          link.click();
          URL.revokeObjectURL(url);
        },
      },
    ];
  }
}
