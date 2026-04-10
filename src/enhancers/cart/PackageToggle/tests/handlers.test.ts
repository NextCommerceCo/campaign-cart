import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  autoAddedPackages,
  handleCardClick,
  addToCart,
  updateSyncedQuantity,
  handleSyncUpdate,
} from '../PackageToggleEnhancer.handlers';
import type { ToggleHandlerContext } from '../PackageToggleEnhancer.handlers';
import type { ToggleCard } from '../PackageToggleEnhancer.types';
import type { CartItem, CartState } from '@/types/global';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useOrderStore } from '@/stores/orderStore';
import { useConfigStore } from '@/stores/configStore';

vi.mock('@/stores/cartStore', () => ({
  useCartStore: { getState: vi.fn() },
}));
vi.mock('@/stores/campaignStore', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/stores/orderStore', () => ({
  useOrderStore: { getState: vi.fn() },
}));
vi.mock('@/stores/configStore', () => ({
  useConfigStore: { getState: vi.fn() },
}));
vi.mock('@/api/client', () => ({ ApiClient: vi.fn() }));
vi.mock('@/utils/url-utils', () => ({
  preserveQueryParams: (url: string) => url,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(packageId: number, overrides: Partial<ToggleCard> = {}): ToggleCard {
  const element = document.createElement('div');
  element.setAttribute('data-next-package-id', String(packageId));
  return {
    element,
    packageId,
    isPreSelected: false,
    quantity: 1,
    isSyncMode: false,
    syncPackageIds: [],
    isUpsell: false,
    stateContainer: element,
    addText: null,
    removeText: null,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<ToggleHandlerContext> = {}): ToggleHandlerContext {
  return {
    logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() } as any,
    emit: vi.fn(),
    autoAddInProgress: new Set(),
    isUpsellContext: false,
    isProcessingRef: { value: false },
    containerElement: document.createElement('div'),
    ...overrides,
  };
}

function makeCartItem(packageId: number, quantity = 1, extras: Partial<CartItem> = {}): CartItem {
  return {
    id: packageId,
    packageId,
    quantity,
    price: 10,
    image: undefined,
    title: `pkg-${packageId}`,
    sku: undefined,
    is_upsell: false,
    ...extras,
  };
}

function mockCartStore(
  items: CartItem[] = [],
  addItem = vi.fn().mockResolvedValue(undefined),
  removeItem = vi.fn().mockResolvedValue(undefined),
  updateQuantity = vi.fn().mockResolvedValue(undefined),
) {
  vi.mocked(useCartStore.getState).mockReturnValue({
    items,
    addItem,
    removeItem,
    updateQuantity,
    swapInProgress: false,
    summary: null,
  } as any);
  return { addItem, removeItem, updateQuantity };
}

function mockCampaignStore(packages: any[] = []) {
  vi.mocked(useCampaignStore.getState).mockReturnValue({
    packages,
    currency: 'USD',
    data: null,
  } as any);
}

function mockOrderStore(canAddUpsells = false, addUpsell = vi.fn().mockResolvedValue(null)) {
  vi.mocked(useOrderStore.getState).mockReturnValue({
    canAddUpsells: () => canAddUpsells,
    addUpsell,
    order: { ref_id: 'order-1' },
  } as any);
  return { addUpsell };
}

// ─── handleCardClick — normal context ────────────────────────────────────────

describe('handleCardClick — normal context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignStore();
  });

  it('adds to cart when package is not in cart', async () => {
    const { addItem } = mockCartStore([]);
    const card = makeCard(101);
    const ctx = makeCtx();
    const event = new Event('click');

    await handleCardClick(event, card, ctx);

    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({ packageId: 101 }));
    expect(ctx.emit).toHaveBeenCalledWith('toggle:toggled', { packageId: 101, added: true });
  });

  it('removes from cart when package is already in cart', async () => {
    const { removeItem } = mockCartStore([makeCartItem(101)]);
    const card = makeCard(101);
    const ctx = makeCtx();
    const event = new Event('click');

    await handleCardClick(event, card, ctx);

    expect(removeItem).toHaveBeenCalledWith(101);
    expect(ctx.emit).toHaveBeenCalledWith('toggle:toggled', { packageId: 101, added: false });
  });

  it('sets and clears next-loading class', async () => {
    mockCartStore([]);
    const card = makeCard(101);
    const ctx = makeCtx();
    const event = new Event('click');

    await handleCardClick(event, card, ctx);

    expect(card.element.classList.contains('next-loading')).toBe(false);
    expect(card.element.getAttribute('data-next-loading')).toBe('false');
  });

  it('logs error and removes loading class on failure', async () => {
    vi.mocked(useCartStore.getState).mockReturnValue({
      items: [],
      addItem: vi.fn().mockRejectedValue(new Error('network fail')),
      swapInProgress: false,
      summary: null,
    } as any);
    const card = makeCard(101);
    const ctx = makeCtx();

    await handleCardClick(new Event('click'), card, ctx);

    expect(ctx.logger.error).toHaveBeenCalled();
    expect(card.element.classList.contains('next-loading')).toBe(false);
  });

  it('skips add for sync card when no synced packages in cart', async () => {
    const { addItem } = mockCartStore([]);
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101], quantity: 0 });
    const ctx = makeCtx();

    await handleCardClick(new Event('click'), card, ctx);

    expect(addItem).not.toHaveBeenCalled();
    expect(ctx.logger.warn).toHaveBeenCalled();
    expect(card.element.classList.contains('next-loading')).toBe(false);
  });

  it('allows removal of sync card even when synced packages are gone', async () => {
    const { removeItem } = mockCartStore([makeCartItem(200)]);
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101], quantity: 0 });
    const ctx = makeCtx();

    await handleCardClick(new Event('click'), card, ctx);

    expect(removeItem).toHaveBeenCalledWith(200);
  });
});

