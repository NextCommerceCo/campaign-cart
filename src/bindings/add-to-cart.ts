import { groupId } from './bundle-selector';
import type { BindContext, Render } from './context';

const DROP_PARAMS = ['reset', 'forcePackageId', 'debug'];

export function nextUrl(target: string, current: URL): string {
  const url = new URL(target, current);
  current.searchParams.forEach((value, key) => {
    if (!DROP_PARAMS.includes(key) && !url.searchParams.has(key)) url.searchParams.set(key, value);
  });
  return url.toString();
}

export function bindAddToCart(root: ParentNode, b: BindContext, navigate: (url: string) => void): Render[] {
  root.querySelectorAll('[data-next-action="add-to-cart"]').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.preventDefault();
      if (el.getAttribute('aria-busy') === 'true') return;
      el.setAttribute('aria-busy', 'true');
      try {
        if (el.getAttribute('data-next-clear-cart') === 'true') await b.engine.clear();
        const selectorId = el.getAttribute('data-next-selector-id');
        const packageId = Number(el.getAttribute('data-next-package-id'));
        if (selectorId) {
          const cards = b.selectors.get(selectorId);
          const pick = cards?.find((c) => c.cardId === b.engine.getState().selections[selectorId]);
          if (!pick) return b.warn(`add-to-cart: selector "${selectorId}" has no selected card`);
          await b.engine.setGroup(groupId(selectorId), { lines: pick.lines, vouchers: pick.vouchers });
        } else if (packageId) {
          await b.engine.addItem(packageId, Number(el.getAttribute('data-next-quantity') || 1));
        } else {
          return b.warn('add-to-cart needs data-next-package-id or data-next-selector-id');
        }
        const url = el.getAttribute('data-next-url');
        if (url) navigate(nextUrl(url, new URL(location.href)));
      } finally {
        el.removeAttribute('aria-busy');
      }
    });
  });
  return [];
}
