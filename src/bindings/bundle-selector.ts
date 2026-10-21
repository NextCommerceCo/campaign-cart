import { cardQuantity, pickedCard } from '../engine/selectors';
import type { SelectorCard, SelectorMode } from '../engine/types';
import { type BindContext, type Render } from './context';
import { isFormControl, parseJson, parseLines, selectorIdOf, setState } from './dom';

function modeOf(el: Element, upsellPage: boolean): SelectorMode {
  if (el.hasAttribute('data-next-upsell-context')) return 'offer';
  const swap = (el.getAttribute('data-next-selection-mode') || 'swap') === 'swap';
  return swap && !upsellPage ? 'swap' : 'select';
}

const STEP = { increase: 1, decrease: -1 } as const;

function bindStepper(b: BindContext, selectorId: string, els: Map<string, Element>): Render {
  const hosts = [...document.querySelectorAll(`[data-next-bundle-qty-for="${selectorId}"]`), ...els.values()];
  const within = <E extends Element>(selector: string) => [
    ...new Set(hosts.flatMap((host) => [...host.querySelectorAll<E>(selector)])),
  ];
  const controls = (['increase', 'decrease'] as const).flatMap((dir) =>
    within<HTMLButtonElement>(`[data-next-quantity-${dir}]`).map((el) => ({ el, dir })),
  );
  const displays = within<HTMLElement>('[data-next-quantity-display]');
  const cardOf = (el: Element) => [...els].find(([, card]) => card.contains(el))?.[0];

  for (const { el, dir } of controls) {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const card = cardOf(el);
      if (card && b.engine.getState().selectors[selectorId]?.picked !== card)
        await b.engine.selectors.pick(selectorId, card);
      const selector = b.engine.getState().selectors[selectorId];
      const picked = pickedCard(selector);
      if (selector && picked)
        await b.engine.selectors.setQuantity(selectorId, cardQuantity(selector, picked) + STEP[dir]);
    });
  }

  return () => {
    const selector = b.engine.getState().selectors[selectorId];
    const picked = pickedCard(selector);
    if (!selector || !picked) return;
    const quantity = cardQuantity(selector, picked);
    for (const el of displays) if (el.textContent !== String(quantity)) el.textContent = String(quantity);
    for (const { el, dir } of controls) {
      const limit = dir === 'increase' ? quantity >= (picked.max ?? 999) : quantity <= (picked.min ?? 1);
      el.disabled = limit;
      el.classList.toggle('next-disabled', limit);
    }
    els.get(picked.id)?.setAttribute('data-next-quantity', String(quantity));
  };
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
        quantity: Number(el.getAttribute('data-next-quantity')) || undefined,
        min: Number(el.getAttribute('data-next-min-quantity')) || undefined,
        max: Number(el.getAttribute('data-next-max-quantity')) || undefined,
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
    renders.push(bindStepper(b, selectorId, els));

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
