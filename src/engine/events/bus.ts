import { newId } from '../id';
import type { Logger } from '../log';
import type { AnalyticsEvents } from './analytics';
import type { CartEvents } from './carts';
import type { CheckoutEvents } from './checkout';
import type { CouponEvents } from './coupons';
import type { OrderEvents } from './orders';
import type { PaymentEvents } from './payments';
import type { PromotionEvents } from './promotions';
import type { SdkEvents } from './sdk';
import type { SelectorEvents } from './selectors';
import type { UpsellEvents } from './upsells';

export interface EventMap
  extends
    SdkEvents,
    SelectorEvents,
    CartEvents,
    CouponEvents,
    CheckoutEvents,
    PaymentEvents,
    OrderEvents,
    UpsellEvents,
    PromotionEvents,
    AnalyticsEvents {}

export type EventName = keyof EventMap;

declare const __VERSION__: string;

export interface EngineEvent<K extends EventName = EventName> {
  id: string;
  name: K;
  data: EventMap[K];
  at: number;
}

/** What every event `next.on` and `next.analytics.on` hand out carries, shaped like a webhook. */
export interface Envelope {
  event_id: string;
  /** What `data` is, such as `order`. */
  object: string;
  created_at: string;
  /** The campaign session: the `ncsid` the NEXT analytics script and the Campaigns API share. */
  session_id: string;
  sdk_version: string;
}

export interface SdkEvent<K extends EventName = EventName> extends Envelope {
  event_type: K;
  data: EventMap[K];
}

/** An event in its envelope; `object` is the event's group (`cart` for `cart.updated`) unless given. */
export const envelope = <N extends string, D>(
  e: { id: string; name: N; data: D; at: number },
  sessionId: string,
  object = e.name.split('.')[0]!,
) => ({
  event_id: e.id,
  event_type: e.name,
  object,
  data: e.data,
  created_at: new Date(e.at).toISOString(),
  session_id: sessionId,
  sdk_version: __VERSION__,
});

type Listener = (event: EngineEvent) => void;

const BUFFER_SIZE = 100;

const INTERNAL_EVENTS = [
  'analytics',
  'campaign.loaded',
  'selector.bound',
  'shipping.settled',
  'upsell.shown',
  'upsell.declined',
] as const satisfies readonly EventName[];

/** The SDK's own events, which `next.on` does not take. */
export type InternalEventName = (typeof INTERNAL_EVENTS)[number];

const INTERNAL: ReadonlySet<EventName> = new Set<EventName>(INTERNAL_EVENTS);
const PUBLIC_EVENTS: Record<Exclude<EventName, InternalEventName>, true> = {
  'sdk.ready': true,
  'sdk.error': true,
  'selector.viewed': true,
  'selector.selected': true,
  'selector.updated': true,
  'selector.deselected': true,
  'selector.pricing': true,
  'selector.priced': true,
  'cart.updated': true,
  'cart.calculating': true,
  'cart.calculated': true,
  'cart.added': true,
  'cart.removed': true,
  'shipping.selected': true,
  'coupon.applied': true,
  'coupon.removed': true,
  'coupon.denied': true,
  'checkout.started': true,
  'user.created': true,
  'user.updated': true,
  'address.entered': true,
  'address.updated': true,
  'address.autofilled': true,
  'payment.selected': true,
  'checkout.continued': true,
  'checkout.submitted': true,
  'checkout.invalid': true,
  'checkout.failed': true,
  'checkout.completed': true,
  'payment.redirected': true,
  'payment.failed': true,
  'order.created': true,
  'order.loaded': true,
  'order.paid': true,
  'order.updated': true,
  'upsell.viewed': true,
  'upsell.accepted': true,
  'upsell.skipped': true,
  'upsell.failed': true,
  'promotion.viewed': true,
  'promotion.clicked': true,
  'promotion.closed': true,
};
/** The names `next.on` takes. */
export const PUBLIC: ReadonlySet<string> = new Set(Object.keys(PUBLIC_EVENTS));

const STATE_SYNC: ReadonlySet<EventName> = new Set<EventName>([
  'cart.updated',
  'cart.calculating',
  'cart.calculated',
  'selector.pricing',
  'selector.priced',
]);

/** @internal */
export class Events {
  private listeners = new Map<string, Set<Listener>>();
  private buffer: EngineEvent[] = [];
  private queue: EngineEvent[] = [];
  private emitting = false;

  constructor(private log: Logger) {}

  emit<K extends EventName>(name: K, data: EventMap[K]): void {
    const event: EngineEvent = { id: newId(), name, data, at: Date.now() };
    const drop =
      this.buffer.length >= BUFFER_SIZE &&
      (this.buffer.find((e) => STATE_SYNC.has(e.name)) ??
        this.buffer.find((e) => INTERNAL.has(e.name)) ??
        this.buffer.find((e) => e.name !== 'sdk.ready'));
    this.buffer = [...this.buffer.filter((e) => e !== drop), event];
    this.queue.push(event);
    this.drain();
  }

  /** Sends the events `fn` emits as one block: listeners run after the last of them. */
  batch(fn: () => void): void {
    if (this.emitting) return fn();
    this.emitting = true;
    try {
      fn();
    } finally {
      this.emitting = false;
    }
    this.drain();
  }

  on<K extends EventName>(
    name: K | '*',
    fn: (event: EngineEvent<K>) => void,
    options: { replay?: boolean } = {},
  ): () => void {
    let set = this.listeners.get(name);
    if (!set) this.listeners.set(name, (set = new Set()));
    if (options.replay)
      this.drain(
        (e) => (name === '*' || e.name === name) && this.deliver(fn as Listener, e),
        this.buffer.filter((e) => !this.queue.includes(e)),
      );
    set.add(fn as Listener);
    return () => set.delete(fn as Listener);
  }

  private drain(late?: (event: EngineEvent) => unknown, past?: EngineEvent[]): void {
    if (this.emitting) return past?.forEach(late!);
    this.emitting = true;
    try {
      for (let next, old; (next = this.queue.shift()) || (old = past?.shift());) {
        if (!next) late!(old!);
        else {
          for (const fn of [next.name, '*'].flatMap((key) => [...(this.listeners.get(key) ?? [])]))
            this.deliver(fn, next);
          past?.push(next);
        }
      }
    } finally {
      this.emitting = false;
    }
  }

  private deliver(fn: Listener, event: EngineEvent): void {
    try {
      fn(event);
    } catch (err) {
      this.log.error(`subscriber failed on ${event.name}`, err);
    }
  }
}
