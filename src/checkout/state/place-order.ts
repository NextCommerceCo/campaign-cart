import { orderError, orderFailure } from '../../engine/api';
import type { CartActions } from '../../engine/cart/cart';
import type { Context } from '../../engine/engine';
import { publicOrder, reportPaid } from '../../engine/order';
import { nextUrl } from '../../engine/params';
import type { ApiOrder, CheckoutError } from '../../engine/types';
import { isWallet, paymentCode } from '../../engine/payment';
import { orderBody, type OrderUrls } from './order-body';
import { PHONES } from './phone';
import { formErrors, type Scope } from './rules';
import type { CheckoutState } from './types';

const PHONE_WAIT = 2000;

const within = (work: Promise<unknown>, ms: number) =>
  Promise.race([work, new Promise((done) => setTimeout(done, ms))]);

export function redirectFor(
  order: ApiOrder,
  successUrl: string | undefined,
  current: URL,
  params: Record<string, string>,
) {
  if (order.payment_complete_url) return order.payment_complete_url;
  if (!successUrl) {
    return nextUrl(order.order_status_url ?? `/checkout/confirmation/?ref_id=${order.ref_id}`, current, params);
  }
  const url = new URL(successUrl, current);
  url.searchParams.set('ref_id', order.ref_id);
  return nextUrl(url.href, current, params);
}

export interface PlaceOrder extends OrderUrls {
  /** An express button's method: the wallet gives the shopper's details, so the form is neither checked nor sent. */
  expressMethod?: string;
  /** What PayPal, Apple Pay or Google Pay picked in the form checks; `null` checks nothing. Unset, the whole form. */
  walletChecks?: Scope | null;
  tokenize?: () => Promise<string>;
  phoneRequired?: boolean;
}

interface Steps {
  checkPhone: (name: string) => Promise<void>;
  showErrors: (errors: Record<string, string>) => Record<string, CheckoutError>;
  invalid: (errors: Record<string, CheckoutError>, method?: string) => void;
  reset: () => void;
}

export function createPlaceOrder(ctx: Context, cart: CartActions, steps: Steps) {
  const state = () => ctx.getState().checkout!;
  const set = (patch: Partial<CheckoutState>) => ctx.update('checkout', patch);

  return async (input: PlaceOrder): Promise<ApiOrder | undefined> => {
    if (state().status !== 'idle') return undefined;
    const express = !!input.expressMethod;
    const method = input.expressMethod ? paymentCode(input.expressMethod) : state().paymentMethod;
    const checks = express
      ? undefined
      : isWallet(method) && input.walletChecks !== undefined
        ? input.walletChecks
        : 'all';
    set({ status: 'placing', express });
    cart.freeze(true);
    const fail = (errors: Record<string, CheckoutError>) => {
      set({ status: 'idle', errors });
      cart.freeze(false);
      return undefined;
    };
    const stop = (errors: Record<string, CheckoutError>) => {
      steps.invalid(errors, method);
      return fail(errors);
    };

    if (checks) {
      const phones = PHONES.filter((name) => !name.startsWith('billing_') || !state().sameAsShipping);
      await within(Promise.all(phones.map((name) => steps.checkPhone(name))), PHONE_WAIT);
    }
    const errors = checks ? formErrors(state(), checks, input.phoneRequired) : {};
    if (Object.keys(errors).length) return stop(steps.showErrors(errors));
    if (!cart.lines().length) return stop({ form: { code: 'empty_cart' } });
    await cart.settled();

    let token: string | undefined;
    if (method === 'card_token') {
      if (!input.tokenize) {
        ctx.log.warn('card payment needs cc-number and cvv fields and a campaign payment_env_key');
        return stop({ form: { code: 'card' } });
      }
      try {
        token = await input.tokenize();
      } catch (err) {
        return stop({ form: { code: 'card', message: err instanceof Error ? err.message : undefined } });
      }
    }

    ctx.emit('checkout.submitted', { ...cart.currentCheckout(), payment_method: method });
    const vouchers = cart.vouchers();
    let order: ApiOrder;
    try {
      order = await ctx.api.createOrder(
        orderBody(ctx.getState(), {
          method,
          express,
          token,
          lines: cart.lines(),
          vouchers,
          attribution: ctx.attribution(),
          urls: input,
        }),
      );
    } catch (err) {
      const error = orderFailure(err);
      if (error.code === 'declined') ctx.emit('payment.failed', { method, error });
      else {
        ctx.fail('order.create', err);
        ctx.emit('checkout.failed', { ...cart.currentCheckout(), payment_method: method, error });
      }
      return fail({ form: orderError(err) });
    }
    const codes = ctx.getState().cart.coupons;
    if (vouchers.length)
      ctx.update('order', { coupon: { refId: order.ref_id, code: vouchers[0], codes } }, { silent: true });
    const created = publicOrder(order, codes);
    if (order.payment_complete_url) {
      set({ status: 'placed', pendingRef: order.ref_id, pendingMethod: method });
      ctx.emit('order.created', created);
      ctx.emit('payment.redirected', { method, ref_id: order.ref_id, url: order.payment_complete_url });
      return order;
    }
    ctx.emit('order.created', created);
    reportPaid(ctx, order, created);
    ctx.emit('checkout.completed', { ...cart.currentCheckout(), payment_method: method, ref_id: order.ref_id });
    cart.clearAfterOrder();
    steps.reset();
    return order;
  };
}
