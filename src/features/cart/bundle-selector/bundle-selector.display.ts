import { BaseDisplayEnhancer } from '@/core/base/base-display-enhancer';
import type { FormatType } from '@/core/base/display-types';
import { BundleSelectorEnhancer } from './bundle-selector.enhancer';

/**
 * Default format per property, for a page that sets no `data-next-format`.
 *
 * One key per `case` in `BundleDisplayEnhancer.getPropertyValue`, and no more.
 * It used to also carry `compare`, `savings`, `savingsPercentage` and `hasSavings`,
 * which the resolver has never answered — and a reference page was written off this
 * table rather than off the resolver, so it taught four `bundle.` paths that render
 * nothing (finding 109 in `docs/code-findings.md`). A format for a property nothing
 * resolves is not harmless dead code: it reads as proof the property exists.
 * `src/tests/docs/featureReference.test.ts` now fails on one.
 *
 * None of these formats currently reach the DOM: `parseDisplayAttributes` below calls
 * `super` — which is what computes the format — *before* it narrows `this.property`
 * from `{bundleId}.{name}` down to `{name}`, so every lookup here misses and the
 * format falls back to `auto`. Restoring
 * it means recomputing the format after the narrowing, and that changes what renders
 * (`auto` prints a whole-number price as `100`, `currency` as `$100.00`), so it is a
 * behaviour change and not a tidy-up.
 */
const FORMAT_MAP: Record<string, FormatType> = {
  isSelected: 'boolean',
  hasDiscount: 'boolean',
  name: 'text',
  price: 'currency',
  originalPrice: 'currency',
  discountAmount: 'currency',
  discountPercentage: 'percentage',
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
