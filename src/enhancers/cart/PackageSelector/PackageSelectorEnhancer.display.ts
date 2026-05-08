import { BaseDisplayEnhancer } from '@/enhancers/display/DisplayEnhancerCore';
import type { FormatType } from '@/enhancers/display/DisplayEnhancerTypes';

const FORMAT_MAP: Record<string, FormatType> = {
  isSelected: 'boolean',
  isInCart: 'boolean',
  hasSavings: 'boolean',
  price: 'currency',
  compare: 'currency',
  savings: 'currency',
  savingsPercentage: 'percentage',
};

/**
 * Displays state for a specific package card within a selector.
 *
 * Path format: data-next-display="selector.{selectorId}.{packageId}.{property}"
 *
 * Properties: isSelected, isInCart, price, compare, savings, savingsPercentage, hasSavings
 */
export class PackageSelectorDisplayEnhancer extends BaseDisplayEnhancer {
  private selectorId?: string;
  private packageId?: number;
  private cardEl: HTMLElement | null = null;
  private selectionHandler: EventListener | null = null;
  private priceHandler: EventListener | null = null;

  protected override parseDisplayAttributes(): void {
    super.parseDisplayAttributes();
    // selector.{selectorId}.{packageId}.{property}
    const parts = this.displayPath!.split('.');
    if (parts.length >= 4 && parts[0] === 'selector') {
      this.selectorId = parts[1];
      const id = parseInt(parts[2], 10);
      this.packageId = isNaN(id) ? undefined : id;
      this.property = parts.slice(3).join('.');
    }
  }

  protected setupStoreSubscriptions(): void {
    this.resolveCardEl();

    this.selectionHandler = (e: Event) => {
      const { selectorId } = (e as CustomEvent<{ selectorId: string }>).detail;
      if (selectorId === this.selectorId) void this.updateDisplay();
    };
    document.addEventListener('selector:item-selected', this.selectionHandler);

    this.priceHandler = (e: Event) => {
      const { selectorId, packageId } =
        (e as CustomEvent<{ selectorId: string; packageId: number }>).detail;
      if (selectorId === this.selectorId && packageId === this.packageId) {
        this.resolveCardEl();
        void this.updateDisplay();
      }
    };
    document.addEventListener('selector:price-updated', this.priceHandler);
  }

  private resolveCardEl(): void {
    if (this.cardEl || !this.selectorId || !this.packageId) return;
    const selectorEl = document.querySelector(
      `[data-next-selector-id="${this.selectorId}"]`,
    );
    this.cardEl =
      selectorEl?.querySelector<HTMLElement>(
        `[data-next-selector-card][data-next-package-id="${this.packageId}"]`,
      ) ?? null;
  }

  protected getPropertyValue(): unknown {
    this.resolveCardEl();
    if (!this.cardEl || !this.property) return undefined;

    switch (this.property) {
      case 'isSelected':
        return this.cardEl.getAttribute('data-next-selected') === 'true';
      case 'isInCart':
        return this.cardEl.getAttribute('data-next-in-cart') === 'true';
      case 'price':
        return parseFloat(this.cardEl.getAttribute('data-package-price-total') ?? '') || undefined;
      case 'compare':
        return parseFloat(this.cardEl.getAttribute('data-package-price-compare') ?? '') || undefined;
      case 'savings':
        return parseFloat(this.cardEl.getAttribute('data-package-price-savings') ?? '') || undefined;
      case 'savingsPercentage':
        return (
          parseFloat(this.cardEl.getAttribute('data-package-price-savings-pct') ?? '') || undefined
        );
      case 'hasSavings':
        return (
          (parseFloat(this.cardEl.getAttribute('data-package-price-savings') ?? '0') || 0) > 0
        );
      default:
        this.logger.warn(`Unknown selector display property: "${this.property}"`);
        return undefined;
    }
  }

  protected override getDefaultFormatType(property: string): FormatType {
    return FORMAT_MAP[property] ?? 'auto';
  }

  override destroy(): void {
    super.destroy();
    if (this.selectionHandler) {
      document.removeEventListener('selector:item-selected', this.selectionHandler);
      this.selectionHandler = null;
    }
    if (this.priceHandler) {
      document.removeEventListener('selector:price-updated', this.priceHandler);
      this.priceHandler = null;
    }
  }
}
