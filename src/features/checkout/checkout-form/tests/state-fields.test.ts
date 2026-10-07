import { describe, it, expect, vi } from 'vitest';
import {
  updateStateOptions,
  updateBillingStateOptions,
  loadCountryConfig,
  type BillingStateFieldsContext,
  type ShippingStateFieldsContext,
} from '../state-fields';
import type {
  CountryConfig,
  I18nRules,
  CountryStatesData,
  State,
} from '@/core/i18n-rules';
import type { Logger } from '@/core/logger';
import type { CountryFieldsContext } from '../country-fields';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Kept as a plain object (not typed as `Logger`) so the spies stay `Mock`s in
// assertions — going through `ctx.logger.error` instead would carry `Logger`'s
// method signature and trip `@typescript-eslint/unbound-method`. Mirrors
// `billing-form-setup.test.ts` / `phone-input.test.ts`.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function createCountryConfig(
  overrides: Partial<CountryConfig> = {}
): CountryConfig {
  return {
    stateLabel: 'Province',
    stateRequired: true,
    postcodeLabel: 'Postal Code',
    postcodeRegex: null,
    postcodeMinLength: 6,
    postcodeMaxLength: 7,
    postcodeExample: 'A1A 1A1',
    postcodeFormat: null,
    currencyCode: 'CAD',
    currencySymbol: '$',
    ...overrides,
  };
}

function createStates(): State[] {
  return [
    { code: 'ON', name: 'Ontario' },
    { code: 'QC', name: 'Quebec' },
  ];
}

function createStatesData(
  overrides: Partial<CountryStatesData> = {}
): CountryStatesData {
  return {
    countryConfig: createCountryConfig(),
    states: createStates(),
    ...overrides,
  };
}

// Returns the spy alongside the fake so a test can assert on the spy
// directly instead of reading it back through `ctx.i18nRules` — that
// value is typed as the real `I18nRules` class, and referencing one of
// its methods off a class-typed value trips `@typescript-eslint/unbound-method`
// even though the runtime value is an unbound-safe `vi.fn()`. Mirrors
// `phone-input.test.ts`'s `makeLogger()`.
function createFakeI18nRules(
  impl: (country: string) => Promise<CountryStatesData> = () =>
    Promise.resolve(createStatesData())
): {
  service: I18nRules;
  getCountryStates: ReturnType<typeof vi.fn>;
} {
  const getCountryStates = vi.fn(impl);
  return {
    service: { getCountryStates } as unknown as I18nRules,
    getCountryStates,
  };
}

function createCountryFieldsCtx(): CountryFieldsContext {
  return {
    form: document.createElement('form'),
    fields: new Map(),
    billingFields: new Map(),
    countries: [],
  };
}

function createShippingCtx(
  overrides: Partial<ShippingStateFieldsContext> = {}
): ShippingStateFieldsContext {
  return {
    stateLoadingPromises: new Map(),
    i18nRules: createFakeI18nRules().service,
    logger: createMockLogger() as unknown as Logger,
    countryFields: createCountryFieldsCtx(),
    countryConfigs: new Map(),
    currentCountryConfig: { value: undefined },
    updateFormData: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  };
}

function createBillingCtx(
  overrides: Partial<BillingStateFieldsContext> = {}
): BillingStateFieldsContext {
  return {
    stateLoadingPromises: new Map(),
    i18nRules: createFakeI18nRules().service,
    logger: createMockLogger() as unknown as Logger,
    countryFields: createCountryFieldsCtx(),
    countryConfigs: new Map(),
    setBillingProvince: vi.fn(),
    ...overrides,
  };
}

/** A `<select>` wrapped in the kind of container the "hide the field" branch looks for. */
function createFieldWithContainer(): {
  field: HTMLSelectElement;
  container: HTMLDivElement;
} {
  const container = document.createElement('div');
  container.className = 'form-group';
  const field = document.createElement('select');
  field.setAttribute('data-next-checkout-field', 'province');
  container.appendChild(field);
  return { field, container };
}

// ─── updateStateOptions ─────────────────────────────────────────────────────

