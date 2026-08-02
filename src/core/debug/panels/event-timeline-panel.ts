/**
 * Event Timeline Panel - Advanced debugging for events and dataLayer
 *
 * Provides real-time monitoring of:
 * - GTM dataLayer events
 * - Internal SDK events
 * - DOM CustomEvents
 * - Performance timeline
 */

import { DebugPanel, PanelAction } from '../debug-panels';
import { EventBus } from '../../events';
import { RawDataHelper } from './raw-data-helper';
import {
  validateDataLayerEvent,
  auditDataLayerEvent,
  worstLevel,
  type EventValidationIssue,
  type EventCheck,
  type CheckStatus,
} from './ecommerce-event-validator';
import {
  analyticsDebug,
  type DeliveryRecord,
  type DeliveryStatus,
  type ProviderDebugInfo,
} from '@/core/analytics/debug/analytics-debug-tracker';
import { lucide, type IconName } from '../icons';
import { eventTimelinePanelStyles } from './event-timeline-panel.styles';

/** Which detail tab is shown in the event modal. */
type DetailTab = 'flow' | 'validation';

const DELIVERY_STATUS_ICON: Record<DeliveryStatus, IconName> = {
  sent: 'check-circle',
  blocked: 'ban',
  skipped: 'minus-circle',
  failed: 'x-circle',
  pending: 'clock',
};

const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, string> = {
  sent: '#1f9d55',
  blocked: '#9aa0a6',
  skipped: '#6b7280',
  failed: '#e3342f',
  pending: '#d6a700',
};

