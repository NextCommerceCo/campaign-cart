import { describe, it, expect, beforeEach } from 'vitest';
import {
  updateSyncedQuantity,
  handleSyncUpdate,
} from '@/features/cart/package-toggle/package-toggle.handlers';
import type { ToggleCard } from '@/features/cart/package-toggle/package-toggle.types';
import type { CartState, CartItem } from '@/types/global';
import { createLogger } from '@/core/logger';
import { useCartStore } from '@/state/cart';

// ─── Factories ────────────────────────────────────────────────────────────────

const logger = createLogger('test');

/** Minimal CartState with only the fields the sync functions actually read. */
function makeCartState(items: Partial<CartItem>[] = [], swapInProgress = false): CartState {
  return { items: items as CartItem[], swapInProgress } as unknown as CartState;
}

function makeSyncCard(overrides: Partial<ToggleCard> = {}): ToggleCard {
  const el = document.createElement('div');
  return {
    element: el,
    packageId: 99,
    name: 'Bump',
    image: '',
    productId: null,
    variantId: null,
    variantName: '',
    productName: '',
    sku: null,
    isPreSelected: false,
    isSelected: false,
    quantity: 0,
    isSyncMode: true,
    syncPackageIds: [],
    syncProductIds: [],
    isUpsell: false,
    stateContainer: el,
    addText: null,
    removeText: null,
    price: 5,
    unitPrice: 5,
    originalPrice: null,
    originalUnitPrice: null,
    discountAmount: 0,
    discountPercentage: 0,
    hasDiscount: false,
    currency: 'USD',
    isRecurring: false,
    recurringPrice: null,
    originalRecurringPrice: null,
    interval: null,
    intervalCount: null,
    frequency: 'One time',
    discounts: [],
    ...overrides,
  };
}

let _nextId = 1;
function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: _nextId++,
    packageId: 1,
    quantity: 1,
    price: 10,
    title: 'Package',
    image: undefined,
    sku: undefined,
    is_upsell: false,
    ...overrides,
  } as CartItem;
}

// ─── updateSyncedQuantity ─────────────────────────────────────────────────────

