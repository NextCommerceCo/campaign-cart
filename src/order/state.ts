import { failureOf, orderError, orderFailure } from '../engine/runtime/api';
import type { CartActions } from '../engine/cart/cart';
import { apiLines } from '../engine/cart/lines';
import { cartItems, publicCheckout } from '../engine/cart/public';
import type { Context } from '../engine/engine';
import type { Checkout } from '../engine/events/checkout';
import type { ErrorCode } from '../engine/events/sdk';
import type { Upsell } from '../engine/events/upsells';
import {
  appliedCodes,
  createLedger,
  type Ledger,
  paymentMethodCode,
  publicOrder,
  reportPaid,
} from '../engine/order/order';
import { cardLines, pickedCard } from '../engine/cart/selectors';
import { latestWins } from '../engine/runtime/flow';
import { cents } from '../engine/display/format';
import type { CartLine, Line } from '../engine/cart/types';
import type { ApiOrder, CheckoutError, State } from '../engine/types';

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

declare module '../engine/types' {
  interface State {
    order?: OrderState;
  }
}

declare module '../engine/engine' {
  interface Engine {
    order?: OrderActions;
  }
}

const ORDER_TTL = 15 * 60 * 1000;
const LOAD_TIMEOUT = 10_000;

export type Accepted = 'accepted' | 'repeat' | 'unsupported' | 'failed' | 'busy';

type SavedCheckout = Partial<NonNullable<State['checkout']>>;

export type Offer = { selectorId?: string; lines?: CartLine[] };

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
        l.quantity === quantity * (pkg.qty ?? 1) &&
        (l.variant_id == null ? sameId(l.product_id, pkg.product_id) : l.variant_id === pkg.product_variant_id),
    );
    if (at < 0) return false;
    added.splice(at, 1);
    return true;
  });
};

const orderOf = (ctx: Context) => ctx.getState().order!;
const setOrder = (ctx: Context, patch: Partial<OrderState>) => ctx.update('order', patch);

function fetchOrder(ctx: Context, refId: string): Promise<ApiOrder> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOAD_TIMEOUT);
  return ctx.api.getOrder(refId, controller.signal).finally(() => clearTimeout(timer));
}

function offerLines(ctx: Context, offer: Offer) {
  const selector = offer.selectorId ? ctx.getState().selectors[offer.selectorId] : undefined;
  const card = pickedCard(selector);
  return selector && card
    ? { card, lines: cardLines(selector, card), quoted: selector.quotes?.[card.id]?.lines }
    : { lines: offer.lines ?? [] };
}

function upsellOf(ctx: Context, offer: Offer, page: string): Upsell {
  const all = ctx.getState();
  const { card, lines, quoted } = offerLines(ctx, offer);
  const items = cartItems(all, apiLines(lines), quoted);
  const priced = items.length > 0 && items.every((i) => i.total !== undefined);
  return {
    ref_id: orderOf(ctx).refId ?? '',
    page,
    ...(offer.selectorId && { selector_id: offer.selectorId }),
    ...(card && { option_id: card.id }),
    lines: items,
    currency: all.campaign?.currency ?? orderOf(ctx).order?.currency,
    ...(priced && { total: items.reduce((n, i) => n + cents(i.total), 0) / 100 }),
  };
}

/** The checkout that sent the shopper to the gateway, as it was then: its saved slice and the cart. */
const pendingCheckout = (ctx: Context, cart: CartActions, saved: SavedCheckout): Checkout => ({
  ...publicCheckout({ ...ctx.getState(), checkout: saved as NonNullable<State['checkout']> }),
  cart: cart.current(),
  payment_method: saved.pendingMethod || saved.paymentMethod || '',
});

function settle(ctx: Context, cart: CartActions, order: ApiOrder): void {
  const paid = !order.payment_complete_url;
  const saved = ctx.saved<SavedCheckout>('checkout');
  const completed = paid && saved?.pendingRef === order.ref_id ? pendingCheckout(ctx, cart, saved) : undefined;
  if (completed) {
    cart.clearAfterOrder();
    ctx.forget('checkout');
  }
  const data = publicOrder(order, appliedCodes(order, orderOf(ctx).coupon));
  ctx.emit('order.loaded', data);
  if (paid) reportPaid(ctx, order, data);
  if (completed) ctx.emit('checkout.completed', { ...completed, ref_id: order.ref_id });
}

function upsellAdded(ctx: Context, updated: ApiOrder, key: string, upsell: Upsell): Accepted {
  setOrder(ctx, {
    order: updated,
    loadedAt: ctx.now(),
    status: 'ready',
    accepted: [...orderOf(ctx).accepted, key].slice(-50),
  });
  ctx.emit('upsell.accepted', upsell);
  ctx.emit('order.updated', publicOrder(updated, appliedCodes(updated, orderOf(ctx).coupon)));
  return 'accepted';
}

