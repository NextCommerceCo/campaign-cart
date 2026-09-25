import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  builtInRules,
  fetchCountryRules,
} from '@/features/checkout/address-form/address-form.api';
import { renderLayout } from '@/features/checkout/address-form/address-form.renderer';

afterEach(() => vi.unstubAllGlobals());

const ok = (body: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body });

describe('fetchCountryRules', () => {
  it('asks for the country layout in the pinned language', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ country: 'US', address: { layout: [['country']] }, fields: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const spec = await fetchCountryRules('US', { baseUrl: 'https://addr.test' });

    expect(fetchMock).toHaveBeenCalledWith('https://addr.test/v1/countries/US?lang=en');
    expect(spec.address.layout).toEqual([['country']]);
  });

  it('honours a language the page asked for', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ country: 'TH', address: { layout: [] }, fields: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchCountryRules('TH', { baseUrl: 'https://addr.test', lang: 'th' });

    expect(fetchMock.mock.calls[0][0]).toContain('lang=th');
  });

  it('escapes the country code rather than pasting it into the path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ country: 'US', address: { layout: [] }, fields: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchCountryRules('../v1/geo', { baseUrl: 'https://addr.test' });

    expect(fetchMock.mock.calls[0][0]).toContain('%2F');
  });

  it('names the country in a non-ok response, so a log says which one failed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: 'Unavailable' }));

    await expect(fetchCountryRules('GB', { baseUrl: 'https://addr.test' })).rejects.toThrow(
      'Address layout for GB responded 503'
    );
  });

  it('rejects a body whose layout is not a list of rows', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ country: 'US', address: { layout: {} }, fields: {} })));

    await expect(fetchCountryRules('US', { baseUrl: 'https://addr.test' })).rejects.toThrow(
      'carried no address layout'
    );
  });
});

describe('builtInRules', () => {
  it('renders every field of a full address under the country it was asked for', () => {
    const container = document.createElement('div');
    const rules = builtInRules('CA');

    expect(rules.country).toBe('CA');
    expect(
      renderLayout(container, rules.address.layout, rules.fields, { form: 'shipping' })
    ).toEqual([
      'country',
      'fname',
      'lname',
      'address1',
      'address2',
      'city',
      'province',
      'postal',
      'phone',
    ]);
  });
});
