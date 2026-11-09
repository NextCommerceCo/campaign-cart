import type { Engine } from '../../engine/engine';
import type { AnalyticsTrace } from '../../engine/events/analytics';
import type { EngineEvent, EventMap, EventName } from '../../engine/events/bus';
import type { EventContext } from '../../engine/events/context';
import { newId } from '../../engine/id';
import { legacyRegistry } from '../legacy/registry';

type Send = (name: string, id: string, time: string, context: EventContext, data: object) => void;

const CLOSED: Partial<Record<EventMap['promotion.closed']['reason'], string>> = {
  dismissed: 'dismissed',
  close_button: 'closed',
};

type PopupEvent = EventMap['promotion.clicked'] & Partial<EventMap['promotion.closed']>;

/** 0.4.43's `exit-intent:*` moments: a close or apply-coupon button's action as it is clicked; a custom one is `customAction`. */
const exitIntentName = (e: EngineEvent): string | undefined => {
  const { type, action, coupon_code, reason } = e.data as PopupEvent;
  if (!e.name.startsWith('promotion.') || type !== 'exit_intent') return undefined;
  if (e.name === 'promotion.viewed') return 'shown';
  if (e.name === 'promotion.clicked') {
    if (!action) return 'accepted';
    return action === 'close' || (action === 'apply-coupon' && coupon_code) ? 'action' : undefined;
  }
  return CLOSED[reason!];
};

/**
 * @deprecated 0.4.43's `dl_exit_intent_*` pushes, which have no tracking event. Returns the handler for
 * the popup's `promotion.*` events, for the caller to run in event order.
 */
export function exitIntentPushes(engine: Engine, send: Send): (e: EngineEvent) => void {
  const exitIntent = (trigger: EventName, name: string, data: object) => {
    const event = `dl_exit_intent_${name}`;
    const id = newId();
    send(event, id, new Date().toISOString(), engine.eventContext(), { event_category: 'engagement', ...data });
    const reason = 'Data layer only: there is no analytics event';
    const trace: AnalyticsTrace = { trace: 'analytics', trigger, name: event, sent: true, reason, id };
    engine.log.debug(`analytics ${event} sent: ${reason}`, trace);
  };

  const acted = (action: string, coupon_code = '') =>
    exitIntent('promotion.clicked', 'action', {
      event_action: `exit_intent_${action}`,
      event_label: coupon_code || action,
      exit_intent: { action, coupon_code },
    });
  const registry = legacyRegistry(engine);
  registry.customAction = () => acted('custom');

  return (e) => {
    const name = exitIntentName(e);
    if (!name) return;
    const { id, action, coupon_code } = e.data as PopupEvent;
    if (name === 'action') return acted(action!, coupon_code);
    const { imageUrl = '', template = '' } = registry.popups[id] ?? {};
    exitIntent(e.name, name, {
      event_action: `exit_intent_${name}`,
      event_label: imageUrl || template || 'exit-intent',
      exit_intent: { image_url: imageUrl, template },
    });
  };
}
