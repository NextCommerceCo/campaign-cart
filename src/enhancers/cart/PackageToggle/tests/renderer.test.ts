import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  renderToggleTemplate,
  renderToggleImage,
  renderTogglePrice,
} from '../PackageToggleEnhancer.renderer';
import type { ToggleCard } from '../PackageToggleEnhancer.types';
import { useCampaignStore } from '@/stores/campaignStore';

vi.mock('@/stores/campaignStore', () => ({
  useCampaignStore: { getState: vi.fn() },
}));
vi.mock('@/utils/currencyFormatter', () => ({
  formatCurrency: (n: number) => `$${n.toFixed(2)}`,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCard(packageId: number, quantity = 1): ToggleCard {
  const element = document.createElement('div');
  return {
    element,
    packageId,
    name: '',
    isPreSelected: false,
    isSelected: false,
    quantity,
    isSyncMode: false,
    syncPackageIds: [],
    isUpsell: false,
    stateContainer: element,
    addText: null,
    removeText: null,
    togglePrice: null,
  };
}

function mockCampaignStore(packages: any[] = []) {
  vi.mocked(useCampaignStore.getState).mockReturnValue({
    packages,
    data: { packages },
    currency: 'USD',
  } as any);
}

const logger = { debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;

// ─── renderToggleTemplate ─────────────────────────────────────────────────────

describe('renderToggleTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCampaignStore();
  });

  it('renders template with custom def fields as {toggle.*} vars', () => {
    mockCampaignStore([]);
    const template = '<div data-next-toggle-card>{toggle.name}</div>';
    const el = renderToggleTemplate(template, { packageId: 101, name: 'Widget' }, logger);

    expect(el).not.toBeNull();
    expect(el!.textContent).toBe('Widget');
  });

  it('sets data-next-package-id on the card element', () => {
    const template = '<div data-next-toggle-card></div>';
    const el = renderToggleTemplate(template, { packageId: 42 }, logger);

    expect(el!.getAttribute('data-next-package-id')).toBe('42');
  });

  it('sets data-next-selected when def.selected is true', () => {
    const template = '<div data-next-toggle-card></div>';
    const el = renderToggleTemplate(template, { packageId: 1, selected: true }, logger);

    expect(el!.getAttribute('data-next-selected')).toBe('true');
  });

  it('enriches from campaign store: name, image, price', () => {
    mockCampaignStore([{ ref_id: 5, name: 'Gadget', image: 'img.jpg', price: '9.99', price_retail: '14.99', price_retail_total: '14.99' }]);
    const template = '<div>{toggle.name} {toggle.image} {toggle.price}</div>';
    const el = renderToggleTemplate(template, { packageId: 5 }, logger);

    expect(el!.textContent).toContain('Gadget');
    expect(el!.textContent).toContain('img.jpg');
    expect(el!.textContent).toContain('9.99');
  });

  it('returns null and warns when template produces no element', () => {
    const el = renderToggleTemplate('', { packageId: 1 }, logger);

    expect(el).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('falls back to first child element when no [data-next-toggle-card] in template', () => {
    const template = '<div class="my-card"></div>';
    const el = renderToggleTemplate(template, { packageId: 7 }, logger);

    expect(el).not.toBeNull();
    expect(el!.classList.contains('my-card')).toBe(true);
  });
});

// ─── renderToggleImage ────────────────────────────────────────────────────────

describe('renderToggleImage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sets src on [data-next-toggle-image] img elements', () => {
    mockCampaignStore([{ ref_id: 10, image: 'product.jpg', name: 'Prod' }]);
    const card = makeCard(10);
    const img = document.createElement('img');
    img.setAttribute('data-next-toggle-image', '');
    card.element.appendChild(img);

    renderToggleImage(card);

    expect(img.src).toContain('product.jpg');
  });

  it('sets alt from package name when img has no alt', () => {
    mockCampaignStore([{ ref_id: 10, image: 'product.jpg', name: 'Cool Product' }]);
    const card = makeCard(10);
    const img = document.createElement('img');
    img.setAttribute('data-next-toggle-image', '');
    card.element.appendChild(img);

    renderToggleImage(card);

    expect(img.alt).toBe('Cool Product');
  });

  it('no-op when no [data-next-toggle-image] slots', () => {
    mockCampaignStore([{ ref_id: 10, image: 'img.jpg', name: 'P' }]);
    const card = makeCard(10);

    // Should not throw
    expect(() => renderToggleImage(card)).not.toThrow();
  });

  it('no-op when package has no image', () => {
    mockCampaignStore([{ ref_id: 10, image: '', name: 'P' }]);
    const card = makeCard(10);
    const img = document.createElement('img');
    img.setAttribute('data-next-toggle-image', '');
    card.element.appendChild(img);

    renderToggleImage(card);

    expect(img.src).toBe('');
  });
});

// ─── renderTogglePrice ────────────────────────────────────────────────────────

describe('renderTogglePrice', () => {
  beforeEach(() => vi.clearAllMocks());

  function makeLine(overrides: Partial<{
    package_price: string;
    original_package_price: string;
    subtotal: string;
    total: string;
    total_discount: string;
    price_recurring_total: string | null;
  }> = {}) {
    return {
      package_id: 101,
      package_price: '8.00',
      original_package_price: '10.00',
      subtotal: '10.00',
      total: '8.00',
      total_discount: '2.00',
      price_recurring_total: null,
      ...overrides,
    } as any;
  }

  it('renders total price into default slot', () => {
    mockCampaignStore([]);
    const card = makeCard(101);
    const slot = document.createElement('span');
    slot.setAttribute('data-next-toggle-price', '');
    card.element.appendChild(slot);

    renderTogglePrice(card, makeLine());

    expect(slot.textContent).toBe('$8.00');
  });

  it('renders original price into originalPrice slot', () => {
    mockCampaignStore([]);
    const card = makeCard(101);
    const slot = document.createElement('span');
    slot.setAttribute('data-next-toggle-price', 'originalPrice');
    card.element.appendChild(slot);

    renderTogglePrice(card, makeLine());

    expect(slot.textContent).toBe('$10.00');
  });

  it('renders discount amount into discountAmount slot', () => {
    mockCampaignStore([]);
    const card = makeCard(101);
    const slot = document.createElement('span');
    slot.setAttribute('data-next-toggle-price', 'discountAmount');
    card.element.appendChild(slot);

    renderTogglePrice(card, makeLine({ total: '8.00', subtotal: '10.00', total_discount: '2.00' }));

    expect(slot.textContent).toBe('$2.00');
  });

  it('renders discount percentage into discountPercentage slot', () => {
    mockCampaignStore([]);
    const card = makeCard(101);
    const slot = document.createElement('span');
    slot.setAttribute('data-next-toggle-price', 'discountPercentage');
    card.element.appendChild(slot);

    // 2 / 10 * 100 = 20%
    renderTogglePrice(card, makeLine({ total: '8.00', subtotal: '10.00', total_discount: '2.00' }));

    expect(slot.textContent).toBe('20%');
  });

  it('stores computed price state on card.togglePrice', () => {
    mockCampaignStore([]);
    const card = makeCard(101);

    renderTogglePrice(card, makeLine({ total: '8.00', subtotal: '10.00', total_discount: '2.00' }));

    expect(card.togglePrice?.price).toBe(8);
    expect(card.togglePrice?.originalPrice).toBe(10);
    expect(card.togglePrice?.discountAmount).toBe(2);
    expect(card.togglePrice?.hasDiscount).toBe(true);
  });

  it('dispatches toggle:price-updated event with packageId', () => {
    mockCampaignStore([]);
    const card = makeCard(101);
    const listener = vi.fn();
    card.element.addEventListener('toggle:price-updated', listener);

    renderTogglePrice(card, makeLine());

    expect(listener).toHaveBeenCalledOnce();
    const event = listener.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ packageId: 101 });
  });

  it('uses line.total directly (qty baked in by price.ts)', () => {
    mockCampaignStore([]);
    const card = makeCard(101, 3);
    const slot = document.createElement('span');
    slot.setAttribute('data-next-toggle-price', '');
    card.element.appendChild(slot);

    // price.ts passes card.quantity to the API, so line.total already reflects qty=3
    renderTogglePrice(card, makeLine({ package_price: '5.00', total: '15.00', subtotal: '30.00', total_discount: '15.00' }));

    expect(slot.textContent).toBe('$15.00');
  });
});
