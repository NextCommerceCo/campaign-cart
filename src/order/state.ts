import { failureOf, orderError, orderFailure } from '../engine/api';
import { apiLines, type CartActions, cartItems } from '../engine/cart/cart';
import type { Context } from '../engine/engine';
import type { ErrorCode, Failure, Upsell } from '../engine/events';
import { appliedCodes, publicOrder } from '../engine/order';
import { cardLines, pickedCard } from '../engine/cart/selectors';
import { bool, cents, money, type Value } from '../engine/format';
import type { CartLine, Line } from '../engine/cart/types';
import type { ApiOrder, ApiOrderAddress, ApiOrderLine, CheckoutError, State } from '../engine/types';
import type { CheckoutState } from '../checkout/state/types';

export interface OrderState {
  refId?: string;
  order?: ApiOrder;
  loadedAt?: number;
  status: 'idle' | 'loading' | 'ready' | 'failed' | 'accepting';
  error?: CheckoutError;
  accepted: string[];
  /** The codes the checkout sent with the order: `code` is the first, `codes` the shopper's own. */
  coupon?: { refId: string; code?: string; codes: string[] };
  /** The order as it was when `order.paid` was sent, before any upsell; never saved. */
  paidOrder?: ApiOrder;
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

const purchaseId = (order: ApiOrder) => String(order.number ?? order.ref_id);

function paymentLabel(method: ApiOrder['payment_method']): string {
  const raw = typeof method === 'string' ? method : (method?.code ?? '');
  const code = raw.toLowerCase().replace(/[\s-]/g, '_');
  return PAYMENT_LABELS[code] ?? raw;
}

function addressValue(address: ApiOrderAddress | undefined, prop: string): Value | undefined {
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

const UNKNOWN_OUTCOME: ErrorCode[] = ['network', 'timeout', 'server'];

const sameId = (a?: number | null, b?: number | null) => (a ?? null) === (b ?? null);

const hasOfferLines = (before: ApiOrder, after: ApiOrder, lines: Line[], packageOf: Context['getPackage']) => {
  const known = new Set((before.lines ?? []).map((l) => String(l.id)));
  const added = (after.lines ?? []).filter((l) => l.is_upsell && !known.has(String(l.id)));
  return lines.every(({ package_id, quantity }) => {
    const pkg = packageOf(package_id);
    if (!pkg) return false;
    const at = added.findIndex(
      (l) =>
        l.quantity === quantity && sameId(l.product_id, pkg.product_id) && sameId(l.variant_id, pkg.product_variant_id),
    );
    if (at < 0) return false;
    added.splice(at, 1);
    return true;
  });
};

export function createOrder(ctx: Context, cart: CartActions) {
  const state = () => ctx.getState().order!;
  const set = (patch: Partial<OrderState>) => ctx.update('order', patch);
  let seq = 0;

  set({ status: 'idle', accepted: [], ...ctx.saved<Partial<OrderState>>('order') });

  const reported = () => ctx.local.get<string[]>(REPORTED) ?? [];
  const markReported = (ids: string[]) =>
    ctx.local.set(REPORTED, [...new Set([...reported(), ...ids])].slice(-REPORTED_KEEP));

  const fetchOrder = (refId: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT);
    return ctx.api.getOrder(refId, controller.signal).finally(() => clearTimeout(timer));
  };

  const offerLines = (offer: Offer) => {
    const selector = offer.selectorId ? ctx.getState().selectors[offer.selectorId] : undefined;
    const card = pickedCard(selector);
    return selector && card
      ? { card, lines: cardLines(selector, card), quoted: selector.quotes?.[card.id]?.lines }
      : { lines: offer.lines ?? [] };
  };

  const upsellOf = (offer: Offer, page: string): Upsell => {
    const all = ctx.getState();
    const { card, lines, quoted } = offerLines(offer);
    const items = cartItems(all, apiLines(lines), quoted);
    const priced = items.length > 0 && items.every((i) => i.total !== undefined);
    return {
      ref_id: state().refId ?? '',
      page,
      ...(offer.selectorId && { selector_id: offer.selectorId }),
      ...(card && { option_id: card.id }),
      lines: items,
      currency: all.campaign?.currency ?? state().order?.currency,
      ...(priced && { total: items.reduce((n, i) => n + cents(i.total), 0) / 100 }),
    };
  };

  const settle = (order: ApiOrder) => {
    const paid = !order.payment_complete_url;
    const checkout = ctx.saved<Partial<CheckoutState>>('checkout');
    if (paid && checkout?.pendingRef === order.ref_id) {
      cart.clearAfterOrder();
      ctx.forget('checkout');
    }
    const data = publicOrder(order, appliedCodes(order, state().coupon));
    ctx.emit('order.loaded', data);
    if (!paid || reported().includes(purchaseId(order))) return;
    markReported([purchaseId(order)]);
    set({ paidOrder: order });
    ctx.emit('order.paid', data);
  };

  return {
    reported,
    markReported,

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
        const loaded = await fetchOrder(refId);
        if (current !== seq) return;
        set({ order: loaded, loadedAt: Date.now(), status: 'ready' });
        settle(loaded);
      } catch (err) {
        if (current !== seq) return;
        set({ status: 'failed', order: undefined, error: orderError(err) });
        ctx.fail('order.load', err);
      }
    },

