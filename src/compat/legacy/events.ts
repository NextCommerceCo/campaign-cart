import { operations } from '../../engine/cart/cart';
import { cardQuantity, pickedCard } from '../../engine/cart/selectors';
import type { EngineEvent, EventMap } from '../../engine/events/bus';
import type { CartChange } from '../../engine/events/carts';
import type { Selector } from '../../engine/events/selectors';
import { localeOf } from '../../engine/format';
import { fill, loadedTexts, textsIn } from '../../engine/texts';
import type { State } from '../../engine/types';
import { readLegacyI18n } from './globals';
import { legacyCart, shippingOption } from './payloads';
import { firstPackage, type From, lastClick, legacyEvent, type LegacyEvent, type LegacyState } from './registry';

const alias = legacyEvent;

/** 0.4.43 sent one item event per cart action; none for a swap-mode selector's pick, emptying or replacing the cart. */
const itemEvent = (map: (c: CartChange, op?: string, source?: string) => object | false) =>
  alias<'cart.added' | 'cart.removed'>({
    from: ['cart.added', 'cart.removed'],
    each: true,
    data: ({ data }, { selectors }) => {
      const { action, group = '' } = operations.get(data.changes) ?? {};
      const bundle = group.startsWith('bundle:') ? selectors[group.slice(7)] : undefined;
      if (action === 'clear' || action === 'setGroups' || bundle?.mode === 'swap') return [];
      const source = action === 'addItem' ? 'direct' : bundle ? 'selector' : undefined;
      return data.changes.flatMap((c) => map(c, action, source) || []);
    },
  });

type Picked = From<'selector.bound' | 'selector.selected' | 'selector.updated' | 'selector.deselected'>;
const SELECTIONS = ['selector.bound', 'selector.selected', 'selector.updated'] as const;
/** A bundle or offer selector's event; `offer` limits it to one of the two. */
const selector = (from: Picked['name'][], data: (s: Selector, state: LegacyState) => unknown, offer?: boolean) =>
  alias<Picked['name']>({
    from,
    when: ({ data: s }) => s.type !== 'toggle' && (offer === undefined || (s.type === 'offer') === offer),
    data: (e, state) => data(e.data, state),
  });
const items = (s: Selector) => ({
  selectorId: s.selector_id,
  items: s.lines.map((l) => ({ packageId: l.package_id, quantity: l.quantity })),
});
const onePackage = ({ selector_id, lines: [line, ...more] }: Selector) => ({
  selectorId: selector_id,
  ...(line && !more.length && { packageId: line.package_id, quantity: line.quantity }),
});
const selectorQuantity = ({ selector_id }: Selector, { selectors }: State) => {
  const state = selectors[selector_id];
  const card = pickedCard(state);
  return state && card ? cardQuantity(state, card) : 1;
};

const offerPick = selector(
  ['selector.selected'],
  (s) => ({ selectorId: s.selector_id, packageId: firstPackage(s) }),
  true,
);

const toggleCards = () =>
  [...document.querySelectorAll('[data-next-toggle-card][data-next-package-id]')].map((el) =>
    Number(el.getAttribute('data-next-package-id')),
  );

const shipping = alias({
  from: ['shipping.settled'],
  when: (e, state) => !!shippingOption(state, e.data.id),
  data: (e, state) => ({ methodId: e.data.id, method: shippingOption(state, e.data.id) }),
});

const COUPON_TEXTS: Record<EventMap['coupon.denied']['reason'], [key: string, english: string]> = {
  no_discount: ['coupon.errors.invalid', "Coupon {{code}} isn't valid for this order."],
  duplicate: ['coupon.errors.already_applied', 'Coupon {{code}} is already applied.'],
  check_failed: ['coupon.errors.network', "Couldn't check the coupon. Try again."],
};

/** The page's `translations`, then i18n-rules' texts if the page loaded them, then English. */
function couponText(reason: EventMap['coupon.denied']['reason'], code: string, state: State): string {
  const [key, english] = COUPON_TEXTS[reason];
  const lang = localeOf(state) || 'en';
  return fill(textsIn(readLegacyI18n().translations, lang)[key] ?? loadedTexts(lang)?.[key] ?? english, { code });
}

/** Each click's first `cart.added`: 0.4.43 sent one `action:success` per button, whatever its change set off. */
const firstAdded = new WeakMap<Event, EngineEvent>();

const requestedCurrency = () => new URLSearchParams(location.search).get('currency')?.toUpperCase();

