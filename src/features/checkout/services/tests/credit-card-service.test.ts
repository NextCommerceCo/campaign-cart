import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { CreditCardService } from '../credit-card-service';

/**
 * Teardown proof for the six listeners this service puts on the checkout form's own
 * markup — `change` on the expiry month and year selects, and `click` on the hosted
 * card number and CVV fields plus each of their wrappers (finding 169 in
 * `docs/code-findings.md`).
 *
 * All six were inline arrows, so `removeEventListener` could never be handed one back,
 * and the service is rebuilt on every checkout-form init: each rebuild added another
 * generation to the same four elements. The expiry pair is the one with a visible
 * effect — it fires the `add_payment_info` analytics event and checks nothing about
 * whether the service is still alive.
 *
 * Nothing here touches tokenization or the Spreedly bridge; `window.Spreedly` is stubbed
 * only far enough for `initialize()` to reach the two methods that register listeners.
 */

const analytics = vi.hoisted(() => ({ track: vi.fn() }));

vi.mock('@/core/analytics/index', () => ({
  nextAnalytics: analytics,
  EcommerceEvents: {
    createAddPaymentInfoEvent: vi.fn((method: string) => ({
      event: 'add_payment_info',
      method,
    })),
  },
}));

/** Captures the callbacks the service registers, so a test can fire one. */
type SpreedlyHandlers = Record<string, (...args: unknown[]) => void>;

function stubSpreedly(): SpreedlyHandlers {
  const handlers: SpreedlyHandlers = {};
  (window as unknown as { Spreedly: unknown }).Spreedly = {
    on: (event: string, cb: (...args: unknown[]) => void) => {
      handlers[event] = cb;
    },
    init: vi.fn(),
    transferFocus: vi.fn(),
  };
  return handlers;
}

/** The four elements the service binds to, plus the two wrappers it also binds. */
interface Fields {
  month: HTMLSelectElement;
  year: HTMLSelectElement;
  number: HTMLElement;
  cvv: HTMLElement;
  numberWrapper: HTMLElement;
  cvvWrapper: HTMLElement;
}

function mountFields(): Fields {
  document.body.innerHTML = `
    <div class="form-group" id="number-wrapper">
      <div data-next-checkout-field="cc-number"></div>
    </div>
    <div class="form-group" id="cvv-wrapper">
      <div data-next-checkout-field="cvv"></div>
    </div>
    <select data-next-checkout-field="cc-month">
      <option value=""></option><option value="01">01</option>
    </select>
    <select data-next-checkout-field="cc-year">
      <option value=""></option><option value="2030">2030</option>
    </select>
  `;
  const q = <T extends HTMLElement>(selector: string): T =>
    document.querySelector(selector) as T;
  return {
    month: q<HTMLSelectElement>('[data-next-checkout-field="cc-month"]'),
    year: q<HTMLSelectElement>('[data-next-checkout-field="cc-year"]'),
    number: q('[data-next-checkout-field="cc-number"]'),
    cvv: q('[data-next-checkout-field="cvv"]'),
    numberWrapper: q('#number-wrapper'),
    cvvWrapper: q('#cvv-wrapper'),
  };
}

describe('CreditCardService teardown', () => {
  beforeEach(() => {
    analytics.track.mockClear();
    stubSpreedly();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
    delete (window as unknown as { Spreedly?: unknown }).Spreedly;
  });

  /** A live service with both hosted fields reported valid and an expiry date chosen. */
  async function readyService(fields: Fields): Promise<CreditCardService> {
    const handlers = stubSpreedly();
    const service = new CreditCardService('test-env-key');
    await service.initialize();

    // The card number and CVV live in a Spreedly iframe, so their validity only ever
    // arrives through this callback.
    handlers.validation?.({ validNumber: true, validCvv: true });
    fields.month.value = '01';
    fields.year.value = '2030';
    return service;
  }

  it('fires add_payment_info when the expiry fields complete the card', async () => {
    const fields = mountFields();
    await readyService(fields);

    fields.month.dispatchEvent(new Event('change'));

    expect(analytics.track).toHaveBeenCalledTimes(1);
  });

  it('stops firing add_payment_info from the expiry fields once destroyed', async () => {
    const fields = mountFields();
    const service = await readyService(fields);

    service.destroy();
    fields.month.dispatchEvent(new Event('change'));
    fields.year.dispatchEvent(new Event('change'));

    expect(analytics.track).not.toHaveBeenCalled();
  });

  it('registers all six listeners against a signal that destroy() aborts', async () => {
    const fields = mountFields();

    // Every click handler this service registers is guarded by `isReady`, which
    // `destroy()` clears — so what has to be asserted is the registration's
    // removability, not a side effect the flag already suppresses.
    const options = new Map<HTMLElement, AddEventListenerOptions[]>();
    for (const element of Object.values(fields)) {
      options.set(element, []);
      const original = element.addEventListener.bind(element);
      vi.spyOn(element, 'addEventListener').mockImplementation(
        (type, handler, opts) => {
          options.get(element)?.push((opts ?? {}) as AddEventListenerOptions);
          original(type, handler, opts);
        }
      );
    }

    const service = new CreditCardService('test-env-key');
    await service.initialize();
    service.destroy();

    const registered = [...options.values()].flat();
    expect(registered).toHaveLength(6);
    for (const opts of registered) {
      expect(opts.signal?.aborted).toBe(true);
    }
  });
});
