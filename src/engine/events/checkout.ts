import type { CheckoutError } from '../types';
import type { Cart } from './carts';
import type { Payment } from './payments';
import type { Failure } from './sdk';

export type AddressType = 'shipping' | 'billing';

/** The shopper, as the store's `user` on the Open Cart and the order. */
export interface User {
  /** As typed, trimmed; none when `data-trigger-on` created the user without one. */
  email?: string;
  first_name: string;
  last_name: string;
  /** In E.164 once the address service read it, else the digits typed. */
  phone?: string;
  /** The marketing checkbox, as sent with the Open Cart and the order. */
  accepts_marketing: boolean;
  /** The language the store keeps for the shopper, such as `en`. */
  language: string;
  /** The shopper's IP address, as the store recorded it with the Open Cart. */
  ip?: string;
  /** As the store recorded it with the Open Cart, else the browser's. */
  user_agent: string;
}

/** A postal address as the shopper entered it, once every field its country requires is valid. */
export interface Address {
  first_name: string;
  last_name: string;
  line1: string;
  line2?: string;
  /** None in a country whose addresses have no city, such as Singapore. */
  city?: string;
  /** The state or province code, in a country that has them. */
  state?: string;
  postcode?: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
  /** In E.164 once the address service read it, else the digits typed. */
  phone?: string;
}

/** The cart and what the shopper has entered so far, the same on every checkout event. */
export interface Checkout {
  /** One checkout in this tab, the same across its steps, reloads and a return from a payment gateway; a new one after an order is paid. Empty until `checkout.started`. */
  id: string;
  /** The step of a multi-step checkout (`data-next-checkout-step`), from 1; none on a one-page checkout. */
  step?: number;
  /** The same cart `cart.*` events carry. */
  cart: Cart;
  /** The shopper, from `user.created` on. */
  user?: User;
  /** From `address.entered` for the shipping address on. */
  shipping_address?: Address;
  /** On a checkout page: `false` once the shopper asks for a separate billing address. */
  billing_same_as_shipping?: boolean;
  /** When `billing_same_as_shipping` is `false`, from `address.entered` for it on. */
  billing_address?: Address;
  /** The API's code for the chosen payment method, on a checkout page: `card_token`, `paypal`, `apple_pay`, … */
  payment_method?: string;
}

export interface CheckoutEvents {
  /**
   * Once per checkout, when its form is bound and the cart has lines, or when the cart first gets
   * lines after that; the steps of a multi-step checkout, a reload and a return from a payment
   * gateway keep the same checkout.
   * @group Checkout
   */
  'checkout.started': Checkout;
  /**
   * Once per checkout, after `checkout.started`, when the store saves the shopper with a new Open
   * Cart: what `data-next-lead` asks for is in (by default a first and last name and a valid
   * email), checked when the shopper leaves a field they changed. The store keeps the user for
   * marketing, as `accepts_marketing` allows, and the cart for `cart.abandoned`.
   * @group Checkout
   */
  'user.created': User;
  /**
   * The shopper's details changed after `user.created` and are still valid. The Open Cart keeps
   * the first ones.
   * @group Checkout
   */
  'user.updated': User;
  /**
   * Once per `type` per checkout, when that address is valid: every field its country requires is
   * filled and valid, and so is each optional one filled. Checked when the shopper leaves a field
   * they changed, once the checkout has started.
   * @group Checkout
   */
  'address.entered': Address & {
    /** Which address: `billing` only when it is separate from the shipping one. */
    type: AddressType;
  };
  /**
   * The address changed after `address.entered` and is still valid.
   * @group Checkout
   */
  'address.updated': Address & { type: AddressType };
  /**
   * The shopper picked an address suggestion under line 1, and it filled these fields. After
   * `checkout.started`; `address.entered` or `address.updated` follows once the address is valid.
   * @group Checkout
   */
  'address.autofilled': Partial<Address> & { type: AddressType };
  /**
   * The shopper changed the payment method, after `checkout.started`. The method the form starts
   * with is the Checkout's `payment_method`.
   * @group Checkout
   */
  'payment.selected': Payment;
  /**
   * A step of a multi-step checkout passed its checks; the next step's page opens.
   * @group Checkout
   */
  'checkout.continued': Checkout;
  /**
   * A submit passed its checks (the fields, then the card tokenized) and the order is being sent.
   * Followed by `order.created`, `payment.failed` or `checkout.failed`.
   * @group Checkout
   */
  'checkout.submitted': Checkout;
  /**
   * A submit, or a step of a multi-step checkout, did not pass its checks; nothing is sent.
   * @group Checkout
   */
  'checkout.invalid': Checkout & {
    /** What stopped it, by field name. */
    errors: Record<string, CheckoutError>;
  };
  /**
   * The order could not be placed: refused, or the request failed. A declined card is
   * `payment.failed`. The shopper stays on the checkout.
   * @group Checkout
   */
  'checkout.failed': Checkout & { error: Failure };
  /**
   * The checkout's order is paid; once per checkout. An order paid at once sends it on the
   * checkout, after `order.paid`; an order paid at a gateway on the page after it.
   * @group Checkout
   */
  'checkout.completed': Checkout & {
    /** The paid order. */
    ref_id: string;
  };
}
