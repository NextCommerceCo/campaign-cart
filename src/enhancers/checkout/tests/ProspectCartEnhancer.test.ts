import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProspectCartEnhancer } from '../ProspectCartEnhancer';
import { useCartStore } from '@/stores/cartStore';
import { useConfigStore } from '@/stores/configStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useAttributionStore } from '@/stores/attributionStore';

vi.mock('@/stores/cartStore', () => ({
  useCartStore: { getState: vi.fn(), subscribe: vi.fn(() => () => {}) },
}));
vi.mock('@/stores/configStore', () => ({
  useConfigStore: { getState: vi.fn() },
}));
vi.mock('@/stores/campaignStore', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/stores/attributionStore', () => ({
  useAttributionStore: { getState: vi.fn() },
}));

const createCartMock = vi.fn();
vi.mock('@/api/client', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    createCart: createCartMock,
  })),
}));

function buildContainer(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  return container;
}

function defaultStores(opts: { items?: any[]; isEmpty?: boolean } = {}) {
  const items = opts.items ?? [
    { packageId: 1, quantity: 1, is_upsell: false, price: 10, title: 'pkg-1' },
  ];
  const isEmpty = opts.isEmpty ?? items.length === 0;

  (useCartStore.getState as any).mockReturnValue({ items, isEmpty });
  (useConfigStore.getState as any).mockReturnValue({
    apiKey: 'test-api-key',
    getCurrency: () => 'USD',
  });
  (useCampaignStore.getState as any).mockReturnValue({ currency: 'EUR' });
  (useAttributionStore.getState as any).mockReturnValue({
    getAttributionForApi: () => ({
      metadata: {
        landing_page: '',
        referrer: '',
        domain: '',
        device: '',
        timestamp: 0,
      },
      funnel: '',
    }),
  });
}

