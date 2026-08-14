/**
 * Order property value resolution for OrderDisplayEnhancer.
 * Resolves a `data-next-display="order.xxx"` path against the order store
 * state and returns the value to render. Pure — reads `orderState`/`order`
 * and the supplied `logger`, does not touch the DOM.
 */

import { AttributeParser } from '@/core/base/attribute-parser';
import {
  PropertyResolver,
  DisplayFormatter,
} from '@/core/base/base-display-enhancer';
import { getPropertyMapping } from '@/core/base/display-types';
import type { Logger } from '@/core/logger';
import type { Order } from '@/types/api';
import {
  getOrderLinesProperty,
  getOrderAttributionProperty,
  getCalculatedProperty,
} from './order-display.line-properties';

export function getDisplayValue(
  orderState: any,
  path: string,
  logger: Logger
): any {
  const parsed = AttributeParser.parseDisplayPath(path);
  const property = parsed.property;

  if (!property) {
    return '';
  }

  // At this point, property is guaranteed to be a non-empty string
  const propertyStr = property as string;

  const order = orderState.order;

  if (!order) {
    // Handle loading and error states
    if (orderState.isLoading) {
      return 'Loading...';
    } else if (orderState.error) {
      return 'Error';
    }
    return '';
  }

  // Check property mappings first
  const mappedPath = getPropertyMapping('order', propertyStr);
  if (mappedPath) {
    // Handle calculated properties
    if (mappedPath.startsWith('_calculated.')) {
      return getCalculatedProperty(order, mappedPath.substring(12));
    }

    // If we have a mapping, use PropertyResolver to get the value
    // For order object, we need to check if it's a direct property or nested
    if (mappedPath.startsWith('order.')) {
      const value = PropertyResolver.getNestedProperty(
        order,
        mappedPath.substring(6)
      );
      if (value !== undefined) {
        // Special handling for payment_method - beautify the name
        if (
          mappedPath === 'order.payment_method' ||
          propertyStr === 'payment_method' ||
          propertyStr === 'paymentMethod'
        ) {
          return beautifyPaymentMethod(value);
        }
        return value;
      }
    } else {
      const value = PropertyResolver.getNestedProperty(orderState, mappedPath);
      if (value !== undefined) {
        return value;
      }
    }
  }

  // Handle nested properties
  const parts = propertyStr.split('.');

  // Try using PropertyResolver for simple nested properties first
  if (parts.length > 1 && parts[0] && !isComplexOrderProperty(parts[0])) {
    const resolvedValue = PropertyResolver.getNestedProperty(
      order,
      propertyStr
    );
    if (resolvedValue !== undefined) {
      return resolvedValue;
    }
  }

  // Handle complex order-specific properties that need special handling
  switch (parts[0]) {
    case 'created_at':
    case 'createdAt':
      // Order API doesn't have created_at, use metadata timestamp if available
      const timestamp = order.attribution?.metadata?.timestamp;
      if (!timestamp) return '';
      if (parts[1] === 'raw') return timestamp;
      // Convert milliseconds timestamp to date
      return DisplayFormatter.formatDate(new Date(timestamp));

    case 'testBadge':
      return order.is_test ? '🧪 TEST ORDER' : '';

    case 'payment_method':
    case 'paymentMethod':
      return beautifyPaymentMethod(order.payment_method || '');

    // User/Customer properties
    case 'user':
    case 'customer':
      return getOrderUserProperty(order, parts.slice(1).join('.') || '');

    // Address properties
    case 'shippingAddress':
      return getOrderAddressProperty(
        order.shipping_address,
        parts.slice(1).join('.') || ''
      );
    case 'billingAddress':
      return getOrderAddressProperty(
        order.billing_address,
        parts.slice(1).join('.') || ''
      );

    // Line items
    case 'items':
    case 'lines':
      return getOrderLinesProperty(order, parts.slice(1).join('.') || '');

    // Attribution
    case 'attribution':
      return getOrderAttributionProperty(
        order.attribution,
        parts.slice(1).join('.') || ''
      );

    default:
      logger.warn(`Unknown order property: ${propertyStr}`);
      return '';
  }
}