// ─── handleCardClick — upsell context ────────────────────────────────────────

describe('handleCardClick — upsell context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignStore();
    vi.mocked(useConfigStore.getState).mockReturnValue({
      apiKey: 'test-key',
      selectedCurrency: 'USD',
    } as any);
  });

  it('does nothing when isProcessingRef is true', async () => {
    const { addUpsell } = mockOrderStore(true);
    const card = makeCard(101);
    const ctx = makeCtx({ isUpsellContext: true, isProcessingRef: { value: true } });

    await handleCardClick(new Event('click'), card, ctx);

    expect(addUpsell).not.toHaveBeenCalled();
  });

  it('warns and skips upsell when canAddUpsells is false', async () => {
    mockOrderStore(false);
    const card = makeCard(101);
    const ctx = makeCtx({ isUpsellContext: true });

    await handleCardClick(new Event('click'), card, ctx);

    expect(ctx.logger.warn).toHaveBeenCalled();
  });

  it('calls orderStore.addUpsell and emits upsell:added on success', async () => {
    const fakeOrder = { ref_id: 'order-1' };
    const { addUpsell } = mockOrderStore(true, vi.fn().mockResolvedValue(fakeOrder));
    const card = makeCard(101);
    const ctx = makeCtx({ isUpsellContext: true });

    await handleCardClick(new Event('click'), card, ctx);

    expect(addUpsell).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [{ package_id: 101, quantity: 1 }] }),
      expect.anything(),
    );
    expect(ctx.emit).toHaveBeenCalledWith('upsell:added', expect.objectContaining({ packageId: 101 }));
    expect(ctx.emit).toHaveBeenCalledWith('toggle:toggled', { packageId: 101, added: true });
  });

  it('logs error and clears loading on failure', async () => {
    mockOrderStore(true, vi.fn().mockRejectedValue(new Error('fail')));
    const card = makeCard(101);
    const ctx = makeCtx({ isUpsellContext: true });

    await handleCardClick(new Event('click'), card, ctx);

    expect(ctx.logger.error).toHaveBeenCalled();
    expect(card.element.classList.contains('next-loading')).toBe(false);
  });
});

// ─── addToCart ────────────────────────────────────────────────────────────────

describe('addToCart', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds item with package name from campaign store', async () => {
    mockCampaignStore([{ ref_id: 101, name: 'Widget', price: '9.99' }]);
    const { addItem } = mockCartStore();
    const card = makeCard(101, { quantity: 2, isUpsell: false });

    await addToCart(card);

    expect(addItem).toHaveBeenCalledWith({
      packageId: 101,
      quantity: 2,
      title: 'Widget',
      price: 9.99,
      isUpsell: false,
    });
  });

  it('falls back to generic title when package not in campaign store', async () => {
    mockCampaignStore([]);
    const { addItem } = mockCartStore();
    const card = makeCard(999);

    await addToCart(card);

    expect(addItem).toHaveBeenCalledWith(
      expect.objectContaining({ packageId: 999, title: 'Package 999' }),
    );
  });
});

