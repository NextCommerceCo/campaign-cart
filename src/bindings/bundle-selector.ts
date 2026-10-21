import { type BindContext, type Card, isFormControl, parseJson, parseLines, type Render, selectorIdOf, setState } from './context';

export const bundleGroup = (selectorId: string) => `bundle:${selectorId}`;

const sameLines = (a: Card['lines'], b: Card['lines']) => {
  const key = (l: Card['lines']) => l.map((x) => `${x.packageId}x${x.quantity}`).sort().join(',');
  return key(a) === key(b);
};

export function putInCart(b: BindContext, card: Card): void {
  void b.engine.setGroup(bundleGroup(card.selectorId), { lines: card.lines, vouchers: card.vouchers });
  if (card.shippingId) void b.engine.setShipping(card.shippingId);
}

export function bindBundleSelectors(root: ParentNode, b: BindContext): Render[] {
  const renders: Render[] = [];
  const upsellPage = !!document.querySelector('[data-next-upsell]');

  b.each(root, 'data-next-bundle-selector', (selectorEl) => {
    const selectorId = selectorIdOf(selectorEl);
    const writesCart =
      (selectorEl.getAttribute('data-next-selection-mode') || 'swap') === 'swap' &&
      !selectorEl.hasAttribute('data-next-upsell-context') &&
      !upsellPage;

    const cards: Card[] = [];
    selectorEl.querySelectorAll('[data-next-bundle-card]').forEach((el, i) => {
      const lines = parseLines(el.getAttribute('data-next-bundle-items'));
      if (!lines.length) return b.warn(`bundle card ${i} in "${selectorId}" has no data-next-bundle-items`);
      cards.push({
        selectorId,
        cardId: el.getAttribute('data-next-bundle-id') || String(i),
        lines,
        vouchers: parseJson<string[]>(el.getAttribute('data-next-bundle-vouchers'), []),
        shippingId: Number(el.getAttribute('data-next-shipping-id')) || undefined,
        el,
      });
    });
    if (!cards.length) return;
    b.selectors.set(selectorId, cards);

    const inCart = () => b.engine.getState().cart.groups[bundleGroup(selectorId)];
    const choose = (card: Card) => {
      b.engine.select(selectorId, card.cardId, card.lines);
      const current = inCart();
      if (writesCart && !(current && sameLines(current.lines, card.lines))) putInCart(b, card);
    };

    const state = b.engine.getState();
    const restored = inCart();
    const initial =
      cards.find((c) => c.cardId === state.selections[selectorId]) ??
      (restored && cards.find((c) => sameLines(c.lines, restored.lines))) ??
      cards.find((c) => c.el.getAttribute('data-next-selected') === 'true') ??
      cards[0]!;
    choose(initial);

    for (const card of cards) {
      card.el.addEventListener('click', (e) => {
        if (!isFormControl(e.target)) choose(card);
      });
    }

    renders.push(() => {
      const selected = b.selected(selectorId);
      selectorEl.setAttribute('data-selected-bundle', selected?.cardId ?? '');
      cards.forEach((card) => setState(card.el, card === selected));
    });
  });

  return renders;
}
