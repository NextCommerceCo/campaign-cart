import type { Logger } from './log';
import type { Attribution } from './attribution';
import type { ApiLine, CartLine, CartState, CartSummary } from './cart/types';
import type { Campaign, Order, OrderLine } from './types';

export interface ExitIntentDetail {
  imageUrl?: string;
  template?: string;
}

export type AnalyticsName =
  | 'page_view'
  | 'view_item'
  | 'view_item_list'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'update_cart'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase'
  | 'upsell_purchase'
  | 'view_upsell'
  | 'skip_upsell';

export interface AnalyticsContext {
  page_location: string;
  page_title: string;
  page_referrer: string;
  campaign_name?: string;
  campaign_currency?: string;
  campaign_language?: string;
  attribution: Attribution;
}

export interface AnalyticsEvent {
  name: AnalyticsName;
  id: string;
  time: string;
  params: Record<string, unknown>;
  context: AnalyticsContext;
}

export interface AnalyticsTrace {
  trace: 'analytics';
  trigger: EventName;
  name: string;
  sent: boolean;
  reason: string;
  id?: string;
}

export interface EventMap {
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
  'cart.updated': { cart: CartState };
  'cart.calculated': { summary: CartSummary };
  'coupon.refused': { code: string };
  'selection.changed': { selectorId: string; cardId: string; items: CartLine[] };
  'shipping.changed': { methodId: number | undefined };
  'storage.degraded': { reason: string };
  ready: { lines: ApiLine[] };
  'checkout.started': { lines: ApiLine[] };
  'checkout.shipping-added': { tier: string };
  'checkout.payment-added': { method: string };
  'prospect.saved': { cart: unknown; email: string; phone?: string };
  'order.placed': { order: Order };
  'order.loaded': {
    order: Order;
    purchase?: string;
    coupon?: string;
    upsells?: Array<{ id: string; number: number; line: OrderLine }>;
  };
  'upsell.viewed': { refId: string; page: string };
  'upsell.accepted': { refId: string; lines: ApiLine[] };
  'upsell.skipped': { refId: string; packageId?: number };
  'exit-intent.shown': ExitIntentDetail;
  'exit-intent.clicked': ExitIntentDetail;
  'exit-intent.dismissed': ExitIntentDetail;
  'exit-intent.closed': ExitIntentDetail;
  'exit-intent.action': ExitIntentDetail & { action?: string; couponCode?: string };
  error: { action: string; message: string };
  analytics: AnalyticsEvent;
}

export type EventName = keyof EventMap;

export interface EngineEvent<K extends EventName = EventName> {
  name: K;
  data: EventMap[K];
  at: number;
}

type Listener = (event: EngineEvent) => void;

const BUFFER_SIZE = 100;

export class Events {
  private listeners = new Map<string, Set<Listener>>();
  private buffer: EngineEvent[] = [];
  private queue: EngineEvent[] = [];
  private emitting = false;

  constructor(private log: Logger) {}

  emit<K extends EventName>(name: K, data: EventMap[K]): void {
    const event: EngineEvent = { name, data, at: Date.now() };
    this.buffer.push(event);
    if (this.buffer.length > BUFFER_SIZE)
      this.buffer.splice(
        this.buffer.findIndex((e) => e.name !== 'ready'),
        1,
      );
    this.queue.push(event);
    if (this.emitting) return;
    this.emitting = true;
    try {
      for (let next = this.queue.shift(); next; next = this.queue.shift()) {
        const current = next;
        for (const key of [current.name, '*'])
          [...(this.listeners.get(key) ?? [])].forEach((fn) => this.deliver(fn, current));
      }
    } finally {
      this.emitting = false;
    }
  }

  on<K extends EventName>(
    name: K | '*',
    fn: (event: EngineEvent<K>) => void,
    options: { replay?: boolean } = {},
  ): () => void {
    const listener = fn as Listener;
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    set.add(listener);
    if (options.replay)
      this.buffer.filter((e) => name === '*' || e.name === name).forEach((e) => this.deliver(listener, e));
    return () => set.delete(listener);
  }

  private deliver(fn: Listener, event: EngineEvent): void {
    try {
      fn(event);
    } catch (err) {
      this.log.error(`subscriber failed on ${event.name}`, err);
    }
  }
}
