/**
 * Reproduces finding 24 in docs/code-findings.md: `findSelectorElement()`
 * (accept-upsell.enhancer.ts) never matches `[data-next-package-selector]` —
 * the container `PackageSelectorEnhancer` actually renders, and the one this
 * feature's own guide/get-started.md (Option B) tells authors to use. So the
 * 100ms init read whose entire job is to pick up a selection that already
 * exists always misses on correct markup, and the button's enabled state is
 * left to which of the two enhancers `AttributeScanner` initializes first.
 *
 * These tests exercise the ordering hazard directly: the selector's
 * pre-selection hook (`_getSelectedPackageId`) is already present on the
 * container — exactly as `PackageSelectorEnhancer.initialize()` leaves it —
 * before `AcceptUpsellEnhancer` runs its own init read.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { AcceptUpsellEnhancer } from '../accept-upsell.enhancer';
import { useOrderStore } from '@/state/order';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config';

vi.mock('@/state/order', () => ({
  useOrderStore: { getState: vi.fn(), subscribe: vi.fn(() => () => {}) },
}));
vi.mock('@/state/campaign', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/state/config', () => ({
  useConfigStore: { getState: vi.fn() },
}));
vi.mock('@/api/client', () => ({ ApiClient: class {} }));
vi.mock('@/core/ui/loading-overlay', () => ({
  LoadingOverlay: class {
    public show(): void {}
    public hide(_immediate?: boolean): void {}
  },
}));
vi.mock('@/core/ui/general-modal', () => ({
  GeneralModal: { showDuplicateUpsell: vi.fn().mockResolvedValue(true) },
}));
vi.mock('@/core/url-utils', () => ({ preserveQueryParams: (u: string) => u }));
vi.mock('@/core/analytics/taxBasis', () => ({
  resolveOrderTaxBasis: vi.fn().mockReturnValue('incl'),
}));

interface SubmittedPayload {
  lines: { package_id: number; quantity: number }[];
  currency: string;
}
type AddUpsell = (
  payload: SubmittedPayload,
  apiClient: unknown
) => Promise<unknown>;

let addUpsell: Mock<AddUpsell>;
let enhancers: AcceptUpsellEnhancer[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  addUpsell = vi.fn<AddUpsell>().mockResolvedValue({
    ref_id: 'ord-9',
    lines: [
      {
        id: 99,
        is_upsell: true,
        price_incl_tax: '20.00',
        price_incl_tax_excl_discounts: '20.00',
      },
    ],
  });
  vi.mocked(useOrderStore.getState).mockReturnValue({
    order: { ref_id: 'ord-9', lines: [] },
    refId: 'ord-9',
    completedUpsells: [],
    upsellJourney: [],
    canAddUpsells: () => true,
    addUpsell,
  } as unknown as ReturnType<typeof useOrderStore.getState>);
  vi.mocked(useOrderStore.subscribe).mockReturnValue(() => {});
  vi.mocked(useCampaignStore.getState).mockReturnValue({
    data: { currency: 'USD', packages: [] },
  } as unknown as ReturnType<typeof useCampaignStore.getState>);
  vi.mocked(useConfigStore.getState).mockReturnValue({
    apiKey: 'test-key',
    getCurrency: () => 'USD',
  } as unknown as ReturnType<typeof useConfigStore.getState>);
});

afterEach(() => {
  enhancers.forEach(e => e.destroy());
  enhancers = [];
  document.body.innerHTML = '';
});

/** Waits past the enhancer's 100ms selector-init read. */
function pastInitRead(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 150));
}

/** Lets a click handler's `await addUpsell(...)` chain settle. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function click(el: Element | null): void {
  if (!el) throw new Error('nothing to click');
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

/**
 * Mounts a `[data-next-package-selector]` container with one pre-selected
 * card and an accept button wired to it via `data-next-selector-id`, then
 * pre-arms the container's `_getSelectedPackageId` hook the way
 * `PackageSelectorEnhancer.initialize()` does *before* returning control to
 * the scanner — i.e. the selection already exists when
 * `AcceptUpsellEnhancer` initializes right after it.
 */
async function mountWithPreSelectedContainer(
  packageId: number
): Promise<{ button: HTMLElement; enhancer: AcceptUpsellEnhancer }> {
  document.body.innerHTML = `
    <div data-next-package-selector data-next-selector-id="upsell-pkg" data-next-upsell-context>
      <div data-next-selector-card data-next-package-id="${packageId}" data-next-selected="true"></div>
    </div>
    <button data-next-action="accept-upsell" data-next-selector-id="upsell-pkg"></button>
  `;
  const container = document.querySelector<HTMLElement>(
    '[data-next-package-selector]'
  );
  if (!container) throw new Error('test DOM has no package-selector container');
  (container as unknown as Record<string, unknown>)['_getSelectedPackageId'] =
    () => packageId;

  const button = document.querySelector<HTMLElement>(
    '[data-next-action="accept-upsell"]'
  );
  if (!button) throw new Error('test DOM has no accept-upsell button');

  const enhancer = new AcceptUpsellEnhancer(button);
  enhancers.push(enhancer);
  await enhancer.initialize();

  return { button, enhancer };
}

describe('AcceptUpsellEnhancer — selector-driven init read (finding 24)', () => {
  it('enables the button from a selection that already exists on a [data-next-package-selector] container', async () => {
    const { button } = await mountWithPreSelectedContainer(42);

    await pastInitRead();

    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.classList.contains('next-disabled')).toBe(false);
  });

  it('submits the package id read from the pre-existing selection, not just from a later click', async () => {
    const { button } = await mountWithPreSelectedContainer(42);

    await pastInitRead();

    // No card click happens here — the button must already know the
    // package id from the init read alone.
    click(button);
    await flush();

    expect(addUpsell).toHaveBeenCalledWith(
      expect.objectContaining({
        lines: [{ package_id: 42, quantity: 1 }],
      }),
      expect.anything()
    );
  });
});
