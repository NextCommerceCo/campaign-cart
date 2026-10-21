import type { Engine } from '../engine/engine';
import type { Accepted, OrderActions } from '../engine/order';
import { nextUrl } from '../engine/params';
import { selectorIdOf } from '../bindings/dom';
import { ACCEPT_WORDS, NEXT_URL_ATTRS } from './legacy';

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
    const selectorId = selectorEl ? selectorIdOf(selectorEl) : undefined;
    const packageId = Number(offer.getAttribute('data-next-package-id'));
    const quantity = Number(offer.getAttribute('data-next-quantity')) || 1;
    const buttons = [...offer.querySelectorAll<HTMLElement>('[data-next-upsell-action]')];
    const flash = (name: string, ms: number) => {
      offer.classList.add(name);
      setTimeout(() => offer.classList.remove(name), ms);
    };
    const go = (url: string | undefined, delay: number) => url && setTimeout(() => navigate(url), delay);

    for (const button of buttons) {
      const accept = ACCEPT_WORDS.includes(button.getAttribute('data-next-upsell-action') ?? '');
      button.addEventListener('click', async (e) => {
        e.preventDefault();
        if (offer.classList.contains('next-processing') || offer.classList.contains('next-skipped')) return;
        const url = targetUrl(button, accept, engine);
        if (!accept) {
          order.skip();
          offer.classList.add('next-skipped');
          return go(url, 0);
        }
        offer.classList.add('next-processing');
        const lines = packageId ? [{ packageId, quantity }] : undefined;
        const result: Accepted = await order.accept({ selectorId, lines }, page);
        offer.classList.remove('next-processing');
        if (result === 'busy') return;
        if (result === 'accepted' || result === 'repeat') {
          flash('next-success', 3000);
          return go(url, SUCCESS_MS);
        }
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
      const busy = state?.status === 'accepting' || offer.classList.contains('next-skipped');
      for (const button of buttons) button.classList.toggle('next-disabled', busy);
    };
  });
}
