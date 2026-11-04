import type { Engine } from '../engine/engine';
import type { Logger } from '../engine/log';
import { mergeLines } from '../engine/cart/cart';
import { cardQuantity, pickedCard } from '../engine/cart/selectors';
import type { CartLine, CartSummary, Line, SummaryLine } from '../engine/cart/types';
import type { CartChange, Checkout, EngineEvent, EventMap, EventName, Selector } from '../engine/events';
import type { Campaign, Package, ShippingOption, State } from '../engine/types';
import type { WidgetEvents } from '../bindings/widgets';
import type { ExitIntentOptions } from './exit-intent';

/** @deprecated Use `data-next-selector-id`. */
export function legacySelectorId(el: Element): string | null {
  return el.getAttribute('data-next-id');
}

export type From<K extends EventName> = { [N in K]: EngineEvent<N> }[K];

/** The state a 0.4.x payload is made from, and the package each selector had picked before its latest pick. */
export type LegacyState = State & { previousPick(selectorId: string): number | undefined };

/** @deprecated How a 0.4.x `next.on` name is made from the events. */
export interface LegacyEvent<K extends EventName = EventName> {
  from: K[];
  when?(e: From<K>, state: LegacyState): boolean;
  /** The 0.4.x payload; with `each`, a list of payloads, one call each. */
  data(e: From<K>, state: LegacyState): unknown;
  each?: boolean;
  /** At most one call per listener. */
  once?: boolean;
  /** A listener added later also gets this page's earlier ones. */
  replay?: boolean;
}

/** @deprecated Types a {@link LegacyEvent} by the events it comes from. */
export const legacyEvent = <K extends EventName>(spec: LegacyEvent<K>) => spec as unknown as LegacyEvent;
const alias = legacyEvent;

/** @deprecated 0.4.x cart payloads carried decimal.js values; this keeps their usual reads. */
export interface LegacyDecimal {
  toNumber(): number;
  toFixed(digits?: number): string;
  toString(): string;
  toJSON(): string;
  valueOf(): number;
}

const decimal = (value: number | string | undefined): LegacyDecimal => {
  const n = Number(value ?? 0);
  const text = () => String(n);
  return {
    toNumber: () => n,
    toFixed: (digits) => (digits === undefined ? text() : n.toFixed(digits)),
    toString: text,
    toJSON: text,
    valueOf: () => n,
  };
};

const percent = (part: number, whole: number) => decimal(whole > 0 ? (part / whole) * 100 : 0);

const pick = <T extends object>(from: T | undefined, keys: Array<keyof T>) =>
  Object.fromEntries(keys.map((k) => [k, from?.[k]]));

const packageOf = ({ campaign }: State, id: number) => campaign?.packages.find((p) => p.ref_id === id);

const legacyItem = (line: Line, p: Package | undefined, priced: SummaryLine | undefined) => ({
  id: line.package_id,
  packageId: line.package_id,
  quantity: line.quantity,
  price: Number(p?.price_total ?? 0),
  title: p?.name ?? '',
  sku: p?.product_sku ?? undefined,
  is_upsell: !!line.is_upsell,
  price_per_unit: p?.price,
  ...pick(p, [
    'image',
    'qty',
    'price_total',
    'price_retail',
    'price_retail_total',
    'price_recurring',
    'is_recurring',
    'interval',
    'interval_count',
  ]),
  productId: p?.product_id,
  productName: p?.product_name,
  variantId: p?.product_variant_id,
  variantName: p?.product_variant_name,
  variantAttributes: p?.product_variant_attribute_values,
  variantSku: p?.product_sku ?? undefined,
  ...(line.properties && { properties: line.properties }),
  ...(priced &&
    pick(priced, [
      'unit_price',
      'original_unit_price',
      'package_price',
      'original_package_price',
      'total',
      'total_discount',
      'discounts',
    ])),
});

function legacyShipping(s: NonNullable<CartSummary['shipping_method']>) {
  const price = Number(s.price);
  const original = Number(s.original_price);
  const off = Math.max(0, Math.round((original - price) * 100) / 100);
  return {
    ...pick(s, ['id', 'name', 'code', 'discounts']),
    originalPrice: decimal(original),
    price: decimal(price),
    discountAmount: decimal(off),
    discountPercentage: percent(off, original),
    hasDiscounts: off > 0,
  };
}