    view(offer: Offer, page: string): void {
      const { refId, order } = state();
      if (refId && order) ctx.emit('upsell.viewed', upsellOf(offer, page));
    },

    skip(offer: Offer, page: string): void {
      if (state().refId) ctx.emit('upsell.skipped', upsellOf(offer, page));
    },

    async accept(offer: Offer, page: string): Promise<Accepted> {
      const { order, refId, status, accepted } = state();
      if (status === 'accepting' || status === 'loading') return 'busy';
      if (!order || !refId || !order.supports_post_purchase_upsells) return 'unsupported';
      const key = `${refId}:${page}`;
      if (accepted.includes(key)) return 'repeat';

      const { card, lines } = offerLines(offer);
      const body = apiLines(lines);
      if (!body.length) {
        const name = offer.selectorId ? `selector "${offer.selectorId}"` : 'no selector';
        ctx.log.warn(`upsell offer on ${page} (${name}) has nothing to add: no package and no picked option`);
        return 'failed';
      }

      const upsell = upsellOf(offer, page);
      const added = (updated: ApiOrder): Accepted => {
        set({ order: updated, loadedAt: Date.now(), status: 'ready', accepted: [...state().accepted, key].slice(-50) });
        ctx.emit('upsell.accepted', upsell);
        ctx.emit('order.updated', publicOrder(updated, appliedCodes(updated, state().coupon)));
        return 'accepted';
      };
      set({ status: 'accepting', error: undefined });
      try {
        return added(
          await ctx.api.addUpsell(refId, {
            lines: body,
            currency: upsell.currency,
            ...(card?.vouchers.length && { vouchers: card.vouchers }),
          }),
        );
      } catch (err) {
        const { code } = failureOf(err);
        if (UNKNOWN_OUTCOME.includes(code)) {
          const after = await fetchOrder(refId).catch(() => undefined);
          if (after && hasOfferLines(order, after, body, ctx.getPackage)) {
            ctx.log.info(`upsell.add failed (${code}), but the order now has the upsell: accepted`);
            return added(after);
          }
        }
        set({ status: 'ready', error: orderError(err) });
        ctx.fail('upsell.add', err);
        ctx.emit('upsell.failed', { ...upsell, error: orderFailure(err) });
        return 'failed';
      }
    },

    /** The gateway's failure redirect carries no ref_id, and the store has no order to load until it is paid. */
    paymentFailed(): void {
      const checkout = ctx.saved<Partial<CheckoutState>>('checkout');
      const refId = checkout?.pendingRef;
      if (!refId || reported().includes(`failed:${refId}`)) return;
      markReported([`failed:${refId}`]);
      const sent = ctx.getState().visit.params.payment_method;
      const method = (sent !== 'None' && sent) || checkout?.pendingMethod || checkout?.paymentMethod || '';
      ctx.emit('payment.failed', { method, ref_id: refId, error: { code: 'payment_failed' } });
    },
  };
}

export type OrderActions = ReturnType<typeof createOrder>;