describe('updateStateOptions', () => {
  it('shows "Select Country First" and stays disabled when no country is chosen, without calling the service', async () => {
    const { field } = createFieldWithContainer();
    const { service, getCountryStates } = createFakeI18nRules();
    const ctx = createShippingCtx({ i18nRules: service });

    await updateStateOptions(ctx, '', field);

    expect(field.disabled).toBe(true);
    expect(field.options.length).toBe(1);
    expect(field.options[0]?.textContent).toBe('Select Country First');
    expect(getCountryStates).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only country the same as an empty one', async () => {
    const { field } = createFieldWithContainer();
    const { service, getCountryStates } = createFakeI18nRules();
    const ctx = createShippingCtx({ i18nRules: service });

    await updateStateOptions(ctx, '   ', field);

    expect(field.options[0]?.textContent).toBe('Select Country First');
    expect(getCountryStates).not.toHaveBeenCalled();
  });

  it('hides the container, drops required, and clears province in form data for a state-less, non-required country', async () => {
    const { field, container } = createFieldWithContainer();
    field.setAttribute('required', 'required');
    const ctx = createShippingCtx({
      i18nRules: createFakeI18nRules(() =>
        Promise.resolve(
          createStatesData({
            countryConfig: createCountryConfig({ stateRequired: false }),
            states: [],
          })
        )
      ).service,
    });

    await updateStateOptions(ctx, 'GB', field);

    expect(container.style.display).toBe('none');
    expect(field.hasAttribute('required')).toBe(false);
    expect(ctx.updateFormData).toHaveBeenCalledWith({ province: '' });
    expect(ctx.clearError).toHaveBeenCalledWith('province');
  });

  it('hides only the field when its parent holds the rest of the form too', async () => {
    // A select placed straight in the <form>: hiding its parent hid the whole checkout.
    const form = document.createElement('form');
    const email = document.createElement('input');
    email.setAttribute('data-next-checkout-field', 'email');
    const field = document.createElement('select');
    field.setAttribute('data-next-checkout-field', 'province');
    form.append(email, field);
    const ctx = createShippingCtx({
      i18nRules: createFakeI18nRules(() =>
        Promise.resolve(
          createStatesData({
            countryConfig: createCountryConfig({ stateRequired: false }),
            states: [],
          })
        )
      ).service,
    });

    await updateStateOptions(ctx, 'VA', field);

    expect(form.style.display).toBe('');
    expect(field.style.display).toBe('none');
  });

  it('renders states behind a disabled+hidden "Select {label}" prompt, marks required, and reveals a container hidden by a previous country', async () => {
    const { field, container } = createFieldWithContainer();
    container.style.display = 'none'; // simulating a prior state-less country (e.g. GB)
    const ctx = createShippingCtx({
      i18nRules: createFakeI18nRules(() =>
        Promise.resolve(
          createStatesData({
            countryConfig: createCountryConfig({
              stateRequired: true,
              stateLabel: 'Province',
            }),
          })
        )
      ).service,
    });

    await updateStateOptions(ctx, 'CA', field);

    expect(container.style.display).toBe('');
    expect(field.options[0]?.textContent).toBe('Select Province');
    expect(field.options[0]?.disabled).toBe(true);
    expect(field.options[0]?.hidden).toBe(true);
    expect(Array.from(field.options).map(o => o.value)).toEqual([
      '',
      'ON',
      'QC',
    ]);
    expect(field.hasAttribute('required')).toBe(true);
  });

  // This is the case browser autofill produces: the field already holds a province the
  // shopper never typed, and the country then resolves. Keeping a *valid* one saves them
  // re-picking it.
  //
  // It was broken for as long as the code existed — the value was read after the field had
  // been overwritten twice (by "Loading...", then by `renderStates`), so it was always
  // empty and this whole branch was unreachable. The value is now captured at the top of
  // the function, before the first overwrite. If someone moves that capture back down,
  // this test is what fails.
  it('keeps a pre-set value when it names a valid state of the new country', async () => {
    const { field } = createFieldWithContainer();
    field.innerHTML = '<option value="ON">Ontario</option>';
    field.value = 'ON';
    const mockLogger = createMockLogger();
    const ctx = createShippingCtx({ logger: mockLogger as unknown as Logger });

    await updateStateOptions(ctx, 'CA', field);

    expect(field.value).toBe('ON');
    expect(ctx.updateFormData).toHaveBeenCalledWith({ province: 'ON' });
    expect(mockLogger.debug).toHaveBeenCalledWith('Kept autofilled state: ON');
  });

  it('clears a pre-set value that is not a state of the new country', async () => {
    const { field } = createFieldWithContainer();
    field.innerHTML = '<option value="XX">Nowhere</option>';
    field.value = 'XX';
    const ctx = createShippingCtx();

    await updateStateOptions(ctx, 'CA', field);

    expect(field.value).toBe('');
  });

  // A failing fetch must not produce an unhandled rejection. The cache-eviction chain in
  // `loadCountryStates` used to be `void request.finally(…)`, which derives a *second*
  // promise that rejects whenever the request does — a different promise from the one this
  // function awaits and catches, with no handler of its own. It is now `.then(fn, fn)`, so
  // the derived promise always settles.
  //
  // This test deliberately installs **no** `unhandledRejection` listener: if the hazard
  // came back, the rejection would surface here and fail the run, which is the point.
  it('restores the previous markup, logs, re-enables the field, and raises no unhandled rejection on failure', async () => {
    const { field } = createFieldWithContainer();
    field.innerHTML = '<option value="ON">Ontario</option>';
    const originalHTML = field.innerHTML;
    const mockLogger = createMockLogger();
    const ctx = createShippingCtx({
      i18nRules: createFakeI18nRules(() =>
        Promise.reject(new Error('network down'))
      ).service,
      logger: mockLogger as unknown as Logger,
    });

    await updateStateOptions(ctx, 'CA', field);

    expect(field.innerHTML).toBe(originalHTML);
    expect(field.disabled).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to load states:',
      expect.any(Error)
    );

    // Long enough for the eviction chain to settle; a leaked rejection would surface now.
    await new Promise(resolve => setTimeout(resolve, 20));
  });
});

