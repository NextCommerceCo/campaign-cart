import type { CartLine } from './cart/types';
import type { Engine } from './engine';

/** What every action resolves to: it never throws. */
export interface ActionResult {
  ok: boolean;
  /** Why it did not run or was refused, by argument name. */
  errors?: Record<string, string>;
}

/** An action's arguments: the snake_case fields of the object model, as `data-next-*` attributes name them. */
export type ActionArgs = Record<string, string | number | boolean | undefined>;

export type Action = (args?: ActionArgs) => Promise<ActionResult>;

const OK: ActionResult = { ok: true };
const fail = (field: string, message: string): ActionResult => ({ ok: false, errors: { [field]: message } });

/** `"1x3, 5"`: package 1 three times, package 5 once. */
export function parseItems(raw: string | undefined): CartLine[] {
  return (raw ?? '')
    .split(',')
    .map((part) => /^\s*(\d+)\s*(?:x\s*(\d+))?\s*$/i.exec(part))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ packageId: Number(m[1]), quantity: Number(m[2] ?? 1) }))
    .filter((l) => l.packageId > 0 && l.quantity > 0);
}

const text = (v: unknown) => (v === undefined || v === null ? undefined : String(v));
const num = (v: unknown) => (v === undefined || v === '' ? undefined : Number(v));

/** The step `quantity` asks for from `current`: `"+1"` and `"-1"` move it, a plain number sets it. */
export function nextQuantity(raw: unknown, current: number): number | undefined {
  const value = text(raw)?.trim();
  if (!value) return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) return undefined;
  return /^[+-]/.test(value) ? current + n : n;
}

/**
 * Every action a page or a script can ask for, under the names `next.actions` and
 * `data-next-action` share. Each takes one object of the model's field names and resolves to
 * `{ ok, errors }`; the events each one sends are the engine action's own.
 */
