import type { Campaign } from '../types';
import type { Cart } from './carts';
import type { Checkout } from './checkout';
import type { EventCampaign } from './context';
import type { Order } from './orders';
import type { Selector } from './selectors';

export type ErrorAction =
  | 'campaign.load'
  | 'cart.calculate'
  | 'selector.calculate'
  | 'coupon.check'
  | 'user.save'
  | 'address.load_rules'
  | 'address.suggest'
  | 'order.create'
  | 'order.load'
  | 'upsell.add'
  | 'storage.write';

export type ErrorCode =
  | 'network'
  | 'timeout'
  | 'server'
  | 'rejected'
  | 'declined'
  | 'payment_failed'
  | 'auth'
  | 'too_many_requests'
  | 'unavailable';

/** Why something failed: the same shape on `sdk.error` and on every `*.failed` event. */
export interface Failure {
  /** `network` (no answer), `timeout`, `server` (5xx), `rejected` (4xx), `declined` (the card or the gateway), `payment_failed` (the gateway sent the shopper back unpaid), `auth` (401, 403), `too_many_requests` (429), or `unavailable` (storage blocked or full). */
  code: ErrorCode;
  /** For developers and logs, never for shoppers. */
  message?: string;
  /** The HTTP status, when the API answered. */
  status?: number;
  /** The gateway's decline code, for a declined card. */
  decline_code?: string;
}

/** What the page shows now: the same objects the events carry. */
export interface Snapshot {
  /** Once the campaign has loaded. */
  campaign?: EventCampaign;
  cart: Cart;
  /** On a checkout page, once the form is bound. */
  checkout?: Checkout;
  /** On a page that loaded an order. */
  order?: Order;
  /** Every bundle and offer selector on the page; toggles are in the cart. */
  selectors: Selector[];
}

export interface SdkEvents {
  /**
   * Once a page, when the campaign is in: at once from a copy saved in the last 10 minutes, else
   * when the API answers. `ready` is the same event. Carries what the page shows then.
   * @group SDK
   */
  'sdk.ready': Snapshot;
  /**
   * A step failed. The SDK lifecycle lists each `action`, what the SDK does next, and the event
   * sent with it.
   * @group SDK
   */
  'sdk.error': Failure & {
    /** The step that failed, named like the events. */
    action: ErrorAction;
    /** For developers and logs, never for shoppers. */
    message: string;
  };
  /** @internal */
  'campaign.loaded': { campaign: Campaign; fromCache: boolean };
}
