import type { Engine } from '../../engine/engine';
import type { EngineEvent, EventName } from '../../engine/events/bus';
import type { Checkout } from '../../engine/events/checkout';
import type { State } from '../../engine/types';
import type { WidgetEvents } from '../widgets';
import { firstPackage, type From, LATER, LEGACY_EVENTS, type LegacyEvent, type LegacyState, noteClick } from './events';

type Shape = (data: never, state: State) => unknown;

/** @deprecated What an exit popup was given, by its Promotion id: 0.4.x payloads name its image and template. */
export interface LegacyPopup {
  imageUrl: string;
  /** The template the popup shows; '' for an image popup. */
  template: string;
}

interface Registry {
  added: Record<string, LegacyEvent>;
  shapes: Record<string, Shape>;
  popups: Record<string, LegacyPopup>;
  fire?(name: string, data: unknown, keep?: boolean): void;
  /** The data layer's `dl_exit_intent_action` for a custom popup button, once its action has run. */
  customAction?(): void;
}
const registries = new WeakMap<Engine, Registry>();
/** @deprecated One engine's 0.4.x names added by lazy chunks, page moment shapes and exit popups (by Promotion id). */
export const legacyRegistry = (engine: Engine) => {
  let r = registries.get(engine);
  if (!r) registries.set(engine, (r = { added: {}, shapes: {}, popups: {} }));
  return r;
};

/**
 * @deprecated A lazy chunk adds the 0.4.x names of its events, and the shape of its page moments, when it loads:
 * none of them can happen before.
 */
export function addLegacyEvents(
  engine: Engine,
  events: Record<string, LegacyEvent>,
  moments?: Record<string, Shape>,
): void {
  const r = legacyRegistry(engine);
  Object.assign(r.added, events);
  Object.assign(r.shapes, moments);
}

/** 0.4.x events no engine event marks: the page's code sends them with {@link legacyFire}. */
const MOMENTS = [
  'checkout:started',
  'checkout:payment-ready',
  'checkout:spreedly-ready',
  'checkout:form-initialized',
  'checkout:location-fields-shown',
  'checkout:billing-location-fields-shown',
  'address:fields-rendered',
  'address:autocomplete-filled',
  'express-checkout:initialized',
  'upsell:initialized',
  'upsell:adding',
  'exit-intent:action',
  'timer:expired',
  'accordion:opened',
  'accordion:closed',
  'accordion:toggled',
  'scroll-hint:updated',
];

/** 0.4.x names this SDK no longer sends, and why. */
const UNSENT: Record<string, string> = {
  'cart:package-swapped': 'package selectors are gone; listen for cart.added and cart.removed',
  'order:redirect-missing': 'the checkout always sends the shopper on',
  'address:messages-loaded': 'the checkout no longer loads the address service’s texts',
  'upsell:accepted': 'offers send upsell:added',
};

const own = <T>(table: Record<string, T>, name: string) =>
  Object.prototype.hasOwnProperty.call(table, name) ? table[name] : undefined;

/** @deprecated 0.4.x features the SDK no longer has. Starter templates still register empty listeners for them. */
export const RETIRED_EVENTS = ['fomo:', 'profile:'];

/** @deprecated Sends a 0.4.x page moment (see `MOMENTS`); with `keep`, a listener added later on this page gets it too. */
export const legacyFire = (engine: Engine, name: string, data: unknown, keep?: boolean) =>
  legacyRegistry(engine).fire?.(name, data, keep);

/** @deprecated See {@link legacyEvents}. */
export interface LegacyEvents {
  /** `next.on` for a 0.4.x name; undefined for any other name. */
  on(name: string, fn: (data: unknown, event?: EngineEvent) => void): (() => void) | undefined;
  /** `bindCheckout`'s `legacyCheckoutStarted`: 0.4.x `checkout:started`, once a page. */
  checkoutStarted(checkout: Checkout): void;
  /** `bindWidgets`'s `events`: `timer:expired`, `accordion:*`, `scroll-hint:updated`. */
  widgets: WidgetEvents;
}

/** @deprecated 0.4.x `next.on` names. See the Campaign SDK event reference for the name each became. */
export function legacyEvents(engine: Engine): LegacyEvents {
  const kept = new Map<string, unknown[]>();
  const listeners = new Map<string, Set<(data: unknown) => void>>();
  const call = (fn: (data: unknown) => void, data: unknown) => {
    try {
      fn(data);
    } catch (err) {
      engine.log.error('a 0.4.x event listener failed', err);
    }
  };
  const r = legacyRegistry(engine);
  const fire = (r.fire = (name: string, data: unknown, keep?: boolean) => {
    const shaped = r.shapes[name] ? r.shapes[name](data as never, engine.getState()) : data;
    if (keep) kept.set(name, [...(kept.get(name) ?? []), shaped]);
    listeners.get(name)?.forEach((fn) => call(fn, shaped));
  });

  const picks = new Map<string, number | undefined>();
  const previous = new Map<string, number | undefined>();
  const counted = new WeakSet<EngineEvent>();
  /** Once per pick, whichever reads it first: this listener or a '*' listener's `previousPick`. */
  const picked = (e: EngineEvent<'selector.bound' | 'selector.selected'>) => {
    const { data } = e;
    if (data.type === 'toggle' || counted.has(e)) return;
    counted.add(e);
    previous.set(data.selector_id, picks.get(data.selector_id));
    picks.set(data.selector_id, firstPackage(data));
  };
  engine.on('selector.bound', picked);
  engine.on('selector.selected', picked);
  addEventListener('click', noteClick, true);

  return {
    on(name, fn) {
      if (RETIRED_EVENTS.some((prefix) => name.startsWith(prefix))) return () => {};
      const why = own(UNSENT, name);
      if (why) {
        engine.log.warn(`next.on: "${name}" is no longer sent: ${why}`);
        return () => {};
      }
      if (MOMENTS.includes(name)) {
        const set = listeners.get(name) ?? new Set();
        listeners.set(name, set.add(fn));
        kept.get(name)?.forEach((data) => call(fn, data));
        return () => void set.delete(fn);
      }
      const boot = own(LEGACY_EVENTS, name);
      if (!boot && !LATER.includes(name)) return undefined;
      let done = false;
      const off = engine.on(
        '*',
        (event) => {
          const e = event as From<EventName>;
          const alias = boot ?? r.added[name];
          if (done || !alias?.from.includes(e.name)) return;
          const state: LegacyState = {
            ...engine.getState(),
            previousPick: (id) => (picked(e as EngineEvent<'selector.selected'>), previous.get(id)),
          };
          if (alias.when && !alias.when(e, state)) return;
          const data = alias.data(e, state);
          (alias.each ? (data as unknown[]) : [data]).forEach((payload) => fn(payload, e));
          done = !!alias.once;
        },
        { replay: boot?.replay },
      );
      if (done) off();
      return off;
    },
    checkoutStarted: (checkout) => fire('checkout:started', checkout, true),
    widgets: {
      timerExpired: (id) => fire('timer:expired', { persistenceId: id }),
      accordion(id, open, element) {
        fire(open ? 'accordion:opened' : 'accordion:closed', { id, element });
        fire('accordion:toggled', { id, isOpen: open, element });
      },
      scrollHint: (state) => fire('scroll-hint:updated', state),
    },
  };
}
