import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Single-producer contract for `order:completed`.
 *
 * `order:completed` is the one event `dl_purchase` is raised from, and the order
 * store is the one thing that emits it — on a page opened with `?ref_id=`, once the
 * order has been fetched back from the API. Every other producer was removed on
 * purpose (issue [#71](https://github.com/NextCommerceCo/campaign-cart/issues/71)):
 * the checkout page emits nothing when it *creates* an order, because a created
 * order is not a paid one for express checkout or for a card needing 3-D Secure,
 * and an event raised as the page navigates away is parked in `sessionStorage` and
 * replayed on whatever SDK page the shopper reaches next.
 *
 * Restoring any of those emits would report a purchase from the checkout page
 * again. Nothing else would fail: the analytics wiring is happy to report whatever
 * it is handed (`src/tests/analytics/PurchaseRequiresPaidOrder.test.ts` proves what
 * it does with the events, not who sends them), and the browser suite that would
 * see it is Playwright, which CI does not run. So this gate reads the source.
 *
 * ## Why a text scan
 *
 * The alternative is constructing `CheckoutFormEnhancer` and asserting `emit` is
 * never called with it, which needs the DOM, the API client, Spreedly and the whole
 * checkout store — machinery whose own failure modes would then decide whether this
 * invariant passes. The emit is one literal string in three files; reading for it is
 * both cheaper and harder to fool.
 *
 * It does mean the scan can only see the literal. An emit assembled at runtime
 * (`emit(name, order)` with `name` computed) would slip past — accepted, because
 * nothing in this codebase emits that way and a reviewer would question the first
 * thing that did.
 */

const SRC = resolve(__dirname, '../..');

/**
 * The files that create an order and then send the shopper onward. Each one used to
 * emit `order:completed` here; none may again.
 */
const CHECKOUT_PAGE_FILES = [
  'features/checkout/checkout-form/checkout-form.enhancer.ts', // card + standard submit
  'features/checkout/managers/order-manager.ts', // tokenized card payment
  'features/checkout/checkout-form/test-order.ts', // Konami test order
  'features/checkout/debug/test-order-manager.ts', // the unimported debug twin
] as const;

/** Where the event legitimately comes from. */
const PRODUCER = 'state/order/order.state.ts';

/**
 * `emit('order:completed'`, however it is spaced — and whatever the emitter is
 * called. The suffix wildcard is not decoration: `order-manager.ts` and its debug
 * twin call an injected `emitCallback(…)`, and a pattern anchored on `emit(` alone
 * passed while both of them emitted. Checked by re-adding the emit and watching
 * this file go red.
 */
const EMIT = /emit\w*\(\s*['"]order:completed['"]/;

function read(relative: string): string {
  return readFileSync(resolve(SRC, relative), 'utf8');
}

describe('order:completed has exactly one producer', () => {
  it('is emitted by the order store', () => {
    // Asserted first, so the negatives below cannot all pass by the event having
    // been renamed or dropped everywhere.
    expect(
      EMIT.test(read(PRODUCER)),
      `${PRODUCER} no longer emits order:completed — dl_purchase now has no producer at all`
    ).toBe(true);
  });

  it.each(CHECKOUT_PAGE_FILES)('is not emitted by %s', file => {
    expect(
      EMIT.test(read(file)),
      `${file} emits order:completed. Creating an order is not completing one: express checkout and 3-D Secure both reach that line unpaid, and the event would be parked and replayed on a later page — issue #71. The landing page's order store is the only producer.`
    ).toBe(false);
  });
});