// ─── shared in-flight requests ──────────────────────────────────────────────

describe('shared in-flight requests', () => {
  it('fetches once when shipping and billing resolve the same country concurrently', async () => {
    const stateLoadingPromises = new Map<string, Promise<CountryStatesData>>();
    const { service: i18nRules, getCountryStates } = createFakeI18nRules();
    const mockLogger = createMockLogger();
    const countryFields = createCountryFieldsCtx();
    const shippingCtx = createShippingCtx({
      stateLoadingPromises,
      i18nRules,
      logger: mockLogger as unknown as Logger,
      countryFields,
    });
    const billingCtx = createBillingCtx({
      stateLoadingPromises,
      i18nRules,
      logger: mockLogger as unknown as Logger,
      countryFields,
    });
    const { field: shippingField } = createFieldWithContainer();
    const { field: billingField } = createFieldWithContainer();

    // Neither call is awaited before the second starts — this is the case
    // `stateLoadingPromises` exists to dedupe.
    const shippingPromise = updateStateOptions(
      shippingCtx,
      'CA',
      shippingField
    );
    const billingPromise = updateBillingStateOptions(
      billingCtx,
      'CA',
      billingField
    );
    await Promise.all([shippingPromise, billingPromise]);

    expect(getCountryStates).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      'Reusing existing state loading promise for CA (billing)'
    );
  });
});

// ─── updateBillingStateOptions ───────────────────────────────────────────────

describe('updateBillingStateOptions', () => {
  it('does not hide the container for a state-less country, unlike the shipping path', async () => {
    const { field, container } = createFieldWithContainer();
    const ctx = createBillingCtx({
      i18nRules: createFakeI18nRules(() =>
        Promise.resolve(
          createStatesData({
            countryConfig: createCountryConfig({ stateRequired: false }),
            states: [],
          })
        )
      ).service,
    });

    await updateBillingStateOptions(ctx, 'GB', field);

    expect(container.style.display).not.toBe('none');
    expect(field.options.length).toBe(1); // just the "Select {label}" prompt
  });

  it('pre-selects the shipping province on the billing field when passed', async () => {
    const { field } = createFieldWithContainer();
    const ctx = createBillingCtx();

    await updateBillingStateOptions(ctx, 'CA', field, 'QC');

    expect(field.value).toBe('QC');
  });

  /**
   * Nothing else writes the billing province when its list is rebuilt: a new country kept
   * the old country's province, and a pre-selected one showed while submit called it missing.
   */
  it('writes the province it shows to the billing address, pre-selected or not', async () => {
    const setBillingProvince = vi.fn();
    const { field } = createFieldWithContainer();

    await updateBillingStateOptions(
      createBillingCtx({ setBillingProvince }),
      'CA',
      field,
      'QC'
    );
    await updateBillingStateOptions(
      createBillingCtx({ setBillingProvince }),
      'CA',
      field,
      'ZZ'
    );

    expect(setBillingProvince.mock.calls).toEqual([['QC'], ['']]);
  });

  it('clears the billing province when the country is cleared', async () => {
    const setBillingProvince = vi.fn();
    const { field } = createFieldWithContainer();

    await updateBillingStateOptions(
      createBillingCtx({ setBillingProvince }),
      '',
      field
    );

    expect(setBillingProvince).toHaveBeenCalledWith('');
  });

  it('leaves the billing province alone when the list cannot load', async () => {
    const setBillingProvince = vi.fn();
    const { field } = createFieldWithContainer();

    await updateBillingStateOptions(
      createBillingCtx({
        setBillingProvince,
        i18nRules: createFakeI18nRules(() =>
          Promise.reject(new Error('offline'))
        ).service,
      }),
      'CA',
      field
    );

    expect(setBillingProvince).not.toHaveBeenCalled();
  });

  it('touches neither form data nor validation errors, unlike the shipping path', async () => {
    const { field } = createFieldWithContainer();
    const updateFormData = vi.fn();
    const clearError = vi.fn();
    const ctx = createBillingCtx();
    // `StateFieldsContext` has no `updateFormData`/`clearError` members at all;
    // attach spies to the object anyway to prove the module never reaches for
    // them, even under a wider object shape (e.g. if callers ever merge the
    // shipping and billing contexts).
    (ctx as unknown as Record<string, unknown>).updateFormData = updateFormData;
    (ctx as unknown as Record<string, unknown>).clearError = clearError;

    await updateBillingStateOptions(ctx, 'CA', field);

    expect(updateFormData).not.toHaveBeenCalled();
    expect(clearError).not.toHaveBeenCalled();
  });
});

