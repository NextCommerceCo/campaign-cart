import type { TrackingMap } from '../engine/events/analytics';
import type { EventName } from '../engine/events/bus';
import type { Checkout } from '../engine/events/checkout';
import type { Handlers, Report } from './report';

type OncePerCheckout = { [K in keyof TrackingMap]: TrackingMap[K] extends Checkout ? K : never }[keyof TrackingMap];

export function checkoutReports({ engine, emit, skip, once }: Report) {
  const current = () => engine.cart.currentCheckout();
  const started = () => !!engine.checkout && !!engine.getState().checkout?.id;

  const oncePerCheckout = (trigger: EventName, name: OncePerCheckout, checkout: () => Checkout, reason: string) => {
    if (!started()) return skip(trigger, name, 'The checkout has not started');
    if (name !== 'checkout_started' && !once.sent('checkout', 'checkout_started'))
      return skip(trigger, name, 'checkout_started has not been sent');
    if (!once('checkout', name)) return skip(trigger, name, 'Already sent for this checkout');
    emit(name, checkout(), { trigger, reason });
  };

  const shippingSteps = (trigger: EventName) => {
    const checkout = current();
    if (!checkout.shipping_address) return;
    oncePerCheckout(
      trigger,
      'checkout_shipping_address_submitted',
      () => checkout,
      'Once per checkout, when the shipping address is valid',
    );
    if (checkout.cart.shipping_method)
      oncePerCheckout(
        trigger,
        'checkout_shipping_method_submitted',
        () => checkout,
        'Once per checkout, when the shipping address is valid and the cart is priced with a shipping method',
      );
  };

  const handlers: Handlers = {
    'checkout.started': (checkout, name) => {
      oncePerCheckout(name, 'checkout_started', () => checkout, 'Once per checkout, when its form is ready');
      shippingSteps(name);
    },
    'user.created': (_, name) =>
      emit('checkout_contact_info_submitted', current(), {
        trigger: name,
        reason: 'Once, when the contact details saved an open cart',
      }),
    'address.entered': (address, name) => (address.type === 'shipping' ? shippingSteps(name) : undefined),
    'shipping.settled': (_, name) =>
      current().shipping_address
        ? shippingSteps(name)
        : skip(name, 'checkout_shipping_method_submitted', 'The shipping address is not valid yet'),
    'checkout.submitted': (checkout, name) =>
      oncePerCheckout(
        name,
        'checkout_payment_info_submitted',
        () => checkout,
        'Once per checkout, when a submit passes its checks',
      ),
  };

  const beginOwed = () => {
    if (started() && !once.sent('checkout', 'checkout_started'))
      oncePerCheckout(
        'checkout.started',
        'checkout_started',
        current,
        'Not sent on the page that started this checkout',
      );
    shippingSteps('checkout.started');
  };

  return { handlers, beginOwed };
}
