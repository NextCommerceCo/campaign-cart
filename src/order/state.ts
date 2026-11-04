import { orderError } from '../engine/api';
import { type CartActions, mergeLines } from '../engine/cart/cart';
import type { Context } from '../engine/engine';
import { cardLines, pickedCard } from '../engine/cart/selectors';
import { bool, cents, money, type Value } from '../engine/format';
import type { CartLine } from '../engine/cart/types';
import type { CheckoutError, Order, OrderAddress, OrderLine, State } from '../engine/types';
import type { CheckoutState } from '../checkout/state/types';

export interface OrderState {
  refId?: string;
  order?: Order;
  loadedAt?: number;
  status: 'idle' | 'loading' | 'ready' | 'failed' | 'accepting';
  error?: CheckoutError;
  accepted: string[];
  coupon?: { refId: string; code: string };
}

const ORDER_TTL = 15 * 60 * 1000;
const LOAD_TIMEOUT = 10_000;
const REPORTED = 'reported';
const REPORTED_KEEP = 50;

const PAYMENT_LABELS: Record<string, string> = {
  card_token: 'Credit Card',
  saved_card: 'Saved Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  paypal: 'PayPal',
  ideal: 'iDEAL',
  sepa_debit: 'SEPA Direct Debit',
  klarna: 'Klarna',
  link: 'Link',
  affirm: 'Affirm',
  bancontact: 'Bancontact',
  external: 'External',
  giropay: 'Giropay',
  sofort: 'Sofort',
  swish: 'Swish',
  twint: 'Twint',
  shop_pay: 'Shop Pay',
};

const purchaseId = (order: Order) => String(order.number ?? order.ref_id);
export const upsellId = (order: Order, line: OrderLine) => `${order.ref_id}:${line.id}`;

function paymentLabel(method: Order['payment_method']): string {
  const raw = typeof method === 'string' ? method : (method?.code ?? '');
  const code = raw.toLowerCase().replace(/[\s-]/g, '_');
  return PAYMENT_LABELS[code] ?? raw;
}

function addressValue(address: OrderAddress | undefined, prop: string): Value | undefined {
  const a = address ?? {};
  const text = (value?: string) => ({ type: 'text' as const, value: value ?? '' });
  switch (prop) {
    case 'name':
      return text([a.first_name, a.last_name].filter(Boolean).join(' '));
    case 'full':
      return text([a.line1, a.line2, a.line4, a.state, a.postcode, a.country].filter(Boolean).join(', '));
    case 'line1':
    case 'line2':
    case 'state':
    case 'country':
      return text(a[prop]);
    case 'city':
      return text(a.line4);
    case 'zip':
    case 'postcode':
      return text(a.postcode);
    case 'phone':
      return text(a.phone_number);
    default:
      return undefined;
  }
}

export function orderValue(state: State, path: string): Value | undefined {
  const order = state.order?.order;
  if (!order) return path.startsWith('has') || path.startsWith('is') ? bool(false) : { type: 'text', value: undefined };
  const [head = '', prop = ''] = path.split('.');
  const lines = order.lines ?? [];
  const user = order.user ?? {};
  switch (head) {
    case 'number':
      return { type: 'text', value: order.number === undefined ? '' : String(order.number) };
    case 'refId':
    case 'ref_id':
      return { type: 'text', value: order.ref_id };
    case 'currency':
      return { type: 'text', value: order.currency };
    case 'total':
      return money(cents(order.total_incl_tax));
    case 'totalExclTax':
    case 'total_excl_tax':
      return money(cents(order.total_excl_tax));
    case 'tax':
      return money(cents(order.total_tax));
    case 'shipping':
      return money(cents(order.shipping_incl_tax));
    case 'shippingExclTax':
      return money(cents(order.shipping_excl_tax));
    case 'discounts':
      return money(cents(order.total_discounts));
    case 'subtotal':
      return money(
        lines.length
          ? lines.reduce((n, l) => n + cents(l.price_excl_tax), 0)
          : cents(order.total_excl_tax) - cents(order.shipping_excl_tax),
      );
    case 'hasTax':
      return bool(cents(order.total_tax) > 0);
    case 'hasShipping':
      return bool(cents(order.shipping_incl_tax) > 0);
    case 'hasDiscounts':
      return bool(cents(order.total_discounts) > 0);
    case 'hasItems':
      return bool(lines.length > 0);
    case 'isEmpty':
      return bool(lines.length === 0);
    case 'hasUpsells':
      return bool(lines.some((l) => l.is_upsell));
    case 'supportsUpsells':
      return bool(!!order.supports_post_purchase_upsells);
    case 'itemCount':
      return { type: 'int', value: lines.length };
    case 'shippingMethod':
      return { type: 'text', value: order.shipping_method ?? '' };
    case 'paymentMethod':
      return { type: 'text', value: paymentLabel(order.payment_method) };
    case 'customer':
    case 'user': {
      const values: Record<string, string | undefined> = {
        name: [user.first_name, user.last_name].filter(Boolean).join(' '),
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone_number,
      };
      return prop in values ? { type: 'text', value: values[prop] ?? '' } : undefined;
    }
    case 'shippingAddress':
      return addressValue(order.shipping_address, prop || 'full');
    case 'billingAddress':
      return addressValue(order.billing_address, prop || 'full');
    default:
      return undefined;
  }
}

