import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import intlTelInput from 'intl-tel-input';
import {
  injectIntlTelInputStyles,
  initializePhoneInputs,
} from '../phone-input';
import type { PhoneInputContext } from '../phone-input';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';

// `intl-tel-input` manipulates the DOM and ships its own async util loader —
// none of that is relevant here, only that the module under test calls
// `getNumber` / `destroy` / `setCountry` on whatever instance it gets back.
// The mock fns are declared via `vi.hoisted` so the `vi.mock` factory (which
// is hoisted above this file's imports) and the tests below can share them.
const { mockGetNumber, mockDestroy, mockSetCountry } = vi.hoisted(() => ({
  mockGetNumber: vi.fn(() => '+15551234567'),
  mockDestroy: vi.fn(),
  mockSetCountry: vi.fn(),
}));

vi.mock('intl-tel-input', () => ({
  default: vi.fn(() => ({
    getNumber: mockGetNumber,
    destroy: mockDestroy,
    setCountry: mockSetCountry,
  })),
}));

const STYLE_ID = 'intl-tel-input-paths';

// Returns the spy alongside the fake so a test can assert on the spy directly
// instead of reading `ctx.logger.error` back through the `Logger` class type —
// referencing a class method as a bare value trips
// `@typescript-eslint/unbound-method`, since the type checker can't see that
// the runtime value is an unbound-safe vi.fn().
function makeLogger(): {
  logger: Logger;
  errorSpy: ReturnType<typeof vi.fn>;
} {
  const errorSpy = vi.fn();
  const logger = {
    error: errorSpy,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger;
  return { logger, errorSpy };
}

function makeFields(names: string[]): Map<string, HTMLElement> {
  const map = new Map<string, HTMLElement>();
  for (const name of names) {
    map.set(name, document.createElement('input'));
  }
  return map;
}

function makeCtx(
  overrides: Partial<PhoneInputContext> = {}
): PhoneInputContext {
  return {
    isIntlTelInputAvailable: true,
    fields: makeFields(['phone']),
    billingFields: makeFields(['billing-phone']),
    phoneInputs: new Map(),
    detectedCountryCode: 'us',
    updateFormData: vi.fn(),
    logger: makeLogger().logger,
    ...overrides,
  };
}

describe('injectIntlTelInputStyles', () => {
  afterEach(() => {
    document.getElementById(STYLE_ID)?.remove();
  });

  it('is idempotent: calling it twice appends only one <style> element', () => {
    injectIntlTelInputStyles();
    injectIntlTelInputStyles();

    expect(document.querySelectorAll(`#${STYLE_ID}`).length).toBe(1);
  });

  it('leaves the existing <style> element alone when called again', () => {
    injectIntlTelInputStyles();
    const first = document.getElementById(STYLE_ID);

    injectIntlTelInputStyles();

    expect(document.getElementById(STYLE_ID)).toBe(first);
  });
});

describe('initializePhoneInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does nothing when the library did not load', () => {
    const ctx = makeCtx({ isIntlTelInputAvailable: false });

    initializePhoneInputs(ctx);

    expect(intlTelInput).not.toHaveBeenCalled();
    expect(ctx.phoneInputs.size).toBe(0);
  });

  it('skips a field that is absent from the fields map and initialises one that is present', () => {
    const ctx = makeCtx({
      fields: makeFields([]), // no 'phone' entry — shipping field does not exist on this form
      billingFields: makeFields(['billing-phone']),
    });

    initializePhoneInputs(ctx);

    expect(intlTelInput).toHaveBeenCalledTimes(1);
    expect(ctx.phoneInputs.has('shipping')).toBe(false);
    expect(ctx.phoneInputs.has('billing')).toBe(true);
  });

  it("writes the instance's full international number to ctx.updateFormData, not the raw input value", () => {
    const ctx = makeCtx();

    initializePhoneInputs(ctx);
    const shippingField = ctx.fields.get('phone') as HTMLInputElement;
    shippingField.value = '5551234567'; // the raw national text the shopper typed
    shippingField.dispatchEvent(new Event('input'));

    expect(ctx.updateFormData).toHaveBeenCalledWith({
      phone: '+15551234567',
    });
  });

  it("writes the billing instance's international number into the checkout store's billingAddress", () => {
    useCheckoutStore.getState().reset();
    const ctx = makeCtx({ fields: makeFields([]) }); // only billing field present

    initializePhoneInputs(ctx);
    const billingField = ctx.billingFields.get(
      'billing-phone'
    ) as HTMLInputElement;
    billingField.dispatchEvent(new Event('input'));

    expect(useCheckoutStore.getState().billingAddress?.phone).toBe(
      '+15551234567'
    );
    useCheckoutStore.getState().reset();
  });

  it('destroys the previous instance on re-init instead of stacking a second one', () => {
    const ctx = makeCtx({ billingFields: makeFields([]) }); // isolate to the shipping field

    initializePhoneInputs(ctx);
    initializePhoneInputs(ctx);

    expect(intlTelInput).toHaveBeenCalledTimes(2);
    expect(mockDestroy).toHaveBeenCalledTimes(1);
    expect(ctx.phoneInputs.size).toBe(1);
  });

  it('catches a throw from the library, logs it, and does not propagate', () => {
    vi.mocked(intlTelInput).mockImplementationOnce(() => {
      throw new Error('intl-tel-input blew up');
    });
    const { logger, errorSpy } = makeLogger();
    const ctx = makeCtx({ billingFields: makeFields([]), logger });

    expect(() => initializePhoneInputs(ctx)).not.toThrow();

    expect(errorSpy).toHaveBeenCalled();
    expect(ctx.phoneInputs.has('shipping')).toBe(false);
  });
});
