/**
 * The events table: the Analytics/Events view tabs, the header stats strip,
 * the table itself and its rows, and the empty state. Extracted verbatim from
 * `event-timeline-panel.ts` (see docs/code-findings.md #147) — logic
 * unchanged. Functions that only ever read an already-computed value
 * (`view`, `events`, `filteredEvents`, `activeFilterCount`, `hasActiveFilters`)
 * take it as a plain parameter instead of a live accessor: a render pass is
 * synchronous, so the value can't change between the moment the panel computes
 * it and the moment these functions read it — recomputing it as a getter would
 * just repeat the same call the panel already made.
 */
import { lucide, type IconName } from '../../icons';
import {
  worstLevel,
  type EventValidationIssue,
} from '../ecommerce-event-validator';
import type { TimelineEvent } from './event-timeline-panel.types';

/** Segmented control switching between the Analytics and Events views. */
export function renderViewTabs(
  events: TimelineEvent[],
  view: 'analytics' | 'events'
): string {
  const dlCount = events.filter(e => e.name.startsWith('dl_')).length;
  const allCount = events.length;
  const tab = (
    id: 'analytics' | 'events',
    label: string,
    ico: IconName,
    count: number
  ): string => `
    <button class="view-tab ${view === id ? 'active' : ''}"
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
export function getEcommerceSummary(event: TimelineEvent): {
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

export function renderTableHead(view: 'analytics' | 'events'): string {
  const cols =
    view === 'analytics'
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

/** Pure helpers `renderEventRow` needs from the panel. */
export interface EventRowDeps {
  formatTimestamp(timestamp: number): string;
  getEventTypeColor(type: string): string;
  getEventTypeBadge(type: string): string;
  getEventIssues(event: TimelineEvent): EventValidationIssue[];
  renderDeliverySummary(event: TimelineEvent): string;
}

export function renderValidationBadge(
  event: TimelineEvent,
  deps: Pick<EventRowDeps, 'getEventIssues'>
): string {
  const level = worstLevel(deps.getEventIssues(event));
  if (!level) return '';
  const isError = level === 'error';
  const cls = isError
    ? 'validation-badge validation-badge-error'
    : 'validation-badge validation-badge-warning';
  const ico = lucide(isError ? 'x-circle' : 'alert', { size: 12 });
  return `<span class="${cls}">${ico} ${isError ? 'INVALID' : 'CHECK'}</span>`;
}

export function renderEventRow(
  event: TimelineEvent,
  view: 'analytics' | 'events',
  deps: EventRowDeps
): string {
  const open = `window.eventTimelinePanel_showModal('${event.id}')`;
  const time = `<td class="event-time">${deps.formatTimestamp(event.timestamp)}</td>`;
  const typeBadge = `<span class="event-type-badge" style="background:${deps.getEventTypeColor(event.type)}22;color:${deps.getEventTypeColor(event.type)};">${deps.getEventTypeBadge(event.type)}</span>`;

  if (view === 'analytics') {
    const { value, items } = getEcommerceSummary(event);
    const delivery = deps.renderDeliverySummary(event);
    return `
      <tr class="event-row" onclick="${open}">
        ${time}
        <td>
          <span class="event-name">${event.name}</span>
          ${renderValidationBadge(event, deps)}
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
        ${renderValidationBadge(event, deps)}
      </td>
      <td class="event-source">${event.source}</td>
    </tr>`;
}

/** Empty-state message, aware of the dl_-only default filter. */
export function renderEmptyState(
  events: TimelineEvent[],
  view: 'analytics' | 'events',
  hasActiveFilters: boolean
): string {
  if (events.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">${lucide('inbox', { size: 44 })}</div>
        <div class="empty-state-text">No events captured yet</div>
      </div>`;
  }

  // Analytics view shows only dl_ events; surface non-dl_ events captured.
  const hiddenByView =
    view === 'analytics' && events.some(e => !e.name.startsWith('dl_'));
  if (hiddenByView && !hasActiveFilters) {
    const other = events.filter(e => !e.name.startsWith('dl_')).length;
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
        hasActiveFilters
          ? `
        <button class="filter-clear" onclick="window.eventTimelinePanel_clearFilters()">
          Clear filters
        </button>`
          : ''
      }
    </div>`;
}

/** Event counts on the left, filter button and recording state on the right. */
export function renderEventsHeader(
  filteredEvents: TimelineEvent[],
  invalidCount: number,
  view: 'analytics' | 'events',
  totalEvents: number,
  activeFilterCount: number,
  filterDrawerOpen: boolean,
  isRecording: boolean
): string {
  return `
      <div class="events-header">
        <div class="events-stats">
          <div class="event-stat">
            <span class="event-stat-value">${filteredEvents.length}</span>
            <span class="event-stat-label">${view === 'analytics' ? 'dl_ events' : 'Events'}</span>
          </div>
          ${
            view === 'analytics'
              ? `
            <div class="event-stat">
              <span class="event-stat-value" style="color: ${invalidCount > 0 ? '#f44336' : 'inherit'};">${invalidCount}</span>
              <span class="event-stat-label">Invalid</span>
            </div>
          `
              : `
            <div class="event-stat">
              <span class="event-stat-value">${totalEvents}</span>
              <span class="event-stat-label">Total captured</span>
            </div>
          `
          }
        </div>

        <div class="events-controls">
          <button class="filter-button ${activeFilterCount > 0 ? 'active' : ''} ${filterDrawerOpen ? 'open' : ''}"
                  title="Filters"
                  onclick="window.eventTimelinePanel_toggleDrawer()">
            ${lucide('filter', { size: 15 })}
            <span>Filters</span>
            ${
              activeFilterCount > 0
                ? `<span class="filter-button-badge">${activeFilterCount}</span>`
                : ''
            }
          </button>

          <div class="recording-status">
            <span class="recording-dot"></span>
            <span>${isRecording ? 'Recording' : 'Paused'}</span>
          </div>
        </div>
      </div>
  `;
}

/** The first 100 filtered events as a table, or the empty state. */
export function renderEventsTable(
  filteredEvents: TimelineEvent[],
  view: 'analytics' | 'events',
  allEvents: TimelineEvent[],
  hasActiveFilters: boolean,
  deps: EventRowDeps
): string {
  return `
      ${
        filteredEvents.length === 0
          ? renderEmptyState(allEvents, view, hasActiveFilters)
          : `
        <div style="flex: 1; overflow-y: auto;">
          <table class="events-table">
            ${renderTableHead(view)}
            <tbody>
              ${filteredEvents
                .slice(0, 100)
                .map(event => renderEventRow(event, view, deps))
                .join('')}
            </tbody>
          </table>
        </div>
      `
      }
  `;
}