/** 0.4.x `CartState`, as `cart:updated` carried it. */
function legacyCart(state: State) {
  const { cart, campaign } = state;
  const { summary } = cart;
  const lines = mergeLines(cart.groups);
  const subtotal = Number(summary?.subtotal ?? 0);
  const totalDiscount = Number(summary?.total_discount ?? 0);
  return {
    items: lines.map((line, i) =>
      legacyItem(
        line,
        packageOf(state, line.package_id),
        summary?.lines[i]?.package_id === line.package_id ? summary.lines[i] : undefined,
      ),
    ),
    totalQuantity: lines.reduce((n, l) => n + l.quantity, 0),
    isEmpty: !lines.length,
    vouchers: [
      ...new Set([
        ...cart.coupons,
        ...cart.held,
        ...Object.values(cart.groups).flatMap((g) => g.vouchers.map((v) => v.trim().toUpperCase())),
      ]),
    ],
    currency: summary?.currency ?? campaign?.currency,
    offerDiscounts: summary?.offer_discounts ?? [],
    voucherDiscounts: summary?.voucher_discounts ?? [],
    subtotal: decimal(subtotal),
    ...(summary?.shipping_method && { shippingMethod: legacyShipping(summary.shipping_method) }),
    hasDiscounts: totalDiscount > 0,
    totalDiscount: decimal(totalDiscount),
    totalDiscountPercentage: percent(totalDiscount, subtotal),
    total: decimal(summary?.total),
    ...(summary && {
      summary: {
        ...summary,
        lines: summary.lines.map((l) => {
          const { ref_id: _, external_id: __, ...shown } = packageOf(state, l.package_id) ?? ({} as Partial<Package>);
          return { ...l, ...shown };
        }),
      },
    }),
    isCalculating: cart.calculating,
  };
}

/** 0.4.43 sent one item event per cart action; none for a swap-mode selector's pick, emptying or replacing the cart. */
const itemEvent = (map: (c: CartChange, op?: string, source?: string) => object | false) =>
  alias<'cart.added' | 'cart.removed'>({
    from: ['cart.added', 'cart.removed'],
    each: true,
    data: ({ data }, { cart: { lastOperation }, selectors }) => {
      const { action, group = '' } = lastOperation ?? {};
      const bundle = group.startsWith('bundle:') ? selectors[group.slice(7)] : undefined;
      if (action === 'clear' || action === 'setGroups' || bundle?.mode === 'swap') return [];
      const source = action === 'addItem' ? 'direct' : bundle ? 'selector' : undefined;
      return data.changes.flatMap((c) => map(c, action, source) || []);
    },
  });

type Picked = From<'selector.viewed' | 'selector.selected' | 'selector.updated' | 'selector.deselected'>;
const SELECTIONS = ['selector.viewed', 'selector.selected', 'selector.updated'] as const;
/** A bundle or offer selector's event; `offer` limits it to one of the two. */
const selector = (from: Picked['name'][], data: (s: Selector, state: LegacyState) => unknown, offer?: boolean) =>
  alias<Picked['name']>({
    from,
    when: ({ data: s }) => s.type !== 'toggle' && (offer === undefined || (s.type === 'offer') === offer),
    data: (e, state) => data(e.data, state),
  });
const items = (s: Selector) => s.lines.map((l) => ({ packageId: l.package_id, quantity: l.quantity }));
const onePackage = ({ lines: [line, ...more] }: Selector) =>
  line && !more.length ? { packageId: line.package_id, quantity: line.quantity } : {};
const firstPackage = (s: Selector) => s.lines[0]?.package_id;
const selectorQuantity = ({ selector_id }: Selector, { selectors }: State) => {
  const state = selectors[selector_id];
  const card = pickedCard(state);
  return state && card ? cardQuantity(state, card) : 1;
};

const offerPick = selector(
  ['selector.selected'],
  (s) => ({ selectorId: s.selector_id, packageId: firstPackage(s) }),
  true,
);

const toggleCards = () =>
  [...document.querySelectorAll('[data-next-toggle-card][data-next-package-id]')].map((el) =>
    Number(el.getAttribute('data-next-package-id')),
  );

const shippingOption = (state: State, id: number) => state.campaign?.shipping_methods.find((m) => m.ref_id === id);
const shipping = alias({
  from: ['shipping.selected'],
  when: (e, state) => !!shippingOption(state, e.data.id),
  data: (e, state) => ({ methodId: e.data.id, method: shippingOption(state, e.data.id) }),
});

const COUPON_TEXTS: Record<EventMap['coupon.denied']['reason'], string> = {
  no_discount: "Coupon {code} isn't valid for this order.",
  duplicate: 'Coupon {code} is already applied.',
  check_failed: "Couldn't check the coupon. Try again.",
};

