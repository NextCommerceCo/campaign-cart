import { afterEach, describe, expect, it, vi } from 'vitest';

import { useCheckoutStore } from '@/state/checkout';

import {
  applyFixedValues,
  fixedValuesPatch,
  type AppliedFixedValues,
} from '../fixed-address-values';

describe('fixedValuesPatch', () => {
  it('writes the values a country fixes into the fields that hold them', () => {
    expect(
      fixedValuesPatch({}, undefined, {
        city: 'Vatican City',
        postcode: '00120',
      })
    ).toEqual({ city: 'Vatican City', postal: '00120' });
  });

  it('takes them back out for a country that fixes nothing', () => {
    const address = { city: 'Vatican City', postal: '00120' };
    expect(
      fixedValuesPatch(address, { city: 'Vatican City', postcode: '00120' }, {})
    ).toEqual({ city: '', postal: '' });
  });

  it('leaves a value the shopper changed since', () => {
    expect(
      fixedValuesPatch({ city: 'Rome' }, { city: 'Vatican City' }, undefined)
    ).toEqual({});
  });

  it('moves from one fixed value to another', () => {
    expect(
      fixedValuesPatch(
        { city: 'Gibraltar' },
        { city: 'Gibraltar' },
        { city: 'Monaco' }
      )
    ).toEqual({ city: 'Monaco' });
  });
});

describe('applyFixedValues', () => {
  afterEach(() => useCheckoutStore.getState().reset());

  const context = (
    fixedFor: Record<string, Record<string, string> | undefined>
  ) => {
    const updateFormData = vi.fn((data: Record<string, string>) =>
      useCheckoutStore.getState().updateFormData(data)
    );
    const countryService = {
      getCountryStates: vi.fn(async (country: string) => ({
        countryConfig: { fixed: fixedFor[country] },
        states: [],
      })),
    };
    return {
      ctx: {
        countryService: countryService as never,
        logger: { debug: vi.fn(), warn: vi.fn() } as never,
        updateFormData,
      },
      updateFormData,
    };
  };

  it('writes a country’s values into the shipping address, and clears them on leaving', async () => {
    const { ctx } = context({ VA: { city: 'Vatican City' }, US: undefined });
    const applied: AppliedFixedValues = {};

    await applyFixedValues(ctx, 'shipping', 'VA', applied);
    expect(useCheckoutStore.getState().formData.city).toBe('Vatican City');

    await applyFixedValues(ctx, 'shipping', 'US', applied);
    expect(useCheckoutStore.getState().formData.city).toBe('');
  });

  it('drops an answer for a country the shopper has already moved off', async () => {
    const { ctx, updateFormData } = context({ VA: { city: 'Vatican City' } });
    const applied: AppliedFixedValues = {};

    const first = applyFixedValues(ctx, 'shipping', 'VA', applied);
    applied.country = 'US';
    await first;

    expect(updateFormData).not.toHaveBeenCalled();
  });
});
