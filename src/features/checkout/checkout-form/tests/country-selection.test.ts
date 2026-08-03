import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Country, CountryService } from '@/core/country-service';
import type { Logger } from '@/core/logger';
import { useCheckoutStore } from '@/state/checkout';
import {
  applyCountryToAddressForms,
  resolveShippingCountry,
  type CountryApplicationContext,
  type CountryResolutionContext,
} from '../country-selection';
import type {
  ShippingStateFieldsContext,
  StateFieldsContext,
} from '../state-fields';

const updateStateOptions = vi.hoisted(() => vi.fn());
const updateBillingStateOptions = vi.hoisted(() => vi.fn());

vi.mock('../state-fields', () => ({
  updateStateOptions,
  updateBillingStateOptions,
}));

// Plain object rather than `Logger`, so the spies stay `Mock`s in assertions.
function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

const COUNTRIES: Country[] = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
] as Country[];

function createResolutionCtx(defaultCountry?: string): {
  ctx: CountryResolutionContext;
  logger: ReturnType<typeof createMockLogger>;
} {
  const logger = createMockLogger();
  return {
    logger,
    ctx: {
      countries: COUNTRIES,
      countryService: {
        getConfig: () => (defaultCountry ? { defaultCountry } : undefined),
      } as unknown as CountryService,
      logger: logger as unknown as Logger,
    },
  };
}

function setUrl(search: string): void {
  window.history.replaceState({}, '', `/checkout${search}`);
}

beforeEach(() => {
  sessionStorage.clear();
  setUrl('');
  updateStateOptions.mockReset();
  updateBillingStateOptions.mockReset();
  useCheckoutStore.getState().reset();
});

afterEach(() => {
  setUrl('');
});

// ─── The priority chain ───────────────────────────────────────────────────────

describe('resolveShippingCountry: which country the form opens on', () => {
  it('uses the detected country when nothing else says otherwise', () => {
    const { ctx } = createResolutionCtx();

    expect(resolveShippingCountry(ctx, 'US', undefined)).toBe('US');
  });

  it('prefers a country stored by an earlier checkout step', () => {
    const { ctx } = createResolutionCtx();

    expect(resolveShippingCountry(ctx, 'US', 'CA')).toBe('CA');
  });

  it('rejects a stored country the campaign cannot ship to, and says which', () => {
    const { ctx, logger } = createResolutionCtx();

    expect(resolveShippingCountry(ctx, 'US', 'JP')).toBe('US');
    expect(logger.warn).toHaveBeenCalledWith(
      'Stored country JP not in available countries'
    );
  });

  it('uses ?country= when nothing is stored, and remembers it for the session', () => {
    setUrl('?country=ca');
    const { ctx } = createResolutionCtx();

    expect(resolveShippingCountry(ctx, 'US', undefined)).toBe('CA');
    expect(sessionStorage.getItem('next_selected_country')).toBe('CA');
  });

  it('ignores a ?country= the campaign cannot ship to', () => {
    setUrl('?country=JP');
    const { ctx, logger } = createResolutionCtx();

    expect(resolveShippingCountry(ctx, 'US', undefined)).toBe('US');
    expect(logger.warn).toHaveBeenCalledWith(
      'Country JP from URL not in available countries'
    );
    expect(sessionStorage.getItem('next_selected_country')).toBeNull();
  });

  it('falls back to a country chosen earlier in the session', () => {
    sessionStorage.setItem('next_selected_country', 'GB');
    const { ctx } = createResolutionCtx();

    expect(resolveShippingCountry(ctx, 'US', undefined)).toBe('GB');
  });

  it('ignores a session country the campaign no longer ships to', () => {
    sessionStorage.setItem('next_selected_country', 'JP');
    const { ctx, logger } = createResolutionCtx();

    expect(resolveShippingCountry(ctx, 'US', undefined)).toBe('US');
    expect(logger.warn).toHaveBeenCalledWith(
      'Saved country JP not in available countries'
    );
  });

  // DEFECT (left as found): a stored country beats the URL outright. Once any earlier
  // step has written a country into `formData`, a link carrying `?country=CA` has no
  // effect at all and is not even remembered for the session — so a merchant's
  // country-specific landing link silently does nothing for a returning shopper.
  it('DEFECT: ?country= is ignored entirely once a country is stored', () => {
    setUrl('?country=CA');
    const { ctx } = createResolutionCtx();

    expect(resolveShippingCountry(ctx, 'US', 'GB')).toBe('GB');
    expect(sessionStorage.getItem('next_selected_country')).toBeNull();
  });

  // DEFECT (left as found): `addressConfig.defaultCountry` is read, reported in the
  // priority log as `addressConfigDefault`, and then never used as a candidate. A
  // merchant who configures a default country sees it named in the log and ignored in
  // the form.
  it('DEFECT: the configured default country is logged but never applied', () => {
    const { ctx, logger } = createResolutionCtx('GB');

    expect(resolveShippingCountry(ctx, 'US', undefined)).toBe('US');
    expect(logger.info).toHaveBeenCalledWith(
      'Shipping country selection priority check (does not affect currency):',
      expect.objectContaining({ addressConfigDefault: 'GB' })
    );
  });
});

