import type { Engine } from '../engine/engine';
import { pickedCard } from '../engine/cart/selectors';
import type { Upsell } from '../engine/events';
import { addLegacyEvents, legacyEvent, legacyFire, legacySelectorId } from './legacy';

/** @deprecated `accept` / `decline`. Use `data-next-upsell-action="add"` / `"skip"`. */
export const ACCEPT_WORDS = ['add', 'accept'];

/** @deprecated `data-next-next-url` / `data-os-next-url`. Use `data-next-url`. */
export const NEXT_URL_ATTRS = ['data-next-url', 'data-next-next-url', 'data-os-next-url'];

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
    from: ['upsell.viewed'],
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
    from: ['sdk.error'],
    when: (e) => e.data.action === 'upsell.add',
    data: (e) => ({ action: 'AcceptUpsellEnhancer', error: new Error(e.data.message) }),
  }),
  'upsell:error': legacyEvent({
    from: ['upsell.failed'],
    data: ({ data }) => ({ packageId: offerPackage(data) ?? 0, error: data.error.message ?? 'Unknown error' }),
  }),
};

/** The package an offer adds: its own, else the first of its selector's picked option. */
function packageOf(engine: Engine, offer: Element): number {
  const own = Number(offer.getAttribute('data-next-package-id'));
  const box = offer.querySelector('[data-next-bundle-selector]');
  const id = box ? (box.getAttribute('data-next-selector-id') ?? legacySelectorId(box)) : legacyOfferSelector(offer);
  const selector = id ? engine.getState().selectors[id] : undefined;
  return own || (pickedCard(selector)?.lines[0]?.packageId ?? 0);
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
