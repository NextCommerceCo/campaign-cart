import { type BindContext, type Card, parseJson, parseLines, type Render, selectorIdOf } from './context';

export const groupId = (selectorId: string) => `bundle:${selectorId}`;

function sameLines(a: Card['lines'], b: Card['lines']): boolean {
  const key = (l: Card['lines']) => l.map((x) => `${x.packageId}x${x.quantity}`).sort().join(',');
  return key(a) === key(b);
}

export function bindBundleSelectors(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];

  root.querySelectorAll('[data-next-bundle-selector]').forEach((selectorEl) => {
    const selectorId = selectorIdOf(selectorEl);
    const writesCart =
      (selectorEl.getAttribute('data-next-selection-mode') || 'swap') === 'swap' &&
      !selectorEl.hasAttribute('data-next-upsell-context') &&
      !selectorEl.closest('[data-next-upsell]');

    const cards: Card[] = [];
    selectorEl.querySelectorAll('[data-next-bundle-card]').forEach((el, i) => {
      const lines = parseLines(el.getAttribute('data-next-bundle-items'));
      if (!lines.length) return b.warn(`bundle card ${i} in "${selectorId}" has no data-next-bundle-items`);
      const shipping = Number(el.getAttribute('data-next-shipping-id'));
      cards.push({
        cardId: el.getAttribute('data-next-bundle-id') || String(i),
        lines,
        vouchers: parseJson<string[]>(el.getAttribute('data-next-bundle-vouchers'), []),
        shippingId: shipping || undefined,
        el,
      });
    });
    if (!cards.length) return;
    b.selectors.set(selectorId, cards);

    const choose = (card: Card) => {
      b.engine.select(selectorId, card.cardId);
      if (!writesCart) return;
      void b.engine.setGroup(groupId(selectorId), { lines: card.lines, vouchers: card.vouchers });
      if (card.shippingId) void b.engine.setShipping(card.shippingId);
    };

    const state = b.engine.getState();
    const inCart = state.cart.groups[groupId(selectorId)];
    const initial =
      cards.find((c) => c.cardId === state.selections[selectorId]) ??
      (inCart && cards.find((c) => sameLines(c.lines, inCart.lines))) ??
      cards.find((c) => c.el.getAttribute('data-next-selected') === 'true') ??
      cards[0]!;
    if (inCart && sameLines(initial.lines, inCart.lines)) b.engine.select(selectorId, initial.cardId);
    else choose(initial);

    for (const card of cards) {
      card.el.addEventListener('click', (e) => {
        if ((e.target as Element).closest('a, input, select, textarea')) return;
        choose(card);
      });
    }

    renders.push(() => {
      const selected = b.engine.getState().selections[selectorId];
      selectorEl.setAttribute('data-selected-bundle', selected ?? '');
      for (const card of cards) {
        const on = card.cardId === selected;
        card.el.classList.toggle('next-selected', on);
        card.el.setAttribute('data-next-selected', String(on));
        card.el.setAttribute('aria-pressed', String(on));
      }
    });
  });

  return renders;
}
