import { BaseDisplayEnhancer } from '@/enhancers/display/DisplayEnhancerCore';
import type { FormatType } from '@/enhancers/display/DisplayEnhancerTypes';
import { PackageToggleEnhancer } from './PackageToggleEnhancer';

const FORMAT_MAP: Record<string, FormatType> = {
  isSelected: 'boolean',
  hasDiscount: 'boolean',
  isRecurring: 'boolean',
  name: 'text',
  price: 'currency',
  unitPrice: 'currency',
  originalPrice: 'currency',
  originalUnitPrice: 'currency',
  discountAmount: 'currency',
  discountPercentage: 'percentage',
  recurringPrice: 'currency',
  currency: 'text',
  interval: 'text',
  intervalCount: 'auto',
  frequency: 'text',
};

/**
 * Displays state for a specific package toggle card.
 *
 * Path format: data-next-display="toggle.{packageId}.{property}"
 *
 * Properties:
 *   isSelected                         — boolean: package is in the cart
 *   name                               — display name from campaign package
 *   price                              — total price (unit price × quantity)
 *   unitPrice                          — per-unit price
 *   originalPrice                      — retail/compare-at total price
 *   originalUnitPrice                  — retail/compare-at per-unit price
 *   discountAmount                     — total savings amount
 *   discountPercentage                 — savings as a percentage
 *   hasDiscount                        — boolean: discount is applied
 *   isRecurring                        — boolean: package bills on a recurring schedule
 *   recurringPrice                     — recurring charge total (quantity-scaled)
 *   interval                           — billing interval: "day" or "month"
 *   intervalCount                      — number of intervals between billing cycles
 *   frequency                          — human-readable billing cadence: "Per month", "Every 3 months", "One time"
 *   currency                           — ISO 4217 currency code
 */
export class PackageToggleDisplayEnhancer extends BaseDisplayEnhancer {
  private packageId?: number;
  private selectionHandler: EventListener | null = null;
  private priceHandler: EventListener | null = null;

  protected override parseDisplayAttributes(): void {
    super.parseDisplayAttributes();
    // toggle.{packageId}.{property}
    const parts = this.displayPath!.split('.');
    if (parts.length >= 3 && parts[0] === 'toggle') {
      const id = parseInt(parts[1], 10);
      this.packageId = isNaN(id) ? undefined : id;
      this.property = parts.slice(2).join('.');
    }
  }

  protected setupStoreSubscriptions(): void {
    // Any selection change may flip isSelected for this card
    this.selectionHandler = () => void this.updateDisplay();
    document.addEventListener('toggle:selection-changed', this.selectionHandler);

    // Price updates are filtered by packageId
    this.priceHandler = (e: Event) => {
      const { packageId } = (e as CustomEvent<{ packageId: number }>).detail;
      if (packageId === this.packageId) void this.updateDisplay();
    };
    document.addEventListener('toggle:price-updated', this.priceHandler);
  }

  protected getPropertyValue(): unknown {
    if (this.packageId === undefined || !this.property) return undefined;

    const state = PackageToggleEnhancer.getToggleState(this.packageId);
    if (!state) return undefined;

    switch (this.property) {
      case 'isSelected':
        return state.isSelected;
      case 'name':
        return state.name;
      case 'price':
        return state.togglePrice?.price;
      case 'unitPrice':
        return state.togglePrice?.unitPrice;
      case 'originalPrice':
        return state.togglePrice?.originalPrice ?? undefined;
      case 'originalUnitPrice':
        return state.togglePrice?.originalUnitPrice ?? undefined;
      case 'discountAmount':
        return state.togglePrice?.discountAmount;
      case 'discountPercentage':
        return state.togglePrice?.discountPercentage;
      case 'hasDiscount':
        return state.togglePrice?.hasDiscount ?? false;
      case 'isRecurring':
        return state.togglePrice?.isRecurring ?? false;
      case 'recurringPrice':
        return state.togglePrice?.recurringPrice ?? undefined;
      case 'interval':
        return state.togglePrice?.interval ?? undefined;
      case 'intervalCount':
        return state.togglePrice?.intervalCount ?? undefined;
      case 'frequency':
        return state.togglePrice?.frequency;
      case 'currency':
        return state.togglePrice?.currency;
      default:
        this.logger.warn(`Unknown toggle display property: "${this.property}"`);
        return undefined;
    }
  }

  protected override getDefaultFormatType(property: string): FormatType {
    return FORMAT_MAP[property] ?? 'auto';
  }

  override destroy(): void {
    super.destroy();
    if (this.selectionHandler) {
      document.removeEventListener('toggle:selection-changed', this.selectionHandler);
      this.selectionHandler = null;
    }
    if (this.priceHandler) {
      document.removeEventListener('toggle:price-updated', this.priceHandler);
      this.priceHandler = null;
    }
  }
}
