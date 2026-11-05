import type { EventName } from './bus';
import type { EventContext } from './context';

export type AnalyticsName =
  | 'page_view'
  | 'view_item'
  | 'view_item_list'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'update_cart'
  | 'begin_checkout'
  | 'add_shipping_info'
  | 'add_payment_info'
  | 'purchase'
  | 'upsell_purchase'
  | 'view_upsell'
  | 'skip_upsell'
  | 'generate_lead'
  | 'view_promotion'
  | 'select_promotion';

export interface AnalyticsEvent {
  name: AnalyticsName;
  id: string;
  time: string;
  params: Record<string, unknown>;
  context: EventContext;
}

export interface AnalyticsTrace {
  trace: 'analytics';
  trigger: EventName;
  name: string;
  sent: boolean;
  reason: string;
  id?: string;
}

export interface AnalyticsEvents {
  /** @internal One tracking event under its GA4 name, for `next.analytics.on`. */
  analytics: AnalyticsEvent;
}
