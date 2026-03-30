import { BaseDisplayEnhancer } from '@/enhancers/display/DisplayEnhancerCore';
import type { FormatType } from '@/enhancers/display/DisplayEnhancerTypes';

const FORMAT_MAP: Record<string, FormatType> = {
  isSelected: 'boolean',
  hasSavings: 'boolean',
  name: 'text',
  price: 'currency',
  compare: 'currency',
  savings: 'currency',
  savingsPercentage: 'percentage',
};

export class BundleDisplayEnhancer extends BaseDisplayEnhancer {
  private bundleId?: string;
  private cardEl: HTMLElement | null = null;
  private selectionHandler: EventListener | null = null;
  private priceHandler: EventListener | null = null;

  protected override parseDisplayAttributes(): void {
    super.parseDisplayAttributes();
    // Parse bundle.{bundleId}.{property}
    const parts = this.displayPath!.split('.');
    if (parts.length >= 3 && parts[0] === 'bundle') {
      this.bundleId = parts[1];
      this.property = parts.slice(2).join('.');
    }
  }

  protected setupStoreSubscriptions(): void {
    this.resolveCardEl();

    // Any selection change can flip isSelected across all cards
    this.selectionHandler = () => void this.updateDisplay();
    document.addEventListener('bundle:selection-changed', this.selectionHandler);

    // Price updates are filtered by bundleId
    this.priceHandler = (e: Event) => {
      const { bundleId } = (e as CustomEvent<{ bundleId: string }>).detail;
      if (bundleId === this.bundleId) {
        this.resolveCardEl();
        void this.updateDisplay();
      }
    };
    document.addEventListener('bundle:price-updated', this.priceHandler);
  }

  private resolveCardEl(): void {
    if (!this.bundleId || this.cardEl) return;
    this.cardEl = document.querySelector<HTMLElement>(
      `[data-next-bundle-card][data-next-bundle-id="${this.bundleId}"]`,
    );
  }

  protected getPropertyValue(): unknown {
    this.resolveCardEl();
    if (!this.cardEl || !this.property) return undefined;

    switch (this.property) {
      case 'isSelected':
        return this.cardEl.getAttribute('data-next-selected') === 'true';
      case 'name':
        return this.cardEl.getAttribute('data-next-bundle-name') ?? '';
      case 'price':
        return parseFloat(this.cardEl.getAttribute('data-bundle-price-total') ?? '') || undefined;
      case 'compare':
        return parseFloat(this.cardEl.getAttribute('data-bundle-price-compare') ?? '') || undefined;
      case 'savings':
        return parseFloat(this.cardEl.getAttribute('data-bundle-price-savings') ?? '') || undefined;
      case 'savingsPercentage':
        return parseFloat(this.cardEl.getAttribute('data-bundle-price-savings-pct') ?? '') || undefined;
      case 'hasSavings':
        return (parseFloat(this.cardEl.getAttribute('data-bundle-price-savings') ?? '0') || 0) > 0;
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
