import { nextUrl } from '../engine/visit/params';
import type { BindContext, Render } from '../dom/context';

const WAIT = 3000;

export function bindAddToCart(root: ParentNode, b: BindContext, navigate: (url: string) => void): Render[] {
  b.each(root, 'data-next-action', (el) => {
    if (el.getAttribute('data-next-action') !== 'add-to-cart') return;
    const packageId = () => Number(el.getAttribute('data-next-package-id'));
    const quantity = () => Number(el.getAttribute('data-next-quantity') || 1);
    const clears = () => el.getAttribute('data-next-clear-cart') === 'true';
    if (el.hasAttribute('data-next-url') && packageId())
      b.offs.push(
        b.engine.on('sdk.ready', () => b.engine.cart.quoteItem(packageId(), quantity(), clears()), { replay: true }),
      );
    el.addEventListener('click', (e) => {
      e.preventDefault();
      if (el.getAttribute('aria-busy') === 'true') return;
      const selectorId = el.getAttribute('data-next-selector-id');
      if (selectorId && !b.engine.selectors.get(selectorId)?.picked)
        return b.warn(`add-to-cart: selector "${selectorId}" has no selected card`);
      if (!selectorId && !packageId()) return b.warn('add-to-cart needs data-next-package-id or data-next-selector-id');

      if (clears()) void b.engine.cart.clear();
      const added = selectorId
        ? b.engine.selectors.addToCart(selectorId)
        : b.engine.cart.addItem(packageId(), quantity());

      const url = el.getAttribute('data-next-url');
      if (!url) return;
      el.setAttribute('aria-busy', 'true');
      el.classList.add('next-loading');
      let gone = false;
      const go = () => {
        if (gone) return;
        gone = true;
        navigate(nextUrl(url, new URL(location.href), b.engine.getState().visit.params));
      };
      void added.then(go, go);
      setTimeout(go, WAIT);
    });
  });
  return [];
}
