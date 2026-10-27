import type { Engine } from '../engine/engine';
import type { Accepted, OrderActions } from './state';
import { nextUrl } from '../engine/params';
import { selectorIdOf } from '../bindings/dom';
import { ACCEPT_WORDS, legacyOfferSelector, NEXT_URL_ATTRS } from '../compat/order';

const FEEDBACK_MS = 1000;
const SUCCESS_MS = 100;

const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content;

function targetUrl(button: Element, accept: boolean, engine: Engine): string | undefined {
  const own = NEXT_URL_ATTRS.map((a) => button.getAttribute(a)).find(Boolean);
  const target = own ?? meta(accept ? 'next-upsell-accept-url' : 'next-upsell-decline-url');
  if (!target) return undefined;
  const url = new URL(target, location.href);
  const refId = engine.getState().order?.refId;
  if (refId && !url.searchParams.has('ref_id')) url.searchParams.set('ref_id', refId);
  return nextUrl(url.href, new URL(location.href), engine.getState().visit.params);
}

export function bindUpsells(engine: Engine, order: OrderActions, navigate: (url: string) => void): Array<() => void> {
  const page = location.pathname;
  return [...document.querySelectorAll<HTMLElement>('[data-next-upsell]')].map((offer) => {
    const selectorEl = offer.querySelector('[data-next-bundle-selector]');
    const selectorId = selectorEl ? selectorIdOf(selectorEl) : legacyOfferSelector(offer);
    const packageId = Number(offer.getAttribute('data-next-package-id'));
    const quantity = Number(offer.getAttribute('data-next-quantity')) || 1;
    const buttons = [...offer.querySelectorAll<HTMLElement>('[data-next-upsell-action]')];
    const flash = (name: string, ms: number) => {
      offer.classList.add(name);
      setTimeout(() => offer.classList.remove(name), ms);
    };
    const go = (url: string | undefined, delay: number) => url && setTimeout(() => navigate(url), delay);
    let leaving = false;

    for (const button of buttons) {
      const accept = ACCEPT_WORDS.includes(button.getAttribute('data-next-upsell-action') ?? '');
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        if (leaving || offer.classList.contains('next-processing')) return;
        const url = targetUrl(button, accept, engine);
        if (!accept) {
          leaving = true;
          order.skip({ selectorId, lines: packageId ? [{ packageId, quantity }] : undefined });
          offer.classList.add('next-skipped');
          return go(url, 0);
        }
        offer.classList.add('next-processing');
        const lines = packageId ? [{ packageId, quantity }] : undefined;
        const result: Accepted = await order.accept({ selectorId, lines }, page);
        if (result === 'busy') return offer.classList.remove('next-processing');
        leaving = true;
        if (result === 'accepted' || result === 'repeat') {
          flash('next-success', 3000);
          return go(url, SUCCESS_MS);
        }
        offer.classList.remove('next-processing');
        flash('next-error', 5000);
        go(url, FEEDBACK_MS);
      });
    }

    return () => {
      const state = engine.getState().order;
      if (state?.status === 'ready' || state?.status === 'failed') {
        const available = !!state.order?.supports_post_purchase_upsells;
        offer.classList.toggle('next-available', available);
        offer.classList.toggle('next-hidden', !available);
        if (available) order.view(page);
      }
      const busy = state?.status === 'accepting' || leaving;
      for (const button of buttons) button.classList.toggle('next-disabled', busy);
    };
  });
}