// ─── Applying a country from outside the form ─────────────────────────────────

describe('applyCountryToAddressForms', () => {
  function createApplicationCtx(html: string): {
    ctx: CountryApplicationContext;
    logger: ReturnType<typeof createMockLogger>;
    updateFormData: ReturnType<typeof vi.fn>;
    changes: string[];
  } {
    document.body.innerHTML = `<form id="checkout">${html}</form>`;
    const form = document.getElementById('checkout') as HTMLFormElement;
    const logger = createMockLogger();
    const updateFormData = vi.fn();
    const changes: string[] = [];

    const fields = new Map<string, HTMLElement>();
    const billingFields = new Map<string, HTMLElement>();
    form.querySelectorAll('[data-field]').forEach(el => {
      const name = el.getAttribute('data-field') as string;
      el.addEventListener('change', () => changes.push(name));
      (name.startsWith('billing-') ? billingFields : fields).set(
        name,
        el as HTMLElement
      );
    });

    return {
      logger,
      updateFormData,
      changes,
      ctx: {
        logger: logger as unknown as Logger,
        fields,
        billingFields,
        updateFormData,
        shippingStateFields: {} as ShippingStateFieldsContext,
        stateFields: {} as StateFieldsContext,
      },
    };
  }

  const SELECTS =
    '<select data-field="country"><option value="US"></option><option value="CA"></option></select>' +
    '<select data-field="province"></select>';
  const BILLING_SELECTS =
    '<select data-field="billing-country"><option value="US"></option><option value="CA"></option></select>' +
    '<select data-field="billing-province"></select>';

  it('sets the shipping dropdown, stores the country and refills the provinces', async () => {
    const { ctx, updateFormData } = createApplicationCtx(SELECTS);

    await applyCountryToAddressForms(ctx, 'CA');

    expect((ctx.fields.get('country') as HTMLSelectElement).value).toBe('CA');
    expect(updateFormData).toHaveBeenCalledWith({ country: 'CA' });
    expect(updateStateOptions).toHaveBeenCalledTimes(1);
  });

  it('mirrors the country into the billing form when the page has one', async () => {
    const { ctx } = createApplicationCtx(SELECTS + BILLING_SELECTS);

    await applyCountryToAddressForms(ctx, 'CA');

    expect(
      (ctx.billingFields.get('billing-country') as HTMLSelectElement).value
    ).toBe('CA');
    expect(updateBillingStateOptions).toHaveBeenCalledTimes(1);
  });

  it('carries the shipping province across only while billing is same-as-shipping', async () => {
    useCheckoutStore.getState().setSameAsShipping(true);
    useCheckoutStore.getState().updateFormData({ province: 'ON' });
    const { ctx } = createApplicationCtx(SELECTS + BILLING_SELECTS);

    await applyCountryToAddressForms(ctx, 'CA');

    expect(updateBillingStateOptions).toHaveBeenCalledWith(
      expect.anything(),
      'CA',
      expect.anything(),
      'ON'
    );
  });

  it('does nothing to billing on a page with no billing country field', async () => {
    const { ctx } = createApplicationCtx(SELECTS);

    await applyCountryToAddressForms(ctx, 'CA');

    expect(updateBillingStateOptions).not.toHaveBeenCalled();
  });

  // DEFECT (left as found): the province list is refilled here *and* again by the change
  // handler the dispatched `change` wakes up — `applyCountrySelection` on the shipping
  // side, `routeBillingField` on the billing side. Every country change driven from
  // outside the form therefore does two state lookups per dropdown, and the shopper can
  // see the province list rebuild twice.
  it('DEFECT: dispatches a change that makes the form refill the provinces a second time', async () => {
    const { ctx, changes } = createApplicationCtx(SELECTS + BILLING_SELECTS);

    await applyCountryToAddressForms(ctx, 'CA');

    expect(changes).toEqual(['country', 'billing-country']);
    expect(updateStateOptions).toHaveBeenCalledTimes(1);
  });

  // DEFECT (left as found): unlike the shopper's own dropdown change, this path never
  // writes `next_selected_country`, so a country applied by the debug selector is
  // forgotten on the next page load — the two ways of changing country do not agree.
  it('DEFECT: does not remember the country for the session', async () => {
    const { ctx } = createApplicationCtx(SELECTS);

    await applyCountryToAddressForms(ctx, 'CA');

    expect(sessionStorage.getItem('next_selected_country')).toBeNull();
  });
});
