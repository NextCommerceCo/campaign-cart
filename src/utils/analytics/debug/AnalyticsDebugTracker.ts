/**
 * Analytics Debug Tracker
 *
 * In-memory telemetry for the analytics provider layer, consumed by the debug
 * overlay's Provider panels. It answers two questions the dataLayer timeline
 * cannot: which providers are wired up right now, and what each provider
 * actually did with every event (sent / blocked / failed / still pending).
 *
 * It is a passive sink — the {@link ProviderAdapter} base self-registers and
 * reports outcomes here. Recording is cheap (a capped ring buffer) so it stays
 * on in all builds; the panels simply read the latest snapshot on render.
 */

import type { ProviderAdapter } from '../providers/ProviderAdapter';

/** Outcome of handing one event to one provider. */
export type DeliveryStatus = 'pending' | 'sent' | 'blocked' | 'failed';

/** A single provider's handling of a single event. */
export interface DeliveryRecord {
  /** Unique record id (used to update `pending` → `sent`/`failed`). */
  id: string;
  /** The provider/adapter name, e.g. `GTM`. */
  provider: string;
  /** The event name, e.g. `dl_purchase`. */
  eventName: string;
  /** The originating event's `event_id`, when present. */
  eventId?: string;
  /** Current delivery status. */
  status: DeliveryStatus;
  /** Epoch ms when the record was created. */
  timestamp: number;
  /** Human-readable note, e.g. `blockedEvents` or a mapped provider event name. */
  detail?: string;
  /** Error message when `status === 'failed'`. */
  error?: string;
  /** The original event payload handed to the provider, for inspection. */
  payload?: unknown;
  /**
   * The transformed payload the provider actually dispatched to its destination
   * (e.g. Facebook's mapped parameters, the NextCampaign API body, the GTM push).
   * Undefined when the provider doesn't report one, or for blocked/failed sends.
   */
  sentPayload?: unknown;
  /**
   * Time in ms from dispatch to resolution (`sent`/`failed`). Undefined while
   * still `pending` or for instantly-`blocked` records.
   */
  durationMs?: number;
}

/** A point-in-time snapshot of a provider's configuration and readiness. */
export interface ProviderDebugInfo {
  /** Adapter name. */
  name: string;
  /** Whether the adapter is currently enabled. */
  enabled: boolean;
  /** Whether the provider can deliver right now (external script loaded, etc.). */
  ready: boolean;
  /** Event names this provider drops. */
  blockedEvents: string[];
  /** Adapter-specific diagnostics (pixel id, endpoint, queue size, …). */
  details: Record<string, string | number | boolean>;
}

const MAX_RECORDS = 250;
let recordCounter = 0;

export class AnalyticsDebugTracker {
  private static instance: AnalyticsDebugTracker;
  private providers = new Set<ProviderAdapter>();
  private deliveries: DeliveryRecord[] = [];
  private listeners = new Set<() => void>();

  public static getInstance(): AnalyticsDebugTracker {
    if (!AnalyticsDebugTracker.instance) {
      AnalyticsDebugTracker.instance = new AnalyticsDebugTracker();
    }
    return AnalyticsDebugTracker.instance;
  }

  /**
   * Subscribe to changes (new/updated/cleared deliveries, provider
   * registration). Lets the debug panels re-render only when something actually
   * changed instead of polling on a timer. Returns an unsubscribe function.
   */
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Notify subscribers that the tracked data changed. */
  private notify(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch {
        // A misbehaving panel listener must not break telemetry recording.
      }
    });
  }

  /** Register a live adapter so the Provider Status panel can enumerate it. */
  public registerProvider(provider: ProviderAdapter): void {
    this.providers.add(provider);
    this.notify();
  }

  /** Remove an adapter (e.g. on teardown). */
  public unregisterProvider(provider: ProviderAdapter): void {
    this.providers.delete(provider);
    this.notify();
  }

  /** Current status of every registered provider. */
  public getProviders(): ProviderDebugInfo[] {
    return Array.from(this.providers).map(provider => provider.getDebugInfo());
  }

  /**
   * Record a delivery attempt. Returns the record id so an async provider can
   * later resolve it via {@link update}.
   */
  public record(
    provider: string,
    eventName: string,
    status: DeliveryStatus,
    opts: {
      eventId?: string;
      detail?: string;
      error?: string;
      payload?: unknown;
    } = {}
  ): string {
    const id = `dlv_${++recordCounter}`;
    this.deliveries.push({
      id,
      provider,
      eventName,
      status,
      timestamp: Date.now(),
      eventId: opts.eventId,
      detail: opts.detail,
      error: opts.error,
      payload: opts.payload,
    });

    // Keep the buffer bounded — drop the oldest records.
    if (this.deliveries.length > MAX_RECORDS) {
      this.deliveries.splice(0, this.deliveries.length - MAX_RECORDS);
    }

    this.notify();
    return id;
  }

  /** Resolve a previously recorded `pending` delivery. */
  public update(
    id: string,
    status: DeliveryStatus,
    opts: { detail?: string; error?: string; sentPayload?: unknown } = {}
  ): void {
    const record = this.deliveries.find(delivery => delivery.id === id);
    if (!record) return;
    record.status = status;
    record.durationMs = Date.now() - record.timestamp;
    if (opts.detail !== undefined) record.detail = opts.detail;
    if (opts.error !== undefined) record.error = opts.error;
    if (opts.sentPayload !== undefined) record.sentPayload = opts.sentPayload;
    this.notify();
  }

  /** All delivery records, oldest first. */
  public getDeliveries(): readonly DeliveryRecord[] {
    return this.deliveries;
  }

  /** Clear the delivery log (provider registrations are kept). */
  public clear(): void {
    this.deliveries = [];
    this.notify();
  }
}

/** Shared singleton instance. */
export const analyticsDebug = AnalyticsDebugTracker.getInstance();
