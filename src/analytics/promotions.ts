import type { EventMap } from '../engine/events/bus';
import type { Handlers, Report } from './report';

export function promotionReports({ emit }: Report): Handlers {
  const send = (
    { id, name, creative }: EventMap['promotion.viewed'],
    trigger: 'promotion.viewed' | 'promotion.clicked',
  ) =>
    emit(
      trigger === 'promotion.viewed' ? 'view_promotion' : 'select_promotion',
      { promotion_id: id, ...(name && { promotion_name: name }), creative_name: creative },
      { trigger, reason: `Every time a promotion is ${trigger === 'promotion.viewed' ? 'shown' : 'clicked'}` },
    );
  return { 'promotion.viewed': send, 'promotion.clicked': send };
}
