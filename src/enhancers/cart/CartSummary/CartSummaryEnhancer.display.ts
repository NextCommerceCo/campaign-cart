import { BaseDisplayEnhancer } from '@/enhancers/display/DisplayEnhancerCore';
import type { FormatType } from '@/enhancers/display/DisplayEnhancerTypes';
import { useCartStore } from '@/stores/cartStore';
import type { CartState } from '@/types/global';
import { buildFlags } from './CartSummaryEnhancer.renderer';

const FORMAT_MAP: Record<string, FormatType> = {
  // totals info
  subtotal: 'currency',
  total: 'currency',

  // shipping info
  shippingName: 'text',
  shippingCode: 'text',
  shipping: 'currency',
  shippingOriginal: 'currency',
  shippingDiscountAmount: 'currency',
  shippingDiscountPercentage: 'percentage',

  // discounts info
  totalDiscount: 'currency',
  totalDiscountPercentage: 'percentage',

  // currency info
  currency: 'text',

  // cart utils
  isCalculating: 'boolean',
  isEmpty: 'boolean',
  itemCount: 'number',
  totalQuantity: 'number',
  isFreeShipping: 'boolean',
  hasShippingDiscount: 'boolean',
  hasDiscounts: 'boolean',
};

export class CartDisplayEnhancer extends BaseDisplayEnhancer {
  protected setupStoreSubscriptions(): void {
    this.subscribe(useCartStore, state => {
      this.toggleClass('next-cart-empty', state.isEmpty);
      this.toggleClass('next-cart-has-items', !state.isEmpty);
      void this.updateDisplay();
    });
  }

  protected getPropertyValue(): unknown {
    if (!this.property) return undefined;
    return this.resolveValue(useCartStore.getState(), this.property);
  }

  private resolveValue(state: CartState, property: string): unknown {
    const flags = buildFlags(state);

    switch (property) {
      case 'isEmpty':
        return flags.isEmpty;
      case 'hasDiscounts':
        return flags.hasDiscounts;
      case 'isFreeShipping':
        return flags.isFreeShipping;
      case 'hasShippingDiscount':
        return flags.hasShippingDiscount;
      case 'isCalculating':
        return flags.isCalculating;
      case 'subtotal':
        return state.subtotal.toNumber();
      case 'total':
        return state.total.toNumber();
      case 'totalDiscount':
        return state.totalDiscount.toNumber();
      case 'totalDiscountPercentage':
        return state.totalDiscountPercentage.toNumber();
      case 'shipping':
        return state.shippingMethod?.price.toNumber() ?? 0;
      case 'shippingOriginal':
        return state.shippingMethod?.originalPrice.toNumber() ?? 0;
      case 'shippingDiscountAmount':
        return state.shippingMethod?.discountAmount.toNumber() ?? 0;
      case 'shippingDiscountPercentage':
        return state.shippingMethod?.discountPercentage.toNumber() ?? 0;
      case 'shippingName':
        return state.shippingMethod?.name ?? '';
      case 'shippingCode':
        return state.shippingMethod?.code ?? '';
      case 'currency':
        return state.currency ?? '';
      case 'itemCount':
        return state.items.length;
      case 'totalQuantity':
        return state.items.reduce((sum, item) => sum + item.quantity, 0);
      default:
        this.logger.warn(`Unknown cart display property: "${property}"`);
        return undefined;
    }
  }

  protected override getDefaultFormatType(property: string): FormatType {
    return FORMAT_MAP[property] ?? 'auto';
  }

  public getCartProperty(cartState: CartState, property: string): unknown {
    return this.resolveValue(cartState, property);
  }

  public refreshDisplay(): void {
    void this.updateDisplay();
  }
}
