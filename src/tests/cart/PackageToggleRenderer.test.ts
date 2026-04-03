import { describe, it, expect, beforeEach } from 'vitest';
import { updateCardDisplayElements } from '@/enhancers/cart/PackageToggle/PackageToggleEnhancer.renderer';
import type { ToggleCard, TogglePriceSummary } from '@/enhancers/cart/PackageToggle/PackageToggleEnhancer.types';

function makeTogglePrice(overrides: Partial<TogglePriceSummary> = {}): TogglePriceSummary {
  return {
    price: 9.99,
    unitPrice: 9.99,
    originalPrice: null,
    originalUnitPrice: null,
    discountAmount: 0,
    discountPercentage: 0,
    hasDiscount: false,
    currency: 'USD',
    isRecurring: false,
    recurringPrice: null,
    interval: null,
    intervalCount: null,
    frequency: 'One time',
    ...overrides,
  };
}

function makeCard(isSelected: boolean): ToggleCard {
  const element = document.createElement('div');
  element.setAttribute('data-next-toggle-card', '');
  // data-next-selected is the pre-load marker — intentionally NOT set to the
  // live value to confirm the fix reads card.isSelected, not this attribute.
  element.setAttribute('data-next-selected', isSelected ? 'false' : 'true');

  return {
    element,
    packageId: 1,
    name: 'Test Package',
    isPreSelected: false,
    isSelected,
    quantity: 1,
    isSyncMode: false,
    syncPackageIds: [],
    isUpsell: false,
    stateContainer: element,
    addText: null,
    removeText: null,
    togglePrice: makeTogglePrice(),
  };
}

describe('updateCardDisplayElements — isSelected display slot', () => {
  describe('when card.isSelected is true', () => {
    let card: ToggleCard;
    let displayEl: HTMLElement;

    beforeEach(() => {
      card = makeCard(true);
      displayEl = document.createElement('span');
      displayEl.setAttribute('data-next-toggle-display', 'isSelected');
      card.element.appendChild(displayEl);
    });

    it('shows the element (display not none)', () => {
      updateCardDisplayElements(card);
      expect(displayEl.style.display).not.toBe('none');
    });
  });

  describe('when card.isSelected is false', () => {
    let card: ToggleCard;
    let displayEl: HTMLElement;

    beforeEach(() => {
      card = makeCard(false);
      displayEl = document.createElement('span');
      displayEl.setAttribute('data-next-toggle-display', 'isSelected');
      card.element.appendChild(displayEl);
    });

    it('hides the element (display none)', () => {
      updateCardDisplayElements(card);
      expect(displayEl.style.display).toBe('none');
    });
  });

  it('updates correctly when isSelected flips from true to false', () => {
    const card = makeCard(true);
    const displayEl = document.createElement('span');
    displayEl.setAttribute('data-next-toggle-display', 'isSelected');
    card.element.appendChild(displayEl);

    updateCardDisplayElements(card);
    expect(displayEl.style.display).not.toBe('none');

    card.isSelected = false;
    updateCardDisplayElements(card);
    expect(displayEl.style.display).toBe('none');
  });
});