describe('updateSyncedQuantity', () => {
  beforeEach(() => {
    _nextId = 1;
  });

  // ── Early return ────────────────────────────────────────────────────────────

  describe('early return', () => {
    it('does not change quantity when both id lists are empty', () => {
      const card = makeSyncCard({ quantity: 5, syncPackageIds: [], syncProductIds: [] });
      updateSyncedQuantity(card, makeCartState([makeItem()]));
      expect(card.quantity).toBe(5);
    });
  });

  // ── Package sync ────────────────────────────────────────────────────────────

  describe('package sync (data-next-package-sync)', () => {
    it('counts one item matching by packageId', () => {
      const card = makeSyncCard({ syncPackageIds: [1] });
      updateSyncedQuantity(card, makeCartState([makeItem({ packageId: 1, quantity: 3 })]));
      expect(card.quantity).toBe(3);
    });

    it('sums quantities across multiple syncPackageIds', () => {
      const card = makeSyncCard({ syncPackageIds: [1, 2] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, quantity: 3 }),
        makeItem({ packageId: 2, quantity: 2 }),
      ]));
      expect(card.quantity).toBe(5);
    });

    it('matches by originalPackageId when packageId has changed', () => {
      const card = makeSyncCard({ syncPackageIds: [1] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 4, originalPackageId: 1, quantity: 3 }),
      ]));
      expect(card.quantity).toBe(3);
    });

    it('multiplies quantity by qty (units per package)', () => {
      const card = makeSyncCard({ syncPackageIds: [1] });
      // 2 packages each containing 3 units → 6 units total
      updateSyncedQuantity(card, makeCartState([makeItem({ packageId: 1, quantity: 2, qty: 3 })]));
      expect(card.quantity).toBe(6);
    });

    it('ignores items whose packageId is not in syncPackageIds', () => {
      const card = makeSyncCard({ syncPackageIds: [1] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, quantity: 2 }),
        makeItem({ packageId: 7, quantity: 10 }),
      ]));
      expect(card.quantity).toBe(2);
    });

    it('sets quantity to 0 when no matching items are in the cart', () => {
      const card = makeSyncCard({ syncPackageIds: [1], quantity: 5 });
      updateSyncedQuantity(card, makeCartState([]));
      expect(card.quantity).toBe(0);
    });

    it('does not pick up items that only match by productId', () => {
      const card = makeSyncCard({ syncPackageIds: [1] });
      // packageId is 4, originalPackageId is undefined — not matched by package-sync
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 4, productId: 55, quantity: 3 }),
      ]));
      expect(card.quantity).toBe(0);
    });
  });

  // ── Product sync ────────────────────────────────────────────────────────────

  describe('product sync (data-next-product-sync)', () => {
    it('counts a single cart line matching productId', () => {
      const card = makeSyncCard({ syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([makeItem({ packageId: 1, productId: 55, quantity: 3 })]));
      expect(card.quantity).toBe(3);
    });

    it('counts ALL variant lines sharing the same productId — core bug fix', () => {
      // Customer has qty 7 total: 6 on the original variant, 1 swapped to another.
      // Both packageIds belong to productId 55.
      const card = makeSyncCard({ syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 6 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1 }),
      ]));
      expect(card.quantity).toBe(7);
    });

    it('counts three or more variant lines correctly', () => {
      const card = makeSyncCard({ syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 3 }),
        makeItem({ packageId: 2, productId: 55, quantity: 2 }),
        makeItem({ packageId: 3, productId: 55, quantity: 1 }),
      ]));
      expect(card.quantity).toBe(6);
    });

    it('ignores items with a different productId', () => {
      const card = makeSyncCard({ syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 2 }),
        makeItem({ packageId: 2, productId: 99, quantity: 10 }),
      ]));
      expect(card.quantity).toBe(2);
    });

    it('multiplies quantity by qty for product-synced items', () => {
      const card = makeSyncCard({ syncProductIds: [55] });
      // 2 variants × 3 units each = 9 total units
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 2, qty: 3 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1, qty: 3 }),
      ]));
      expect(card.quantity).toBe(9);
    });

    it('sums across multiple productIds in syncProductIds', () => {
      const card = makeSyncCard({ syncProductIds: [55, 66] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 2 }),
        makeItem({ packageId: 5, productId: 66, quantity: 3 }),
      ]));
      expect(card.quantity).toBe(5);
    });

    it('safely ignores items with productId undefined', () => {
      const card = makeSyncCard({ syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: undefined, quantity: 99 }),
        makeItem({ packageId: 2, productId: 55, quantity: 2 }),
      ]));
      expect(card.quantity).toBe(2);
    });

    it('sets quantity to 0 when no items match any productId', () => {
      const card = makeSyncCard({ syncProductIds: [55], quantity: 7 });
      updateSyncedQuantity(card, makeCartState([makeItem({ packageId: 1, productId: 99, quantity: 5 })]));
      expect(card.quantity).toBe(0);
    });

    it('does not double-count items already covered by package sync when product sync overlaps', () => {
      // pkg 1 matches BOTH packageId-sync AND productId-sync (same product)
      // without the guard this would count pkg1 twice
      const card = makeSyncCard({ syncPackageIds: [1], syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 6 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1 }),
      ]));
      // package-sync: pkg1 → 6 (marked counted)
      // product-sync: pkg1 skipped (already counted), pkg4 → 1
      // total = 7, not 6+6+1=13
      expect(card.quantity).toBe(7);
    });

  it('does not pick up items already covered by package sync (no double-count, different products)', () => {
      // pkg 1 matches packageId-sync only (different productId)
      // pkg 4 matches productId-sync only (different packageId)
      const card = makeSyncCard({ syncPackageIds: [1], syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 77, quantity: 4 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1 }),
      ]));
      // package-sync: 4, product-sync: 1 → 5
      expect(card.quantity).toBe(5);
    });
  });

  // ── Combined modes ──────────────────────────────────────────────────────────

  describe('combined package + product sync', () => {
    it('sums package-sync total and product-sync total independently', () => {
      const card = makeSyncCard({ syncPackageIds: [10], syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 10, quantity: 3, productId: undefined }),
        makeItem({ packageId: 1, productId: 55, quantity: 2 }),
        makeItem({ packageId: 4, productId: 55, quantity: 4 }),
      ]));
      // package-sync: 3, product-sync: 6 → total 9
      expect(card.quantity).toBe(9);
    });

    it('applies qty multiplier to both sync types', () => {
      const card = makeSyncCard({ syncPackageIds: [10], syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 10, quantity: 2, qty: 2, productId: undefined }),
        makeItem({ packageId: 1, productId: 55, quantity: 1, qty: 3 }),
      ]));
      // package-sync: 2 × 2 = 4, product-sync: 1 × 3 = 3 → 7
      expect(card.quantity).toBe(7);
    });
  });

  // ── Full repro from bug report ──────────────────────────────────────────────

  describe('MV variant-swap repro — package-sync vs product-sync comparison', () => {
    it('package-sync reports 7 when all units are on the original variant', () => {
      const card = makeSyncCard({ syncPackageIds: [1] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 7 }),
      ]));
      expect(card.quantity).toBe(7);
    });

    it('package-sync undercounts to 6 after one unit is swapped — documents the regression', () => {
      // data-next-package-sync="1" only sees pkg1; swapped pkg4 is invisible
      const card = makeSyncCard({ syncPackageIds: [1] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 6 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1 }),
      ]));
      expect(card.quantity).toBe(6); // wrong — only pkg1 counted
    });

    it('product-sync reports 7 when all units are on the original variant', () => {
      const card = makeSyncCard({ syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 7 }),
      ]));
      expect(card.quantity).toBe(7);
    });

    it('product-sync still reports 7 after one unit is swapped to a different variant — the fix', () => {
      // pkg1 × 6 + pkg4 × 1 — both carry productId 55
      const card = makeSyncCard({ syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState([
        makeItem({ packageId: 1, productId: 55, quantity: 6 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1 }),
      ]));
      expect(card.quantity).toBe(7); // correct
    });

    it('product-sync still reports 7 when all 7 units are on swapped variants', () => {
      // Extreme case: 7 different variants, each quantity 1
      const items = [1, 2, 3, 4, 5, 6, 7].map(pkgId =>
        makeItem({ packageId: pkgId, productId: 55, quantity: 1 }),
      );
      const card = makeSyncCard({ syncProductIds: [55] });
      updateSyncedQuantity(card, makeCartState(items));
      expect(card.quantity).toBe(7);
    });
  });
});

