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
