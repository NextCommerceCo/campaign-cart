import { describe, it, expect, vi, beforeEach } from 'vitest';
import { acceptUpsell } from '../accept-upsell.handlers';
import type { UpsellHandlerContext } from '../accept-upsell.types';
import { useOrderStore } from '@/state/order';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';
import { GeneralModal } from '@/shared/modals/general-modal';
import { resolveOrderTaxBasis } from '@/core/analytics/taxBasis';

vi.mock('@/state/order', () => ({ useOrderStore: { getState: vi.fn() } }));
vi.mock('@/state/campaign', () => ({ useCampaignStore: { getState: vi.fn() } }));
vi.mock('@/state/config', () => ({ useConfigStore: { getState: vi.fn() } }));
vi.mock('@/shared/modals/general-modal', () => ({
  GeneralModal: { showDuplicateUpsell: vi.fn() },
}));
vi.mock('@/utils/url-utils', () => ({ preserveQueryParams: (u: string) => u }));
vi.mock('@/core/analytics/taxBasis', () => ({ resolveOrderTaxBasis: vi.fn() }));

function mockStores(orderOverrides: Record<string, any> = {}) {
  const addUpsell = vi.fn().mockResolvedValue({
    ref_id: 'ref_1',
    lines: [
      { id: 1, is_upsell: false },
      {
        id: 99,
        is_upsell: true,
        price_incl_tax: '20.00',
        price_incl_tax_excl_discounts: '25.00',
      },
    ],
  });
  const orderState = {
    order: { lines: [{ id: 1 }] },
    completedUpsells: [] as string[],
    upsellJourney: [] as any[],
    refId: 'ref_1',
    addUpsell,
    ...orderOverrides,
  };
  (useOrderStore.getState as any).mockReturnValue(orderState);
  (useCampaignStore.getState as any).mockReturnValue({
    data: { currency: 'USD', packages: [] },
  });
  (useConfigStore.getState as any).mockReturnValue({ getCurrency: () => 'USD' });
  (resolveOrderTaxBasis as any).mockReturnValue('incl');
  return { orderState, addUpsell };
}

function makeContext(overrides: Partial<UpsellHandlerContext> = {}): UpsellHandlerContext {
  return {
    packageId: 55,
    selectorId: undefined,
    selectedItemRef: { value: null },
    quantity: 1,
    bundleSelectorId: undefined,
    bundleItemsRef: { value: null },
    nextUrl: undefined,
    apiClient: {} as any,
    loadingOverlay: { show: vi.fn(), hide: vi.fn() } as any,
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any,
    emit: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => vi.clearAllMocks());

describe('acceptUpsell', () => {
  it('adds the upsell and emits upsell:accepted with value and discount', async () => {
    const { addUpsell } = mockStores();
    const ctx = makeContext({ packageId: 55, quantity: 2 });
    await acceptUpsell(ctx);

    expect(addUpsell).toHaveBeenCalledWith(
      { lines: [{ package_id: 55, quantity: 2 }], currency: 'USD' },
      ctx.apiClient,
    );
    expect(ctx.emit).toHaveBeenCalledWith(
      'upsell:accepted',
      expect.objectContaining({
        packageId: 55,
        quantity: 2,
        orderId: 'ref_1',
        value: 20,
        discount: 5,
      }),
    );
    expect(ctx.loadingOverlay.hide).toHaveBeenCalled();
  });

  it('prefers the selected item when a selector is active', async () => {
    const { addUpsell } = mockStores();
    const ctx = makeContext({
      packageId: 55,
      selectorId: 'up',
      selectedItemRef: { value: { packageId: 88, quantity: 3 } as any },
    });
    await acceptUpsell(ctx);
    expect(addUpsell).toHaveBeenCalledWith(
      { lines: [{ package_id: 88, quantity: 3 }], currency: 'USD' },
      ctx.apiClient,
    );
  });

  it('warns and does nothing when no package id can be resolved', async () => {
    const { addUpsell } = mockStores();
    const ctx = makeContext({ packageId: undefined });
    await acceptUpsell(ctx);
    expect(ctx.logger.warn).toHaveBeenCalled();
    expect(addUpsell).not.toHaveBeenCalled();
  });

  it('errors and does nothing when no order is loaded', async () => {
    const { addUpsell } = mockStores({ order: null });
    const ctx = makeContext();
    await acceptUpsell(ctx);
    expect(ctx.logger.error).toHaveBeenCalled();
    expect(addUpsell).not.toHaveBeenCalled();
  });

  it('aborts the add when a duplicate is declined', async () => {
    const { addUpsell } = mockStores({ completedUpsells: ['55'] });
    (GeneralModal.showDuplicateUpsell as any).mockResolvedValue(false);
    const ctx = makeContext({ packageId: 55 });
    await acceptUpsell(ctx);
    expect(GeneralModal.showDuplicateUpsell).toHaveBeenCalled();
    expect(addUpsell).not.toHaveBeenCalled();
    expect(ctx.emit).not.toHaveBeenCalled();
  });

  it('hides the overlay and rethrows when the add fails', async () => {
    const { orderState } = mockStores();
    orderState.addUpsell = vi.fn().mockRejectedValue(new Error('api down'));
    (useOrderStore.getState as any).mockReturnValue(orderState);
    const ctx = makeContext();
    await expect(acceptUpsell(ctx)).rejects.toThrow('api down');
    expect(ctx.logger.error).toHaveBeenCalled();
    expect(ctx.loadingOverlay.hide).toHaveBeenCalledWith(true);
  });
});
