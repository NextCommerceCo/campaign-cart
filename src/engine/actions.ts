import type { CartLine } from './cart/types';
import { cardVariant, lineVariant, slotVariant } from './cart/variant-swap';
import { variantPackage } from './cart/variants';
import type { Engine } from './engine';
import { mergeMetadata } from './visit/metadata';

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

const selectorOf = (args: ActionArgs) => text(args.selector_id);

/** The selector `args` names, when it has no picked option to act on. */
const unpicked = (engine: Engine, args: ActionArgs) => {
  const id = selectorOf(args);
  return id && !engine.selectors.get(id)?.picked ? id : undefined;
};

interface QuantityStep {
  selectorId?: string;
  packageId?: number;
  current: number;
  next: number;
  min: number;
  max: number;
}

/** The quantity `setQuantity` moves from and to, and the limits it keeps to. */
function quantityStep(engine: Engine, args: ActionArgs): QuantityStep | ActionResult {
  const selectorId = selectorOf(args);
  const selector = selectorId ? engine.selectors.get(selectorId) : undefined;
  const card = selectorId ? engine.selectors.picked(selectorId) : undefined;
  const packageId = num(args.package_id);
  if (selectorId && !card) return fail('selector_id', `selector "${selectorId}" has no picked option`);
  if (!selectorId && !packageId) return fail('package_id', 'setQuantity needs package_id or selector_id');
  const current = card
    ? (selector!.quantities?.[card.id] ?? card.quantity ?? 1)
    : (engine.cart.line(packageId!)?.quantity ?? 0);
  const next = nextQuantity(args.quantity, current);
  if (next === undefined) return fail('quantity', 'quantity must be a number, +n or -n');
  const [min, max] = card
    ? [card.min ?? 1, card.max ?? 999]
    : [num(args.min_quantity) ?? (current > 0 ? 1 : 0), num(args.max_quantity) ?? Infinity];
  return { selectorId, packageId, current, next, min, max };
}

/** `addItem` and `acceptUpsell`: a selector they name has a picked option. */
const canAdd = (engine: Engine, args: ActionArgs) => !unpicked(engine, args);

/** `setQuantity`: the step is valid and moves the quantity within its limits. */
const canStep = (step: QuantityStep | ActionResult) =>
  !('ok' in step) && step.next !== step.current && step.next >= step.min && step.next <= step.max;

const currencyOf = (args: ActionArgs) => text(args.code)?.trim().toUpperCase();

/** `setCurrency`: the campaign sells in the code, and is not in it already. */
const canSwitch = (engine: Engine, args: ActionArgs) => {
  const campaign = engine.getState().campaign;
  const code = currencyOf(args);
  return code !== campaign?.currency && !!campaign?.available_currencies?.some((c) => c.code === code);
};

/** `select`: it names a selector and an option. */
const canSelect = (args: ActionArgs) => !!selectorOf(args) && !!text(args.option_id);

/** Whether `name` can run with `args` now: `data-next-action` disables its element when not. */
export function ready(engine: Engine, name: ActionName, args: ActionArgs): boolean {
  switch (name) {
    case 'addItem':
    case 'acceptUpsell':
      return canAdd(engine, args);
    case 'setQuantity':
      return canStep(quantityStep(engine, args));
    case 'select':
      return canSelect(args);
    case 'setCurrency':
      return canSwitch(engine, args);
    default:
      return true;
  }
}

const noVariant = (code: string, value: string) => fail('value', `no package for ${code} ${value}`);

async function addItem(engine: Engine, args: ActionArgs): Promise<ActionResult> {
  const selectorId = selectorOf(args);
  const lines = text(args.items)
    ? parseItems(text(args.items))
    : num(args.package_id)
      ? [{ packageId: num(args.package_id)!, quantity: num(args.quantity) ?? 1 }]
      : [];
  if (!selectorId && !lines.length) return fail('items', 'nothing to add: items, package_id or selector_id');
  if (!canAdd(engine, args)) return fail('selector_id', `selector "${selectorId}" has no picked option`);
  if (args.replace === true || args.replace === 'true' || args.replace === '') await engine.cart.clear();
  if (selectorId) await engine.selectors.addToCart(selectorId);
  else for (const line of lines) await engine.cart.addItem(line.packageId, line.quantity);
  return OK;
}

async function setQuantity(engine: Engine, args: ActionArgs): Promise<ActionResult> {
  const step = quantityStep(engine, args);
  if ('ok' in step) return step;
  if (step.selectorId) await engine.selectors.setQuantity(step.selectorId, step.next);
  else await engine.cart.setQuantity(step.packageId!, Math.min(step.max, Math.max(step.min, step.next)));
  return OK;
}

async function selectVariant(engine: Engine, args: ActionArgs): Promise<ActionResult> {
  const code = text(args.code);
  const value = text(args.value);
  if (!code || value === undefined) return fail('value', 'selectVariant needs code and value');
  const packages = engine.getState().campaign?.packages ?? [];
  const packageFor = (current: number) => variantPackage(packages, current, code, value);
  const selectorId = selectorOf(args);
  const optionId = text(args.option_id);
  const card = selectorId ? engine.selectors.get(selectorId)?.cards.find((c) => c.id === optionId) : undefined;
  if (card && args.slot_index !== undefined)
    return (await slotVariant(engine, selectorId!, card, Number(args.slot_index), packageFor))
      ? OK
      : noVariant(code, value);
  if (card) return (await cardVariant(engine, selectorId!, card, packageFor)) ? OK : noVariant(code, value);
  return (await lineVariant(engine, num(args.package_id), packageFor))
    ? OK
    : fail('value', 'this line cannot change its variant');
}

const offer = (args: ActionArgs) => {
  const selectorId = selectorOf(args);
  const lines = parseItems(text(args.items));
  return { selectorId, lines: lines.length ? lines : undefined };
};

/**
 * Every action a page or a script can ask for, under the names `next.actions` and
 * `data-next-action` share. Each takes one object of the model's field names and resolves to
 * `{ ok, errors }`; the events each one sends are the engine action's own.
 */
export function createActions(
  engine: Engine,
  host: { page: () => string; navigate: (url: string) => void; url: (target: string) => string },
) {
  return {
    addItem: (args = {}) => addItem(engine, args),
    setQuantity: (args = {}) => setQuantity(engine, args),
    async removeItem(args = {}) {
      const packageId = num(args.package_id);
      if (!packageId) return fail('package_id', 'removeItem needs package_id');
      await engine.cart.removeItem(packageId);
      return OK;
    },
    async select(args = {}) {
      if (!canSelect(args)) return fail('option_id', 'select needs selector_id and option_id');
      const selectorId = selectorOf(args)!;
      const optionId = text(args.option_id)!;
      if (!engine.selectors.get(selectorId)?.cards.some((c) => c.id === optionId))
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
    selectVariant: (args = {}) => selectVariant(engine, args),
    async setMetadata(args = {}) {
      const refused = mergeMetadata(engine, args);
      return refused ? fail(refused, 'a metadata value is a string or a number') : OK;
    },
    async setCurrency(args = {}) {
      const code = currencyOf(args);
      if (!code) return fail('code', 'setCurrency needs code');
      if (code === engine.getState().campaign?.currency) return OK;
      if (!canSwitch(engine, args)) return fail('code', `this campaign has no prices in "${code}"`);
      const url = new URL(host.url(''));
      url.searchParams.set('currency', code);
      host.navigate(url.toString());
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
