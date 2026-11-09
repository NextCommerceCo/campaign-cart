import type { Engine } from '../engine/engine';
import type { Upsell } from '../engine/events/upsells';
import type { ApiOrder, ApiOrderLine, Package } from '../engine/types';
import type { OrderActions } from '../order/state';
import { ACCEPT_WORDS, NEXT_URL_ATTRS } from '../order/upsell';
import { selectorIdOf } from '../dom/dom';
import { addLegacyEvents, legacyEvent, legacyFire } from './legacy/registry';

/** @deprecated `data-next-bundle-selector-id` on `[data-next-upsell]`. Put the `[data-next-bundle-selector]` inside the offer. */
export const legacyOfferSelector = (offer: Element) => offer.getAttribute('data-next-bundle-selector-id') ?? undefined;

const offerPackage = (u: Upsell) => (u.selector_id ? undefined : u.lines[0]?.package_id);
const leaves = () =>
  !!document.querySelector(
    ['meta[name="next-upsell-accept-url"]', ...NEXT_URL_ATTRS.map((a) => `[data-next-upsell] [${a}]`)].join(', '),
  );

const ORDER_EVENTS = {
  'order:completed': legacyEvent({
    from: ['order.paid', 'order.loaded'],
    when: (e, state) => e.name === 'order.paid' || !!state.order?.order?.payment_complete_url,
    data: (_, state) => state.order?.order,
  }),
  'upsell:viewed': legacyEvent({
    from: ['upsell.shown'],
    once: true,
    data: ({ data }) => ({ pagePath: data.page, orderId: data.ref_id }),
  }),
  'upsell:added': legacyEvent({
    from: ['upsell.accepted'],
    each: true,
    data: ({ data }, state) =>
      data.lines.map((l) => ({
        packageId: l.package_id,
        quantity: l.quantity,
        order: state.order?.order,
        ...(l.total !== undefined && { value: l.total }),
        willRedirect: leaves(),
      })),
  }),
  'upsell:skipped': legacyEvent({
    from: ['upsell.skipped'],
    data: ({ data }) => ({
      ...(offerPackage(data) !== undefined && { packageId: offerPackage(data) }),
      ...(data.ref_id && { orderId: data.ref_id }),
    }),
  }),
  'action:failed': legacyEvent({
    from: ['sdk.error', 'upsell.declined'],
    when: (e) => e.name === 'upsell.declined' || e.data.action === 'upsell.add',
    data: (e) => ({ action: 'AcceptUpsellEnhancer', error: new Error(e.data.message) }),
  }),
  'upsell:error': legacyEvent({
    from: ['upsell.failed', 'upsell.declined'],
    data: ({ data }) => ({ packageId: offerPackage(data) ?? 0, error: data.error.message ?? 'Unknown error' }),
  }),
};

/** The package an offer adds: its own, else the first of its selector's picked option. */
function packageOf(engine: Engine, offer: Element): number {
  const own = Number(offer.getAttribute('data-next-package-id'));
  const box = offer.querySelector('[data-next-bundle-selector]');
  const id = box ? selectorIdOf(box) : legacyOfferSelector(offer);
  return own || ((id ? engine.selectors.picked(id) : undefined)?.lines[0]?.packageId ?? 0);
}

/**
 * @deprecated The order chunk's 0.4.x `next.on` names: `order:completed` and the upsell events, with the page moments
 * 0.4.x sent: `upsell:initialized` per offer, and `upsell:adding` when an add goes out.
 */
export function legacyOrderEvents(engine: Engine): void {
  addLegacyEvents(engine, ORDER_EVENTS);
  const offers = [...document.querySelectorAll('[data-next-upsell]')];
  for (const offer of offers)
    legacyFire(engine, 'upsell:initialized', { packageId: packageOf(engine, offer), element: offer });
  const adding = new WeakSet<Element>();
  document.addEventListener('click', (e) => {
    const button = e.target instanceof Element ? e.target.closest('[data-next-upsell-action]') : null;
    const offer = button?.closest('[data-next-upsell]');
    if (!offer || adding.has(offer) || !ACCEPT_WORDS.includes(button!.getAttribute('data-next-upsell-action') ?? ''))
      return;
    if (engine.getState().order?.status !== 'accepting') return;
    adding.add(offer);
    legacyFire(engine, 'upsell:adding', { packageId: packageOf(engine, offer) });
  });
}

const QTY_TOGGLE = 'data-next-upsell-quantity-toggle';

