import type { SelectorCard, SelectorMode } from '../engine/types';
import { type BindContext, type Render } from './context';
import { isFormControl, parseJson, parseLines, selectorIdOf, setState } from './dom';

function modeOf(el: Element, upsellPage: boolean): SelectorMode {
  if (el.hasAttribute('data-next-upsell-context')) return 'offer';
  const swap = (el.getAttribute('data-next-selection-mode') || 'swap') === 'swap';
  return swap && !upsellPage ? 'swap' : 'select';
}

export function bindBundleSelectors(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];
  const upsellPage = !!document.querySelector('[data-next-upsell]');

  b.each(root, 'data-next-bundle-selector', (selectorEl) => {
    const selectorId = selectorIdOf(selectorEl);
    const cards: SelectorCard[] = [];
    const els = new Map<string, Element>();

    selectorEl.querySelectorAll('[data-next-bundle-card]').forEach((el, i) => {
      const lines = parseLines(el.getAttribute('data-next-bundle-items'));
      if (!lines.length) return b.warn(`bundle card ${i} in "${selectorId}" has no data-next-bundle-items`);
      const id = el.getAttribute('data-next-bundle-id') || String(i);
      cards.push({
        id,
        lines,
        vouchers: parseJson<string[]>(el.getAttribute('data-next-bundle-vouchers'), []),
        shippingId: Number(el.getAttribute('data-next-shipping-id')) || undefined,
      });
      els.set(id, el);
      b.cards.set(el, { selectorId, cardId: id });
      el.addEventListener('click', (e) => {
        if (!isFormControl(e.target)) void b.engine.selectors.pick(selectorId, id);
      });
    });
    if (!cards.length) return;

    const preferred = [...els].find(([, el]) => el.getAttribute('data-next-selected') === 'true')?.[0];
    void b.engine.selectors.register(selectorId, cards, modeOf(selectorEl, upsellPage), preferred);

    renders.push(() => {
      const selector = b.engine.getState().selectors[selectorId];
      selectorEl.setAttribute('data-selected-bundle', selector?.picked ?? '');
      els.forEach((el, id) => {
        setState(el, id === selector?.picked);
        el.classList.toggle('next-loading', !!selector?.quoting);
      });
    });
  });

  return renders;
}
