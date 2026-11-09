import type { Engine } from '../engine/engine';
import type { Accepted, Offer, OrderActions } from './state';
import { nextUrl } from '../engine/visit/params';
import { metaContent, onceVisible, selectorIdOf } from '../dom/dom';

/** `data-next-upsell-action` words that accept (`accept` is 0.4.x's `add`); any other skips. */
export const ACCEPT_WORDS = ['add', 'accept'];

/** Where an upsell button goes next, over the page's accept or decline meta; the last two are 0.4.x's. */
export const NEXT_URL_ATTRS = ['data-next-url', 'data-next-next-url', 'data-os-next-url'];

const FEEDBACK_MS = 1000;
const SUCCESS_MS = 100;

function targetUrl(button: Element, accept: boolean, engine: Engine): string | undefined {
  const own = NEXT_URL_ATTRS.map((a) => button.getAttribute(a)).find(Boolean);
  const target = own ?? metaContent(accept ? 'next-upsell-accept-url' : 'next-upsell-decline-url');
  if (!target) return undefined;
  const { order, visit } = engine.getState();
  return nextUrl(target, new URL(location.href), visit.params, order?.refId);
}

function offerOf(offer: Element, offerSelector?: (offer: Element) => string | undefined): Offer {
  const selectorEl = offer.querySelector('[data-next-bundle-selector]');
  const selectorId = selectorEl ? selectorIdOf(selectorEl) : offerSelector?.(offer);
  const packageId = Number(offer.getAttribute('data-next-package-id'));
  const quantity = Number(offer.getAttribute('data-next-quantity')) || 1;
  return { selectorId, lines: packageId ? [{ packageId, quantity }] : undefined };
}

function flash(offer: Element, name: string, ms: number): void {
  offer.classList.add(name);
  setTimeout(() => offer.classList.remove(name), ms);
}

function bindOffer(
  engine: Engine,
  order: OrderActions,
  navigate: (url: string) => void,
  page: string,
  offer: HTMLElement,
  spec: Offer,
): () => void {
  const buttons = [...offer.querySelectorAll<HTMLElement>('[data-next-upsell-action]')];
  const go = (url: string | undefined, delay: number) => url && setTimeout(() => navigate(url), delay);
  let leaving = false;
  let shown = false;
  let onScreen = false;
  let viewed = false;
  const view = () => {
    if (viewed || !shown || !onScreen) return;
    viewed = true;
    order.view(spec, page);
  };
  const show = () => {
    if (shown || !engine.getState().order?.order) return;
    shown = true;
    order.shown(spec, page);
    view();
  };
  const seen = () => {
    onScreen = true;
    view();
  };
  onceVisible(offer, seen);

  for (const button of buttons) {
    const accept = ACCEPT_WORDS.includes(button.getAttribute('data-next-upsell-action') ?? '');
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      if (leaving || offer.classList.contains('next-processing')) return;
      show();
      seen();
      const url = targetUrl(button, accept, engine);
      if (!accept) {
        leaving = true;
        order.skip(spec, page);
        offer.classList.add('next-skipped');
        return go(url, 0);
      }
      offer.classList.add('next-processing');
      const result: Accepted = await order.accept(spec, page);
      if (result === 'busy') return offer.classList.remove('next-processing');
      leaving = true;
      if (result === 'accepted' || result === 'repeat') {
        flash(offer, 'next-success', 3000);
        return go(url, SUCCESS_MS);
      }
      offer.classList.remove('next-processing');
      flash(offer, 'next-error', 5000);
      go(url, FEEDBACK_MS);
    });
  }

  return () => {
    const state = engine.getState().order;
    if (state?.status === 'ready' || state?.status === 'failed') {
      const available = !!state.order?.supports_post_purchase_upsells;
      offer.classList.toggle('next-available', available);
      offer.classList.toggle('next-hidden', !available);
      const quoting = spec.selectorId && engine.selectors.get(spec.selectorId)?.quoting;
      if (available && !quoting) show();
    }
    const busy = state?.status === 'accepting' || leaving;
    for (const button of buttons) button.classList.toggle('next-disabled', busy);
  };
}

export function bindUpsells(
  engine: Engine,
  order: OrderActions,
  navigate: (url: string) => void,
  offerSelector?: (offer: Element) => string | undefined,
): Array<() => void> {
  const page = location.pathname;
  return [...document.querySelectorAll<HTMLElement>('[data-next-upsell]')].map((offer) =>
    bindOffer(engine, order, navigate, page, offer, offerOf(offer, offerSelector)),
  );
}
