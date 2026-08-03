/**
 * The right-side filter drawer: search, provider, issues-only, and
 * internal-events toggles — the single home for all timeline filters, add
 * future filters as new `.filter-section` blocks here. Extracted verbatim from
 * `event-timeline-panel.ts` (see docs/code-findings.md #147) — logic
 * unchanged. `filterDrawerOpen`/`view`/`searchTerm`/`providerFilter`/
 * `showInternalEvents`/`issuesOnly` and the two active-filter figures are read
 * only once per render (rendering is synchronous), so they cross as plain
 * values on `FilterDrawerState` rather than live accessors — the same
 * reasoning `event-timeline-panel.table.ts` uses for `view`/`events`.
 */
import { lucide } from '../../icons';
import { analyticsDebug } from '@/core/analytics/debug/analytics-debug-tracker';

/** Timeline filter state the drawer reads to render itself. */
export interface FilterDrawerState {
  filterDrawerOpen: boolean;
  view: 'analytics' | 'events';
  searchTerm: string;
  providerFilter: string | null;
  showInternalEvents: boolean;
  issuesOnly: boolean;
  activeFilterCount: number;
  hasActiveFilters: boolean;
}

/** Pure helpers `renderFilterDrawer` needs from the panel. */
export interface FilterDrawerDeps {
  escapeHtml(value: string): string;
  escapeAttr(value: string): string;
}

/**
 * Right-side filter drawer. The single home for all timeline filters — add
 * future filters as new `.filter-section` blocks here. Rendered only when
 * open; a transparent backdrop closes it on outside click.
 */
export function renderFilterDrawer(
  state: FilterDrawerState,
  deps: FilterDrawerDeps
): string {
  if (!state.filterDrawerOpen) return '';

  const providers = analyticsDebug.getProviders();
  const providerSection = providers.length
    ? providers
        .map(p => {
          const on = state.providerFilter === p.name;
          return `
            <button class="filter-chip ${on ? 'active' : ''}"
                    onclick="window.eventTimelinePanel_filterProvider('${deps.escapeAttr(p.name)}')">
              ${on ? lucide('check', { size: 13 }) : ''}
              ${deps.escapeHtml(p.name)}
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
              value="${deps.escapeHtml(state.searchTerm).replace(/"/g, '&quot;')}"
              oninput="window.eventTimelinePanel_search(this.value)" />
          </div>
        </div>

        <div class="filter-section">
          <label class="filter-label">Provider</label>
          <div class="filter-chips">${providerSection}</div>
        </div>

        ${
          state.view === 'events'
            ? `
          <div class="filter-section">
            <label class="filter-label">Events</label>
            ${toggle(state.showInternalEvents, 'Include internal SDK events', 'window.eventTimelinePanel_toggleInternal()')}
          </div>`
            : ''
        }

        <div class="filter-section">
          <label class="filter-label">Status</label>
          ${toggle(state.issuesOnly, 'Issues only (failed/blocked or invalid)', 'window.eventTimelinePanel_toggleIssues()')}
        </div>
      </div>

      <footer class="filter-drawer-footer">
        <span class="filter-hint">${state.activeFilterCount} active</span>
        ${
          state.hasActiveFilters
            ? `<button class="filter-clear" onclick="window.eventTimelinePanel_clearFilters()">Clear all</button>`
            : ''
        }
      </footer>
    </aside>`;
}
