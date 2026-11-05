import type { TrackingMap } from '../engine/events/analytics';
import type { EventName } from '../engine/events/bus';
import type { Checkout } from '../engine/events/checkout';
import type { Handlers, Report } from './report';

type OncePerCheckout = { [K in keyof TrackingMap]: TrackingMap[K] extends Checkout ? K : never }[keyof TrackingMap];

export function checkoutReports({ engine, emit, skip }: Report) {
  const current = () => engine.cart.currentCheckout();

  const oncePerCheckout = (trigger: EventName, name: OncePerCheckout, checkout: () => Checkout, reason: string) => {
    const actions = engine.checkout;
    if (!actions || !engine.getState().checkout?.id) return skip(trigger, name, 'The checkout has not started');
    if (actions.reported(name)) return skip(trigger, name, 'Already sent for this checkout');
    emit(name, checkout(), { trigger, reason });
    actions.markReported(name);
  };

  const handlers: Handlers = {
    'checkout.started': (checkout, name) =>
      oncePerCheckout(name, 'checkout_started', () => checkout, 'Once per checkout, when its form is ready'),
    'user.created': (_, name) =>
      emit('checkout_contact_info_submitted', current(), {
        trigger: name,
        reason: 'Once, when the contact details saved an open cart',
      }),
    'address.entered': (address, name) =>
      address.type === 'shipping'
        ? oncePerCheckout(
            name,
            'checkout_shipping_address_submitted',
            current,
            'Once per checkout, when the shipping address is valid',
          )
        : undefined,
    'shipping.settled': (_, name) =>
      oncePerCheckout(
        name,
        'checkout_shipping_method_submitted',
        current,
        'Once per checkout, when a shipping method is picked and the cart is priced with it',
      ),
    'checkout.submitted': (checkout, name) =>
      oncePerCheckout(
        name,
        'checkout_payment_info_submitted',
        () => checkout,
        'Once per checkout, when a submit passes its checks',
      ),
  };

  const beginOwed = () => {
    if (engine.getState().checkout?.id && engine.checkout && !engine.checkout.reported('checkout_started'))
      oncePerCheckout(
        'checkout.started',
        'checkout_started',
        current,
        'Not sent on the page that started this checkout',
      );
  };

  return { handlers, beginOwed };
}
