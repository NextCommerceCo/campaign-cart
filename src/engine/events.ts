import type { Logger } from './log';
import type { Attribution } from './attribution';
import type { ApiLine, CartLine, CartState, CartSummary } from './cart/types';
import type { Campaign, CheckoutError, Order, OrderLine } from './types';

export interface PromotionDetail {
  source: 'exit_intent';
  image_url?: string;
  template?: string;
}

export type AddressType = 'shipping' | 'billing';

export interface Contact {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

export type SelectorType = 'bundle' | 'offer' | 'toggle';

export interface CartChangeLine {
  package_id: number;
  quantity: number;
  unit_price: string;
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
  | 'skip_upsell'
  | 'generate_lead'
  | 'view_promotion'
  | 'select_promotion';

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
  'sdk.ready': { lines: ApiLine[] };
  'sdk.error': { action: string; message: string };
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
  'selector.selected': { selector_id: string; type: SelectorType; card_id?: string; items: CartLine[] };
  'selector.deselected': { selector_id: string; type: SelectorType };
  'selector.calculating': { selector_id: string; type: SelectorType };
  'selector.calculated': {
    selector_id: string;
    type: SelectorType;
    quotes: Record<string, CartSummary>;
    from_cache: boolean;
  };
  'cart.updated': { cart: CartState };
  'cart.calculating': { lines: ApiLine[] };
  'cart.calculated': { summary: CartSummary };
  'cart.added': { lines: CartChangeLine[]; priced: boolean };
  'cart.removed': { lines: CartChangeLine[]; priced: boolean };
  'coupon.applied': { code: string };
  'coupon.removed': { code: string };
  'coupon.denied': { code: string };
  'checkout.started': { lines: ApiLine[] };
  'contact.entered': Contact & { cart: unknown };
  'contact.updated': Contact;
  'address.entered': { type: AddressType; country: string };
  'address.updated': { type: AddressType; country: string };
  'shipping.selected': {
    method_id: number | undefined;
    method?: { ref_id: number; code: string; price: string };
  };
  'payment.selected': { method: string };
  'checkout.submitted': { payment_method: string; valid: boolean; errors: Record<string, CheckoutError> };
  'order.created': { order: Order };
  'order.failed': { stage: 'order' | 'payment'; code: string; message?: string; decline?: string; ref_id?: string };
  'order.loaded': {
    order: Order;
    purchase?: string;
    coupon?: string;
    upsells?: Array<{ id: string; number: number; line: OrderLine }>;
  };
  'upsell.viewed': { ref_id: string; page: string };
  'upsell.accepted': { ref_id: string; lines: ApiLine[]; order: Order };
  'upsell.skipped': { ref_id: string; package_id?: number };
  'upsell.failed': { ref_id: string; code: string; message?: string };
  'promotion.viewed': PromotionDetail;
  'promotion.clicked': PromotionDetail & { action?: string; coupon_code?: string };
  'promotion.closed': PromotionDetail & { reason: 'dismissed' | 'closed' };
  analytics: AnalyticsEvent;
}

export type EventName = keyof EventMap;

export interface EngineEvent<K extends EventName = EventName> {
  id: string;
  name: K;
  data: EventMap[K];
  at: number;
}

let sequence = 0;
const eventId = () =>
  `evt_${Date.now().toString(36)}${(sequence++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

type Listener = (event: EngineEvent) => void;

const BUFFER_SIZE = 100;

export class Events {
  private listeners = new Map<string, Set<Listener>>();
  private buffer: EngineEvent[] = [];
  private queue: EngineEvent[] = [];
  private emitting = false;

  constructor(private log: Logger) {}

  emit<K extends EventName>(name: K, data: EventMap[K]): void {
    const event: EngineEvent = { id: eventId(), name, data, at: Date.now() };
    this.buffer.push(event);
    if (this.buffer.length > BUFFER_SIZE)
      this.buffer.splice(
        this.buffer.findIndex((e) => e.name !== 'sdk.ready'),
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