export function getOrderUserProperty(order: Order, property: string): any {
  const user = order.user;
  if (!user) return '';

  switch (property) {
    case '':
    case 'name':
      return `${user.first_name || ''} ${user.last_name || ''}`.trim();
    case 'email':
      return String(user.email || '');
    case 'firstName':
      return String(user.first_name || '');
    case 'lastName':
      return String(user.last_name || '');
    case 'phone':
      return String(user.phone_number || '');
    case 'acceptsMarketing':
      return user.accepts_marketing;
    case 'language':
      return String(user.language || '');
    case 'ip':
      return String(user.ip || '');
    default:
      return '';
  }
}

export function getOrderAddressProperty(address: any, property: string): any {
  if (!address) return '';

  switch (property) {
    case '':
    case 'full':
      return formatAddress(address);
    case 'name':
      return `${address.first_name || ''} ${address.last_name || ''}`.trim();
    case 'line1':
      return String(address.line1 || '');
    case 'line2':
      return String(address.line2 || '');
    case 'city':
      return String(address.line4 || '');
    case 'state':
      return String(address.state || '');
    case 'zip':
    case 'postcode':
      return String(address.postcode || '');
    case 'country':
      return String(address.country || '');
    case 'phone':
      return String(address.phone_number || '');
    default:
      return '';
  }
}

export function formatAddress(address: any): string {
  if (!address) return '';

  const parts = [
    address.line1,
    address.line2,
    address.line4, // city
    address.state,
    address.postcode,
    address.country,
  ]
    .filter(Boolean)
    .map(part => String(part));

  return parts.join(', ');
}

/**
 * What to print for each payment method the orders API can put on an order.
 *
 * The platform's own labels, so a receipt names the method the way the shopper
 * met it — `iDEAL` and `PayPal` keep their house capitalisation, which is why
 * this is a table rather than a title-case function over the code.
 *
 * `card_token` is the one deliberate difference: the API calls it "Card Token",
 * which is a word about plumbing, and a shopper reading their own receipt is
 * being told how they paid.
 *
 * Two codes for SEPA because two of the platform's own references disagree about
 * which one it is; both land on the same label, so a receipt reads correctly
 * whichever arrives.
 */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  card_token: 'Credit Card',
  credit_card: 'Credit Card',
  saved_card: 'Saved Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  paypal: 'PayPal',
  affirm: 'Affirm',
  bancontact: 'Bancontact',
  external: 'External',
  giropay: 'Giropay',
  ideal: 'iDEAL',
  klarna: 'Klarna',
  link: 'Link',
  sepa_debit: 'SEPA Direct Debit',
  sepa_direct: 'SEPA Direct Debit',
  sofort: 'Sofort',
  swish: 'Swish',
  twint: 'Twint',
};

/**
 * Turns the API's payment-method code into the label to show a shopper.
 *
 * A code this build has no label for is returned **unchanged** rather than
 * prettified by a rule: guessing would print a plausible wrong name for a method
 * the platform has just added, and a raw `pix` on a receipt is a bug someone
 * reports, where "Pix Payments" is one nobody notices.
 *
 * @example
 * ```ts
 * beautifyPaymentMethod('sepa_debit');  // 'SEPA Direct Debit'
 * beautifyPaymentMethod('Apple Pay');   // 'Apple Pay' — spacing and case ignored
 * beautifyPaymentMethod('pix');         // 'pix' — no label for it yet
 * ```
 */
export function beautifyPaymentMethod(method: string): string {
  if (!method) return '';

  // Same normalisation the payment-method radios get: an order fetched from an
  // older API, or hand-written test data, may carry `Apple Pay` or `apple-pay`.
  const code = method.trim().toLowerCase().replace(/[\s-]+/g, '_');

  // The original, not the normalised code, so an unlabelled method is shown
  // exactly as the API spelled it.
  return PAYMENT_METHOD_LABELS[code] ?? method;
}

export function isComplexOrderProperty(property: string): boolean {
  const complexProperties = [
    'user',
    'customer',
    'total',
    'subtotal',
    'tax',
    'shipping',
    'discounts',
    'shippingAddress',
    'billingAddress',
    'items',
    'lines',
    'attribution',
    'created_at',
  ];
  return complexProperties.includes(property);
}
