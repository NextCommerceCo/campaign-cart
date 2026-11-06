import type { Line } from '../engine/cart/types';
import type { Context } from '../engine/engine';
import type { AnalyticsTrace } from '../engine/events/analytics';
import type { EngineEvent, EventMap, EventName } from '../engine/events/bus';
import type { Theme } from './theme';

export type PageKind = 'product' | 'checkout' | 'upsell' | 'receipt' | 'page';

export interface Mark {
  at: number;
  text: string;
  tone?: 'done' | 'warn' | 'error';
}

export interface PageVisit {
  at: number;
  path: string;
  title: string;
  kind: PageKind;
  scope: string;
  reloads: number;
  units: number;
  total?: string;
  currency?: string;
  order?: string;
  upsell?: 'accepted' | 'declined';
  sent: string[];
  marks: Mark[];
}

export interface Panel {
  open: boolean;
  tab: string;
  right: boolean;
  dev?: boolean;
  country?: string;
  /** Light or dark over the system's; none follows the system. */
  theme?: Theme;
  /** The Events tab groups the events one action set off. */
  grouped?: boolean;
}

export interface DebugState {
  pages: PageVisit[];
  panel: Panel;
}

export interface Arrival {
  at: number;
  path: string;
  title: string;
  kind: PageKind;
  scope: string;
  reload: boolean;
  reset: boolean;
  lines: Line[];
}

const PAGES = 25;
const MARKS = 60;
const DENIED: Record<EventMap['coupon.denied']['reason'], string> = {
  no_discount: 'refused by the server',
  duplicate: 'is already on the cart',
  check_failed: 'could not be checked',
};

const quantities = (lines: Line[]) => {
  const byPackage = new Map<number, number>();
  for (const l of lines) byPackage.set(l.package_id, (byPackage.get(l.package_id) ?? 0) + l.quantity);
  return byPackage;
};

const count = (lines: Line[]) => lines.reduce((n, l) => n + l.quantity, 0);

