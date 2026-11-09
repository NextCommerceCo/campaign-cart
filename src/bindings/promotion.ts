import type { Promotion } from '../engine/events/promotions';
import type { BindContext, Render } from './context';
import { onceVisible } from './dom';

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
  b.each(root, 'data-next-promotion', (el) => {
    if (!el.getAttribute('data-next-promotion')) return b.warn('data-next-promotion needs an id');
    el.addEventListener('click', () => events.emit('promotion.clicked', promotionOf(el)));
    b.offs.push(onceVisible(el, () => events.emit('promotion.viewed', promotionOf(el))));
  });
  return [];
}
