import { BaseDisplayEnhancer } from '@/enhancers/display/DisplayEnhancerCore';
import type { FormatType } from '@/enhancers/display/DisplayEnhancerTypes';

const FORMAT_MAP: Record<string, FormatType> = {
  isInCart: 'boolean',
  hasSavings: 'boolean',
  price: 'currency',
  compare: 'currency',
  savings: 'currency',
  savingsPercentage: 'percentage',
};

/**
 * Displays state for a specific package toggle card.
 *
 * Path format: data-next-display="toggle.{packageId}.{property}"
 *
 * Properties: isInCart, price, compare, savings, savingsPercentage, hasSavings
 */
export class PackageToggleDisplayEnhancer extends BaseDisplayEnhancer {
  private packageId?: number;
  private cardEl: HTMLElement | null = null;
  private toggleHandler: EventListener | null = null;
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
    this.resolveCardEl();

    this.toggleHandler = (e: Event) => {
      const { packageId } = (e as CustomEvent<{ packageId: number }>).detail;
      if (packageId === this.packageId) void this.updateDisplay();
    };
    document.addEventListener('toggle:toggled', this.toggleHandler);

    this.priceHandler = (e: Event) => {
      const { packageId } = (e as CustomEvent<{ packageId: number }>).detail;
      if (packageId === this.packageId) {
        this.resolveCardEl();
        void this.updateDisplay();
      }
    };
    document.addEventListener('toggle:price-updated', this.priceHandler);
  }

  private resolveCardEl(): void {
    if (this.cardEl || !this.packageId) return;
    this.cardEl = document.querySelector<HTMLElement>(
      `[data-next-toggle-card][data-next-package-id="${this.packageId}"]`,
    );
  }

  protected getPropertyValue(): unknown {
    this.resolveCardEl();
    if (!this.cardEl || !this.property) return undefined;

    switch (this.property) {
      case 'isInCart':
        return this.cardEl.getAttribute('data-next-in-cart') === 'true';
      case 'price':
        return parseFloat(this.cardEl.getAttribute('data-toggle-price-total') ?? '') || undefined;
      case 'compare':
        return parseFloat(this.cardEl.getAttribute('data-toggle-price-compare') ?? '') || undefined;
      case 'savings':
        return parseFloat(this.cardEl.getAttribute('data-toggle-price-savings') ?? '') || undefined;
      case 'savingsPercentage':
        return (
          parseFloat(this.cardEl.getAttribute('data-toggle-price-savings-pct') ?? '') || undefined
        );
      case 'hasSavings':
        return (
          (parseFloat(this.cardEl.getAttribute('data-toggle-price-savings') ?? '0') || 0) > 0
        );
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
    if (this.toggleHandler) {
      document.removeEventListener('toggle:toggled', this.toggleHandler);
      this.toggleHandler = null;
    }
    if (this.priceHandler) {
      document.removeEventListener('toggle:price-updated', this.priceHandler);
      this.priceHandler = null;
    }
  }
}