export function createActions(
  engine: Engine,
  host: { page: () => string; navigate: (url: string) => void; url: (target: string) => string },
) {
  const selectorOf = (args: ActionArgs) => text(args.selector_id);

  const addItem: Action = async (args = {}) => {
    const selectorId = selectorOf(args);
    const lines = text(args.items)
      ? parseItems(text(args.items))
      : num(args.package_id)
        ? [{ packageId: num(args.package_id)!, quantity: num(args.quantity) ?? 1 }]
        : [];
    if (!selectorId && !lines.length) return fail('items', 'nothing to add: items, package_id or selector_id');
    if (selectorId && !engine.getState().selectors[selectorId]?.picked)
      return fail('selector_id', `selector "${selectorId}" has no picked option`);
    if (args.replace === true || args.replace === 'true' || args.replace === '') await engine.cart.clear();
    if (selectorId) await engine.selectors.addToCart(selectorId);
    else for (const line of lines) await engine.cart.addItem(line.packageId, line.quantity);
    return OK;
  };

  const setQuantity: Action = async (args = {}) => {
    const selectorId = selectorOf(args);
    if (selectorId) {
      const selector = engine.getState().selectors[selectorId];
      const card = selector?.cards.find((c) => c.id === selector.picked);
      if (!selector || !card) return fail('selector_id', `selector "${selectorId}" has no picked option`);
      const current = selector.quantities?.[card.id] ?? card.quantity ?? 1;
      const next = nextQuantity(args.quantity, current);
      if (next === undefined) return fail('quantity', 'quantity must be a number, +n or -n');
      await engine.selectors.setQuantity(selectorId, next);
      return OK;
    }
    const packageId = num(args.package_id);
    if (!packageId) return fail('package_id', 'setQuantity needs package_id or selector_id');
    const current = engine.cart.lines().find((l) => l.package_id === packageId)?.quantity ?? 0;
    const next = nextQuantity(args.quantity, current);
    if (next === undefined) return fail('quantity', 'quantity must be a number, +n or -n');
    const min = num(args.min_quantity) ?? (current > 0 ? 1 : 0);
    const max = num(args.max_quantity) ?? Infinity;
    await engine.cart.setQuantity(packageId, Math.min(max, Math.max(min, next)));
    return OK;
  };

  const offer = (args: ActionArgs) => {
    const selectorId = selectorOf(args);
    const lines = parseItems(text(args.items));
    return { selectorId, lines: lines.length ? lines : undefined };
  };

  return {
    addItem,
    setQuantity,
    async removeItem(args = {}) {
      const packageId = num(args.package_id);
      if (!packageId) return fail('package_id', 'removeItem needs package_id');
      await engine.cart.removeItem(packageId);
      return OK;
    },
    async select(args = {}) {
      const selectorId = selectorOf(args);
      const optionId = text(args.option_id);
      if (!selectorId || !optionId) return fail('option_id', 'select needs selector_id and option_id');
      if (!engine.getState().selectors[selectorId]?.cards.some((c) => c.id === optionId))
        return fail('option_id', `selector "${selectorId}" has no option "${optionId}"`);
      await engine.selectors.pick(selectorId, optionId);
      return OK;
    },
    async clear() {
      await engine.cart.clear();
      return OK;
    },
    async applyCoupon(args = {}) {
      const code = text(args.code)?.trim();
      if (!code) return fail('code', 'enter a code');
      return (await engine.cart.applyCoupon(code)) ? OK : fail('code', `code "${code.toUpperCase()}" was not applied`);
    },
    async removeCoupon(args = {}) {
      const code = text(args.code)?.trim();
      if (!code) return fail('code', 'removeCoupon needs code');
      await engine.cart.removeCoupon(code);
      return OK;
    },
    async setShipping(args = {}) {
      const id = num(args.shipping_id);
      if (!id) return fail('shipping_id', 'setShipping needs shipping_id');
      await engine.cart.setShipping(id);
      return OK;
    },
    async acceptUpsell(args = {}) {
      const order = engine.order;
      if (!order || !engine.getState().order?.order) return fail('order', 'no order on this page');
      const result = await order.accept(offer(args), host.page());
      return result === 'accepted' || result === 'repeat' ? OK : fail('order', result);
    },
    async skipUpsell(args = {}) {
      const order = engine.order;
      if (!order) return fail('order', 'no order on this page');
      order.skip(offer(args), host.page());
      return OK;
    },
    async go(args = {}) {
      const url = text(args.url);
      if (!url) return fail('url', 'go needs url');
      host.navigate(host.url(url));
      return OK;
    },
  } satisfies Record<string, Action>;
}

export type Actions = ReturnType<typeof createActions>;
export type ActionName = keyof Actions;

/** `window.next.actions`: every action, plus the 0.5 positional calls. */
export type NextActions = Omit<
  Actions,
  'addItem' | 'removeItem' | 'setQuantity' | 'applyCoupon' | 'removeCoupon' | 'setShipping'
> & {
  addItem(args: ActionArgs): Promise<ActionResult>;
  /** @deprecated Use `addItem({ package_id, quantity })`. */
  addItem(packageId: number, quantity?: number): Promise<void>;
  removeItem(args: ActionArgs): Promise<ActionResult>;
  /** @deprecated Use `removeItem({ package_id })`. */
  removeItem(packageId: number): Promise<void>;
  setQuantity(args: ActionArgs): Promise<ActionResult>;
  /** @deprecated Use `setQuantity({ package_id, quantity })`. */
  setQuantity(packageId: number, quantity: number): Promise<void>;
  applyCoupon(args: ActionArgs): Promise<ActionResult>;
  /** @deprecated Use `applyCoupon({ code })`. */
  applyCoupon(code: string): Promise<boolean>;
  removeCoupon(args: ActionArgs): Promise<ActionResult>;
  /** @deprecated Use `removeCoupon({ code })`. */
  removeCoupon(code: string): Promise<void>;
  setShipping(args: ActionArgs): Promise<ActionResult>;
  /** @deprecated Use `setShipping({ shipping_id })`. */
  setShipping(shippingId: number | undefined): Promise<void>;
  setGroup(id: string, group: { lines: CartLine[]; vouchers?: string[] } | null): Promise<void>;
};
