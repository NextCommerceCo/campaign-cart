import { nextUrl } from '../engine/params';
import type { BindContext, Render } from './context';

export function bindLinks(root: ParentNode, b: BindContext): Render[] {
  if (root !== document || !b.claim(document.documentElement, 'links')) return [];
  document.addEventListener('click', (e) => {
    const link = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!link || link.hasAttribute('data-next-action')) return;
    const href = link.getAttribute('href') ?? '';
    if (!href || href.startsWith('#') || /^(javascript|mailto|tel|sms|whatsapp):/i.test(href)) return;
    const current = new URL(location.href);
    if (new URL(href, current).origin !== current.origin) return;
    link.href = nextUrl(href, current, b.engine.getState().params);
  });
  return [];
}
