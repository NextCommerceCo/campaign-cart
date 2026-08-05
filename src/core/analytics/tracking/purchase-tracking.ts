/**
 * The two questions every automatic `dl_purchase` has to answer first: *did the
 * customer actually pay*, and *has this order already been reported*.
 *
 * Both exist because of issue #71. `dl_purchase` was hung on the event the
 * express-checkout processor fires the moment the orders API accepts a PayPal
 * order — which is **before** the customer has paid anything: that order comes
 * back with a `payment_complete_url` and the SDK redirects to PayPal with it.
 * The event was then parked in `sessionStorage` (`_willRedirect`) and replayed on
 * the next SDK page in the session, so pressing **back** from PayPal, or landing
 * on `payment_failed_url`, fired a purchase for an order that never happened. One
 * merchant's affiliate network approved six payouts for purchases that did not
 * exist.
 *
 * So an order is only reportable once it is paid, and only once ever:
 *
 * - {@link isAwaitingGatewayPayment} — a `payment_complete_url` means the money
 *   has not moved yet. True for every express method (PayPal, Apple Pay, Google
 *   Pay) at creation time, and for a card order that needs 3-D Secure. Those
 *   orders are reported later, when the gateway returns the shopper to
 *   `success_url?ref_id=…` and the order store loads the paid order.
 * - {@link hasPurchaseBeenReported} — identity is the transaction id, so the two
 *   emission paths (checkout page, receipt page) are interchangeable and whichever
 *   arrives first wins. `DataLayerManager.push` is where the check runs, because a
 *   queued event re-enters through it after the redirect.
 *
 * The dedupe list lives in **localStorage**, not sessionStorage: a shopper who
 * opens the receipt link again in a new tab is a new session, and re-reporting
 * their order there is exactly the double-count this prevents.
 */

import { createLogger } from '@/core/logger';
import { STORAGE_KEYS } from '../config';

const logger = createLogger('PurchaseTracking');

/**
 * How many transaction ids the dedupe list keeps. Bounds the entry instead of
 * expiring it — an order reported an hour ago must still be suppressed, so age is
 * the wrong axis. Twenty covers a shopper's own purchase plus any test orders a
 * developer places on the same browser.
 */
const REPORTED_LIMIT = 20;

/**
 * The id `dl_purchase` reports as `transaction_id`, or `null` when the payload
 * carries none.
 *
 * Mirrors the resolution order in `createPurchaseEvent`, minus the
 * `order_<timestamp>` fallback that used to sit at the end of it — see
 * {@link reportedPurchaseId}.
 */
export function purchaseTransactionId(order: any): string | null {
  // Falsy-skip, not `??`: an order carrying `number: ''` has no usable number,
  // and must fall through to `ref_id` rather than resolve to an empty id.
  const id =
    order?.number || order?.ref_id || order?.orderId || order?.transactionId;
  return id ? String(id) : null;
}

/**
 * Whether this order is still waiting for money to move at a payment gateway.
 *
 * `payment_complete_url` is the orders API telling the SDK "send the shopper here
 * to finish paying" — see {@link index.Order.payment_complete_url}. While it is
 * present the order exists but is unpaid, so nothing about it may be reported as
 * a purchase.
 */
export function isAwaitingGatewayPayment(order: any): boolean {
  return Boolean(order?.payment_complete_url);
}

/**
 * Where the SDK told the orders API to send the shopper afterwards, remembered on
 * the checkout page so the *landing* page can tell which of the two it is.
 *
 * A redirect payment has two return legs, `success_url` and `payment_failed_url`,
 * and both come back to the merchant's own site with `?ref_id=` — so the order
 * loads either way and `order:loaded` fires either way.
 * {@link isAwaitingGatewayPayment} is the first line of defence, but it rests on
 * the API still returning `payment_complete_url` for an order whose payment
 * failed, which is the platform's behaviour to decide, not the SDK's. This record
 * does not depend on it.
 *
 * Paths only — the two URLs can carry different query strings per attempt — and
 * only ever used to **veto** a purchase, never to require one: no record means the
 * ordinary rules apply, so losing sessionStorage can never lose a conversion.
 */
