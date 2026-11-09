import { localeOf } from '../engine/format';
import { cardQuantity, pickedCard } from '../engine/cart/selectors';
import type { SelectorCard, SelectorLine, SelectorMode } from '../engine/cart/types';
import { discountsOfKind, discountTokens } from '../engine/tokens';
import { cardQuote, repricing } from '../engine/values';
import { bundleCardId, markedSelected, setState } from './cards';
import { type BindContext, type Render } from './context';
import { cardFromElement, registerSelector, selectorIdOf, withAttribute } from './dom';
import { stamp } from './tokens';

function parseList(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const parseCodes = (raw: string | null): string[] =>
  parseList(raw).filter((code): code is string => typeof code === 'string');

function parseLines(raw: string | null): SelectorLine[] {
  return parseList(raw)
    .filter((i): i is Record<string, unknown> => typeof i === 'object' && i !== null)
    .map((i) => ({
      packageId: Number(i.packageId),
      quantity: Number(i.quantity ?? 1),
      ...(i.configurable === true && { configurable: true }),
    }))
    .filter((l) => l.packageId > 0 && l.quantity > 0);
}

function modeOf(el: Element, upsellPage: boolean): SelectorMode {
  if (el.hasAttribute('data-next-upsell-context')) return 'offer';
  const swap = (el.getAttribute('data-next-selection-mode') || 'swap') === 'swap';
  return swap && !upsellPage ? 'swap' : 'select';
}

const STEP = { increase: 1, decrease: -1 } as const;

function bindStepper(b: BindContext, selectorId: string, els: Map<string, Element>): Render {
  const hosts = [...withAttribute(document, 'data-next-bundle-qty-for', selectorId), ...els.values()];
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
      if (card && b.engine.selectors.get(selectorId)?.picked !== card) await b.engine.selectors.pick(selectorId, card);
      const selector = b.engine.selectors.get(selectorId);
      const picked = pickedCard(selector);
      if (selector && picked)
        await b.engine.selectors.setQuantity(selectorId, cardQuantity(selector, picked) + STEP[dir]);
    });
  }

  return () => {
    const selector = b.engine.selectors.get(selectorId);
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
      const id = bundleCardId(el, i);
      cards.push(cardFromElement(el, id, lines, parseCodes(el.getAttribute('data-next-bundle-vouchers'))));
      els.set(id, el);
      b.cards.set(el, { selectorId, cardId: id });
    });
    if (!cards.length) return;

    registerSelector(b.engine, selectorEl, selectorId, cards, els, modeOf(selectorEl, upsellPage), markedSelected);
    renders.push(bindStepper(b, selectorId, els));

    renders.push(() => {
      const selector = b.engine.selectors.get(selectorId);
      selectorEl.setAttribute('data-selected-bundle', selector?.picked ?? '');
      els.forEach((el, id) => {
        setState(el, id === selector?.picked);
        el.classList.toggle('next-loading', !!selector?.quoting);
        const card = selector?.cards.find((c) => c.id === id);
        const quote = selector && card && cardQuote(selector, card);
        if (selector && card && repricing(selector, card)) return;
        for (const box of el.querySelectorAll('[data-next-discounts]')) {
          const list = discountsOfKind(quote, box.getAttribute('data-next-discounts'));
          stamp(box, list, (d) => discountTokens(d, quote?.currency, localeOf(b.engine.getState())));
        }
      });
    });
  });

  return renders;
}
