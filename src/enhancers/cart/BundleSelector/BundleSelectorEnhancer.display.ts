import { BaseDisplayEnhancer } from '@/enhancers/display/DisplayEnhancerCore';
import type { FormatType } from '@/enhancers/display/DisplayEnhancerTypes';
import { BundleSelectorEnhancer } from './BundleSelectorEnhancer';

const FORMAT_MAP: Record<string, FormatType> = {
  isSelected: 'boolean',
  hasDiscount: 'boolean',
  name: 'text',
  price: 'currency',
  compare: 'currency',
  originalPrice: 'currency',
  savings: 'currency',
  discountAmount: 'currency',
  savingsPercentage: 'percentage',
  discountPercentage: 'percentage',
  hasSavings: 'boolean',
  unitPrice: 'currency',
  originalUnitPrice: 'currency',
  currency: 'text',
};

export class BundleDisplayEnhancer extends BaseDisplayEnhancer {
  private selectorId?: string;
  private selectionHandler: EventListener | null = null;
  private priceHandler: EventListener | null = null;

  protected override parseDisplayAttributes(): void {
    super.parseDisplayAttributes();
    // Parse bundle.{selectorId}.{property}
    const parts = this.displayPath!.split('.');
    if (parts.length >= 3 && parts[0] === 'bundle') {
      this.selectorId = parts[1];
      this.property = parts.slice(2).join('.');
    }
  }

  protected setupStoreSubscriptions(): void {
    // Any selection change can flip isSelected across all cards
    this.selectionHandler = () => void this.updateDisplay();
    document.addEventListener('bundle:selection-changed', this.selectionHandler);

    // Price updates are filtered by selectorId
    this.priceHandler = (e: Event) => {
      const { selectorId } = (e as CustomEvent<{ selectorId: string }>).detail;
      if (selectorId === this.selectorId) void this.updateDisplay();
    };
    document.addEventListener('bundle:price-updated', this.priceHandler);
  }

  protected getPropertyValue(): unknown {
    if (!this.selectorId || !this.property) return undefined;

    const state = BundleSelectorEnhancer.getBundleState(this.selectorId);
    if (!state) return undefined;

    switch (this.property) {
      case 'isSelected':
        return state.isSelected;
      case 'name':
        return state.name;
      case 'price':
        return state.bundlePrice?.price;
      case 'originalPrice':
        return state.bundlePrice?.originalPrice;
      case 'discountAmount':
        return state.bundlePrice?.discountAmount;
      case 'discountPercentage':
        return state.bundlePrice?.discountPercentage;
      case 'hasDiscount':
        return state.bundlePrice?.hasDiscount ?? false;
      case 'unitPrice':
        return state.bundlePrice?.unitPrice;
      case 'originalUnitPrice':
        return state.bundlePrice?.originalUnitPrice;
      case 'currency':
        return state.bundlePrice?.currency;
      default:
        this.logger.warn(`Unknown bundle display property: "${this.property}"`);
        return undefined;
    }
  }

  protected override getDefaultFormatType(property: string): FormatType {
    return FORMAT_MAP[property] ?? 'auto';
  }

  override destroy(): void {
    super.destroy();
    if (this.selectionHandler) {
      document.removeEventListener('bundle:selection-changed', this.selectionHandler);
      this.selectionHandler = null;
    }
    if (this.priceHandler) {
      document.removeEventListener('bundle:price-updated', this.priceHandler);
      this.priceHandler = null;
    }
  }
}