export type Accepted = 'accepted' | 'repeat' | 'unsupported' | 'failed' | 'busy';

type Offer = { selectorId?: string; lines?: CartLine[] };

export function createOrder(ctx: Context, cart: CartActions) {
  const state = () => ctx.getState().order!;
  const set = (patch: Partial<OrderState>) => ctx.update('order', patch);
  const viewed = new Set<string>();
  let seq = 0;

  set({ status: 'idle', accepted: [], ...ctx.saved<Partial<OrderState>>('order') });

  const reported = () => ctx.local.get<string[]>(REPORTED) ?? [];
  const markReported = (ids: string[]) =>
    ctx.local.set(REPORTED, [...new Set([...reported(), ...ids])].slice(-REPORTED_KEEP));

  const offerLines = (offer: Offer) => {
    const selector = offer.selectorId ? ctx.getState().selectors[offer.selectorId] : undefined;
    const card = pickedCard(selector);
    return { card, lines: selector && card ? cardLines(selector, card) : (offer.lines ?? []) };
  };

  const settle = (order: Order) => {
    const paid = !order.payment_complete_url;
    const checkout = ctx.saved<Partial<CheckoutState>>('checkout');
    if (paid && checkout?.pendingRef === order.ref_id) {
      cart.clearAfterOrder();
      ctx.forget('checkout');
    }
    const done = reported();
    const upsells = (order.lines ?? [])
      .filter((l) => l.is_upsell)
      .map((line, i) => ({ id: upsellId(order, line), number: i + 1, line }))
      .filter((u) => !done.includes(u.id));
    if (upsells.length) markReported(upsells.map((u) => u.id));
    ctx.emit('order.loaded', { order, ...(upsells.length && { upsells }) });
    if (!paid || done.includes(purchaseId(order))) return;
    markReported([purchaseId(order)]);
    const { coupon } = state();
    ctx.emit('order.paid', { order, ...(coupon?.refId === order.ref_id && { coupon: coupon.code }) });
  };

  return {
    async load(refId: string): Promise<void> {
      const current = ++seq;
      const { order, loadedAt } = state();
      if (order && state().refId === refId && loadedAt && Date.now() - loadedAt < ORDER_TTL) {
        set({ status: 'ready' });
        return settle(order);
      }
      set({
        refId,
        status: 'loading',
        error: undefined,
        ...(state().refId !== refId && { order: undefined }),
      });
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT);
        const loaded = await ctx.api.getOrder(refId, controller.signal).finally(() => clearTimeout(timer));
        if (current !== seq) return;
        set({ order: loaded, loadedAt: Date.now(), status: 'ready' });
        settle(loaded);
      } catch (err) {
        if (current !== seq) return;
        set({ status: 'failed', error: orderError(err) });
        ctx.fail('order.load', err);
      }
    },

    view(page: string): void {
      const { refId, order } = state();
      if (!refId || !order || viewed.has(page)) return;
      viewed.add(page);
      ctx.emit('upsell.viewed', { ref_id: refId, page });
    },

    skip(offer: Offer = {}): void {
      const { refId } = state();
      if (refId) ctx.emit('upsell.skipped', { ref_id: refId, package_id: offerLines(offer).lines[0]?.packageId });
    },

    async accept(offer: Offer, page: string): Promise<Accepted> {
      const { order, refId, status, accepted } = state();
      if (status === 'accepting' || status === 'loading') return 'busy';
      if (!order || !refId || !order.supports_post_purchase_upsells) return 'unsupported';
      const key = `${refId}:${page}`;
      if (accepted.includes(key)) return 'repeat';

      const { card, lines } = offerLines(offer);
      const body = mergeLines({ offer: { lines, vouchers: [] } });
      if (!body.length) return 'failed';

      set({ status: 'accepting', error: undefined });
      try {
        const updated = await ctx.api.addUpsell(refId, {
          lines: body,
          currency: ctx.getState().campaign?.currency ?? order.currency,
          ...(card?.vouchers.length && { vouchers: card.vouchers }),
        });
        set({ order: updated, loadedAt: Date.now(), status: 'ready', accepted: [...state().accepted, key].slice(-50) });
        ctx.emit('upsell.accepted', { ref_id: refId, lines: body, order: updated });
        return 'accepted';
      } catch (err) {
        const error = orderError(err);
        set({ status: 'ready', error });
        ctx.fail('upsell.add', err);
        ctx.emit('upsell.failed', {
          ref_id: refId,
          code: error.code,
          ...(error.message && { message: error.message }),
        });
        return 'failed';
      }
    },

    /** The gateway's failure redirect carries no ref_id, and the store has no order to load until it is paid. */
    paymentFailed(): void {
      const refId = ctx.saved<Partial<CheckoutState>>('checkout')?.pendingRef;
      if (refId) ctx.emit('order.failed', { stage: 'payment', code: 'payment_failed', ref_id: refId });
    },
  };
}

export type OrderActions = ReturnType<typeof createOrder>;
