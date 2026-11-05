import { failureOf } from '../api';
import type { Context } from '../engine';
import { serialize } from '../flow';
import { addDollars, cents } from '../format';
import type { EventMap } from '../events/bus';
import type { Cart } from '../events/carts';
import type { Line, CartOperation, CartState, CartSummary } from './types';
import { normalizeCode } from './lines';

export interface CouponCart {
  vouchers: () => string[];
  lines: () => Line[];
  price: (codes: string[], signal?: AbortSignal) => Promise<CartSummary>;
  settled: () => Promise<void>;
  settledSummary: () => CartSummary | undefined;
  cartOf: (summary?: CartSummary) => Cart;
  commit: (patch: Partial<CartState>, operation?: CartOperation, also?: () => void) => Promise<void>;
}

function addsDiscount(without: CartSummary, withCode: CartSummary): boolean {
  const ids = (s: CartSummary) =>
    new Set(
      [...s.voucher_discounts, ...s.offer_discounts, ...(s.shipping_method?.discounts ?? [])].map((d) => d.offer_id),
    );
  const before = ids(without);
  return [...ids(withCode)].some((id) => !before.has(id)) || cents(withCode.total) < cents(without.total);
}

export function createCoupons(ctx: Context, cart: CouponCart) {
  let checkingHeld = false;
  const inTurn = serialize();
  const waiting = new Map<string, (applied: boolean) => void>();
  const checking = new Map<string, object>();
  const state = () => ctx.getState().cart;
  const set = (patch: Partial<CartState>) => ctx.update('cart', patch);

  const deny = (code: string, reason: EventMap['coupon.denied']['reason'], message?: string) =>
    ctx.emit('coupon.denied', { code, reason, ...(message && { message }) });

  const discountsOf = (code: string, summary: CartSummary) => {
    const priced = cart.cartOf(summary);
    const discounts = [...(priced.discounts ?? []), ...(priced.shipping_method?.discounts ?? [])].filter(
      (d) => d.code === code,
    );
    return discounts.length ? { amount: addDollars(discounts.map((d) => d.amount)), discounts } : {};
  };

  const answer = (code: string, applied: boolean) => {
    waiting.get(code)?.(applied);
    waiting.delete(code);
  };

  const unheld = (code: string) => state().held.filter((c) => c !== code);

  const check = (code: string) => {
    // identity token: a newer check of this code, a removal or a clear drops this one
    const run = {};
    checking.set(code, run);
    const go = async (): Promise<'applied' | 'denied' | 'frozen' | 'dropped'> => {
      let without: CartSummary | undefined;
      let withCode: CartSummary | undefined;
      let error: unknown;
      try {
        await cart.settled();
        const base = cart.vouchers();
        without = cart.settledSummary() || (await cart.price(base));
        withCode = await cart.price([...base, code]);
      } catch (err) {
        error = err;
      }
      if (checking.get(code) !== run) return 'dropped';
      checking.delete(code);
      if (state().frozen) return 'frozen';
      if (!withCode) {
        ctx.fail('coupon.check', error);
        deny(code, 'check_failed', failureOf(error).message);
        return 'denied';
      }
      if (!addsDiscount(without!, withCode)) {
        deny(code, 'no_discount');
        return 'denied';
      }
      await cart.commit({ coupons: [...state().coupons, code], held: unheld(code) }, undefined, () =>
        ctx.emit('coupon.applied', { code, ...discountsOf(code, withCode) }),
      );
      return 'applied';
    };
    return inTurn(go);
  };

  const checkHeld = async () => {
    if (checkingHeld) return;
    checkingHeld = true;
    try {
      for (let code = state().held[0]; code !== undefined; code = state().held[0]) {
        if (state().frozen || !cart.lines().length) break;
        const result = await check(code);
        if (result === 'frozen') break;
        if (result === 'denied') set({ held: unheld(code) });
        if (result !== 'dropped') answer(code, result === 'applied');
      }
    } finally {
      checkingHeld = false;
    }
  };

  return {
    checkHeld,
    answer,
    stopChecks: () => checking.clear(),
    dropAll() {
      waiting.forEach((done) => done(false));
      waiting.clear();
    },
    async apply(code: string): Promise<boolean> {
      const normalized = normalizeCode(code);
      if (state().frozen || !normalized) return false;
      if (cart.vouchers().includes(normalized) || state().held.includes(normalized) || checking.has(normalized)) {
        deny(normalized, 'duplicate');
        return false;
      }
      if (cart.lines().length && ctx.getState().campaign) return (await check(normalized)) === 'applied';
      set({ held: [...state().held, normalized] });
      return new Promise((done) => waiting.set(normalized, done));
    },
    remove(code: string): Promise<void> {
      const normalized = normalizeCode(code);
      if (state().frozen) return Promise.resolve();
      checking.delete(normalized);
      if (state().held.includes(normalized)) {
        set({ held: unheld(normalized) });
        answer(normalized, false);
      }
      if (!state().coupons.includes(normalized)) return Promise.resolve();
      return cart.commit({ coupons: state().coupons.filter((c) => c !== normalized) }, undefined, () =>
        ctx.emit('coupon.removed', { code: normalized, reason: 'shopper' }),
      );
    },
  };
}
