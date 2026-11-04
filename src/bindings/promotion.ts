import type { Promotion } from '../engine/events';
import type { BindContext, Render } from './context';

const VISIBLE = 0.5;

function promotionOf(el: Element): Promotion {
  const name = el.getAttribute('data-next-promotion-name');
  const creative = el.getAttribute('data-next-promotion-creative');
  return {
    id: el.getAttribute('data-next-promotion')!,
    type: 'banner',
    ...(name && { name }),
    ...(creative && { creative }),
  };
}

export function bindPromotions(root: ParentNode, b: BindContext): Render[] {
  const { events } = b.engine;
  const viewed = (el: Element) => events.emit('promotion.viewed', promotionOf(el));
  let observer: IntersectionObserver | undefined;
  const watch = (el: Element) => {
    if (typeof IntersectionObserver === 'undefined') return viewed(el);
    observer ??= new IntersectionObserver(
      (entries) =>
        entries
          .filter((entry) => entry.intersectionRatio >= VISIBLE)
          .forEach(({ target }) => {
            observer!.unobserve(target);
            viewed(target);
          }),
      { threshold: VISIBLE },
    );
    observer.observe(el);
  };

  b.each(root, 'data-next-promotion', (el) => {
    if (!el.getAttribute('data-next-promotion')) return b.warn('data-next-promotion needs an id');
    el.addEventListener('click', () => events.emit('promotion.clicked', promotionOf(el)));
    watch(el);
  });
  return [];
}
