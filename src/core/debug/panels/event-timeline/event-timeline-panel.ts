/**
 * Event Timeline Panel - Advanced debugging for events and dataLayer
 *
 * Provides real-time monitoring of:
 * - GTM dataLayer events
 * - Internal SDK events
 * - DOM CustomEvents
 * - Performance timeline
 */

import { DebugPanel, PanelAction } from '../../debug-panels';
import { EventBus } from '../../../events';
import {
  validateDataLayerEvent,
  auditDataLayerEvent,
  worstLevel,
  type EventValidationIssue,
  type EventCheck,
} from '../ecommerce-event-validator';
import { analyticsDebug } from '@/core/analytics/debug/analytics-debug-tracker';
import { lucide } from '../../icons';
import { eventTimelinePanelStyles } from './event-timeline-panel.styles';
import type { DetailTab, TimelineEvent } from './event-timeline-panel.types';
import {
  loadSavedState as loadPersistedTimelineState,
  saveEvents as savePersistedTimelineEvents,
  EVENTS_STORAGE_KEY,
  SHOW_INTERNAL_KEY,
  VIEW_KEY,
  type PersistenceHost,
} from './event-timeline-panel.persistence';
import {
  watchDataLayer,
  watchInternalEvents,
  watchDOMEvents,
  watchPerformanceEvents,
  type EventCaptureHost,
} from './event-timeline-panel.capture';
import type { FlowRenderDeps } from './event-timeline-panel.flow';
import type { ValidationRenderDeps } from './event-timeline-panel.validation';
import {
  getEventId,
  getDeliveriesForEvent,
  formatDeliveryDuration,
  providerIcon,
  renderDeliverySummary,
  renderProviderStrip,
} from './event-timeline-panel.providers';
import {
  renderFilterDrawer,
  type FilterDrawerState,
} from './event-timeline-panel.filters';
import {
  renderViewTabs,
  renderEventsHeader,
  renderEventsTable,
  type EventRowDeps,
} from './event-timeline-panel.table';
import {
  showEventModal,
  closeEventModal,
  renderEventModal,
  type ModalHost,
  type EventModalDeps,
} from './event-timeline-panel.modal';

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

  /** Applies whichever fields of the saved state actually had a valid value. */
  private loadSavedState(): void {
    const patch = loadPersistedTimelineState(ts => this.formatRelativeTime(ts));
    if (patch.showInternalEvents !== undefined) {
      this.showInternalEvents = patch.showInternalEvents;
    }
    if (patch.view !== undefined) {
      this.view = patch.view;
    }
    if (patch.events !== undefined) {
      this.events = patch.events;
    }
  }

  private saveEvents(): void {
    savePersistedTimelineEvents(this.makePersistenceContext());
  }

  /** Live read/write view onto this panel's persisted-history state. */
  private makePersistenceContext(): PersistenceHost {
    const self = this;
    return {
      get events() {
        return self.events;
      },
      get saveTimeout() {
        return self.saveTimeout;
      },
      set saveTimeout(v) {
        self.saveTimeout = v;
      },
    };
  }

  public toggleInternalEvents(): void {
    this.showInternalEvents = !this.showInternalEvents;
    localStorage.setItem(SHOW_INTERNAL_KEY, String(this.showInternalEvents));
  }

  public setView(view: 'analytics' | 'events'): void {
    this.view = view;
    localStorage.setItem(VIEW_KEY, view);
  }

  private initializeEventWatching(): void {
    const ctx = this.makeCaptureContext();
    watchDataLayer(ctx);
    watchInternalEvents(ctx);
    watchDOMEvents(EventTimelinePanel.getCaptureHost);
    watchPerformanceEvents(ctx);
  }

  /**
   * Live read/write view onto this panel's capture-related state, for the
   * `watch*` hooks in `event-timeline-panel.capture.ts` — they fire well after
   * this is built, so every field they touch is a live accessor, not a
   * snapshot.
   */
  private makeCaptureContext(): EventCaptureHost {
    const self = this;
    return {
      get isRecording() {
        return self.isRecording;
      },
      get events() {
        return self.events;
      },
      set events(v) {
        self.events = v;
      },
      get maxEvents() {
        return self.maxEvents;
      },
      get updateTimeout() {
        return self.updateTimeout;
      },
      set updateTimeout(v) {
        self.updateTimeout = v;
      },
      get eventBus() {
        return self.eventBus;
      },
      get panelId() {
        return self.id;
      },
      formatRelativeTime: (ts: number) => self.formatRelativeTime(ts),
      saveEvents: () => self.saveEvents(),
    };
  }

  private static instance: EventTimelinePanel | null = null;

  private static getInstance(): EventTimelinePanel | null {
    return EventTimelinePanel.instance;
  }

  /**
   * Builds a live capture context for whichever instance is currently
   * registered. `watchDOMEvents`'s `dispatchEvent` override calls this at
   * fire time (not at setup time), mirroring the original's dynamic
   * `EventTimelinePanel.getInstance()` lookup rather than closing over one
   * fixed instance like the other three watchers.
   */
  private static getCaptureHost(): EventCaptureHost | null {
    const instance = EventTimelinePanel.getInstance();
    return instance ? instance.makeCaptureContext() : null;
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
        getDeliveriesForEvent(e).some(d => d.provider === this.providerFilter)
      );
    }

    if (this.issuesOnly) {
      events = events.filter(e => this.eventHasIssues(e));
    }

    return events;
  }

  /** True when an event failed/was blocked by a provider, or fails validation. */
  private eventHasIssues(event: TimelineEvent): boolean {
    const deliveryProblem = getDeliveriesForEvent(event).some(
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

  /** Pure helpers `renderValidationSection` needs — see `event-timeline-panel.validation.ts`. */
  private validationDeps(): ValidationRenderDeps {
    return { escapeHtml: value => this.escapeHtml(value) };
  }

  /** Pure helpers `renderFlowDetail` needs — see `event-timeline-panel.flow.ts`. */
  private flowDeps(): FlowRenderDeps {
    return {
      getDeliveriesForEvent: event => getDeliveriesForEvent(event),
      getEventId: event => getEventId(event),
      formatDeliveryDuration: ms => formatDeliveryDuration(ms),
      providerIcon: name => providerIcon(name),
      escapeHtml: value => this.escapeHtml(value),
      escapeAttr: value => this.escapeAttr(value),
    };
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeAttr(value: string): string {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  /** Shared `{escapeHtml, escapeAttr}` deps for the providers and filters modules. */
  private escapeDeps(): {
    escapeHtml(value: string): string;
    escapeAttr(value: string): string;
  } {
    return {
      escapeHtml: value => this.escapeHtml(value),
      escapeAttr: value => this.escapeAttr(value),
    };
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
      ? renderEventModal(
          selectedEvent,
          this.selectedDetailTab,
          this.selectedFlowNode,
          this.eventModalDeps()
        )
      : '';

    this.exposeModalHandlers();

    return `
      ${eventTimelinePanelStyles(this.isRecording)}
      ${this.renderTimelineBody(filteredEvents, invalidCount)}
      ${modalHtml}
    `;
  }

  /** Pure helpers `renderEventModal` needs — see `event-timeline-panel.modal.ts`. */
  private eventModalDeps(): EventModalDeps {
    return {
      getEventTypeColor: type => this.getEventTypeColor(type),
      getEventTypeBadge: type => this.getEventTypeBadge(type),
      formatTimestamp: ts => this.formatTimestamp(ts),
      getDeliveriesForEvent: event => getDeliveriesForEvent(event),
      getEventIssues: event => this.getEventIssues(event),
      getEventChecks: event => this.getEventChecks(event),
      noValidationReason: event => this.noValidationReason(event),
      validationDeps: () => this.validationDeps(),
      flowDeps: () => this.flowDeps(),
    };
  }

  /** Live read/write view the modal's open/close needs — see `event-timeline-panel.modal.ts`. */
  private modalHost(): ModalHost {
    const self = this;
    return {
      get selectedEventId() {
        return self.selectedEventId;
      },
      set selectedEventId(v) {
        self.selectedEventId = v;
      },
      get selectedFlowNode() {
        return self.selectedFlowNode;
      },
      set selectedFlowNode(v) {
        self.selectedFlowNode = v;
      },
      get panelId() {
        return self.id;
      },
    };
  }

  /**
   * Installs the `window.eventTimelinePanel_*` click handlers the rendered
   * markup calls through inline `onclick`.
   */
  private exposeModalHandlers(): void {
    // Setup global functions for modal interaction
    if (typeof window !== 'undefined') {
      (window as any).eventTimelinePanel_showModal = (eventId: string) => {
        showEventModal(this.modalHost(), eventId);
      };
      (window as any).eventTimelinePanel_closeModal = () => {
        closeEventModal(this.modalHost());
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
        ${renderViewTabs(this.events, this.view)}
        ${this.view === 'analytics' ? renderProviderStrip(this.providerFilter, this.escapeDeps()) : ''}
        ${renderEventsHeader(
          filteredEvents,
          invalidCount,
          this.view,
          this.events.length,
          this.activeFilterCount(),
          this.filterDrawerOpen,
          this.isRecording
        )}
        ${renderEventsTable(
          filteredEvents,
          this.view,
          this.events,
          this.hasActiveFilters(),
          this.eventRowDeps()
        )}
        ${renderFilterDrawer(this.filterDrawerState(), this.escapeDeps())}
      </div>
    `;
  }

  /** Pure helpers `renderEventRow` needs — see `event-timeline-panel.table.ts`. */
  private eventRowDeps(): EventRowDeps {
    return {
      formatTimestamp: ts => this.formatTimestamp(ts),
      getEventTypeColor: type => this.getEventTypeColor(type),
      getEventTypeBadge: type => this.getEventTypeBadge(type),
      getEventIssues: event => this.getEventIssues(event),
      renderDeliverySummary: event =>
        renderDeliverySummary(event, this.escapeDeps()),
    };
  }

  /** Timeline filter state `renderFilterDrawer` needs — see `event-timeline-panel.filters.ts`. */
  private filterDrawerState(): FilterDrawerState {
    return {
      filterDrawerOpen: this.filterDrawerOpen,
      view: this.view,
      searchTerm: this.searchTerm,
      providerFilter: this.providerFilter,
      showInternalEvents: this.showInternalEvents,
      issuesOnly: this.issuesOnly,
      activeFilterCount: this.activeFilterCount(),
      hasActiveFilters: this.hasActiveFilters(),
    };
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
          localStorage.removeItem(EVENTS_STORAGE_KEY);
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