export function createDebug(ctx: Context, arrival: Arrival) {
  const saved = ctx.saved<DebugState>('debug');
  let state: DebugState = {
    pages: saved?.pages ?? [],
    panel: saved?.panel ?? { open: false, tab: 'journey', right: true },
  };
  const save = () => ctx.update('debug', state, { silent: true });

  const change = (patch: Partial<PageVisit>, ...marks: Mark[]) => {
    const page = state.pages.at(-1)!;
    state = {
      ...state,
      pages: [...state.pages.slice(0, -1), { ...page, ...patch, marks: [...page.marks, ...marks].slice(-MARKS) }],
    };
    save();
  };

  const before = state.pages.at(-1);
  const order = ctx.getState().order?.refId ?? ctx.saved<{ refId?: string }>('order')?.refId;
  const units = count(arrival.lines);
  const warnings: Mark[] = [];
  const at = arrival.at;
  if (arrival.reset) warnings.push({ at, text: 'Saved data cleared with ?reset=1' });
  else if (before && before.scope !== arrival.scope)
    warnings.push({
      at,
      tone: 'error',
      text: `Storage scope changed from ${before.scope} to ${arrival.scope}, so the cart and order of the pages before are not here. Pages of one funnel need the same campaign key and data-funnel.`,
    });
  else if (before && before.units > 0 && !before.order && units === 0)
    warnings.push({
      at,
      tone: 'error',
      text: `The cart (${before.units} item${before.units === 1 ? '' : 's'}) did not carry over from ${before.path}`,
    });
  if ((arrival.kind === 'upsell' || arrival.kind === 'receipt') && !order && !ctx.getState().visit.params.ref_id)
    warnings.push({
      at,
      tone: 'warn',
      text: `No order here: ${arrival.kind === 'upsell' ? 'an upsell' : 'a receipt'} page shows the order placed at checkout`,
    });

  const { lines, reset, reload, ...visit } = arrival;
  const pages =
    reload && before?.path === arrival.path
      ? [
          ...state.pages.slice(0, -1),
          {
            ...before,
            units,
            order,
            reloads: before.reloads + 1,
            marks: [...before.marks, { at, text: 'Reloaded' }, ...warnings].slice(-MARKS),
          },
        ]
      : [...state.pages, { ...visit, units, order, reloads: 0, sent: [], marks: warnings }].slice(-PAGES);
  state = { ...state, pages };
  save();

  const name = (id: number) => ctx.getPackage(id)?.name ?? `package ${id}`;
  let seen = quantities(lines);
  let coupons = ctx.getState().cart.coupons;
  const cartChanged = (cart: EventMap['cart.updated'], at: number) => {
    const merged = cart.lines;
    const now = quantities(merged);
    const marks: Mark[] = [];
    for (const id of new Set([...seen.keys(), ...now.keys()])) {
      const was = seen.get(id) ?? 0;
      const is = now.get(id) ?? 0;
      if (!was) marks.push({ at, text: `Added ${name(id)} ×${is}` });
      else if (!is) marks.push({ at, text: `Removed ${name(id)}` });
      else if (was !== is) marks.push({ at, text: `${name(id)} ×${was} → ×${is}` });
    }
    for (const code of cart.coupons.filter((c) => !coupons.includes(c)))
      marks.push({ at, text: `Coupon ${code} applied` });
    for (const code of coupons.filter((c) => !cart.coupons.includes(c)))
      marks.push({ at, text: `Coupon ${code} removed` });
    seen = now;
    coupons = cart.coupons;
    change({ units: count(merged) }, ...marks);
  };

  const shippingCode = (id: number | undefined) =>
    ctx.getState().campaign?.shipping_methods.find((m) => m.ref_id === id)?.code ?? `method ${id}`;
  const on = <K extends EventName>(event: K, fn: (e: EngineEvent<K>) => void) => ctx.on(event, fn, { replay: true });
  on('cart.updated', (e) => cartChanged(e.data, e.at));
  on('cart.calculated', (e) => change({ total: e.data.total?.toFixed(2), currency: e.data.currency }));
  on('coupon.denied', (e) =>
    change({}, { at: e.at, tone: 'warn', text: `Coupon ${e.data.code} ${DENIED[e.data.reason]}` }),
  );
  on('shipping.selected', (e) =>
    change({}, { at: e.at, text: `Shipping set to ${e.data.code ?? shippingCode(e.data.id)}` }),
  );
  on('checkout.started', (e) => change({}, { at: e.at, text: 'Checkout started' }));
  on('address.entered', (e) =>
    change({}, { at: e.at, text: `${e.data.type === 'billing' ? 'Billing' : 'Shipping'} address entered` }),
  );
  on('payment.selected', (e) => change({}, { at: e.at, text: `Payment method ${e.data.method} chosen` }));
  on('checkout.continued', (e) => change({}, { at: e.at, text: `Step ${e.data.step ?? 1} passed its checks` }));
  on('address.autofilled', (e) =>
    change(
      {},
      { at: e.at, text: `${e.data.type === 'billing' ? 'Billing' : 'Shipping'} address filled from a suggestion` },
    ),
  );
  on('checkout.submitted', (e) => change({}, { at: e.at, text: 'Order submitted' }));
  on('checkout.invalid', (e) =>
    change({}, { at: e.at, text: `Submit stopped: ${Object.keys(e.data.errors).join(', ') || 'form not ready'}` }),
  );
  on('checkout.completed', (e) =>
    change({}, { at: e.at, tone: 'done', text: `Checkout completed: order ${e.data.ref_id}` }),
  );
  on('user.created', (e) => change({}, { at: e.at, text: 'User created: open cart saved on the store' }));
  on('checkout.failed', (e) =>
    change({}, { at: e.at, tone: 'warn', text: `Order refused: ${e.data.error.message ?? e.data.error.code}` }),
  );
  on('payment.redirected', (e) =>
    change({}, { at: e.at, text: `Left for the payment gateway to pay order ${e.data.ref_id}` }),
  );
  on('payment.failed', (e) =>
    change(
      {},
      {
        at: e.at,
        tone: 'warn',
        text:
          e.data.error.code === 'declined'
            ? `Payment declined${e.data.ref_id ? ` for order ${e.data.ref_id}` : ''}: ${e.data.error.decline_code ?? e.data.error.message ?? 'no reason given'}`
            : `Payment for order ${e.data.ref_id} not completed at the gateway`,
      },
    ),
  );
  on('order.created', (e) =>
    change(
      { order: e.data.ref_id, total: e.data.total.toFixed(2), currency: e.data.currency, units: 0 },
      { at: e.at, tone: 'done', text: `Order ${e.data.number ?? e.data.ref_id} placed` },
    ),
  );
  on('order.loaded', (e) =>
    change(
      { order: e.data.ref_id, total: e.data.total.toFixed(2), currency: e.data.currency },
      { at: e.at, text: `Order ${e.data.number ?? e.data.ref_id} loaded` },
    ),
  );
  on('order.paid', (e) => change({}, { at: e.at, tone: 'done', text: `Order ${e.data.number ?? e.data.ref_id} paid` }));
  on('upsell.accepted', (e) =>
    change(
      { upsell: 'accepted' },
      { at: e.at, tone: 'done', text: `Upsell accepted: ${e.data.lines.map((l) => name(l.package_id)).join(', ')}` },
    ),
  );
  on('upsell.skipped', (e) => change({ upsell: 'declined' }, { at: e.at, text: 'Upsell declined' }));
  on('upsell.failed', (e) =>
    change({}, { at: e.at, tone: 'warn', text: `Upsell refused: ${e.data.error.message ?? e.data.error.code}` }),
  );
  on('promotion.viewed', (e) =>
    change({}, { at: e.at, text: e.data.type === 'exit_intent' ? 'Exit popup shown' : `Promotion ${e.data.id} shown` }),
  );
  on('sdk.error', (e) =>
    e.data.action === 'storage.write'
      ? change({}, { at: e.at, tone: 'warn', text: `Storage degraded: ${e.data.message}` })
      : change({}, { at: e.at, tone: 'error', text: `${e.data.action} failed: ${e.data.message}` }),
  );
  ctx.log.stream(
    (entry) => {
      const trace = entry.data as Partial<AnalyticsTrace> | undefined;
      if (trace?.trace === 'analytics' && trace.sent) change({ sent: [...state.pages.at(-1)!.sent, trace.name!] });
    },
    { replay: true },
  );

  return {
    state: () => state,
    setPanel(patch: Partial<Panel>) {
      state = { ...state, panel: { ...state.panel, ...patch } };
      save();
    },
    clear() {
      state = { ...state, pages: state.pages.slice(-1) };
      save();
    },
  };
}

export type DebugActions = ReturnType<typeof createDebug>;