describe('ProspectCartEnhancer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
    vi.clearAllMocks();
    createCartMock.mockReset();
    createCartMock.mockResolvedValue({ checkout_url: 'https://checkout.example/abc' });
    defaultStores();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    sessionStorage.clear();
  });

  describe('initialize', () => {
    it('initializes with default config and finds email and phone fields', async () => {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" />
        <input data-next-checkout-field="phone" type="tel" />
      `);

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      expect(enhancer.getCurrentProspectCart()).toBeNull();
    });

    it('loads JSON config from data-prospect-config', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="email" type="email" />'
      );
      container.setAttribute(
        'data-prospect-config',
        JSON.stringify({ triggerOn: 'manual', autoCreate: false })
      );

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      // manual + no autoCreate means no triggers fire even with input
      const email = container.querySelector('input') as HTMLInputElement;
      email.value = 'user@example.com';
      email.dispatchEvent(new Event('change'));

      expect(createCartMock).not.toHaveBeenCalled();
    });

    it('ignores invalid JSON in data-prospect-config without throwing', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="email" type="email" />'
      );
      container.setAttribute('data-prospect-config', '{not-json');

      const enhancer = new ProspectCartEnhancer(container);
      await expect(enhancer.initialize()).resolves.toBeUndefined();
    });

    it('overrides config via data-trigger-on and data-auto-create attributes', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="email" type="email" />'
      );
      container.setAttribute('data-trigger-on', 'manual');
      container.setAttribute('data-auto-create', 'false');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      const email = container.querySelector('input') as HTMLInputElement;
      email.value = 'user@example.com';
      email.dispatchEvent(new Event('change'));

      expect(createCartMock).not.toHaveBeenCalled();
    });

    it('ignores unknown trigger-on values and keeps the default', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="email" type="email" />'
      );
      container.setAttribute('data-trigger-on', 'bogus');

      const enhancer = new ProspectCartEnhancer(container);
      await expect(enhancer.initialize()).resolves.toBeUndefined();
    });

    it('restores existing prospect cart from sessionStorage when not expired', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      sessionStorage.setItem(
        'next_prospect_cart',
        JSON.stringify({ id: 'prev', expires_at: future })
      );

      const container = buildContainer('<input type="email" />');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      expect(enhancer.getCurrentProspectCart()).toMatchObject({ id: 'prev' });
    });

    it('removes expired prospect cart from sessionStorage on initialize', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      sessionStorage.setItem(
        'next_prospect_cart',
        JSON.stringify({ id: 'old', expires_at: past })
      );

      const container = buildContainer('<input type="email" />');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      expect(enhancer.getCurrentProspectCart()).toBeNull();
      expect(sessionStorage.getItem('next_prospect_cart')).toBeNull();
    });

    it('removes malformed prospect cart JSON from sessionStorage', async () => {
      sessionStorage.setItem('next_prospect_cart', 'not json');
      const container = buildContainer('<input type="email" />');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      expect(sessionStorage.getItem('next_prospect_cart')).toBeNull();
    });
  });

  describe('update', () => {
    it('merges new config and re-runs setupTriggers', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="email" type="email" />'
      );
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      enhancer.update({ config: { triggerOn: 'manual', autoCreate: false } });

      const email = container.querySelector('input') as HTMLInputElement;
      email.value = 'user@example.com';
      email.dispatchEvent(new Event('change'));

      expect(createCartMock).not.toHaveBeenCalled();
    });

    it('is a no-op when called without data', async () => {
      const container = buildContainer('<input type="email" />');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      expect(() => enhancer.update()).not.toThrow();
    });
  });

  describe('email validation (isValidEmail)', () => {
    let enhancer: ProspectCartEnhancer;
    beforeEach(async () => {
      enhancer = new ProspectCartEnhancer(buildContainer('<input type="email" />'));
      await enhancer.initialize();
    });

    const valid = [
      'user@example.com',
      'user.name@example.co.uk',
      'user+tag@example.co',
      'a@b.io',
    ];
    const invalid = [
      '',
      'plain',
      'no-at-sign.com',
      'user@example',
      'user@example.c',
      'user..name@example.com',
      '.user@example.com',
      'user@.example.com',
      'user@example..com',
      'test@test....com',
    ];

    it.each(valid)('accepts %s', (email) => {
      expect((enhancer as any).isValidEmail(email)).toBe(true);
    });

    it.each(invalid)('rejects %s', (email) => {
      expect((enhancer as any).isValidEmail(email)).toBe(false);
    });
  });

  describe('name validation (isValidName)', () => {
    let enhancer: ProspectCartEnhancer;
    beforeEach(async () => {
      enhancer = new ProspectCartEnhancer(buildContainer('<input type="email" />'));
      await enhancer.initialize();
    });

    it('accepts simple names', () => {
      expect((enhancer as any).isValidName('Jane')).toBe(true);
      expect((enhancer as any).isValidName("O'Connor")).toBe(true);
      expect((enhancer as any).isValidName('Mary-Jane')).toBe(true);
      expect((enhancer as any).isValidName('José')).toBe(true);
      expect((enhancer as any).isValidName('Jean Luc')).toBe(true);
    });

    it('rejects empty, too-short, or invalid characters', () => {
      expect((enhancer as any).isValidName('')).toBe(false);
      expect((enhancer as any).isValidName('A')).toBe(false);
      expect((enhancer as any).isValidName('  ')).toBe(false);
      expect((enhancer as any).isValidName('John123')).toBe(false);
      expect((enhancer as any).isValidName('John@Doe')).toBe(false);
    });
  });

  describe('phone validation (isValidPhone)', () => {
    it('returns false for empty or whitespace-only input', async () => {
      const enhancer = new ProspectCartEnhancer(
        buildContainer('<input type="tel" />')
      );
      await enhancer.initialize();
      expect((enhancer as any).isValidPhone('')).toBe(false);
      expect((enhancer as any).isValidPhone('   ')).toBe(false);
    });

    it('uses intlTelInput.isValidNumber when available', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="phone" type="tel" />'
      );
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      const phoneField = container.querySelector('input') as any;
      phoneField.iti = { isValidNumber: vi.fn().mockReturnValue(true) };

      expect((enhancer as any).isValidPhone('+15551234567')).toBe(true);
      expect(phoneField.iti.isValidNumber).toHaveBeenCalled();
    });

    it('falls back to digit count when intlTelInput is unavailable', async () => {
      const enhancer = new ProspectCartEnhancer(
        buildContainer('<input type="tel" />')
      );
      await enhancer.initialize();
      expect((enhancer as any).isValidPhone('555-12')).toBe(false);
      expect((enhancer as any).isValidPhone('555-123-4567')).toBe(true);
    });

    it('falls back to digit count when intlTelInput throws', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="phone" type="tel" />'
      );
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      const phoneField = container.querySelector('input') as any;
      phoneField.iti = {
        isValidNumber: vi.fn().mockImplementation(() => {
          throw new Error('boom');
        }),
      };

      expect((enhancer as any).isValidPhone('555-123-4567')).toBe(true);
    });
  });

  describe('getFormattedPhoneNumber', () => {
    it('returns empty string when no phone field is present', async () => {
      const enhancer = new ProspectCartEnhancer(buildContainer('<div></div>'));
      await enhancer.initialize();
      expect((enhancer as any).getFormattedPhoneNumber()).toBe('');
    });

    it('returns E.164 number from intlTelInput when available', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="phone" type="tel" />'
      );
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      const phone = container.querySelector('input') as any;
      phone.iti = { getNumber: vi.fn().mockReturnValue('+15551234567') };

      expect((enhancer as any).getFormattedPhoneNumber()).toBe('+15551234567');
    });

    it('falls back to raw input value when intlTelInput is not initialized', async () => {
      const container = buildContainer(
        '<input data-next-checkout-field="phone" type="tel" />'
      );
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      const phone = container.querySelector('input') as HTMLInputElement;
      phone.value = '5551234567';
      expect((enhancer as any).getFormattedPhoneNumber()).toBe('5551234567');
    });
  });

  describe('getCurrency', () => {
    it('prefers campaign store currency over config store', async () => {
      const enhancer = new ProspectCartEnhancer(buildContainer('<div></div>'));
      await enhancer.initialize();
      expect((enhancer as any).getCurrency()).toBe('EUR');
    });

    it('falls back to config store getCurrency() when campaign currency is missing', async () => {
      (useCampaignStore.getState as any).mockReturnValue({ currency: undefined });
      const enhancer = new ProspectCartEnhancer(buildContainer('<div></div>'));
      await enhancer.initialize();
      expect((enhancer as any).getCurrency()).toBe('USD');
    });
  });

  describe('collectUtmData', () => {
    it('extracts UTM params from current URL and persists them to sessionStorage', async () => {
      const originalLocation = window.location;
      // happy-dom allows reassigning location via search string
      Object.defineProperty(window, 'location', {
        value: { ...originalLocation, search: '?utm_source=google&utm_medium=cpc' },
        writable: true,
      });

      const enhancer = new ProspectCartEnhancer(buildContainer('<div></div>'));
      await enhancer.initialize();

      const utm = (enhancer as any).collectUtmData();
      expect(utm).toMatchObject({ utm_source: 'google', utm_medium: 'cpc' });
      expect(JSON.parse(sessionStorage.getItem('next_utm_data')!)).toMatchObject({
        utm_source: 'google',
      });

      Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
    });

    it('merges stored UTM data with URL params', async () => {
      sessionStorage.setItem(
        'next_utm_data',
        JSON.stringify({ utm_campaign: 'spring' })
      );
      const enhancer = new ProspectCartEnhancer(buildContainer('<div></div>'));
      await enhancer.initialize();
      const utm = (enhancer as any).collectUtmData();
      expect(utm.utm_campaign).toBe('spring');
    });

    it('returns empty object when no UTM data is available', async () => {
      const enhancer = new ProspectCartEnhancer(buildContainer('<div></div>'));
      await enhancer.initialize();
      expect((enhancer as any).collectUtmData()).toEqual({});
    });
  });

  describe('checkAndCreateCart - field requirements per trigger', () => {
    function makeContainer(triggerOn: string, withPhone = true) {
      const phoneInput = withPhone
        ? '<input data-next-checkout-field="phone" type="tel" />'
        : '';
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" />
        ${phoneInput}
        <input data-next-checkout-field="fname" />
        <input data-next-checkout-field="lname" />
      `);
      container.setAttribute('data-trigger-on', triggerOn);
      return container;
    }

    function setFieldValues(
      container: HTMLElement,
      values: Partial<Record<'email' | 'phone' | 'fname' | 'lname', string>>
    ) {
      for (const [key, val] of Object.entries(values)) {
        const input = container.querySelector(
          `[data-next-checkout-field="${key}"]`
        ) as HTMLInputElement | null;
        if (input) input.value = val ?? '';
      }
    }

    it('creates cart when all required fields are valid (emailEntry trigger)', async () => {
      const container = makeContainer('emailEntry');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      setFieldValues(container, {
        email: 'user@example.com',
        fname: 'Jane',
        lname: 'Doe',
      });

      enhancer.checkAndCreateCart();
      await Promise.resolve();
      await Promise.resolve();

      expect(createCartMock).toHaveBeenCalledTimes(1);
    });

    it('does not create cart when first name is missing', async () => {
      const container = makeContainer('emailEntry');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      setFieldValues(container, {
        email: 'user@example.com',
        fname: '',
        lname: 'Doe',
      });

      enhancer.checkAndCreateCart();
      await Promise.resolve();
      expect(createCartMock).not.toHaveBeenCalled();
    });

    it('does not create cart when email is invalid', async () => {
      const container = makeContainer('emailEntry');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      setFieldValues(container, {
        email: 'not-an-email',
        fname: 'Jane',
        lname: 'Doe',
      });

      enhancer.checkAndCreateCart();
      await Promise.resolve();
      expect(createCartMock).not.toHaveBeenCalled();
    });

    it('phoneEntry trigger requires phone but not email', async () => {
      const container = makeContainer('phoneEntry');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      const phone = container.querySelector(
        '[data-next-checkout-field="phone"]'
      ) as any;
      phone.iti = { isValidNumber: () => true, getNumber: () => '+15551234567' };

      setFieldValues(container, { phone: '+15551234567', fname: 'Jane', lname: 'Doe' });

      enhancer.checkAndCreateCart();
      await Promise.resolve();
      await Promise.resolve();
      expect(createCartMock).toHaveBeenCalledTimes(1);
    });

    it('blocks cart creation when an optional phone is partially typed (emailEntry trigger)', async () => {
      const container = makeContainer('emailEntry');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      const phone = container.querySelector(
        '[data-next-checkout-field="phone"]'
      ) as any;
      phone.iti = { isValidNumber: () => false, getNumber: () => '' };

      setFieldValues(container, {
        email: 'user@example.com',
        phone: '+1555',
        fname: 'Jane',
        lname: 'Doe',
      });

      enhancer.checkAndCreateCart();
      await Promise.resolve();
      await Promise.resolve();
      expect(createCartMock).not.toHaveBeenCalled();
    });

    it('emailAndPhone trigger requires both email and phone', async () => {
      const container = makeContainer('emailAndPhone');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      const phone = container.querySelector(
        '[data-next-checkout-field="phone"]'
      ) as any;
      phone.iti = { isValidNumber: () => true, getNumber: () => '+15551234567' };

      // Only email — should not create
      setFieldValues(container, {
        email: 'user@example.com',
        fname: 'Jane',
        lname: 'Doe',
      });
      enhancer.checkAndCreateCart();
      await Promise.resolve();
      expect(createCartMock).not.toHaveBeenCalled();

      // Now provide phone too
      setFieldValues(container, { phone: '+15551234567' });
      enhancer.checkAndCreateCart();
      await Promise.resolve();
      await Promise.resolve();
      expect(createCartMock).toHaveBeenCalledTimes(1);
    });

    it('does not create cart twice once hasTriggered is set', async () => {
      const container = makeContainer('emailEntry');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      setFieldValues(container, {
        email: 'user@example.com',
        fname: 'Jane',
        lname: 'Doe',
      });

      enhancer.checkAndCreateCart();
      enhancer.checkAndCreateCart();
      await Promise.resolve();
      await Promise.resolve();
      expect(createCartMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('createProspectCart', () => {
    it('does not call the API when cart is empty', async () => {
      defaultStores({ items: [], isEmpty: true });
      const container = buildContainer(
        '<input data-next-checkout-field="email" type="email" value="user@example.com" />'
      );
      container.setAttribute('data-trigger-on', 'manual');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      await enhancer.createCartManually();
      expect(createCartMock).not.toHaveBeenCalled();
      expect(enhancer.getCurrentProspectCart()).toBeNull();
    });

    it('persists prospect cart to sessionStorage with checkout_url and expiry', async () => {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" value="user@example.com" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      const result = await enhancer.createCartManually();

      expect(createCartMock).toHaveBeenCalledTimes(1);
      const callArg = createCartMock.mock.calls[0][0];
      expect(callArg.user).toMatchObject({
        email: 'user@example.com',
        first_name: 'Jane',
        last_name: 'Doe',
        language: 'en',
      });
      expect(callArg.lines).toEqual([
        { package_id: 1, quantity: 1, is_upsell: false },
      ]);
      expect(callArg.currency).toBe('EUR');
      expect(callArg.attribution.funnel).toBe('CH01');

      expect(result).toMatchObject({
        id: 'https://checkout.example/abc',
        email: 'user@example.com',
      });
      const stored = JSON.parse(sessionStorage.getItem('next_prospect_cart')!);
      expect(stored.id).toBe('https://checkout.example/abc');
    });

    it('does not create another cart when one already exists', async () => {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" value="user@example.com" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      await enhancer.createCartManually();
      await enhancer.createCartManually();
      expect(createCartMock).toHaveBeenCalledTimes(1);
    });

    it('retries with minimal data when the first request fails and email is valid', async () => {
      createCartMock
        .mockRejectedValueOnce(new Error('first failure'))
        .mockResolvedValueOnce({ checkout_url: 'https://checkout.example/retry' });

      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" value="user@example.com" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      await enhancer.createCartManually();

      expect(createCartMock).toHaveBeenCalledTimes(2);
      const retryArg = createCartMock.mock.calls[1][0];
      expect(retryArg.user).toEqual({
        email: 'user@example.com',
        first_name: '',
        last_name: '',
        language: 'en',
      });
      expect(retryArg.attribution).toBeUndefined();
      expect(enhancer.getCurrentProspectCart()?.id).toBe('https://checkout.example/retry');
    });

    it('does not retry when the email is invalid', async () => {
      createCartMock.mockRejectedValueOnce(new Error('first failure'));

      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" value="bad-email" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      await enhancer.createCartManually();

      expect(createCartMock).toHaveBeenCalledTimes(1);
      expect(enhancer.getCurrentProspectCart()).toBeNull();
    });

    it('emits next:prospect-cart-created event on successful creation', async () => {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" value="user@example.com" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      const handler = vi.fn();
      container.addEventListener('next:prospect-cart-created', handler);

      await enhancer.createCartManually();
      expect(handler).toHaveBeenCalledTimes(1);
      const detail = handler.mock.calls[0][0].detail;
      expect(detail.cart.checkout_url).toBe('https://checkout.example/abc');
    });

    it('honors accepts_marketing checkbox state when present', async () => {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" value="user@example.com" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
        <input data-next-checkout-field="accepts_marketing" type="checkbox" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      await enhancer.createCartManually();

      const callArg = createCartMock.mock.calls[0][0];
      expect(callArg.user.accepts_marketing).toBe(false);
    });

    it('defaults accepts_marketing to true when no checkbox is present', async () => {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" value="user@example.com" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      await enhancer.createCartManually();

      const callArg = createCartMock.mock.calls[0][0];
      expect(callArg.user.accepts_marketing).toBe(true);
    });
  });

  describe('updateEmail', () => {
    it('updates the email input value and triggers cart creation when valid', async () => {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      enhancer.updateEmail('user@example.com');
      const email = container.querySelector(
        '[data-next-checkout-field="email"]'
      ) as HTMLInputElement;
      expect(email.value).toBe('user@example.com');

      await Promise.resolve();
      await Promise.resolve();
      expect(createCartMock).toHaveBeenCalledTimes(1);
    });

    it('does not trigger cart creation when the email is invalid', async () => {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" />
      `);
      container.setAttribute('data-trigger-on', 'manual');

      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();

      enhancer.updateEmail('nope');
      await Promise.resolve();
      expect(createCartMock).not.toHaveBeenCalled();
    });
  });

  describe('abandonCart / convertCart', () => {
    async function setupWithCart() {
      const container = buildContainer(`
        <input data-next-checkout-field="email" type="email" value="user@example.com" />
        <input data-next-checkout-field="fname" value="Jane" />
        <input data-next-checkout-field="lname" value="Doe" />
      `);
      container.setAttribute('data-trigger-on', 'manual');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      await enhancer.createCartManually();
      return { container, enhancer };
    }

    it('abandonCart clears state, removes sessionStorage and emits event', async () => {
      const { container, enhancer } = await setupWithCart();
      const handler = vi.fn();
      container.addEventListener('next:prospect-cart-abandoned', handler);

      await enhancer.abandonCart();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem('next_prospect_cart')).toBeNull();
      expect(enhancer.getCurrentProspectCart()).toBeNull();
    });

    it('abandonCart is a no-op when no prospect cart exists', async () => {
      const enhancer = new ProspectCartEnhancer(buildContainer('<div></div>'));
      await enhancer.initialize();
      const handler = vi.fn();
      enhancer['element'].addEventListener('next:prospect-cart-abandoned', handler);
      await enhancer.abandonCart();
      expect(handler).not.toHaveBeenCalled();
    });

    it('convertCart clears state, removes sessionStorage and emits event', async () => {
      const { container, enhancer } = await setupWithCart();
      const handler = vi.fn();
      container.addEventListener('next:prospect-cart-converted', handler);

      await enhancer.convertCart();

      expect(handler).toHaveBeenCalledTimes(1);
      expect(sessionStorage.getItem('next_prospect_cart')).toBeNull();
      expect(enhancer.getCurrentProspectCart()).toBeNull();
    });

    it('convertCart is a no-op when no prospect cart exists', async () => {
      const enhancer = new ProspectCartEnhancer(buildContainer('<div></div>'));
      await enhancer.initialize();
      const handler = vi.fn();
      enhancer['element'].addEventListener('next:prospect-cart-converted', handler);
      await enhancer.convertCart();
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('field discovery selectors', () => {
    it('finds email field via os-checkout-field legacy attribute', async () => {
      const container = buildContainer('<input os-checkout-field="email" />');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      // private access for test assertion
      expect((enhancer as any).emailField).toBe(container.querySelector('input'));
    });

    it('finds email field via input[name*="email"] fallback', async () => {
      const container = buildContainer('<input name="customer_email_address" />');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      expect((enhancer as any).emailField).toBe(container.querySelector('input'));
    });

    it('finds phone field via input[type="tel"]', async () => {
      const container = buildContainer('<input type="tel" />');
      const enhancer = new ProspectCartEnhancer(container);
      await enhancer.initialize();
      expect((enhancer as any).phoneField).toBe(container.querySelector('input'));
    });
  });
});