/** The click being dispatched, if any: 0.4.x `action:success` named the add-to-cart button whose click changed the cart. */
let click: Event | undefined;

const requestedCurrency = () => new URLSearchParams(location.search).get('currency')?.toUpperCase();

/** @deprecated 0.4.x `next.on` names, each made from the events at the moment 0.4.43 sent it, with its payload. */
export const LEGACY_EVENTS: Record<string, LegacyEvent> = {
  'campaign:loaded': alias({ from: ['campaign.loaded'], once: true, replay: true, data: (e) => e.data.campaign }),
  'currency:fallback': alias({
    from: ['campaign.loaded'],
    once: true,
    replay: true,
    when: ({ data }) => !!requestedCurrency() && requestedCurrency() !== data.campaign.currency.toUpperCase(),
    data: ({ data }) => ({
      requested: requestedCurrency(),
      actual: data.campaign.currency,
      reason: data.fromCache ? 'cached' : 'api',
    }),
  }),
  'sdk:url-parameters-processed': alias({ from: ['sdk.ready'], replay: true, data: () => ({}) }),
  'error:occurred': alias({
    from: ['sdk.error'],
    replay: true,
    data: ({ data }) => ({ message: data.message, code: data.code, details: data }),
  }),
  'action:success': alias<'cart.added' | 'coupon.applied' | 'coupon.denied'>({
    from: ['cart.added', 'coupon.applied', 'coupon.denied'],
    each: true,
    data: (e) => {
      const field = document.querySelector('[data-next-coupon] .next-loading')?.closest('[data-next-coupon]');
      const button = click?.eventPhase && (click.target as Element).closest?.('[data-next-action="add-to-cart"]');
      const [action, element] = e.name === 'cart.added' ? ['AddToCartEnhancer', button] : ['CouponEnhancer', field];
      return element ? [{ action, data: { element } }] : [];
    },
  }),
  'cart:updated': alias({
    from: ['cart.calculated', 'cart.updated'],
    when: (e) => e.name === 'cart.calculated' || !e.data.lines.length,
    data: (_, state) => legacyCart(state),
  }),
  'cart:item-added': itemEvent(
    (c, op, source) =>
      op !== 'setQuantity' &&
      c.to > c.from && { packageId: c.package_id, quantity: c.quantity, ...(source && { source }) },
  ),
  'cart:item-removed': itemEvent((c) => c.to === 0 && { packageId: c.package_id }),
  'cart:quantity-changed': itemEvent(
    (c, op) => op === 'setQuantity' && { packageId: c.package_id, quantity: c.to, oldQuantity: c.from },
  ),
  'coupon:applied': alias({ from: ['coupon.applied'], data: (e) => ({ code: e.data.code }) }),
  'coupon:removed': alias({
    from: ['coupon.removed'],
    when: (e) => e.data.reason === 'shopper',
    data: (e) => ({ code: e.data.code }),
  }),
  'coupon:validation-failed': alias({
    from: ['coupon.denied'],
    data: ({ data }) => ({ code: data.code, message: COUPON_TEXTS[data.reason].replace('{code}', data.code) }),
  }),
  'bundle:selection-changed': selector([...SELECTIONS], (s) => ({ selectorId: s.selector_id, items: items(s) })),
  'bundle:selected': selector(['selector.selected'], (s) => ({ selectorId: s.selector_id, items: items(s) })),
  'bundle:quantity-changed': selector(['selector.updated'], (s, state) => ({
    selectorId: s.selector_id,
    bundleId: s.option_id,
    quantity: selectorQuantity(s, state),
    items: items(s),
  })),
  'selector:selection-changed': selector([...SELECTIONS], (s) => ({ selectorId: s.selector_id, ...onePackage(s) })),
  'selector:item-selected': selector(['selector.selected'], (s, state) => {
    const mode = state.selectors[s.selector_id]?.mode === 'swap' ? 'swap' : 'select';
    return {
      selectorId: s.selector_id,
      packageId: firstPackage(s),
      previousPackageId: state.previousPick(s.selector_id),
      mode,
      pendingAction: mode === 'select' || undefined,
    };
  }),
  'selector:quantity-changed': selector(['selector.updated'], (s) => ({ selectorId: s.selector_id, ...onePackage(s) })),
  'upsell-selector:item-selected': offerPick,
  'upsell:option-selected': offerPick,
  'upsell:quantity-changed': selector(
    ['selector.updated'],
    (s, state) => ({ selectorId: s.selector_id, quantity: selectorQuantity(s, state), packageId: firstPackage(s) }),
    true,
  ),
  'toggle:toggled': alias({
    from: ['selector.selected', 'selector.deselected'],
    when: (e) => e.data.type === 'toggle',
    data: (e) => ({ packageId: e.data.lines[0]?.package_id, added: e.name === 'selector.selected' }),
  }),
  'toggle:selection-changed': alias({
    from: ['cart.updated'],
    when: () => toggleCards().length > 0,
    data: ({ data }) => ({
      selected: [...new Set(toggleCards())].filter((id) => data.lines.some((l) => l.package_id === id)),
    }),
  }),
  'shipping:method-changed': shipping,
  'shipping:method-selected': alias({ from: ['shipping.selected'], data: (e) => ({ shippingId: String(e.data.id) }) }),
};