/** An upsell request that failed: accepted when an unanswered one did add the offer, else declined or failed. */
async function upsellFailed(
  ctx: Context,
  err: unknown,
  sent: { order: ApiOrder; refId: string; key: string; body: Line[]; upsell: Upsell },
): Promise<Accepted> {
  const { order, refId, upsell } = sent;
  const { code } = failureOf(err);
  if (UNKNOWN_OUTCOME.includes(code)) {
    const after = await fetchOrder(ctx, refId).catch(() => undefined);
    if (after && hasOfferLines(order, after, sent.body, ctx.getPackage)) {
      ctx.log.info(`upsell.add failed (${code}), but the order now has the upsell: accepted`);
      return upsellAdded(ctx, after, sent.key, upsell);
    }
  }
  setOrder(ctx, { status: 'ready', error: orderError(err) });
  const error = orderFailure(err);
  if (error.code === 'declined') {
    ctx.emit('upsell.declined', { ...upsell, error, message: failureOf(err).message });
    ctx.emit('payment.failed', { method: paymentMethodCode(order.payment_method), ref_id: refId, error });
    return 'failed';
  }
  ctx.fail('upsell.add', err);
  ctx.emit('upsell.failed', { ...upsell, error });
  return 'failed';
}

/** The gateway's failure redirect carries no ref_id, and the store has no order to load until it is paid. */
function reportPaymentFailed(ctx: Context, ledger: Ledger): void {
  const checkout = ctx.saved<SavedCheckout>('checkout');
  const refId = checkout?.pendingRef;
  if (!refId || ledger.has(`failed:${refId}`)) return;
  ledger.mark([`failed:${refId}`]);
  const sent = ctx.getState().visit.params.payment_method;
  const method = (sent !== 'None' && sent) || checkout?.pendingMethod || checkout?.paymentMethod || '';
  ctx.emit('payment.failed', { method, ref_id: refId, error: { code: 'payment_failed' } });
}

export function createOrder(ctx: Context, cart: CartActions) {
  const loads = latestWins();
  setOrder(ctx, { status: 'idle', accepted: [], ...ctx.saved<Partial<OrderState>>('order') });
  const ledger = createLedger(ctx);

  return {
    async load(refId: string): Promise<void> {
      const { stale } = loads.start();
      const { order, loadedAt } = orderOf(ctx);
      if (order && orderOf(ctx).refId === refId && loadedAt && ctx.now() - loadedAt < ORDER_TTL) {
        setOrder(ctx, { status: 'ready' });
        return settle(ctx, cart, order);
      }
      setOrder(ctx, {
        refId,
        status: 'loading',
        error: undefined,
        ...(orderOf(ctx).refId !== refId && { order: undefined }),
      });
      try {
        const loaded = await fetchOrder(ctx, refId);
        if (stale()) return;
        setOrder(ctx, { order: loaded, loadedAt: ctx.now(), status: 'ready' });
        settle(ctx, cart, loaded);
      } catch (err) {
        if (stale()) return;
        setOrder(ctx, { status: 'failed', order: undefined, error: orderError(err) });
        ctx.fail('order.load', err);
      }
    },

    /** The offer is shown: the order loaded and takes upsells, and its selector is priced. */
    shown(offer: Offer, page: string): void {
      const { refId, order } = orderOf(ctx);
      if (refId && order) ctx.emit('upsell.shown', upsellOf(ctx, offer, page));
    },

    /** The shown offer is on screen. */
    view(offer: Offer, page: string): void {
      const { refId, order } = orderOf(ctx);
      if (refId && order) ctx.emit('upsell.viewed', upsellOf(ctx, offer, page));
    },

    skip(offer: Offer, page: string): void {
      if (orderOf(ctx).refId) ctx.emit('upsell.skipped', upsellOf(ctx, offer, page));
    },

    async accept(offer: Offer, page: string): Promise<Accepted> {
      const { order, refId, status, accepted } = orderOf(ctx);
      if (status === 'accepting' || status === 'loading') return 'busy';
      if (!order || !refId || !order.supports_post_purchase_upsells) return 'unsupported';
      const key = `${refId}:${page}`;
      if (accepted.includes(key)) return 'repeat';

      const { card, lines } = offerLines(ctx, offer);
      const body = apiLines(lines);
      if (!body.length) {
        const name = offer.selectorId ? `selector "${offer.selectorId}"` : 'no selector';
        ctx.log.warn(`upsell offer on ${page} (${name}) has nothing to add: no package and no picked option`);
        return 'failed';
      }

      const upsell = upsellOf(ctx, offer, page);
      setOrder(ctx, { status: 'accepting', error: undefined });
      try {
        const updated = await ctx.api.addUpsell(refId, {
          lines: body,
          currency: upsell.currency,
          ...(card?.vouchers.length && { vouchers: card.vouchers }),
        });
        return upsellAdded(ctx, updated, key, upsell);
      } catch (err) {
        return upsellFailed(ctx, err, { order, refId, key, body, upsell });
      }
    },

    paymentFailed: (): void => reportPaymentFailed(ctx, ledger),
  };
}

export type OrderActions = ReturnType<typeof createOrder>;