// ─── the country config cache ────────────────────────────────────────────────

// Issue #115: a billing country the shipping side never loaded had no config, and the
// postcode check passes a country it has no config for.
describe('countryConfigs', () => {
  const gbConfig = createCountryConfig({ postcodeLabel: 'Postcode' });
  const gbRules = (): ReturnType<typeof createFakeI18nRules> =>
    createFakeI18nRules(() =>
      Promise.resolve(createStatesData({ countryConfig: gbConfig, states: [] }))
    );

  it('caches the billing country config when the billing province list loads', async () => {
    const { field } = createFieldWithContainer();
    const ctx = createBillingCtx({ i18nRules: gbRules().service });

    await updateBillingStateOptions(ctx, 'GB', field);

    expect(ctx.countryConfigs.get('GB')).toBe(gbConfig);
  });

  it('loadCountryConfig fetches and caches a country with no province field to refill', async () => {
    const ctx = createBillingCtx({ i18nRules: gbRules().service });

    await expect(loadCountryConfig(ctx, 'GB')).resolves.toBe(gbConfig);
    expect(ctx.countryConfigs.get('GB')).toBe(gbConfig);
  });

  it('loadCountryConfig returns a cached config without fetching', async () => {
    const { service, getCountryStates } = gbRules();
    const ctx = createBillingCtx({
      i18nRules: service,
      countryConfigs: new Map([['GB', gbConfig]]),
    });

    await expect(loadCountryConfig(ctx, 'GB')).resolves.toBe(gbConfig);
    expect(getCountryStates).not.toHaveBeenCalled();
  });

  it('loadCountryConfig resolves undefined and caches nothing when the fetch fails', async () => {
    const ctx = createBillingCtx({
      i18nRules: createFakeI18nRules(() => Promise.reject(new Error('offline')))
        .service,
    });

    await expect(loadCountryConfig(ctx, 'GB')).resolves.toBeUndefined();
    expect(ctx.countryConfigs.has('GB')).toBe(false);
  });
});

// ─── answers arriving out of order ──────────────────────────────────────────

/** Countries answer in any order; a slow one used to land last and win. */
describe('a country answer that arrives after a newer request', () => {
  function deferredRules() {
    const pending = new Map<string, (data: CountryStatesData) => void>();
    const { service } = createFakeI18nRules(
      country =>
        new Promise<CountryStatesData>(resolve => pending.set(country, resolve))
    );
    return {
      service,
      answer: (country: string, data: CountryStatesData) =>
        pending.get(country)?.(data),
    };
  }
  const canada = createStatesData({
    states: [{ code: 'ON', name: 'Ontario' }],
  });
  const us = createStatesData({
    states: [{ code: 'NY', name: 'New York' }],
  });

  it('is dropped by the shipping list, which keeps the newer country', async () => {
    const { service, answer } = deferredRules();
    const ctx = createShippingCtx({ i18nRules: service });
    const { field } = createFieldWithContainer();

    const first = updateStateOptions(ctx, 'CA', field);
    const second = updateStateOptions(ctx, 'US', field);
    answer('US', us);
    await second;
    answer('CA', canada);
    await first;

    expect([...field.options].map(o => o.value)).toContain('NY');
    expect([...field.options].map(o => o.value)).not.toContain('ON');
    expect(field.disabled).toBe(false);
  });

  it('is dropped by the billing list, which stores nothing for it', async () => {
    const { service, answer } = deferredRules();
    const setBillingProvince = vi.fn();
    const ctx = createBillingCtx({ i18nRules: service, setBillingProvince });
    const { field } = createFieldWithContainer();

    const first = updateBillingStateOptions(ctx, 'CA', field);
    const second = updateBillingStateOptions(ctx, 'US', field, 'NY');
    answer('US', us);
    await second;
    answer('CA', canada);
    await first;

    expect(field.value).toBe('NY');
    expect(setBillingProvince.mock.calls).toEqual([['NY']]);
  });
});