/**
 * @deprecated `data-next-upsell-quantity-toggle="n"`: a click sets the offer's `data-next-quantity` and marks that
 * toggle `next-selected`. Use `data-next-quantity` on the offer, or a bundle selector inside it.
 */
export function legacyQuantityToggles(): void {
  for (const offer of document.querySelectorAll<HTMLElement>('[data-next-upsell]')) {
    const toggles = [...offer.querySelectorAll<HTMLElement>(`[${QTY_TOGGLE}]`)];
    if (!toggles.length) continue;
    const select = (qty: number) => {
      offer.setAttribute('data-next-quantity', String(qty));
      for (const t of toggles) t.classList.toggle('next-selected', Number(t.getAttribute(QTY_TOGGLE)) === qty);
    };
    select(Number(offer.getAttribute('data-next-quantity')) || 1);
    for (const t of toggles) t.addEventListener('click', () => select(Number(t.getAttribute(QTY_TOGGLE)) || 1));
  }
}

export interface LegacyUpsellOptions {
  packageId?: number;
  quantity?: number;
  items?: Array<{ packageId: number; quantity?: number }>;
}

export interface LegacyUpsellApi {
  /** @deprecated Use `next.actions.acceptUpsell({ items: '12x2' })` or `data-next-upsell-action="add"`. Throws as 0.4.x did. */
  addUpsell(o: LegacyUpsellOptions): Promise<{ order: ApiOrder; addedLines: ApiOrderLine[]; totalValue: number }>;
  /** @deprecated Read `next.snapshot().order`. */
  canAddUpsells(): boolean;
  /** @deprecated The package ids of the order's upsell lines, as strings. */
  getCompletedUpsells(): string[];
  /** @deprecated Whether the order has an upsell line of this package. */
  isUpsellAlreadyAdded(packageId: number): boolean;
  /** @deprecated The values of one variant attribute across the product's packages, sorted. */
  getAvailableVariantAttributes(productId: number, code: string): string[];
  /** @deprecated The first package of the product with every one of these attribute values. */
  getPackageByVariantSelection(productId: number, picked: Record<string, string>): Package | null;
}

/** @deprecated The order chunk's 0.4.x `window.next` methods: post-purchase upsells and the variant lookups their scripts use. */
export function legacyUpsellApi(engine: Engine, order: OrderActions): LegacyUpsellApi {
  const state = () => engine.getState().order;
  const upsellLines = (o?: ApiOrder) => (o?.lines ?? []).filter((l) => l.is_upsell);
  const completed = () => upsellLines(state()?.order).map((l) => String(l.package ?? ''));
  const packagesOf = (productId: number) =>
    (engine.getState().campaign?.packages ?? []).filter((p) => p.product_id === productId);
  return {
    async addUpsell({ packageId, quantity, items }) {
      const before = state()?.order;
      if (!before) throw new Error('No order found. Upsells can only be added after order completion.');
      const lines = items?.length
        ? items.map((i) => ({ packageId: i.packageId, quantity: i.quantity || 1 }))
        : packageId
          ? [{ packageId, quantity: quantity || 1 }]
          : [];
      if (!lines.length) throw new Error('Either packageId or items array must be provided');
      const result = await order.accept({ lines }, location.pathname);
      if (result !== 'accepted' && result !== 'repeat') throw new Error(`Failed to add upsell: ${result}`);
      const after = state()!.order!;
      const known = new Set(upsellLines(before).map((l) => String(l.id)));
      const addedLines = upsellLines(after).filter((l) => !known.has(String(l.id)));
      const totalValue = addedLines.reduce((n, l) => n + Number(l.price_incl_tax || 0), 0);
      return { order: after, addedLines, totalValue };
    },
    canAddUpsells: () => state()?.status === 'ready' && !!state()?.order?.supports_post_purchase_upsells,
    getCompletedUpsells: completed,
    isUpsellAlreadyAdded: (packageId) => completed().includes(String(packageId)),
    getAvailableVariantAttributes: (productId, code) => {
      const values = packagesOf(productId).flatMap((p) =>
        (p.product_variant_attribute_values ?? []).filter((a) => a.code === code).map((a) => a.value),
      );
      return [...new Set(values)].sort();
    },
    getPackageByVariantSelection: (productId, picked) =>
      packagesOf(productId).find((p) =>
        Object.entries(picked).every(([code, value]) =>
          p.product_variant_attribute_values?.some((a) => a.code === code && a.value === value),
        ),
      ) ?? null,
  };
}
