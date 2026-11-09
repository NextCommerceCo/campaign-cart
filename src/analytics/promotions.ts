import type { Handlers, Report } from './report';

export function promotionReports({ emit }: Report): Handlers {
  return {
    'promotion.viewed': (promotion, name) =>
      emit('promotion_viewed', promotion, { trigger: name, reason: 'Every time a promotion is shown' }),
    'promotion.clicked': (promotion, name) =>
      emit('promotion_selected', promotion, { trigger: name, reason: 'Every time a promotion is clicked' }),
  };
}
