import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupAutofillDetection,
  type AutofillDetectionContext,
} from '../autofill-detection';
import type { EventBus } from '@/core/events';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

// The mock fns are declared via `vi.hoisted` so the `vi.mock` factory (which
// is hoisted above this file's imports) and the tests below can share them,
// and so assertions reference a plain `vi.fn()` rather than a property read
// off a class-typed import — the latter trips `@typescript-eslint/unbound-method`.
// Mirrors `phone-input.test.ts`.
const { trackMock, createAddShippingInfoEventMock } = vi.hoisted(() => ({
  trackMock: vi.fn(),
  createAddShippingInfoEventMock: vi.fn((shippingTier?: string) => ({
    event: 'add_shipping_info',
    shippingTier,
  })),
}));

vi.mock('@/core/analytics/index', () => ({
  nextAnalytics: { track: trackMock },
  EcommerceEvents: {
    createAddShippingInfoEvent: createAddShippingInfoEventMock,
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Kept as a plain object (not typed as `Logger`) so the spies stay `Mock`s in
// assertions — going through `ctx.logger.info` instead would carry `Logger`'s
// method signature and trip `@typescript-eslint/unbound-method`. Mirrors
// `state-fields.test.ts` / `billing-animation.test.ts`.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createField(name: string, value = ''): HTMLInputElement {
  const field = document.createElement('input');
  field.name = name;
  field.value = value;
  document.body.appendChild(field);
  return field;
}

function createCtx(
  fields: Map<string, HTMLElement>,
  options: { hasTrackedShippingInfo?: boolean } = {}
): {
  ctx: AutofillDetectionContext;
  onSpy: ReturnType<typeof vi.fn>;
  unsubSpy: ReturnType<typeof vi.fn>;
  logger: ReturnType<typeof createMockLogger>;
  hasTrackedShippingInfo: { value: boolean };
} {
  // `on` returns an unsubscribe, matching the real `EventBus.on` — a fake that returns
  // nothing would make the teardown throw rather than fail a meaningful assertion.
  const unsubSpy = vi.fn();
  const onSpy = vi.fn(() => unsubSpy);
  const logger = createMockLogger();
  const hasTrackedShippingInfo = {
    value: options.hasTrackedShippingInfo ?? false,
  };
  const ctx: AutofillDetectionContext = {
    eventBus: { on: onSpy } as unknown as EventBus,
    fields,
    hasTrackedShippingInfo,
    logger: logger as unknown as Logger,
  };
  return { ctx, onSpy, unsubSpy, logger, hasTrackedShippingInfo };
}

/** Pulls the handler registered for `address:autocomplete-filled` out of the fake bus. */
function getAutocompleteFilledHandler(
  onSpy: ReturnType<typeof vi.fn>
): () => void {
  const call = onSpy.mock.calls.find(
    args => args[0] === 'address:autocomplete-filled'
  );
  if (!call) {
    throw new Error('address:autocomplete-filled was never registered');
  }
  return call[1] as () => void;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  useCheckoutStore.getState().reset();
});

// ─── Detecting autofill ───────────────────────────────────────────────────────

describe('setupAutofillDetection', () => {
  it('reports a value that changes while the field is unfocused as autofill: dispatches change and logs the field name', () => {
    const field = createField('first_name');
    const { ctx, logger } = createCtx(new Map([['first_name', field]]));
    const changeSpy = vi.fn();
    field.addEventListener('change', changeSpy);

    const stop = setupAutofillDetection(ctx);
    field.value = 'Jane';
    vi.advanceTimersByTime(500);

    expect(changeSpy).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Browser autofill detected for fields:',
      ['first_name']
    );
    stop();
  });

  it('does not report a value that changes while the field is focused — that is the shopper typing', () => {
    const field = createField('email');
    const { ctx, logger } = createCtx(new Map([['email', field]]));
    const changeSpy = vi.fn();
    field.addEventListener('change', changeSpy);

    const stop = setupAutofillDetection(ctx);
    field.focus();
    field.value = 'jane@example.com';
    vi.advanceTimersByTime(500);

    expect(changeSpy).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    stop();
  });

  it('ignores an unchanged value and a change to an empty string', () => {
    const unchanged = createField('email', 'same@example.com');
    const clearedField = createField('phone', 'something');
    const { ctx, logger } = createCtx(
      new Map([
        ['email', unchanged],
        ['phone', clearedField],
      ])
    );
    const unchangedSpy = vi.fn();
    const clearedSpy = vi.fn();
    unchanged.addEventListener('change', unchangedSpy);
    clearedField.addEventListener('change', clearedSpy);

    const stop = setupAutofillDetection(ctx);
    clearedField.value = '';
    vi.advanceTimersByTime(500);

    expect(unchangedSpy).not.toHaveBeenCalled();
    expect(clearedSpy).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    stop();
  });

  it('records country and billing-country as autofilled but never dispatches change on them — that reload would discard the autofilled province', () => {
    const country = createField('country');
    const billingCountry = createField('billing-country');
    const { ctx, logger } = createCtx(
      new Map([
        ['country', country],
        ['billing-country', billingCountry],
      ])
    );
    const countryChangeSpy = vi.fn();
    const billingChangeSpy = vi.fn();
    country.addEventListener('change', countryChangeSpy);
    billingCountry.addEventListener('change', billingChangeSpy);

    const stop = setupAutofillDetection(ctx);
    country.value = 'CA';
    billingCountry.value = 'US';
    vi.advanceTimersByTime(500);

    expect(countryChangeSpy).not.toHaveBeenCalled();
    expect(billingChangeSpy).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      'Browser autofill detected for fields:',
      expect.arrayContaining(['country', 'billing-country'])
    );

    // The value was still recorded on this tick, so a second poll with no
    // further change must not report it again.
    logger.info.mockClear();
    vi.advanceTimersByTime(500);
    expect(logger.info).not.toHaveBeenCalled();
    stop();
  });

  it('skips address1/address entirely — no dispatch and never reported, because Google Places owns that field', () => {
    const address1 = createField('address1');
    const { ctx, logger } = createCtx(new Map([['address1', address1]]));
    const changeSpy = vi.fn();
    address1.addEventListener('change', changeSpy);

    const stop = setupAutofillDetection(ctx);
    address1.value = '123 Main St';
    vi.advanceTimersByTime(500);

    expect(changeSpy).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();

    // The new value was still tracked, so it must not surface on a later poll either.
    vi.advanceTimersByTime(500);
    expect(logger.info).not.toHaveBeenCalled();
    stop();
  });

  it('stops polling after 60 checks (30 seconds) and no longer detects changes afterward', () => {
    const field = createField('last_name');
    const { ctx, logger } = createCtx(new Map([['last_name', field]]));

    const stop = setupAutofillDetection(ctx);
    vi.advanceTimersByTime(60 * 500);

    expect(logger.debug).toHaveBeenCalledWith(
      'Stopped autofill detection after 30 seconds'
    );

    const changeSpy = vi.fn();
    field.addEventListener('change', changeSpy);
    field.value = 'Doe';
    vi.advanceTimersByTime(500);

    expect(changeSpy).not.toHaveBeenCalled();
    stop();
  });

  it('pauses detection while address:autocomplete-filled is in effect, then resumes after the 2s pause', () => {
    const field = createField('promo_code');
    const { ctx, onSpy, logger } = createCtx(new Map([['promo_code', field]]));
    const changeSpy = vi.fn();
    field.addEventListener('change', changeSpy);

    const stop = setupAutofillDetection(ctx);
    const pauseHandler = getAutocompleteFilledHandler(onSpy);

    pauseHandler();
    field.value = 'places-written-value';
    vi.advanceTimersByTime(500);
    expect(changeSpy).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();

    // Cross the 2s pause window — detection resumes and re-baselines on the
    // value Places just wrote, so that value alone is still not reported.
    vi.advanceTimersByTime(2000);
    expect(changeSpy).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();

    // A genuinely new change after resume is detected normally.
    field.value = 'shopper-typed-after-resume';
    vi.advanceTimersByTime(500);
    expect(changeSpy).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Browser autofill detected for fields:',
      ['promo_code']
    );
    stop();
  });

  it('does not fire add_shipping_info a second time when hasTrackedShippingInfo is already true', () => {
    const city = createField('city');
    const province = createField('province');
    const { ctx } = createCtx(
      new Map([
        ['city', city],
        ['province', province],
      ]),
      { hasTrackedShippingInfo: true }
    );
    useCheckoutStore
      .getState()
      .updateFormData({ city: 'Toronto', province: 'ON' });

    const stop = setupAutofillDetection(ctx);
    city.value = 'Toronto';
    province.value = 'ON';
    vi.advanceTimersByTime(500); // the poll that detects the autofill
    vi.advanceTimersByTime(100); // the nested settle timeout that would track it

    expect(trackMock).not.toHaveBeenCalled();
    stop();
  });

  it('fires add_shipping_info once when untracked and the store already has city and province, then flips the ref', () => {
    const city = createField('city');
    const province = createField('province');
    const { ctx, logger, hasTrackedShippingInfo } = createCtx(
      new Map([
        ['city', city],
        ['province', province],
      ]),
      { hasTrackedShippingInfo: false }
    );
    useCheckoutStore.getState().setShippingMethod({
      id: 1,
      name: 'Express',
      price: 0,
      code: 'EXP',
    });
    useCheckoutStore
      .getState()
      .updateFormData({ city: 'Toronto', province: 'ON' });

    const stop = setupAutofillDetection(ctx);
    city.value = 'Toronto';
    province.value = 'ON';
    vi.advanceTimersByTime(500); // the poll that detects the autofill
    vi.advanceTimersByTime(100); // the nested settle timeout

    expect(trackMock).toHaveBeenCalledTimes(1);
    expect(createAddShippingInfoEventMock).toHaveBeenCalledWith('Express');
    expect(hasTrackedShippingInfo.value).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(
      'Tracked add_shipping_info event (browser autofill)',
      { shippingTier: 'Express' }
    );
    stop();
  });
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

describe('teardown', () => {
  // `EventBus` is a singleton, so a subscription that outlives its setup keeps firing on
  // every later `address:autocomplete-filled` — re-snapshotting a `fieldValues` map that
  // no longer matches any live field. The returned teardown used to be a bare interval
  // handle, which could only stop the poll.
  it('unsubscribes from the event bus as well as stopping the poll', () => {
    const { ctx, onSpy, unsubSpy } = createCtx(new Map());

    const stop = setupAutofillDetection(ctx);
    expect(onSpy).toHaveBeenCalledTimes(1);
    expect(onSpy.mock.calls[0]?.[0]).toBe('address:autocomplete-filled');
    expect(unsubSpy).not.toHaveBeenCalled();

    stop();

    // Calls the unsubscribe `on` handed back, rather than reaching for `EventBus.off`
    // with a stashed handler reference — see the TSDoc on `EventBus.on`.
    expect(unsubSpy).toHaveBeenCalledTimes(1);
  });
});