/** @deprecated 0.4.x `next.on` names, each made from the events at the moment 0.4.43 sent it, with its payload. */
export const LEGACY_EVENTS: Record<string, LegacyEvent> = {
  'campaign:loaded': alias({ from: ['campaign.loaded'], once: true, replay: true, data: (e) => e.data.campaign }),
  'currency:fallback': alias({
    from: ['campaign.loaded'],
    once: true,
    replay: true,
    when: ({ data }) => !!requestedCurrency() && requestedCurrency() !== data.campaign.currency.toUpperCase(),
    data: ({ data }) => ({
      requested: requestedCurrency(),
      actual: data.campaign.currency,
      reason: data.fromCache ? 'cached' : 'api',
    }),
  }),
  'sdk:url-parameters-processed': alias({ from: ['sdk.ready'], replay: true, data: () => ({}) }),
  'error:occurred': alias({
    from: ['sdk.error'],
    replay: true,
    data: ({ data }) => ({ message: data.message, code: data.code, details: data }),
  }),
  'action:success': alias<'cart.added' | 'coupon.applied' | 'coupon.denied'>({
    from: ['cart.added', 'coupon.applied', 'coupon.denied'],
    each: true,
    data: (e) => {
      const added = e.name === 'cart.added';
      const click = lastClick();
      if (added && click?.eventPhase) firstAdded.set(click, firstAdded.get(click) ?? e);
      const element = added
        ? firstAdded.get(click!) === e && (click!.target as Element).closest?.('[data-next-action="add-to-cart"]')
        : document.querySelector('[data-next-coupon] .next-loading')?.closest('[data-next-coupon]');
      return element ? [{ action: added ? 'AddToCartEnhancer' : 'CouponEnhancer', data: { element } }] : [];
    },
  }),
  'cart:updated': alias({
    from: ['cart.calculated', 'cart.updated'],
    when: (e) => e.name === 'cart.calculated' || !e.data.lines.length,
    data: (_, state) => legacyCart(state),
  }),
  'cart:item-added': itemEvent(
    (c, op, source) =>
      op !== 'setQuantity' &&
      c.to > c.from && { packageId: c.package_id, quantity: c.quantity, ...(source && { source }) },
  ),
  'cart:item-removed': itemEvent((c) => c.to === 0 && { packageId: c.package_id }),
  'cart:quantity-changed': itemEvent(
    (c, op) => op === 'setQuantity' && { packageId: c.package_id, quantity: c.to, oldQuantity: c.from },
  ),
  'coupon:applied': alias({ from: ['coupon.applied'], data: (e) => ({ code: e.data.code }) }),
  'coupon:removed': alias({
    from: ['coupon.removed'],
    when: (e) => e.data.reason === 'shopper',
    data: (e) => ({ code: e.data.code }),
  }),
  'coupon:validation-failed': alias({
    from: ['coupon.denied'],
    data: ({ data }, state) => ({ code: data.code, message: couponText(data.reason, data.code, state) }),
  }),
  'bundle:selection-changed': selector([...SELECTIONS], items),
  'bundle:selected': selector(['selector.selected'], items),
  'bundle:quantity-changed': selector(['selector.updated'], (s, state) => ({
    ...items(s),
    bundleId: s.option_id,
    quantity: selectorQuantity(s, state),
  })),
  'selector:selection-changed': selector([...SELECTIONS], onePackage),
  'selector:item-selected': selector(['selector.selected'], (s, state) => {
    const mode = state.selectors[s.selector_id]?.mode === 'swap' ? 'swap' : 'select';
    return {
      selectorId: s.selector_id,
      packageId: firstPackage(s),
      previousPackageId: state.previousPick(s.selector_id),
      mode,
      pendingAction: mode === 'select' || undefined,
    };
  }),
  'selector:quantity-changed': selector(['selector.updated'], onePackage),
  'upsell-selector:item-selected': offerPick,
  'upsell:option-selected': offerPick,
  'upsell:quantity-changed': selector(
    ['selector.updated'],
    (s, state) => ({ selectorId: s.selector_id, quantity: selectorQuantity(s, state), packageId: firstPackage(s) }),
    true,
  ),
  'toggle:toggled': alias({
    from: ['selector.selected', 'selector.deselected'],
    when: (e) => e.data.type === 'toggle',
    data: (e) => ({ packageId: e.data.lines[0]?.package_id, added: e.name === 'selector.selected' }),
  }),
  'toggle:selection-changed': alias({
    from: ['cart.updated'],
    when: () => toggleCards().length > 0,
    data: ({ data }) => ({
      selected: [...new Set(toggleCards())].filter((id) => data.lines.some((l) => l.package_id === id)),
    }),
  }),
  'shipping:method-changed': shipping,
  'shipping:method-selected': alias({ from: ['shipping.settled'], data: (e) => ({ shippingId: String(e.data.id) }) }),
};

/** 0.4.x names of checkout, order and exit popup events: those chunks add them with {@link addLegacyEvents} when they load. */
export const LATER = [
  'action:failed',
  'exit-intent:shown',
  'exit-intent:clicked',
  'exit-intent:dismissed',
  'exit-intent:closed',
  'payment:tokenized',
  'payment:error',
  'checkout:express-completed',
  'express-checkout:completed',
  'checkout:express-failed',
  'express-checkout:failed',
  'express-checkout:started',
  'express-checkout:error',
  'order:completed',
  'upsell:viewed',
  'upsell:added',
  'upsell:skipped',
  'upsell:error',
];
