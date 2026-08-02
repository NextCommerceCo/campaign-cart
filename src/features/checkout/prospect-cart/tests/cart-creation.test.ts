import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { IApiClient } from '@/api/client.types';
import {
  createProspectCart,
  updateProspectCart,
  collectUtmData,
  getCurrency,
} from '../cart-creation';
import type { CartCreationContext } from '../prospect-cart.types';
import { useCartStore } from '@/state/cart';
import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';
import { useAttributionStore } from '@/state/attribution';
import type { Logger } from '@/core/logger';

vi.mock('@/state/cart', () => ({
  useCartStore: { getState: vi.fn() },
}));
vi.mock('@/state/config', () => ({
  useConfigStore: { getState: vi.fn() },
}));
vi.mock('@/state/campaign', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/state/attribution', () => ({
  useAttributionStore: { getState: vi.fn() },
}));

function createMockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function defaultStores(opts: { items?: any[]; isEmpty?: boolean } = {}) {
  const items = opts.items ?? [{ packageId: 1, quantity: 1, is_upsell: false }];
  const isEmpty = opts.isEmpty ?? items.length === 0;
  (useCartStore.getState as any).mockReturnValue({ items, isEmpty });
  (useConfigStore.getState as any).mockReturnValue({
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

function buildContainer(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

function makeContext(overrides: Partial<CartCreationContext> = {}): {
  context: CartCreationContext;
  logger: ReturnType<typeof createMockLogger>;
  createCartMock: ReturnType<typeof vi.fn>;
  emitProspectEvent: ReturnType<typeof vi.fn>;
} {
  const logger = createMockLogger();
  const createCartMock = vi
    .fn()
    .mockResolvedValue({ checkout_url: 'https://checkout.example/abc' });
  const emitProspectEvent = vi.fn();
  const apiClient: Pick<IApiClient, 'createCart'> = {
    createCart: createCartMock,
  };

  const context: CartCreationContext = {
    apiClient: apiClient as IApiClient,
    element: buildContainer(''),
    emailField: undefined,
    config: { sessionTimeout: 30 },
    logger: logger as unknown as Logger,
    prospectCartRef: { value: undefined },
    emitProspectEvent,
    getFormattedPhoneNumber: () => '',
    isValidEmail: () => true,
    isValidPhone: () => true,
    ...overrides,
  };
  return { context, logger, createCartMock, emitProspectEvent };
}

describe('createProspectCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultStores();
  });

  it('skips the API call and returns when the cart is empty', async () => {
    defaultStores({ items: [], isEmpty: true });
    const { context, createCartMock } = makeContext();

    await createProspectCart(context);

    expect(createCartMock).not.toHaveBeenCalled();
    expect(context.prospectCartRef.value).toBeUndefined();
  });

  it('is a no-op when a prospect cart already exists', async () => {
    const { context, createCartMock } = makeContext({
      prospectCartRef: {
        value: { id: 'x', prospect_id: 'x', created_at: '', expires_at: '' },
      },
    });

    await createProspectCart(context);
    expect(createCartMock).not.toHaveBeenCalled();
  });

  it('sends the built payload and stores the result with an expiry from config.sessionTimeout', async () => {
    const container = buildContainer(`
      <input data-next-checkout-field="fname" value="Jane" />
      <input data-next-checkout-field="lname" value="Doe" />
    `);
    const { context, createCartMock, emitProspectEvent } = makeContext({
      element: container,
      emailField: (() => {
        const input = document.createElement('input');
        input.value = 'user@example.com';
        return input;
      })(),
    });

    await createProspectCart(context);

    expect(createCartMock).toHaveBeenCalledTimes(1);
    const payload = createCartMock.mock.calls[0][0];
    expect(payload.user).toMatchObject({
      email: 'user@example.com',
      first_name: 'Jane',
      last_name: 'Doe',
    });
    expect(payload.currency).toBe('EUR');

    expect(context.prospectCartRef.value?.id).toBe(
      'https://checkout.example/abc'
    );
    expect(emitProspectEvent).toHaveBeenCalledWith(
      'cart-created',
      expect.any(Object)
    );
  });

  it('retries with email-only data when the first request fails and the email is valid', async () => {
    const { context, createCartMock } = makeContext({
      emailField: (() => {
        const input = document.createElement('input');
        input.value = 'user@example.com';
        return input;
      })(),
    });
    createCartMock
      .mockRejectedValueOnce(new Error('first failure'))
      .mockResolvedValueOnce({
        checkout_url: 'https://checkout.example/retry',
      });

    await createProspectCart(context);

    expect(createCartMock).toHaveBeenCalledTimes(2);
    const retryPayload = createCartMock.mock.calls[1][0];
    expect(retryPayload.attribution).toBeUndefined();
    expect(context.prospectCartRef.value?.id).toBe(
      'https://checkout.example/retry'
    );
  });

  it('does not retry and swallows the error when the email is invalid', async () => {
    const { context, createCartMock } = makeContext({
      isValidEmail: () => false,
    });
    createCartMock.mockRejectedValueOnce(new Error('first failure'));

    await expect(createProspectCart(context)).resolves.toBeUndefined();
    expect(createCartMock).toHaveBeenCalledTimes(1);
    expect(context.prospectCartRef.value).toBeUndefined();
  });
});

describe('updateProspectCart', () => {
  it('is a no-op regardless of prospectCartRef — the standard cart API has no update endpoint', async () => {
    const { context, logger } = makeContext({
      prospectCartRef: {
        value: { id: 'x', prospect_id: 'x', created_at: '', expires_at: '' },
      },
    });
    await expect(updateProspectCart(context)).resolves.toBeUndefined();
    expect(logger.debug).toHaveBeenCalledWith(
      'Prospect cart update skipped - using standard cart API'
    );
  });
});

describe('collectUtmData', () => {
  afterEach(() => sessionStorage.clear());

  it('returns an empty object when there is nothing to collect', () => {
    const logger = createMockLogger();
    expect(collectUtmData({ logger: logger as unknown as Logger })).toEqual({});
  });

  it('merges sessionStorage UTM data into the result', () => {
    sessionStorage.setItem(
      'next_utm_data',
      JSON.stringify({ utm_campaign: 'spring' })
    );
    const logger = createMockLogger();
    expect(
      collectUtmData({ logger: logger as unknown as Logger }).utm_campaign
    ).toBe('spring');
  });
});

describe('getCurrency', () => {
  beforeEach(() => defaultStores());

  it('prefers the campaign store currency over the config store', () => {
    expect(getCurrency()).toBe('EUR');
  });

  it('falls back to the config store when campaign currency is missing', () => {
    (useCampaignStore.getState as any).mockReturnValue({ currency: undefined });
    expect(getCurrency()).toBe('USD');
  });
});
