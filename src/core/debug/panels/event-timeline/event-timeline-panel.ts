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
import { RawDataHelper } from '../raw-data-helper';
import {
  validateDataLayerEvent,
  auditDataLayerEvent,
  worstLevel,
  type EventValidationIssue,
  type EventCheck,
} from '../ecommerce-event-validator';
import {
  analyticsDebug,
  type DeliveryRecord,
  type ProviderDebugInfo,
} from '@/core/analytics/debug/analytics-debug-tracker';
import { lucide, type IconName } from '../../icons';
import { eventTimelinePanelStyles } from './event-timeline-panel.styles';
import type { DetailTab, TimelineEvent } from './event-timeline-panel.types';
import { DELIVERY_STATUS_COLOR, DELIVERY_STATUS_ICON } from './event-timeline-panel.types';
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
import {
  renderFlowDetail,
  type FlowRenderDeps,
} from './event-timeline-panel.flow';
import {
  renderValidationSection,
  type ValidationRenderDeps,
} from './event-timeline-panel.validation';

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

  /** Pure helpers `renderValidationSection` needs — see `event-timeline-panel.validation.ts`. */
  private validationDeps(): ValidationRenderDeps {
    return { escapeHtml: value => this.escapeHtml(value) };
  }

  /** Pure helpers `renderFlowDetail` needs — see `event-timeline-panel.flow.ts`. */
  private flowDeps(): FlowRenderDeps {
    return {
      getDeliveriesForEvent: event => this.getDeliveriesForEvent(event),
      getEventId: event => this.getEventId(event),
      formatDeliveryDuration: ms => this.formatDeliveryDuration(ms),
      providerIcon: name => this.providerIcon(name),
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
        ? renderValidationSection(this.getEventChecks(event), this.validationDeps()) ||
          `<div class="delivery-empty">${this.noValidationReason(event)}</div>`
        : renderFlowDetail(event, this.selectedFlowNode, this.flowDeps());

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
