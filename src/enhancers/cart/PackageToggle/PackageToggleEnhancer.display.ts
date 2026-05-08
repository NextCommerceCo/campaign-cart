import { BaseDisplayEnhancer } from '@/enhancers/display/DisplayEnhancerCore';
import type { FormatType } from '@/enhancers/display/DisplayEnhancerTypes';
import { PackageToggleEnhancer } from './PackageToggleEnhancer';

const FORMAT_MAP: Record<string, FormatType> = {
  packageId: 'auto',
  name: 'text',
  image: 'text',
  quantity: 'auto',
  productId: 'auto',
  variantId: 'auto',
  variantName: 'text',
  productName: 'text',
  sku: 'text',
  isRecurring: 'boolean',
  interval: 'text',
  intervalCount: 'auto',
  frequency: 'text',
  price: 'currency',
  originalPrice: 'currency',
  unitPrice: 'currency',
  originalUnitPrice: 'currency',
  discountAmount: 'currency',
  discountPercentage: 'percentage',
  hasDiscount: 'boolean',
  recurringPrice: 'currency',
  originalRecurringPrice: 'currency',
  currency: 'text',
  isSelected: 'boolean',
};

/**
 * Displays state for a specific package toggle card.
 *
 * Path format: data-next-display="toggle.{packageId}.{property}"
 *
 * Properties:
 *   packageId                          — package ref_id
 *   name                               — display name from campaign package
 *   image                              — package image URL
 *   quantity                           — quantity added to cart
 *   productId                          — product ID
 *   variantId                          — product variant ID
 *   variantName                        — variant display name
 *   productName                        — product display name
 *   sku                                — product SKU
 *   isRecurring                        — boolean: package bills on a recurring schedule
 *   interval                           — billing interval: "day" or "month"
 *   intervalCount                      — number of intervals between billing cycles
 *   frequency                          — human-readable billing cadence: "Per month", "Every 3 months", "One time"
 *   price                              — total price (unit price × quantity)
 *   originalPrice                      — retail/compare-at total price
 *   unitPrice                          — per-unit price
 *   originalUnitPrice                  — retail/compare-at per-unit price
 *   discountAmount                     — total savings amount
 *   discountPercentage                 — savings as a percentage
 *   hasDiscount                        — boolean: discount is applied
 *   recurringPrice                     — recurring charge total (quantity-scaled)
 *   originalRecurringPrice             — original recurring charge total
 *   currency                           — ISO 4217 currency code
 *   isSelected                         — boolean: package is in the cart
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

    const values: Record<string, unknown> = {
      packageId: state.packageId,
      name: state.name,
      image: state.image,
      quantity: state.quantity,
      productId: state.productId,
      variantId: state.variantId,
      variantName: state.variantName,
      productName: state.productName,
      sku: state.sku,
      isRecurring: state.isRecurring,
      interval: state.interval,
      intervalCount: state.intervalCount,
      frequency: state.frequency,
      price: state.price,
      originalPrice: state.originalPrice,
      unitPrice: state.unitPrice,
      originalUnitPrice: state.originalUnitPrice,
      discountAmount: state.discountAmount,
      discountPercentage: state.discountPercentage,
      hasDiscount: state.hasDiscount,
      recurringPrice: state.recurringPrice,
      originalRecurringPrice: state.originalRecurringPrice,
      currency: state.currency,
      isSelected: state.isSelected,
    };

    if (this.property in values) return values[this.property];
    this.logger.warn(`Unknown toggle display property: "${this.property}"`);
    return undefined;
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