// ─── updateSyncedQuantity ─────────────────────────────────────────────────────

describe('updateSyncedQuantity', () => {
  it('sums quantities from synced packages and updates card.quantity', () => {
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101, 102] });
    const cartState = {
      items: [makeCartItem(101, 2), makeCartItem(102, 3)],
    } as unknown as CartState;

    updateSyncedQuantity(card, cartState);

    expect(card.quantity).toBe(5);
  });

  it('scales by qty field when present', () => {
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101] });
    const cartState = {
      items: [{ ...makeCartItem(101, 1), qty: 3 }],
    } as unknown as CartState;

    updateSyncedQuantity(card, cartState);

    expect(card.quantity).toBe(3);
  });

  it('sets quantity to 0 when no synced packages in cart', () => {
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101], quantity: 5 });
    const cartState = { items: [] } as unknown as CartState;

    updateSyncedQuantity(card, cartState);

    expect(card.quantity).toBe(0);
  });

  it('no-op when syncPackageIds is empty', () => {
    const card = makeCard(200, { syncPackageIds: [], quantity: 3 });
    const cartState = { items: [] } as unknown as CartState;

    updateSyncedQuantity(card, cartState);

    expect(card.quantity).toBe(3);
  });
});

// ─── handleSyncUpdate ─────────────────────────────────────────────────────────

describe('handleSyncUpdate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('no-op when not sync mode', async () => {
    const { updateQuantity, removeItem } = mockCartStore();
    const card = makeCard(200, { isSyncMode: false });
    const cartState = { items: [] } as unknown as CartState;

    await handleSyncUpdate(card, cartState, vi.fn() as any);

    expect(updateQuantity).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('updates quantity when synced item is in cart and quantity differs', async () => {
    const { updateQuantity } = mockCartStore([makeCartItem(200, 1)]);
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101] });
    const cartState = {
      items: [makeCartItem(101, 3), makeCartItem(200, 1)],
      swapInProgress: false,
    } as unknown as CartState;

    await handleSyncUpdate(card, cartState, vi.fn() as any);

    expect(updateQuantity).toHaveBeenCalledWith(200, 3);
  });

  it('removes non-upsell sync card when no synced packages present', async () => {
    const { removeItem } = mockCartStore([makeCartItem(200, 1)]);
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101] });
    const cartState = {
      items: [makeCartItem(200, 1)],
      swapInProgress: false,
    } as unknown as CartState;

    await handleSyncUpdate(card, cartState, vi.fn() as any);

    expect(removeItem).toHaveBeenCalledWith(200);
  });

  it('skips removal when swapInProgress is true', async () => {
    const { removeItem } = mockCartStore([makeCartItem(200, 1)]);
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101] });
    const cartState = {
      items: [makeCartItem(200, 1)],
      swapInProgress: true,
    } as unknown as CartState;

    await handleSyncUpdate(card, cartState, vi.fn() as any);

    expect(removeItem).not.toHaveBeenCalled();
  });

  it('updates card.quantity to match synced total', async () => {
    mockCartStore([makeCartItem(200, 1)]);
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101, 102], quantity: 0 });
    const cartState = {
      items: [makeCartItem(101, 2), makeCartItem(102, 3), makeCartItem(200, 1)],
      swapInProgress: false,
    } as unknown as CartState;

    await handleSyncUpdate(card, cartState, vi.fn() as any);

    expect(card.quantity).toBe(5);
  });

  it('sets card.quantity to 0 when no synced packages in cart', async () => {
    mockCartStore([makeCartItem(200, 1)]);
    const card = makeCard(200, { isSyncMode: true, syncPackageIds: [101], quantity: 3 });
    const cartState = {
      items: [makeCartItem(200, 1)],
      swapInProgress: false,
    } as unknown as CartState;

    await handleSyncUpdate(card, cartState, vi.fn() as any);

    expect(card.quantity).toBe(0);
  });
});

// ─── autoAddedPackages deduplication ─────────────────────────────────────────

describe('autoAddedPackages', () => {
  it('is a module-level Set', () => {
    expect(autoAddedPackages).toBeInstanceOf(Set);
  });
});
