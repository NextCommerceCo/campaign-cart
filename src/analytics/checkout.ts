import type { AnalyticsMap, AnalyticsName } from '../engine/events/analytics';
import type { EventMap, EventName } from '../engine/events/bus';
import { cartEcommerce } from './ecommerce';
import type { Handlers, Report } from './report';

export function checkoutReports({ engine, emit, skip }: Report) {
  const tier = () => engine.getState().cart.summary?.shipping_method?.name ?? 'Standard';

  const oncePerCheckout = <K extends AnalyticsName>(
    trigger: EventName,
    name: K,
    params: () => AnalyticsMap[K],
    reason: string,
  ) => {
    const checkout = engine.checkout;
    if (!checkout || !engine.getState().checkout?.id) return skip(trigger, name, 'The checkout has not started');
    if (checkout.reported(name)) return skip(trigger, name, 'Already sent for this checkout');
    emit(name, params(), { trigger, reason });
    checkout.markReported(name);
  };

  const shippingInfo = (trigger: EventName, method?: EventMap['shipping.settled']) =>
    oncePerCheckout(
      trigger,
      'add_shipping_info',
      () => ({
        ...cartEcommerce(engine),
        ...(method?.price !== undefined && { shipping: method.price }),
        shipping_tier: method?.name ?? tier(),
      }),
      'Once per checkout, when the shipping address is valid or a shipping method is picked',
    );

  const handlers: Handlers = {
    'checkout.started': (_, name) =>
      oncePerCheckout(name, 'begin_checkout', () => cartEcommerce(engine), 'Once per checkout, when its form is ready'),
    'user.created': (_, name) => {
      const { currency, value } = cartEcommerce(engine);
      emit(
        'generate_lead',
        { currency, value, lead_source: 'checkout' },
        { trigger: name, reason: 'Once, when the contact details saved an open cart' },
      );
    },
    'address.entered': (address, name) => (address.type === 'shipping' ? shippingInfo(name) : undefined),
    'shipping.settled': (method, name) => shippingInfo(name, method),
    'checkout.submitted': ({ payment_method }, name) =>
      oncePerCheckout(
        name,
        'add_payment_info',
        () => ({
          ...cartEcommerce(engine),
          payment_type: payment_method === 'card_token' ? 'Credit Card' : payment_method,
        }),
        'Once per checkout, when a submit passes its checks',
      ),
  };

  const beginOwed = () => {
    if (engine.getState().checkout?.id && engine.checkout && !engine.checkout.reported('begin_checkout'))
      oncePerCheckout(
        'checkout.started',
        'begin_checkout',
        () => cartEcommerce(engine),
        'Not sent on the page that started this checkout',
      );
  };

  return { handlers, beginOwed };
}