// Flow-graph geometry for the event modal: fixed provider-node height/gap and
// the connector-wire column width, all in px. The SVG connectors are drawn from
// these numbers, so they must stay in sync with the .flow-node / .flow-col-wire
// CSS further down.
const FLOW_NODE_H = 42;
const FLOW_NODE_GAP = 8;
const FLOW_WIRE_W = 44;

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
  private selectedDetailTab: DetailTab = 'flow';
  /**
   * Selected node in the Flow tab's graph. `null` = the source ("Original
   * event") node; otherwise a delivery-record id (one provider node). Drives
   * which payload the detail panel below the graph shows.
   */
  private selectedFlowNode: string | null = null;

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
   * Brand icon for a provider, when one exists (GTM, Facebook, RudderStack,
   * NextCampaign). Returns null for providers without a brand glyph (e.g.
   * Custom), so callers fall back to a generic/status icon.
   */
  private providerIcon(name: string): IconName | null {
    const map: Record<string, IconName> = {
      // NextCampaign is the SDK's own provider — its "N" brand mark.
      NextCampaign: 'next',
      GTM: 'gtm',
      Facebook: 'facebook',
      RudderStack: 'rudderstack',
    };
    return map[name] ?? null;
  }

  /**
   * The Flow tab: a node graph of the event. The source ("Original event") node
   * on the left fans out to one node per provider that handled it; the panel
   * below shows the selected node's payload — the original event for the source
   * node, the transformed payload each provider actually dispatched otherwise.
   */
  private renderFlowDetail(event: TimelineEvent): string {
    const deliveries = this.getDeliveriesForEvent(event);

    // No provider deliveries: still show the source node + original event, plus
    // why nothing fanned out.
    if (deliveries.length === 0) {
      return `
        <div class="flow">
          <div class="flow-graph flow-graph-solo">
            ${this.renderFlowSourceNode(event, [], true)}
          </div>
          <div class="flow-detail">
            <div class="delivery-empty">
              No provider deliveries recorded for this event.
              ${
                this.getEventId(event)
                  ? 'Providers may have been disabled, or this event is not dispatched to the provider layer.'
                  : 'This event has no <code>event_id</code>, so it cannot be matched to a provider delivery.'
              }
            </div>
            <div class="flow-detail-view">${RawDataHelper.generateRawDataContent(event.data)}</div>
          </div>
        </div>`;
    }

    // The remembered node only applies if it belongs to this event; otherwise
    // fall back to the source node.
    const selected = this.selectedFlowNode
      ? (deliveries.find(d => d.id === this.selectedFlowNode) ?? null)
      : null;

    const providerNodes = deliveries
      .map(d => this.renderFlowProviderNode(d, selected?.id === d.id))
      .join('');

    const detail = selected
      ? this.renderFlowProviderPanel(selected)
      : this.renderFlowSourcePanel(event, deliveries.length);

    return `
      <div class="flow">
        <div class="flow-graph">
          <div class="flow-col flow-col-source">
            ${this.renderFlowSourceNode(event, deliveries, selected === null)}
          </div>
          <div class="flow-col flow-col-wire">
            ${this.renderFlowWire(deliveries, selected?.id ?? null)}
          </div>
          <div class="flow-col flow-col-providers">
            ${providerNodes}
          </div>
        </div>
        <div class="flow-detail">${detail}</div>
      </div>`;
  }

  /**
   * The source node — the original event every provider branches from. Shows a
   * per-status delivery summary (e.g. "3 sent · 1 skipped") so you can gauge the
   * fan-out without clicking each provider.
   */
  private renderFlowSourceNode(
    event: TimelineEvent,
    deliveries: DeliveryRecord[],
    active: boolean
  ): string {
    const count = deliveries.length;
    const sub =
      count > 0 ? `${count} provider${count === 1 ? '' : 's'}` : 'no providers';

    // One chip per status present, in a stable order, tinted by status colour.
    const order: DeliveryStatus[] = [
      'sent',
      'skipped',
      'blocked',
      'failed',
      'pending',
    ];
    const summary = order
      .map(status => ({
        status,
        n: deliveries.filter(d => d.status === status).length,
      }))
      .filter(({ n }) => n > 0)
      .map(
        ({ status, n }) =>
          `<span class="flow-summary-item">
             <span class="flow-summary-dot" style="background:${DELIVERY_STATUS_COLOR[status]}"></span>${n} ${status}
           </span>`
      )
      .join('');

    return `
      <button class="flow-node flow-node-source ${active ? 'active' : ''}"
              onclick="window.eventTimelinePanel_selectFlowNode(null)">
        <span class="flow-node-kind">Original event</span>
        <span class="flow-node-name">${this.escapeHtml(event.name)}</span>
        <span class="flow-node-sub">${sub}</span>
        ${summary ? `<span class="flow-summary">${summary}</span>` : ''}
      </button>`;
  }

  /**
   * One provider node as a single table-like row: brand + name on the left,
   * status + duration right-aligned. Tinted by status, clickable for its payload.
   */
  private renderFlowProviderNode(
    record: DeliveryRecord,
    active: boolean
  ): string {
    const color = DELIVERY_STATUS_COLOR[record.status];
    const brand = this.providerIcon(record.provider);
    const glyph = brand ? `${lucide(brand, { size: 14 })} ` : '';
    const duration = this.formatDeliveryDuration(record.durationMs);
    return `
      <button class="flow-node flow-node-provider ${active ? 'active' : ''}"
              style="--accent:${color}"
              onclick="window.eventTimelinePanel_selectFlowNode('${this.escapeAttr(record.id)}')">
        <span class="flow-node-dot" style="background:${color}"></span>
        <span class="flow-node-name">${glyph}${this.escapeHtml(record.provider)}</span>
        <span class="flow-node-status" style="color:${color}">
          ${lucide(DELIVERY_STATUS_ICON[record.status], { size: 12 })} ${record.status}${duration ? ` · ${duration}` : ''}
        </span>
      </button>`;
  }

  /**
   * SVG connectors from the source node to each provider node. Geometry is
   * arithmetic: provider node `i` sits at `i * (H + GAP) + H/2`, and the source
   * connects to the vertical centre of the whole column. The selected branch is
   * drawn thicker and in its status colour; branches that never carried the
   * event (blocked/failed) are dashed so it's clear it did not flow there.
   */
  private renderFlowWire(
    deliveries: DeliveryRecord[],
    selectedId: string | null
  ): string {
    const n = deliveries.length;
    const colH = n * FLOW_NODE_H + (n - 1) * FLOW_NODE_GAP;
    const sourceY = colH / 2;
    const w = FLOW_WIRE_W;
    const cx = w / 2;
    const paths = deliveries
      .map((d, i) => {
        const y = i * (FLOW_NODE_H + FLOW_NODE_GAP) + FLOW_NODE_H / 2;
        const active = selectedId === d.id;
        const stroke = active
          ? DELIVERY_STATUS_COLOR[d.status]
          : 'rgba(255,255,255,0.18)';
        const didNotFlow =
          d.status === 'blocked' ||
          d.status === 'skipped' ||
          d.status === 'failed';
        const dash = didNotFlow ? ' stroke-dasharray="4 3"' : '';
        return `<path d="M0,${sourceY} C${cx},${sourceY} ${cx},${y} ${w},${y}" fill="none" stroke="${stroke}" stroke-width="${active ? 2 : 1.5}"${dash} />`;
      })
      .join('');
    return `<svg class="flow-wire" width="${w}" height="${colH}" viewBox="0 0 ${w} ${colH}" preserveAspectRatio="none">${paths}</svg>`;
  }

  /** Detail panel for the source node: the original event payload. */
  private renderFlowSourcePanel(
    event: TimelineEvent,
    providerCount: number
  ): string {
    return `
      <div class="flow-detail-head">
        <span class="flow-detail-title">Original event · ${this.escapeHtml(event.name)}</span>
        <span class="flow-detail-meta">Dispatched to ${providerCount} provider${providerCount === 1 ? '' : 's'}</span>
      </div>
      <div class="flow-detail-view">${RawDataHelper.generateRawDataContent(event.data)}</div>`;
  }

  /**
   * Detail panel for a provider node, framed by delivery outcome:
   * - `sent` → the transformed payload the provider dispatched.
   * - `blocked` / `skipped` → nothing was sent, so no provider payload exists;
   *   show only the reason (the original event lives on the source node).
   * - `failed` → the error plus whatever it attempted.
   */
  private renderFlowProviderPanel(record: DeliveryRecord): string {
    const provider = this.escapeHtml(record.provider);
    const dispatched = record.sentPayload !== undefined;
    // Blocked/skipped mean the provider dispatched nothing — there is no
    // provider-side payload to inspect.
    const nothingSent =
      record.status === 'blocked' || record.status === 'skipped';

    const noteHtml = (text: string): string =>
      `<div class="flow-detail-note">${text}</div>`;
    let title: string;
    let note = '';
    switch (record.status) {
      case 'blocked':
        title = `Blocked — nothing sent to ${provider}`;
        note = noteHtml(this.escapeHtml(record.detail || 'blocked by config'));
        break;
      case 'skipped':
        title = `Skipped — nothing sent to ${provider}`;
        note = noteHtml(
          this.escapeHtml(record.detail || 'not handled by this provider')
        );
        break;
      case 'failed':
        title = `Failed — ${provider} errored`;
        if (dispatched)
          note = noteHtml(
            'Prepared payload below — dispatch failed, so it was not confirmed delivered.'
          );
        break;
      case 'pending':
        title = `Sending to ${provider}…`;
        break;
      default:
        title = `Sent to ${provider}`;
        if (!dispatched)
          note = noteHtml('No payload reported — showing original event.');
    }

    const meta = [
      `<span class="flow-detail-status" style="color:${DELIVERY_STATUS_COLOR[record.status]}">${lucide(DELIVERY_STATUS_ICON[record.status], { size: 12 })} ${record.status}</span>`,
      record.durationMs !== undefined
        ? `<span>${this.formatDeliveryDuration(record.durationMs)}</span>`
        : '',
    ]
      .filter(Boolean)
      .join('');

    const error = record.error
      ? `<div class="flow-detail-error">${this.escapeHtml(record.error)}</div>`
      : '';

    // No provider payload for nothing-sent outcomes — point at the source node
    // instead of repeating the original event.
    let body: string;
    if (nothingSent) {
      body = `<div class="delivery-empty">Nothing was dispatched. Select the <strong>Original event</strong> node to inspect the payload.</div>`;
    } else {
      const payload = dispatched ? record.sentPayload : record.payload;
      body =
        payload !== undefined
          ? `<div class="flow-detail-view">${RawDataHelper.generateRawDataContent(payload)}</div>`
          : `<div class="delivery-empty">This provider reported no payload for this event.</div>`;
    }

    return `
      <div class="flow-detail-head">
        <span class="flow-detail-title">${title}</span>
        <span class="flow-detail-meta">${meta}</span>
      </div>
      ${note}
      ${error}
      ${body}`;
  }

  /** Tabbed detail body for the event modal: Flow / Validation. */
  private renderDetailTabs(event: TimelineEvent): string {
    const deliveryCount = this.getDeliveriesForEvent(event).length;
    const issues = this.getEventIssues(event);
    const issueLevel = worstLevel(issues);

    const flowBadge =
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

    const body =
      this.selectedDetailTab === 'validation'
        ? this.renderValidationSection(event) ||
          `<div class="delivery-empty">${this.noValidationReason(event)}</div>`
        : this.renderFlowDetail(event);

    return `
      <div class="detail-tabs">
        ${tab('flow', 'Flow', flowBadge)}
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
    // Each freshly opened event starts on its source node.
    this.selectedFlowNode = null;
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
    const modalHtml = selectedEvent ? this.renderEventModal(selectedEvent) : '';

    this.exposeModalHandlers();

    return `
      ${eventTimelinePanelStyles(this.isRecording)}
      ${this.renderTimelineBody(filteredEvents, invalidCount)}
      ${modalHtml}
    `;
  }

  /** The detail modal for one selected event. */
  private renderEventModal(selectedEvent: TimelineEvent): string {
    return `
      <div class="event-modal-overlay" onclick="window.eventTimelinePanel_closeModal()">
        <div class="event-modal" onclick="event.stopPropagation()">
          <div class="event-modal-header">
            <h3 class="event-modal-title">${selectedEvent.name}</h3>
            <button class="event-modal-close" onclick="window.eventTimelinePanel_closeModal()">${lucide('x', { size: 16 })}</button>
          </div>
          <div class="event-modal-body">
            <div class="event-modal-meta">
              <span class="event-modal-meta-item">
                <span class="event-type-badge" style="background: ${this.getEventTypeColor(selectedEvent.type)}22; color: ${this.getEventTypeColor(selectedEvent.type)};">
                  ${this.getEventTypeBadge(selectedEvent.type)}
                </span>
              </span>
              <span class="event-modal-meta-item">
                <span class="event-modal-meta-label">Source</span>
                <span>${selectedEvent.source}</span>
              </span>
              <span class="event-modal-meta-item">
                <span class="event-modal-meta-label">Time</span>
                <span>${this.formatTimestamp(selectedEvent.timestamp)}</span>
                <span class="event-modal-meta-muted">· ${selectedEvent.relativeTime}</span>
              </span>
            </div>
            ${this.renderDetailTabs(selectedEvent)}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Installs the `window.eventTimelinePanel_*` click handlers the rendered
   * markup calls through inline `onclick`.
   */
  private exposeModalHandlers(): void {
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
      (window as any).eventTimelinePanel_selectFlowNode = (
        id: string | null
      ) => {
        // null = the source node; any other id = one provider node.
        this.selectedFlowNode = id;
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
  }

  /** The panel body: view tabs, provider strip, header, table, filter drawer. */
  private renderTimelineBody(
    filteredEvents: TimelineEvent[],
    invalidCount: number
  ): string {
    return `
      <div class="events-table-container">
        ${this.renderViewTabs()}
        ${this.view === 'analytics' ? this.renderProviderStrip() : ''}
        ${this.renderEventsHeader(filteredEvents, invalidCount)}
        ${this.renderEventsTable(filteredEvents)}
        ${this.renderFilterDrawer()}
      </div>
    `;
  }

  /** Event counts on the left, filter button and recording state on the right. */
  private renderEventsHeader(
    filteredEvents: TimelineEvent[],
    invalidCount: number
  ): string {
    return `
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
    `;
  }

  /** The first 100 filtered events as a table, or the empty state. */
  private renderEventsTable(filteredEvents: TimelineEvent[]): string {
    return `
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
