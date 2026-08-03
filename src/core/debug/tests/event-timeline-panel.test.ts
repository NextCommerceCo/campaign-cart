/**
 * Covers what `getContent()` and its render helpers decide: which view is
 * showing, whether the modal is open, what the filter badge counts, and the
 * empty state. The panel is dev-only, but these are the branches a reader of
 * the overlay actually relies on.
 *
 * Not covered here, deliberately: the ~900 lines of CSS in
 * `event-timeline-panel.styles.ts` (no logic beyond the one recording branch
 * asserted below), and the `watch*` capture methods, which hook global
 * `dataLayer` / EventBus / performance APIs and belong in E2E.
 */
import { describe, it, expect } from 'vitest';
import { EventTimelinePanel } from '../panels/event-timeline/event-timeline-panel';
import { eventTimelinePanelStyles } from '../panels/event-timeline/event-timeline-panel.styles';

const EVENTS = [
  {
    id: 'e1',
    timestamp: Date.now() - 1000,
    relativeTime: '1s ago',
    type: 'datalayer',
    name: 'dl_purchase',
    source: 'GTM',
    data: { event: 'dl_purchase', ecommerce: { value: 10, currency: 'USD' } },
  },
  {
    id: 'e2',
    timestamp: Date.now(),
    relativeTime: 'now',
    type: 'internal',
    name: 'cart:updated',
    source: 'EventBus',
    data: { items: 2 },
  },
];

/** A panel in a known state — the constructor otherwise restores localStorage. */
function panel(over: Record<string, unknown> = {}): Record<string, unknown> {
  const p = new EventTimelinePanel() as unknown as Record<string, unknown>;
  Object.assign(p, {
    events: structuredClone(EVENTS),
    selectedEventId: null,
    selectedDetailTab: 'flow',
    selectedFlowNode: null,
    searchTerm: '',
    providerFilter: null,
    issuesOnly: false,
    filterDrawerOpen: false,
    view: 'analytics',
    isRecording: true,
    showInternalEvents: false,
    ...over,
  });
  return p;
}

const render = (p: Record<string, unknown>): string =>
  (p.getContent as () => string).call(p);

describe('EventTimelinePanel.getContent', () => {
  it('ships its stylesheet and the panel body in one string', () => {
    const html = render(panel());
    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
    expect(html).toContain('events-table-container');
  });

  it('counts only dl_ events in the analytics view, everything in the events view', () => {
    expect(render(panel())).toContain('dl_ events');
    expect(render(panel({ view: 'events' }))).toContain('Total captured');
  });

  it('shows the empty state instead of a table when nothing matches', () => {
    const html = render(panel({ events: [] }));
    expect(html).not.toContain('<table class="events-table">');

    const noMatch = render(panel({ searchTerm: 'nothing-matches-this' }));
    expect(noMatch).not.toContain('<table class="events-table">');
  });

  it('renders a table once at least one event survives the filters', () => {
    expect(render(panel())).toContain('<table class="events-table">');
  });

  it('opens the modal only for the selected event', () => {
    expect(render(panel())).not.toContain('<div class="event-modal-overlay"');
    const open = render(panel({ selectedEventId: 'e1' }));
    expect(open).toContain('event-modal-overlay');
    expect(open).toContain('dl_purchase');
  });

  it('badges the filter button with the number of active filters', () => {
    expect(render(panel())).not.toContain('<span class="filter-button-badge">');
    const filtered = render(
      panel({ searchTerm: 'dl_', providerFilter: 'gtm', issuesOnly: true })
    );
    expect(filtered).toContain('<span class="filter-button-badge">3</span>');
  });

  it('reports recording versus paused', () => {
    expect(render(panel())).toContain('<span>Recording</span>');
    expect(render(panel({ isRecording: false }))).toContain(
      '<span>Paused</span>'
    );
  });

  it('installs the inline-onclick handlers the markup calls back into', () => {
    render(panel());
    const w = window as unknown as Record<string, unknown>;
    expect(typeof w.eventTimelinePanel_showModal).toBe('function');
    expect(typeof w.eventTimelinePanel_closeModal).toBe('function');
    expect(typeof w.eventTimelinePanel_clearFilters).toBe('function');
  });
});

describe('eventTimelinePanelStyles', () => {
  it('animates the recording dot only while recording', () => {
    expect(eventTimelinePanelStyles(true)).toContain(
      'animation: pulse 1.5s infinite;'
    );
    expect(eventTimelinePanelStyles(false)).not.toContain(
      'animation: pulse 1.5s infinite;'
    );
  });
});
