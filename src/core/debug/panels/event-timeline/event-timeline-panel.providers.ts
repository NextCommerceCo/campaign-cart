/**
 * Provider delivery correlation: joining a dataLayer event to which analytics
 * providers received it, and rendering that correlation both as compact row
 * chips (`renderDeliverySummary`) and as the top-of-table provider status strip
 * (`renderProviderStrip`). Extracted verbatim from `event-timeline-panel.ts`
 * (see docs/code-findings.md #147) — logic unchanged. `getEventId`,
 * `getDeliveriesForEvent`, `formatDeliveryDuration`, `providerAbbrev`, and
 * `providerIcon` never touched `this` in the original either — they read only
 * their own arguments plus the module-level `analyticsDebug` singleton — so
 * they move as plain functions with no host/context object at all.
 */
import {
  analyticsDebug,
  type DeliveryRecord,
  type ProviderDebugInfo,
} from '@/core/analytics/debug/analytics-debug-tracker';
import { lucide, type IconName } from '../../icons';
import {
  DELIVERY_STATUS_COLOR,
  DELIVERY_STATUS_ICON,
  type TimelineEvent,
} from './event-timeline-panel.types';

/** Pure helpers `renderDeliverySummary`/`renderProviderStrip` need from the panel. */
export interface ProviderRenderDeps {
  escapeHtml(value: string): string;
  escapeAttr(value: string): string;
}

export function getEventId(event: TimelineEvent): string | undefined {
  const id = event.data?.event_id;
  return typeof id === 'string' ? id : undefined;
}

/** Delivery records that belong to this timeline event (matched by event_id). */
export function getDeliveriesForEvent(event: TimelineEvent): DeliveryRecord[] {
  const eventId = getEventId(event);
  if (!eventId) return [];
  return analyticsDebug
    .getDeliveries()
    .filter(record => record.eventId === eventId);
}

export function formatDeliveryDuration(ms?: number): string {
  if (ms === undefined) return '';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Short provider label for compact row chips (Facebook → FB, RudderStack → RS).
 * Falls back to the capital-letter acronym, then the first 3 characters.
 */
function providerAbbrev(name: string): string {
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
export function providerIcon(name: string): IconName | null {
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
 * Per-provider delivery chips shown on an event row — one chip per provider
 * that handled the event, tinted by its delivery status (sent/failed/…), so
 * you can see at a glance who received it without opening the modal.
 */
export function renderDeliverySummary(
  event: TimelineEvent,
  deps: ProviderRenderDeps
): string {
  const deliveries = getDeliveriesForEvent(event);
  if (deliveries.length === 0) return '';

  const chips = deliveries
    .map(d => {
      const color = DELIVERY_STATUS_COLOR[d.status];
      const duration = formatDeliveryDuration(d.durationMs);
      const title =
        `${d.provider}: ${d.status}` +
        (duration ? ` · ${duration}` : '') +
        (d.error ? ` · ${d.error}` : d.detail ? ` · ${d.detail}` : '');
      // Lead with the provider's brand glyph when it has one; otherwise the
      // status icon. Either way the chip colour still encodes delivery status.
      const brand = providerIcon(d.provider);
      const glyph = brand
        ? lucide(brand, { size: 11 })
        : lucide(DELIVERY_STATUS_ICON[d.status], { size: 11 });
      return `<span class="delivery-chip" style="--chip:${color}" title="${deps.escapeAttr(title)}">${glyph}<span class="delivery-chip-name">${deps.escapeHtml(providerAbbrev(d.provider))}</span></span>`;
    })
    .join('');

  return `<span class="delivery-summary" title="Provider delivery">${chips}</span>`;
}

/** Top strip: which analytics providers are registered and ready. */
export function renderProviderStrip(
  providerFilter: string | null,
  deps: ProviderRenderDeps
): string {
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
      const brand = providerIcon(p.name);
      const brandIcon = brand
        ? `<span class="provider-chip-brand">${lucide(brand, { size: 13 })}</span>`
        : '';
      const state = !p.enabled ? 'disabled' : p.ready ? 'ready' : 'not ready';
      const blocked =
        p.blockedEvents.length > 0
          ? ` · blocks ${p.blockedEvents.length}`
          : '';
      const active = providerFilter === p.name ? ' active' : '';
      const hint = `${p.name}: ${state}${blocked} · click to filter timeline`;
      return `
        <button
          class="provider-chip${active}"
          title="${deps.escapeHtml(hint)}"
          onclick="window.eventTimelinePanel_filterProvider('${deps.escapeAttr(p.name)}')">
          ${brandIcon}
          <span class="provider-chip-name">${deps.escapeHtml(p.name)}</span>
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