// ─── handleSyncUpdate ─────────────────────────────────────────────────────────

describe('handleSyncUpdate', () => {
  beforeEach(() => {
    _nextId = 1;
    useCartStore.getState().reset();
  });

  // ── Guard conditions ────────────────────────────────────────────────────────

  it('returns without changing quantity when both id lists are empty', async () => {
    const card = makeSyncCard({
      isSyncMode: true,
      syncPackageIds: [],
      syncProductIds: [],
      quantity: 5,
    });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(5);
  });

  it('returns without changing quantity when isSyncMode is false', async () => {
    const card = makeSyncCard({ isSyncMode: false, syncProductIds: [55], quantity: 5 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(5);
  });

  // ── Package sync via store ──────────────────────────────────────────────────

  it('sets card.quantity from package-synced items in the store', async () => {
    useCartStore.setState({
      items: [makeItem({ packageId: 1, quantity: 5 })] as CartItem[],
    });
    // Bump package (99) is not in cart → no updateQuantity API call needed
    const card = makeSyncCard({ packageId: 99, syncPackageIds: [1], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(5);
  });

  it('sets card.quantity to 0 when package-synced items are absent', async () => {
    useCartStore.setState({ items: [] as CartItem[] });
    const card = makeSyncCard({ packageId: 99, syncPackageIds: [1], quantity: 7 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(0);
  });

  // ── Product sync via store ──────────────────────────────────────────────────

  it('sets card.quantity from product-synced items in the store', async () => {
    useCartStore.setState({
      items: [
        makeItem({ packageId: 1, productId: 55, quantity: 4 }),
        makeItem({ packageId: 4, productId: 55, quantity: 3 }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(7);
  });

  it('sets card.quantity to 0 when no product-synced items are in the store', async () => {
    useCartStore.setState({ items: [] as CartItem[] });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 7 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(0);
  });

  it('counts all variant lines for product sync', async () => {
    // 6 of original variant + 1 of swapped variant → should be 7
    useCartStore.setState({
      items: [
        makeItem({ packageId: 1, productId: 55, quantity: 6 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1 }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(7);
  });

  it('sets card.quantity correctly for combined package + product sync', async () => {
    useCartStore.setState({
      items: [
        makeItem({ packageId: 10, quantity: 2, productId: undefined }),
        makeItem({ packageId: 1, productId: 55, quantity: 3 }),
        makeItem({ packageId: 4, productId: 55, quantity: 2 }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncPackageIds: [10], syncProductIds: [55], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    // package-sync: 2, product-sync: 5 → 7
    expect(card.quantity).toBe(7);
  });

  // ── Sync quantity update flow ───────────────────────────────────────────────

  it('updates the cart store item quantity when bump is in cart at a different quantity', async () => {
    // Bump (pkg 99) is already in cart at qty 5 but should be 7
    useCartStore.setState({
      items: [
        makeItem({ packageId: 1, productId: 55, quantity: 6 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1 }),
        makeItem({ packageId: 99, quantity: 5, is_upsell: false }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 0 });

    await handleSyncUpdate(card, {} as CartState, logger);

    expect(card.quantity).toBe(7);
    // updateQuantity is optimistic — it updates the store directly without an API call
    const bumpItem = useCartStore.getState().items.find(i => i.packageId === 99);
    expect(bumpItem?.quantity).toBe(7);
  });

  it('does not call updateQuantity when bump is already at the correct quantity', async () => {
    useCartStore.setState({
      items: [
        makeItem({ packageId: 1, productId: 55, quantity: 7 }),
        makeItem({ packageId: 99, quantity: 7, is_upsell: false }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 0 });

    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await handleSyncUpdate(card, {} as CartState, logger);

    expect(card.quantity).toBe(7);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});

// ─── updateSyncedQuantity — additional edge cases ─────────────────────────────

describe('updateSyncedQuantity — additional edge cases', () => {
  beforeEach(() => {
    _nextId = 1;
  });

  it('treats absent qty field as 1 (default multiplier)', () => {
    const card = makeSyncCard({ syncPackageIds: [1] });
    // qty deliberately not set — should default to 1
    updateSyncedQuantity(card, makeCartState([makeItem({ packageId: 1, quantity: 4 })]));
    expect(card.quantity).toBe(4); // 4 × 1
  });

  it('contributes 0 when a matched item has quantity=0', () => {
    const card = makeSyncCard({ syncPackageIds: [1] });
    updateSyncedQuantity(card, makeCartState([makeItem({ packageId: 1, quantity: 0 })]));
    expect(card.quantity).toBe(0);
  });

  it('contributes 0 when a matched item has qty=0 (zero units per package)', () => {
    const card = makeSyncCard({ syncPackageIds: [1] });
    // 5 packages but 0 units each → 0 total units
    updateSyncedQuantity(card, makeCartState([makeItem({ packageId: 1, quantity: 5, qty: 0 })]));
    expect(card.quantity).toBe(0);
  });

  it('counts only the syncPackageIds that actually appear in the cart', () => {
    const card = makeSyncCard({ syncPackageIds: [1, 2, 3] });
    updateSyncedQuantity(card, makeCartState([
      makeItem({ packageId: 1, quantity: 4 }),
      // packageId 2 and 3 absent
    ]));
    expect(card.quantity).toBe(4);
  });

  it('counts only the syncProductIds that actually appear in the cart', () => {
    const card = makeSyncCard({ syncProductIds: [55, 66, 77] });
    updateSyncedQuantity(card, makeCartState([
      makeItem({ packageId: 1, productId: 66, quantity: 3 }),
      // productId 55 and 77 absent
    ]));
    expect(card.quantity).toBe(3);
  });

  it('returns 0 for product sync when all cart items have productId undefined', () => {
    const card = makeSyncCard({ syncProductIds: [55], quantity: 7 });
    updateSyncedQuantity(card, makeCartState([
      makeItem({ packageId: 1, productId: undefined, quantity: 3 }),
      makeItem({ packageId: 2, productId: undefined, quantity: 4 }),
    ]));
    expect(card.quantity).toBe(0);
  });

  it('the bump package being in the cart with a different productId does not skew the total', () => {
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55] });
    updateSyncedQuantity(card, makeCartState([
      makeItem({ packageId: 99, productId: 99, quantity: 5 }), // bump — different productId
      makeItem({ packageId: 1, productId: 55, quantity: 3 }),
    ]));
    expect(card.quantity).toBe(3);
  });

  it('does not double-count when the same productId appears twice in syncProductIds', () => {
    // .filter() iterates items, not syncProductIds — each item only passes once
    const card = makeSyncCard({ syncProductIds: [55, 55] });
    updateSyncedQuantity(card, makeCartState([
      makeItem({ packageId: 1, productId: 55, quantity: 3 }),
    ]));
    expect(card.quantity).toBe(3);
  });

  it('handles a mix of packageId and originalPackageId matches across multiple syncPackageIds', () => {
    const card = makeSyncCard({ syncPackageIds: [1, 2] });
    updateSyncedQuantity(card, makeCartState([
      makeItem({ packageId: 1, quantity: 4 }),                        // matches by packageId
      makeItem({ packageId: 5, originalPackageId: 2, quantity: 2 }),  // matches by originalPackageId
    ]));
    expect(card.quantity).toBe(6);
  });

  it('safely ignores items where productId is undefined — NaN coercion does not produce a false match', () => {
    // Number(undefined) = NaN; [55].includes(NaN) is false — verified here
    const card = makeSyncCard({ syncProductIds: [55] });
    updateSyncedQuantity(card, makeCartState([
      makeItem({ packageId: 1, productId: undefined, quantity: 100 }),
      makeItem({ packageId: 2, productId: 55, quantity: 2 }),
    ]));
    expect(card.quantity).toBe(2);
  });
});

// ─── handleSyncUpdate — additional edge cases ─────────────────────────────────

describe('handleSyncUpdate — additional edge cases', () => {
  beforeEach(() => {
    _nextId = 1;
    useCartStore.getState().reset();
  });

  it('applies qty multiplier to product-synced items from the store', async () => {
    useCartStore.setState({
      items: [
        makeItem({ packageId: 1, productId: 55, quantity: 2, qty: 3 }),
        makeItem({ packageId: 4, productId: 55, quantity: 1, qty: 3 }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(9); // (2 + 1) × 3
  });

  it('sums across multiple distinct productIds when all are in the store', async () => {
    useCartStore.setState({
      items: [
        makeItem({ packageId: 1, productId: 55, quantity: 3 }),
        makeItem({ packageId: 2, productId: 66, quantity: 2 }),
        makeItem({ packageId: 3, productId: 77, quantity: 1 }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55, 66, 77], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(6);
  });

  it('matches by originalPackageId through the store (package sync)', async () => {
    useCartStore.setState({
      items: [makeItem({ packageId: 4, originalPackageId: 1, quantity: 5 })] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncPackageIds: [1], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(5);
  });

  it('does not remove bump from store when swapInProgress is true and no synced items exist', async () => {
    useCartStore.setState({
      items: [makeItem({ packageId: 99, quantity: 3, is_upsell: false })] as CartItem[],
      swapInProgress: true,
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 3 });
    await handleSyncUpdate(card, {} as CartState, logger);
    // swapInProgress guard: removal is skipped
    expect(useCartStore.getState().items.some(i => i.packageId === 99)).toBe(true);
  });

  it('leaves store unchanged when bump is already at the correct synced quantity', async () => {
    useCartStore.setState({
      items: [
        makeItem({ packageId: 1, productId: 55, quantity: 7 }),
        makeItem({ packageId: 99, quantity: 7, is_upsell: false }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(7);
    // quantity was already correct — store should not have changed the bump
    expect(useCartStore.getState().items.find(i => i.packageId === 99)?.quantity).toBe(7);
  });

  it('sets card.quantity to 0 when all product-synced items leave the store', async () => {
    useCartStore.setState({ items: [] as CartItem[] });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 5 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(0);
  });

  it('processes product sync correctly when syncPackageIds is empty', async () => {
    useCartStore.setState({
      items: [makeItem({ packageId: 2, productId: 88, quantity: 4 })] as CartItem[],
    });
    const card = makeSyncCard({
      packageId: 99,
      syncPackageIds: [],
      syncProductIds: [88],
      quantity: 0,
    });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(4);
  });

  it('sums five variant lines of the same product correctly via the store', async () => {
    useCartStore.setState({
      items: [1, 2, 3, 4, 5].map(pkgId =>
        makeItem({ packageId: pkgId, productId: 55, quantity: 1 })
      ) as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(5);
  });

  it('removes non-upsell bump from the store when no synced items remain and swap is not in progress', async () => {
    useCartStore.setState({
      items: [makeItem({ packageId: 99, quantity: 3, is_upsell: false })] as CartItem[],
      swapInProgress: false,
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 3 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(useCartStore.getState().items.some(i => i.packageId === 99)).toBe(false);
    expect(card.quantity).toBe(0);
  });

  it('ignores items with productId undefined in the store when computing product sync total', async () => {
    useCartStore.setState({
      items: [
        makeItem({ packageId: 1, productId: undefined, quantity: 10 }),
        makeItem({ packageId: 2, productId: 55, quantity: 3 }),
      ] as CartItem[],
    });
    const card = makeSyncCard({ packageId: 99, syncProductIds: [55], quantity: 0 });
    await handleSyncUpdate(card, {} as CartState, logger);
    expect(card.quantity).toBe(3);
  });
});
