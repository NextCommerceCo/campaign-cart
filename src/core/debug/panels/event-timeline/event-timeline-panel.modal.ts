/**
 * The event detail modal: header/meta, the Flow/Validation tab bar, and the
 * open/close lifecycle. Extracted verbatim from `event-timeline-panel.ts`
 * (see docs/code-findings.md #147) — logic unchanged. `showEventModal`/
 * `closeEventModal` mutate the panel's `selectedEventId`/`selectedFlowNode`
 * and dispatch the same `debug:update-content` CustomEvent inline rather than
 * calling `requestRerender()` — that duplication already existed in the
 * original class and is preserved as-is, not consolidated here.
 */
import { lucide } from '../../icons';
import type { DeliveryRecord } from '@/core/analytics/debug/analytics-debug-tracker';
import {
  worstLevel,
  type EventValidationIssue,
  type EventCheck,
} from '../ecommerce-event-validator';
import {
  renderValidationSection,
  type ValidationRenderDeps,
} from './event-timeline-panel.validation';
import { renderFlowDetail, type FlowRenderDeps } from './event-timeline-panel.flow';
import type { DetailTab, TimelineEvent } from './event-timeline-panel.types';

/** Live read/write view the modal's open/close needs from the panel. */
export interface ModalHost {
  selectedEventId: string | null;
  selectedFlowNode: string | null;
  readonly panelId: string;
}

export function showEventModal(host: ModalHost, eventId: string): void {
  host.selectedEventId = eventId;
  // Each freshly opened event starts on its source node.
  host.selectedFlowNode = null;
  // Trigger re-render
  if (typeof document !== 'undefined') {
    document.dispatchEvent(
      new CustomEvent('debug:update-content', {
        detail: { panelId: host.panelId },
      })
    );
  }
}

export function closeEventModal(host: ModalHost): void {
  host.selectedEventId = null;
  // Trigger re-render
  if (typeof document !== 'undefined') {
    document.dispatchEvent(
      new CustomEvent('debug:update-content', {
        detail: { panelId: host.panelId },
      })
    );
  }
}

/** Pure helpers `renderDetailTabs` needs from the panel. */
export interface DetailTabsDeps {
  getDeliveriesForEvent(event: TimelineEvent): DeliveryRecord[];
  getEventIssues(event: TimelineEvent): EventValidationIssue[];
  getEventChecks(event: TimelineEvent): EventCheck[];
  noValidationReason(event: TimelineEvent): string;
  validationDeps(): ValidationRenderDeps;
  flowDeps(): FlowRenderDeps;
}

/** Tabbed detail body for the event modal: Flow / Validation. */
export function renderDetailTabs(
  event: TimelineEvent,
  selectedDetailTab: DetailTab,
  selectedFlowNode: string | null,
  deps: DetailTabsDeps
): string {
  const deliveryCount = deps.getDeliveriesForEvent(event).length;
  const issues = deps.getEventIssues(event);
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
      class="detail-tab ${selectedDetailTab === id ? 'active' : ''}"
      onclick="window.eventTimelinePanel_setTab('${id}')">
      ${label}${badge}
    </button>`;

  const body =
    selectedDetailTab === 'validation'
      ? renderValidationSection(deps.getEventChecks(event), deps.validationDeps()) ||
        `<div class="delivery-empty">${deps.noValidationReason(event)}</div>`
      : renderFlowDetail(event, selectedFlowNode, deps.flowDeps());

  return `
    <div class="detail-tabs">
      ${tab('flow', 'Flow', flowBadge)}
      ${tab('validation', 'Validation', validationBadge)}
    </div>
    <div class="detail-tab-body detail-tab-body-${selectedDetailTab}">${body}</div>`;
}

/** Pure helpers `renderEventModal` needs from the panel, beyond the detail tabs. */
export interface EventModalDeps extends DetailTabsDeps {
  getEventTypeColor(type: string): string;
  getEventTypeBadge(type: string): string;
  formatTimestamp(timestamp: number): string;
}

/** The detail modal for one selected event. */
export function renderEventModal(
  selectedEvent: TimelineEvent,
  selectedDetailTab: DetailTab,
  selectedFlowNode: string | null,
  deps: EventModalDeps
): string {
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
              <span class="event-type-badge" style="background: ${deps.getEventTypeColor(selectedEvent.type)}22; color: ${deps.getEventTypeColor(selectedEvent.type)};">
                ${deps.getEventTypeBadge(selectedEvent.type)}
              </span>
            </span>
            <span class="event-modal-meta-item">
              <span class="event-modal-meta-label">Source</span>
              <span>${selectedEvent.source}</span>
            </span>
            <span class="event-modal-meta-item">
              <span class="event-modal-meta-label">Time</span>
              <span>${deps.formatTimestamp(selectedEvent.timestamp)}</span>
              <span class="event-modal-meta-muted">· ${selectedEvent.relativeTime}</span>
            </span>
          </div>
          ${renderDetailTabs(selectedEvent, selectedDetailTab, selectedFlowNode, deps)}
        </div>
      </div>
    </div>
  `;
}
