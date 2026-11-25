import type { TrackingMap } from '../engine/events/analytics';
import type { EventName } from '../engine/events/bus';
import type { Checkout } from '../engine/events/checkout';
import { addPending } from './carts';
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

  const BEGIN = 'Once per checkout, when its form is ready, the cart is priced and its add is reported';
  let owed = false;
  const begin = (trigger: EventName, reason: string, unpriced = false) => {
    const checkout = current();
    const wait =
      checkout.cart.total === undefined
        ? 'The cart is not priced yet'
        : addPending(engine)
          ? 'product_added_to_cart has not been sent for the cart yet'
          : undefined;
    owed = !!wait && started() && !unpriced && !once.sent('checkout', 'checkout_started');
    if (owed && wait) return skip(trigger, 'checkout_started', wait);
    oncePerCheckout(trigger, 'checkout_started', () => checkout, reason);
    shippingSteps(trigger);
  };

  const handlers: Handlers = {
    'checkout.started': (_, name) => begin(name, BEGIN),
    'cart.calculated': (_, name) => (owed ? begin(name, BEGIN) : undefined),
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
    'checkout.submitted': (checkout, name) => {
      if (owed) begin(name, 'The cart was never priced before the submit', true);
      oncePerCheckout(
        name,
        'checkout_payment_info_submitted',
        () => checkout,
        'Once per checkout, when a submit passes its checks',
      );
    },
  };

  const beginOwed = () => {
    if (started() && !once.sent('checkout', 'checkout_started'))
      return begin('checkout.started', 'Not sent on the page that started this checkout');
    shippingSteps('checkout.started');
  };

  return { handlers, beginOwed };
}