interface CheckoutReturnPaths {
  success: string;
  failure: string;
}

/** `'/thanks'` from `https://shop.test/thanks?x=1`, or `null` if unparseable. */
function pathOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return null;
  }
}

/**
 * Record the two return legs of this order, from the payload the SDK is about to
 * send. Called on the checkout page, for every order that is created.
 */
export function rememberCheckoutReturnPaths(
  successUrl: string | undefined,
  failureUrl: string | undefined
): void {
  const success = pathOf(successUrl);
  const failure = pathOf(failureUrl);
  // Both, or neither: one path alone cannot tell the legs apart.
  if (!success || !failure) return;

  try {
    sessionStorage.setItem(
      STORAGE_KEYS.CHECKOUT_RETURN_PATHS,
      JSON.stringify({ success, failure } satisfies CheckoutReturnPaths)
    );
  } catch (error) {
    logger.warn('Failed to record the checkout return paths:', error);
  }
}

function readReturnPaths(): CheckoutReturnPaths | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.CHECKOUT_RETURN_PATHS);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.success === 'string' &&
      typeof parsed?.failure === 'string'
      ? (parsed as CheckoutReturnPaths)
      : null;
  } catch (error) {
    logger.warn('Failed to read the checkout return paths:', error);
    return null;
  }
}

/**
 * Whether the page being looked at is where a *failed* payment lands, which is
 * never a purchase however complete the order it loaded looks.
 *
 * Two independent signals, either of which is enough:
 *
 * - `?payment_failed=true` — the SDK's own default failure URL is the checkout
 *   page with that parameter appended (`getFailureUrl`), so this covers every
 *   store that has not set `next-failure-url`.
 * - the path matches the `payment_failed_url` this session sent with its order —
 *   which covers the stores that have. A store pointing **both** legs at one page
 *   makes the path meaningless, so that case falls back to the parameter alone.
 */
export function isPaymentFailureLanding(): boolean {
  const { search, pathname } = window.location;
  if (new URLSearchParams(search).get('payment_failed') === 'true') return true;

  const paths = readReturnPaths();
  if (!paths || paths.failure === paths.success) return false;
  return pathname === paths.failure;
}

/** The transaction id of an already-built event, for the dedupe check. */
export function reportedPurchaseId(event: {
  ecommerce?: { transaction_id?: string } | undefined;
}): string | null {
  const id = event.ecommerce?.transaction_id;
  return id ? String(id) : null;
}

function readReported(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.REPORTED_PURCHASES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch (error) {
    logger.warn('Failed to read reported purchases:', error);
    return [];
  }
}

/** Has `dl_purchase` already been emitted for this transaction id? */
export function hasPurchaseBeenReported(transactionId: string): boolean {
  return readReported().includes(transactionId);
}

/**
 * Record that `dl_purchase` shipped for this transaction id. Call it only once
 * the event has actually reached the data layer — marking a *queued* event would
 * suppress the receipt page's own emission and lose the purchase entirely if the
 * queue drops the event as stale.
 */
export function markPurchaseReported(transactionId: string): void {
  try {
    const reported = readReported().filter(id => id !== transactionId);
    reported.push(transactionId);
    localStorage.setItem(
      STORAGE_KEYS.REPORTED_PURCHASES,
      JSON.stringify(reported.slice(-REPORTED_LIMIT))
    );
  } catch (error) {
    logger.warn('Failed to record reported purchase:', error);
  }
}

/**
 * Forget every reported purchase — test infrastructure, so one test's order id
 * cannot suppress the next test's event. Nothing in the SDK calls it: on a real
 * page the whole point of the list is that it outlives everything.
 */
export function resetReportedPurchases(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.REPORTED_PURCHASES);
  } catch (error) {
    logger.warn('Failed to clear reported purchases:', error);
  }
}
