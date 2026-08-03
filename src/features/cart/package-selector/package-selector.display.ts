import { BaseDisplayEnhancer } from '@/core/base/base-display-enhancer';
import type { FormatType } from '@/core/base/display-types';
import { cartOperations } from '@/state/cart';
import type { CartState } from '@/types/global';
import type { SelectorHandlerContext } from './package-selector.types';
import { selectItem, updateCart } from './package-selector.handlers';

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
 * Reconciles selector card state (in-cart flag, quantity, selection) with the
 * current cart store snapshot. Pure state → DOM sync, no direct cart writes
 * except the swap-mode default-selection bootstrap below.
 */
export function syncWithCart(
  cartState: CartState,
  ctx: SelectorHandlerContext
): void {
  for (const item of ctx.items) {
    const inCart = cartState.items.some(
      ci =>
        ci.packageId === item.packageId ||
        ci.originalPackageId === item.packageId
    );
    item.element.classList.toggle('next-in-cart', inCart);
    item.element.setAttribute('data-next-in-cart', String(inCart));

    if (inCart) {
      const ci = cartState.items.find(
        ci =>
          ci.packageId === item.packageId ||
          ci.originalPackageId === item.packageId
      );
      if (ci && item.quantity !== ci.quantity) {
        item.quantity = ci.quantity;
        const displayEl = item.element.querySelector<HTMLElement>(
          '[data-next-quantity-display]'
        );
        if (displayEl) displayEl.textContent = String(item.quantity);
        item.element.setAttribute('data-next-quantity', String(item.quantity));
      }
    }
  }

  if (ctx.mode === 'swap') {
    const inCartItem = ctx.items.find(item =>
      cartState.items.some(
        ci =>
          ci.packageId === item.packageId ||
          ci.originalPackageId === item.packageId
      )
    );
    if (inCartItem && ctx.selectedItemRef.value !== inCartItem) {
      selectItem(inCartItem, ctx);
      return;
    }
  }

  if (!ctx.selectedItemRef.value) {
    const preSelected = ctx.items.find(i => i.isPreSelected) ?? ctx.items[0];
    if (preSelected) {
      selectItem(preSelected, ctx);
      if (ctx.mode === 'swap' && cartState.isEmpty) {
        void updateCart(null, preSelected, ctx.items).then(() => {
          if (preSelected.shippingId) {
            void cartOperations.setShippingMethod(
              parseInt(preSelected.shippingId, 10)
            );
          }
        });
      }
    }
  }
}

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
      const { selectorId, packageId } = (
        e as CustomEvent<{ selectorId: string; packageId: number }>
      ).detail;
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
      `[data-next-selector-id="${this.selectorId}"]`
    );
    this.cardEl =
      selectorEl?.querySelector<HTMLElement>(
        `[data-next-selector-card][data-next-package-id="${this.packageId}"]`
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
        return (
          parseFloat(
            this.cardEl.getAttribute('data-package-price-total') ?? ''
          ) || undefined
        );
      case 'compare':
        return (
          parseFloat(
            this.cardEl.getAttribute('data-package-price-compare') ?? ''
          ) || undefined
        );
      case 'savings':
        return (
          parseFloat(
            this.cardEl.getAttribute('data-package-price-savings') ?? ''
          ) || undefined
        );
      case 'savingsPercentage':
        return (
          parseFloat(
            this.cardEl.getAttribute('data-package-price-savings-pct') ?? ''
          ) || undefined
        );
      case 'hasSavings':
        return (
          (parseFloat(
            this.cardEl.getAttribute('data-package-price-savings') ?? '0'
          ) || 0) > 0
        );
      default:
        this.logger.warn(
          `Unknown selector display property: "${this.property}"`
        );
        return undefined;
    }
  }

  protected override getDefaultFormatType(property: string): FormatType {
    return FORMAT_MAP[property] ?? 'auto';
  }

  override destroy(): void {
    super.destroy();
    if (this.selectionHandler) {
      document.removeEventListener(
        'selector:item-selected',
        this.selectionHandler
      );
      this.selectionHandler = null;
    }
    if (this.priceHandler) {
      document.removeEventListener('selector:price-updated', this.priceHandler);
      this.priceHandler = null;
    }
  }
}