/** 0.4.x names of checkout, order and exit popup events: those chunks add them with {@link addLegacyEvents} when they load. */
const LATER = [
  'action:failed',
  'exit-intent:shown',
  'exit-intent:clicked',
  'exit-intent:action',
  'exit-intent:dismissed',
  'exit-intent:closed',
  'payment:tokenized',
  'payment:error',
  'checkout:express-completed',
  'express-checkout:completed',
  'checkout:express-failed',
  'express-checkout:failed',
  'express-checkout:started',
  'express-checkout:error',
  'order:completed',
  'upsell:viewed',
  'upsell:added',
  'upsell:skipped',
  'upsell:error',
];
type Shape = (data: never, state: State) => unknown;

/** @deprecated What an exit popup was given, by its Promotion id: 0.4.x payloads name its image and template. */
export interface LegacyPopup {
  imageUrl: string;
  /** The template the popup shows; '' for an image popup. */
  template: string;
  /** The `data-exit-intent-action` whose run finished. */
  ran?: string;
}

interface Registry {
  added: Record<string, LegacyEvent>;
  shapes: Record<string, Shape>;
  popups: Record<string, LegacyPopup>;
  fire?(name: string, data: unknown, keep?: boolean): void;
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
  const picked = (e: EngineEvent<'selector.viewed' | 'selector.selected'>) => {
    const { data } = e;
    if (data.type === 'toggle' || counted.has(e)) return;
    counted.add(e);
    previous.set(data.selector_id, picks.get(data.selector_id));
    picks.set(data.selector_id, firstPackage(data));
  };
  engine.on('selector.viewed', picked);
  engine.on('selector.selected', picked);
  addEventListener('click', (e) => (click = e), true);

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

export interface LegacyCartLine {
  packageId: number;
  quantity: number;
  name?: string;
  image?: string;
  price?: string;
  total?: string;
}

export interface LegacyCartData {
  cartLines: LegacyCartLine[];
  items: LegacyCartLine[];
  cartTotals: { subtotal?: string; total?: string; discount?: string; currency?: string };
  campaignData?: Campaign;
  appliedCoupons: string[];
}

export interface LegacyApi {
  /** @deprecated Use `next.actions.addItem(packageId, quantity)`. */
  addItem(o: { packageId: number; quantity?: number }): Promise<void>;
  /** @deprecated Use `next.actions.clear()`. Keeps coupons, like the old SDK. */
  clearCart(): Promise<void>;
  /** @deprecated Use `next.actions.setGroup(id, { lines, vouchers })`. */
  swapCart(items: CartLine[]): Promise<void>;
  /** @deprecated Use `next.actions.applyCoupon(code)`. A code entered on an empty cart answers `true` at once, as in 0.4.x. */
  applyCoupon(code: string): Promise<boolean>;
  /** @deprecated A package's product, variant and image come on every event's `CartItem`; `next.getState()` has the campaign for debugging. */
  getPackage(id: number): Package | undefined;
  /** @deprecated Use `next.snapshot().campaign`. */
  getCampaignData(): Campaign | undefined;
  /** @deprecated Use `next.snapshot().cart`. Returns the 0.4.x shape. */
  getCartData(): LegacyCartData;
  /** @deprecated Exit intent will move to the page kit. */
  exitIntent(options: ExitIntentOptions): Promise<() => void>;
  /** @deprecated The chosen method is `next.snapshot().cart.shipping_method`; `next.getState()` has the campaign's list for debugging. */
  getShippingMethods(): ShippingOption[];
  /** @deprecated Use `next.actions.setShipping(id)`. */
  setShippingMethod(id: number): Promise<void>;
  /** @deprecated Use `next.snapshot().cart.shipping_method`. */
  getSelectedShippingMethod(): ShippingOption | undefined;
}

export function legacyApi(engine: Engine): LegacyApi {
  const products = (lines: CartLine[]) => ({ lines, vouchers: [] });
  return {
    addItem: ({ packageId, quantity = 1 }) => engine.cart.addItem(packageId, quantity),
    clearCart: () => engine.cart.setGroups({}),
    swapCart: (items) => engine.cart.setGroups({ items: products(items) }),
    applyCoupon: (code) => {
      const held = () => engine.getState().cart.held.includes(code.trim().toUpperCase());
      const wasHeld = held();
      const applied = engine.cart.applyCoupon(code);
      return !wasHeld && held() ? Promise.resolve(true) : applied;
    },
    getPackage: (id) => engine.getPackage(id),
    getCampaignData: () => engine.getState().campaign,
    getCartData: () => {
      const { cart, campaign } = engine.getState();
      const lines = engine.cart.lines().map((l) => {
        const pkg = engine.getPackage(l.package_id);
        const line = cart.summary?.lines.find((s) => s.package_id === l.package_id);
        return {
          packageId: l.package_id,
          quantity: l.quantity,
          name: pkg?.name,
          image: pkg?.image,
          price: pkg?.price_total,
          total: line?.total,
        };
      });
      const s = cart.summary;
      return {
        cartLines: lines,
        items: lines,
        cartTotals: { subtotal: s?.subtotal, total: s?.total, discount: s?.total_discount, currency: s?.currency },
        campaignData: campaign,
        appliedCoupons: [...cart.coupons, ...cart.held],
      };
    },
    exitIntent: (options) => import('./exit-intent').then((m) => m.exitIntent(engine, options)),
    getShippingMethods: () => engine.getState().campaign?.shipping_methods ?? [],
    setShippingMethod: (id) => engine.cart.setShipping(id),
    getSelectedShippingMethod: () => {
      const { campaign, cart } = engine.getState();
      return campaign?.shipping_methods.find((m) => m.ref_id === cart.shippingId);
    },
  };
}

/** @deprecated Use `next.on('ready', fn)` and `html[data-next-ready]`. */
export function announceLegacyReady(next: { version: string }, log: Logger): void {
  document.documentElement.classList.add('next-display-ready');
  document.dispatchEvent(new CustomEvent('next:initialized', { bubbles: true, detail: { version: next.version } }));
  const win = window as unknown as { nextReady?: unknown };
  const run = (fn: (n: object) => void) => {
    try {
      fn(next);
    } catch (err) {
      log.error('nextReady callback failed', err);
    }
  };
  if (Array.isArray(win.nextReady)) win.nextReady.forEach(run);
  win.nextReady = { push: run };
}

interface LegacyAnalyticsConfig {
  enabled?: boolean;
  providers?: Record<string, { enabled?: boolean } | undefined>;
}

export interface LegacyAnalytics {
  enabled: boolean;
  nextCampaign: boolean;
  dataLayer: boolean;
  unsupported: string[];
}

/** @deprecated `nextConfig.analytics`. GTM reads `dataLayer`; other vendors use GTM or the page's forwarder. */
export function readLegacyAnalytics(): LegacyAnalytics {
  const config = (window as unknown as { nextConfig?: { analytics?: LegacyAnalyticsConfig } }).nextConfig?.analytics;
  const providers = config?.providers ?? {};
  return {
    enabled: config?.enabled !== false,
    nextCampaign: providers.nextCampaign?.enabled !== false,
    dataLayer: providers.gtm?.enabled !== false,
    unsupported: ['facebook', 'rudderstack', 'custom'].filter((name) => providers[name]?.enabled),
  };
}

/** @deprecated {@link readLegacyAnalytics}, warning once for each provider that is no longer built in. */
export function legacyAnalytics(log: Logger): LegacyAnalytics {
  const analytics = readLegacyAnalytics();
  for (const name of analytics.unsupported)
    log.warn(`analytics provider "${name}" is no longer built in; send it through GTM or a forwarder`);
  return analytics;
}

/** @deprecated Removes the old SDK's plain-text personal-data cookie and stored profile. */
export function removeLegacyPersonalData(): void {
  document.cookie = 'next_user_data=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  try {
    localStorage.removeItem('nextDataLayer_userProperties');
  } catch {}
}
