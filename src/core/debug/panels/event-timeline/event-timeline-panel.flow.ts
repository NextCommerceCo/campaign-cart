/**
 * The Flow tab of the event detail modal: a node graph of the event's fan-out
 * to each analytics provider. Extracted verbatim from `event-timeline-panel.ts`
 * (see docs/code-findings.md #137) — one of the two seams the finding notes as
 * moving no cited symbol, so it needed no doc regeneration on its own. Every
 * function here was already pure (no instance field beside the one read-only
 * `selectedFlowNode` value, passed as a plain parameter since rendering is
 * synchronous — no async gap to go stale across).
 */
import type {
  DeliveryRecord,
  DeliveryStatus,
} from '@/core/analytics/debug/analytics-debug-tracker';
import { lucide, type IconName } from '../../icons';
import { RawDataHelper } from '../raw-data-helper';
import {
  DELIVERY_STATUS_COLOR,
  DELIVERY_STATUS_ICON,
  type TimelineEvent,
} from './event-timeline-panel.types';

// Flow-graph geometry for the event modal: fixed provider-node height/gap and
// the connector-wire column width, all in px. The SVG connectors are drawn from
// these numbers, so they must stay in sync with the .flow-node / .flow-col-wire
// CSS further down.
const FLOW_NODE_H = 42;
const FLOW_NODE_GAP = 8;
const FLOW_WIRE_W = 44;

/** Pure helpers the flow graph needs, supplied by the panel that renders it. */
export interface FlowRenderDeps {
  getDeliveriesForEvent(event: TimelineEvent): DeliveryRecord[];
  getEventId(event: TimelineEvent): string | undefined;
  formatDeliveryDuration(ms?: number): string;
  providerIcon(name: string): IconName | null;
  escapeHtml(value: string): string;
  escapeAttr(value: string): string;
}

/**
 * The source node — the original event every provider branches from. Shows a
 * per-status delivery summary (e.g. "3 sent · 1 skipped") so you can gauge the
 * fan-out without clicking each provider.
 */
function renderFlowSourceNode(
  event: TimelineEvent,
  deliveries: DeliveryRecord[],
  active: boolean,
  deps: FlowRenderDeps
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
      <span class="flow-node-name">${deps.escapeHtml(event.name)}</span>
      <span class="flow-node-sub">${sub}</span>
      ${summary ? `<span class="flow-summary">${summary}</span>` : ''}
    </button>`;
}

/**
 * One provider node as a single table-like row: brand + name on the left,
 * status + duration right-aligned. Tinted by status, clickable for its payload.
 */
function renderFlowProviderNode(
  record: DeliveryRecord,
  active: boolean,
  deps: FlowRenderDeps
): string {
  const color = DELIVERY_STATUS_COLOR[record.status];
  const brand = deps.providerIcon(record.provider);
  const glyph = brand ? `${lucide(brand, { size: 14 })} ` : '';
  const duration = deps.formatDeliveryDuration(record.durationMs);
  return `
    <button class="flow-node flow-node-provider ${active ? 'active' : ''}"
            style="--accent:${color}"
            onclick="window.eventTimelinePanel_selectFlowNode('${deps.escapeAttr(record.id)}')">
      <span class="flow-node-dot" style="background:${color}"></span>
      <span class="flow-node-name">${glyph}${deps.escapeHtml(record.provider)}</span>
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
function renderFlowWire(
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
function renderFlowSourcePanel(
  event: TimelineEvent,
  providerCount: number,
  deps: FlowRenderDeps
): string {
  return `
    <div class="flow-detail-head">
      <span class="flow-detail-title">Original event · ${deps.escapeHtml(event.name)}</span>
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
function renderFlowProviderPanel(
  record: DeliveryRecord,
  deps: FlowRenderDeps
): string {
  const provider = deps.escapeHtml(record.provider);
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
      note = noteHtml(deps.escapeHtml(record.detail || 'blocked by config'));
      break;
    case 'skipped':
      title = `Skipped — nothing sent to ${provider}`;
      note = noteHtml(
        deps.escapeHtml(record.detail || 'not handled by this provider')
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
      ? `<span>${deps.formatDeliveryDuration(record.durationMs)}</span>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const error = record.error
    ? `<div class="flow-detail-error">${deps.escapeHtml(record.error)}</div>`
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

/**
 * The Flow tab: a node graph of the event. The source ("Original event") node
 * on the left fans out to one node per provider that handled it; the panel
 * below shows the selected node's payload — the original event for the source
 * node, the transformed payload each provider actually dispatched otherwise.
 */
export function renderFlowDetail(
  event: TimelineEvent,
  selectedFlowNode: string | null,
  deps: FlowRenderDeps
): string {
  const deliveries = deps.getDeliveriesForEvent(event);

  // No provider deliveries: still show the source node + original event, plus
  // why nothing fanned out.
  if (deliveries.length === 0) {
    return `
      <div class="flow">
        <div class="flow-graph flow-graph-solo">
          ${renderFlowSourceNode(event, [], true, deps)}
        </div>
        <div class="flow-detail">
          <div class="delivery-empty">
            No provider deliveries recorded for this event.
            ${
              deps.getEventId(event)
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
  const selected = selectedFlowNode
    ? (deliveries.find(d => d.id === selectedFlowNode) ?? null)
    : null;

  const providerNodes = deliveries
    .map(d => renderFlowProviderNode(d, selected?.id === d.id, deps))
    .join('');

  const detail = selected
    ? renderFlowProviderPanel(selected, deps)
    : renderFlowSourcePanel(event, deliveries.length, deps);

  return `
    <div class="flow">
      <div class="flow-graph">
        <div class="flow-col flow-col-source">
          ${renderFlowSourceNode(event, deliveries, selected === null, deps)}
        </div>
        <div class="flow-col flow-col-wire">
          ${renderFlowWire(deliveries, selected?.id ?? null)}
        </div>
        <div class="flow-col flow-col-providers">
          ${providerNodes}
        </div>
      </div>
      <div class="flow-detail">${detail}</div>
    </div>`;
}
