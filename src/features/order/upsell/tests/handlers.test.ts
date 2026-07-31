import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addUpsellToOrder } from '../upsell.handlers';
import type { UpsellHandlerContext } from '../upsell.types';
import { useOrderStore } from '@/state/order';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';

vi.mock('@/state/order', () => ({
  useOrderStore: { getState: vi.fn() },
}));
vi.mock('@/state/campaign', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/state/config', () => ({
  useConfigStore: { getState: vi.fn() },
}));
vi.mock('../upsell.renderer', () => ({
  renderProcessingState: vi.fn(),
  renderSuccess: vi.fn(),
  renderError: vi.fn(),
}));
vi.mock('@/core/ui/general-modal', () => ({
  GeneralModal: { showDuplicateUpsell: vi.fn().mockResolvedValue(true) },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOrderStore(overrides: Record<string, any> = {}) {
  const addUpsell = vi.fn().mockResolvedValue({ ref_id: 'ord-1', lines: [] });
  const mock = {
    order: { ref_id: 'ord-1', supports_post_purchase_upsells: true, lines: [] },
    isProcessingUpsell: false,
    completedUpsells: [],
    upsellJourney: [],
    canAddUpsells: vi.fn().mockReturnValue(true),
    addUpsell,
    setProcessingUpsell: vi.fn(),
    markUpsellPageViewed: vi.fn(),
    ...overrides,
  };
  vi.mocked(useOrderStore.getState).mockReturnValue(mock as any);
  return mock;
}

function makeCtx(overrides: Partial<UpsellHandlerContext> = {}): UpsellHandlerContext {
  return {
    isProcessingRef: { value: false },
    element: document.createElement('div'),
    packageId: 1,
    isSelector: false,
    selectedPackageId: undefined,
    selectorId: undefined,
    quantity: 1,
    quantityBySelectorId: new Map(),
    currentQuantitySelectorId: undefined,
    actionButtons: [],
    loadingOverlay: { show: vi.fn(), hide: vi.fn() } as any,
    apiClient: {} as any,
    bundleItems: null,
    bundleVouchers: [],
    defaultProperties: undefined,
    properties: undefined,
    currentPagePath: undefined,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any,
    emit: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useCampaignStore.getState).mockReturnValue({ currency: 'USD' } as any);
  vi.mocked(useConfigStore.getState).mockReturnValue({ getCurrency: () => 'USD' } as any);
});

// ─── canAddUpsells guard ──────────────────────────────────────────────────────

describe('addUpsellToOrder — canAddUpsells guard', () => {
  it('does not call addUpsell when order does not support upsells', async () => {
    const store = makeOrderStore({ canAddUpsells: vi.fn().mockReturnValue(false) });

    await addUpsellToOrder(null, makeCtx());

    expect(store.addUpsell).not.toHaveBeenCalled();
  });

  it('does not call addUpsell when no package selected and no bundle items', async () => {
    makeOrderStore();

    await addUpsellToOrder(null, makeCtx({ packageId: undefined, bundleItems: null }));

    expect(useOrderStore.getState().addUpsell).not.toHaveBeenCalled();
  });
});

// ─── Non-bundle path — properties ────────────────────────────────────────────

describe('addUpsellToOrder — non-bundle path', () => {
  it('sends properties on the single line when ctx.properties is set', async () => {
    const store = makeOrderStore();
    const props = { 'player-number': '7', 'team-name': 'Lions' };

    await addUpsellToOrder(null, makeCtx({ packageId: 10, properties: props }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(payload.lines).toHaveLength(1);
    expect(payload.lines[0]).toEqual({ package_id: 10, quantity: 1, properties: props });
  });

  it('omits properties key when ctx.properties is undefined', async () => {
    const store = makeOrderStore();

    await addUpsellToOrder(null, makeCtx({ packageId: 10, properties: undefined }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(payload.lines[0], 'properties')).toBe(false);
  });

  it('sends currency from campaignStore', async () => {
    const store = makeOrderStore();
    vi.mocked(useCampaignStore.getState).mockReturnValue({ currency: 'EUR' } as any);

    await addUpsellToOrder(null, makeCtx({ packageId: 5 }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(payload.currency).toBe('EUR');
  });
});

// ─── Bundle path — properties ─────────────────────────────────────────────────

describe('addUpsellToOrder — bundle path', () => {
  it('sends per-slot properties on each line', async () => {
    const store = makeOrderStore();
    const bundleItems = [
      { packageId: 1, quantity: 1, properties: { 'player-number': '7' } },
      { packageId: 2, quantity: 1, properties: { 'player-number': '9' } },
    ];

    await addUpsellToOrder(null, makeCtx({ packageId: undefined, bundleItems }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(payload.lines).toHaveLength(2);
    expect(payload.lines[0]).toMatchObject({ package_id: 1, quantity: 1, properties: { 'player-number': '7' } });
    expect(payload.lines[1]).toMatchObject({ package_id: 2, quantity: 1, properties: { 'player-number': '9' } });
  });

  it('merges defaultProperties onto every bundle line', async () => {
    const store = makeOrderStore();
    const bundleItems = [
      { packageId: 1, quantity: 1, properties: { 'player-number': '7' } },
      { packageId: 2, quantity: 1, properties: { 'player-number': '9' } },
    ];
    const defaultProperties = { 'team-name': 'Lions' };

    await addUpsellToOrder(null, makeCtx({ packageId: undefined, bundleItems, defaultProperties }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(payload.lines[0].properties).toEqual({ 'player-number': '7', 'team-name': 'Lions' });
    expect(payload.lines[1].properties).toEqual({ 'player-number': '9', 'team-name': 'Lions' });
  });

  it('slot properties override defaultProperties on key conflict', async () => {
    const store = makeOrderStore();
    const bundleItems = [
      { packageId: 1, quantity: 1, properties: { color: 'red' } },
    ];
    const defaultProperties = { color: 'blue', size: 'M' };

    await addUpsellToOrder(null, makeCtx({ packageId: undefined, bundleItems, defaultProperties }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(payload.lines[0].properties).toEqual({ color: 'red', size: 'M' });
  });

  it('omits properties key when both slot and defaultProperties are empty', async () => {
    const store = makeOrderStore();
    const bundleItems = [{ packageId: 1, quantity: 1 }];

    await addUpsellToOrder(null, makeCtx({ packageId: undefined, bundleItems, defaultProperties: {} }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(payload.lines[0], 'properties')).toBe(false);
  });

  it('includes only defaultProperties when slot has no properties', async () => {
    const store = makeOrderStore();
    const bundleItems = [{ packageId: 1, quantity: 1 }];
    const defaultProperties = { 'order-note': 'urgent' };

    await addUpsellToOrder(null, makeCtx({ packageId: undefined, bundleItems, defaultProperties }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(payload.lines[0].properties).toEqual({ 'order-note': 'urgent' });
  });

  it('includes bundle vouchers when present', async () => {
    const store = makeOrderStore();
    const bundleItems = [{ packageId: 1, quantity: 1 }];

    await addUpsellToOrder(
      null,
      makeCtx({ packageId: undefined, bundleItems, bundleVouchers: ['SAVE10'] }),
    );

    const [payload] = store.addUpsell.mock.calls[0];
    expect(payload.vouchers).toEqual(['SAVE10']);
  });

  it('omits vouchers key when bundleVouchers is empty', async () => {
    const store = makeOrderStore();
    const bundleItems = [{ packageId: 1, quantity: 1 }];

    await addUpsellToOrder(null, makeCtx({ packageId: undefined, bundleItems, bundleVouchers: [] }));

    const [payload] = store.addUpsell.mock.calls[0];
    expect(Object.prototype.hasOwnProperty.call(payload, 'vouchers')).toBe(false);
  });
});
