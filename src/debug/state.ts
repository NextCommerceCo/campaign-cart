import { unitsOf } from '../engine/cart/public';
import type { Line } from '../engine/cart/types';
import type { PageConfig } from '../engine/debug-config';
import type { Context } from '../engine/engine';
import type { AnalyticsTrace } from '../engine/events/analytics';
import type { EventMap, EventName } from '../engine/events/bus';
import type { Upsell } from '../engine/events/upsells';
import { addDollars } from '../engine/format';
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
  total?: number;
  currency?: string;
  order?: string;
  /** What this page added to the order: the order's total at checkout, the accepted upsells' after it. */
  earned?: number;
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
  /** The nextConfig Page config tries on this tab; boot reads it (src/engine/debug-config.ts). */
  config?: PageConfig;
}

declare module '../engine/types' {
  interface State {
    debug?: DebugState;
  }
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

export const quantities = (lines: Line[]) => {
  const byPackage = new Map<number, number>();
  for (const l of lines) byPackage.set(l.package_id, (byPackage.get(l.package_id) ?? 0) + l.quantity);
  return byPackage;
};

/** What an accepted upsell adds: its total, else its priced lines'. */
const upsellTotal = (u: Upsell) => u.total ?? addDollars(u.lines.map((l) => l.total ?? 0));

const side = (type: string) => (type === 'billing' ? 'Billing' : 'Shipping');

/** What went amiss between the page before and this one. */
function arrivalWarnings(arrival: Arrival, before: PageVisit | undefined, units: number, linked: boolean): Mark[] {
  const { at, kind, scope } = arrival;
  const warnings: Mark[] = [];
  if (arrival.reset) warnings.push({ at, text: 'Saved data cleared with ?reset=1' });
  else if (before && before.scope !== scope)
    warnings.push({
      at,
      tone: 'error',
      text: `Storage scope changed from ${before.scope} to ${scope}, so the cart and order of the pages before are not here. Pages of one funnel need the same campaign key and data-funnel.`,
    });
  else if (before && before.units > 0 && !before.order && units === 0)
    warnings.push({
      at,
      tone: 'error',
      text: `The cart (${before.units} item${before.units === 1 ? '' : 's'}) did not carry over from ${before.path}`,
    });
  if ((kind === 'upsell' || kind === 'receipt') && !linked)
    warnings.push({
      at,
      tone: 'warn',
      text: `No order here: ${kind === 'upsell' ? 'an upsell' : 'a receipt'} page shows the order placed at checkout`,
    });
  return warnings;
}

/** The pages with this one: a reload folds into the page before, anything else starts a new step. */
function arrive(pages: PageVisit[], arrival: Arrival, units: number, order: string | undefined, warnings: Mark[]) {
  const { lines, reset, reload, ...visit } = arrival;
  const before = pages.at(-1);
  if (!reload || before?.path !== arrival.path)
    return [...pages, { ...visit, units, order, reloads: 0, sent: [], marks: warnings }].slice(-PAGES);
  const marks = [
    ...before.marks,
    { at: arrival.at, text: 'Reloaded' },
    ...warnings.filter((w) => !before.marks.some((m) => m.text === w.text)),
  ].slice(-MARKS);
  return [...pages.slice(0, -1), { ...before, units, order, reloads: before.reloads + 1, marks }];
}

/** Marks what changed in the cart since the last `cart.updated`: lines added, removed or recounted, and codes. */
function cartMarks(lines: Line[], coupons: string[], name: (id: number) => string) {
  let seen = quantities(lines);
  return (cart: EventMap['cart.updated'], at: number): Mark[] => {
    const now = quantities(cart.lines);
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
    return marks;
  };
}

/** What an event writes on its page: a patch, then a mark's text and tone. */
type Seen = [patch: Partial<PageVisit>, text?: string, tone?: Mark['tone']];
interface Journal {
  ctx: Context;
  page: () => PageVisit;
  name: (id: number) => string;
}

const placed = (d: { number?: string; ref_id: string }) => d.number ?? d.ref_id;
const failed = (d: { error: { message?: string; code: string } }) => d.error.message ?? d.error.code;

/** Each event the journey records, in the order it listens (replayed events keep that order). */
const SEEN: { [K in EventName]?: (d: EventMap[K], j: Journal) => Seen } = {
  'cart.calculated': (d) => [{ total: d.total, currency: d.currency }],
  'coupon.denied': (d) => [{}, `Coupon ${d.code} ${DENIED[d.reason]}`, 'warn'],
  'shipping.selected': (d, { ctx }) => [
    {},
    `Shipping set to ${d.code ?? ctx.getState().campaign?.shipping_methods.find((m) => m.ref_id === d.id)?.code ?? `method ${d.id}`}`,
  ],
  'checkout.started': () => [{}, 'Checkout started'],
  'address.entered': (d) => [{}, `${side(d.type)} address entered`],
  'payment.selected': (d) => [{}, `Payment method ${d.method} chosen`],
  'checkout.continued': (d) => [{}, `Step ${d.step ?? 1} passed its checks`],
  'address.autofilled': (d) => [{}, `${side(d.type)} address filled from a suggestion`],
  'checkout.submitted': () => [{}, 'Order submitted'],
  'checkout.invalid': (d) => [{}, `Submit stopped: ${Object.keys(d.errors).join(', ') || 'form not ready'}`, 'warn'],
  'checkout.completed': (d) => [{}, `Checkout completed: order ${d.ref_id}`, 'done'],
  'user.created': () => [{}, 'User created: open cart saved on the store'],
  'checkout.failed': (d) => [{}, `Order refused: ${failed(d)}`, 'warn'],
  'payment.redirected': (d) => [{}, `Left for the payment gateway to pay order ${d.ref_id}`],
  'payment.failed': (d) => [
    {},
    d.error.code === 'declined'
      ? `Payment declined${d.ref_id ? ` for order ${d.ref_id}` : ''}: ${d.error.decline_code ?? d.error.message ?? 'no reason given'}`
      : `Payment for order ${d.ref_id} not completed at the gateway`,
    'warn',
  ],
  'order.created': (d) => [
    { order: d.ref_id, total: d.total, currency: d.currency, units: 0, earned: d.total },
    `Order ${placed(d)} placed`,
    'done',
  ],
  'order.loaded': (d) => [{ order: d.ref_id, total: d.total, currency: d.currency }, `Order ${placed(d)} loaded`],
  'order.updated': (d) => [{ total: d.total, currency: d.currency }],
  'order.paid': (d) => [{}, `Order ${placed(d)} paid`, 'done'],
  'upsell.accepted': (d, { page, name }) => [
    { upsell: 'accepted', earned: addDollars([page().earned ?? 0, upsellTotal(d)]) },
    `Upsell accepted: ${d.lines.map((l) => name(l.package_id)).join(', ')}`,
    'done',
  ],
  'upsell.skipped': () => [{ upsell: 'declined' }, 'Upsell declined'],
  'upsell.failed': (d) => [{}, `Upsell refused: ${failed(d)}`, 'warn'],
  'promotion.viewed': (d) => [{}, d.type === 'exit_intent' ? 'Exit popup shown' : `Promotion ${d.id} shown`],
  'sdk.error': (d) =>
    d.action === 'storage.write'
      ? [{}, `Storage degraded: ${d.message}`, 'warn']
      : [{}, `${d.action} failed: ${d.message}`, 'error'],
};

export function createDebug(ctx: Context, arrival: Arrival) {
  const saved = ctx.saved<DebugState>('debug');
  let state: DebugState = {
    pages: saved?.pages ?? [],
    panel: saved?.panel ?? { open: false, tab: 'journey', right: true },
    ...(saved?.config && { config: saved.config }),
  };
  const save = () => ctx.update('debug', state, { silent: true });
  const page = () => state.pages.at(-1)!;
  const change = (patch: Partial<PageVisit>, ...marks: Mark[]) => {
    const now = page();
    state = {
      ...state,
      pages: [...state.pages.slice(0, -1), { ...now, ...patch, marks: [...now.marks, ...marks].slice(-MARKS) }],
    };
    save();
  };

  const order = ctx.getState().order?.refId ?? ctx.saved<{ refId?: string }>('order')?.refId;
  const units = unitsOf(arrival.lines);
  const linked = !!order || !!ctx.getState().visit.params.ref_id;
  const warnings = arrivalWarnings(arrival, state.pages.at(-1), units, linked);
  state = { ...state, pages: arrive(state.pages, arrival, units, order, warnings) };
  save();

  const journal: Journal = { ctx, page, name: (id) => ctx.getPackage(id)?.name ?? `package ${id}` };
  const cartChanged = cartMarks(arrival.lines, ctx.getState().cart.coupons, journal.name);
  const stops = [
    ctx.on('cart.updated', (e) => change({ units: unitsOf(e.data.lines) }, ...cartChanged(e.data, e.at)), {
      replay: true,
    }),
    ...Object.entries(SEEN).map(([event, seen]) =>
      ctx.on(
        event as EventName,
        (e) => {
          const [patch, text, tone] = (seen as (d: unknown, j: Journal) => Seen)(e.data, journal);
          change(patch, ...(text ? [{ at: e.at, text, ...(tone && { tone }) }] : []));
        },
        { replay: true },
      ),
    ),
    ctx.log.stream(
      (entry) => {
        const trace = entry.data as Partial<AnalyticsTrace> | undefined;
        if (trace?.trace === 'analytics' && trace.sent) change({ sent: [...page().sent, trace.name!] });
      },
      { replay: true },
    ),
  ];

  return {
    state: () => state,
    setPanel(patch: Partial<Panel>) {
      state = { ...state, panel: { ...state.panel, ...patch } };
      save();
    },
    setConfig(config: PageConfig | undefined) {
      state = { ...state, config };
      save();
    },
    clear() {
      state = { ...state, pages: state.pages.slice(-1) };
      save();
    },
    /** Stops recording this page. */
    stop: () => stops.forEach((stop) => stop()),
  };
}

export type DebugActions = ReturnType<typeof createDebug>;
