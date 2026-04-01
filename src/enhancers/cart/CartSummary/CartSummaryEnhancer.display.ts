import { BaseDisplayEnhancer } from '@/enhancers/display/DisplayEnhancerCore';
import type { FormatType } from '@/enhancers/display/DisplayEnhancerTypes';
import { useCartStore } from '@/stores/cartStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useConfigStore } from '@/stores/configStore';
import { formatCurrency, getCurrencySymbol } from '@/utils/currencyFormatter';
import type { CartState } from '@/types/global';
import { buildFlags } from './CartSummaryEnhancer.renderer';

const FORMAT_MAP: Record<string, FormatType> = {
  subtotal: 'currency',
  total: 'currency',
  isFreeShipping: 'boolean',
  shipping: 'currency',
  shippingOriginal: 'currency',
  hasShippingDiscount: 'boolean',
  shippingDiscountAmount: 'currency',
  shippingDiscountPercentage: 'number',
  shippingName: 'text',
  shippingCode: 'text',
  hasDiscounts: 'boolean',
  /** @deprecated use totalDiscount */
  discounts: 'currency',
  totalDiscount: 'currency',
  itemCount: 'number',
  totalQuantity: 'number',
  isEmpty: 'boolean',
  isCalculating: 'boolean',
  currency: 'text',
  currencyCode: 'text',
  currencySymbol: 'text',
};

export class CartDisplayEnhancer extends BaseDisplayEnhancer {
  private includeDiscounts = false;

  override async initialize(): Promise<void> {
    this.includeDiscounts = this.element.hasAttribute('data-include-discounts');
    if (this.includeDiscounts) {
      this.logger.warn(
        '`data-include-discounts` is deprecated. ' +
          'Show discounts as a separate row using `data-next-display="cart.totalDiscount"` ' +
          'and hide it with the `.next-no-discounts` CSS state class instead.',
      );
    }
    await super.initialize();
  }

  protected override parseDisplayAttributes(): void {
    super.parseDisplayAttributes();
    const parts = this.displayPath?.split('.') ?? [];
    if (parts.length >= 2 && parts[0] === 'cart-summary') {
      this.logger.warn(
        `"cart-summary.${parts.slice(1).join('.')}" is deprecated — use "cart.${parts.slice(1).join('.')}" instead`,
      );
      this.property = parts.slice(1).join('.');
    }
  }

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
    // .raw suffix — return raw numeric value without formatting
    if (property.endsWith('.raw')) {
      const baseProp = property.slice(0, -4);
      if (baseProp === 'subtotal') {
        return this.includeDiscounts
          ? state.subtotal.toNumber() - state.totalDiscount.toNumber()
          : state.subtotal.toNumber();
      }
      if (baseProp === 'total') return state.total.toNumber();
      if (baseProp === 'totalDiscount') return state.totalDiscount.toNumber();
      if (baseProp === 'shipping') return state.shippingMethod?.price.toNumber() ?? 0;
      return undefined;
    }

    // currency / currencyCode
    if (property === 'currency' || property === 'currencyCode') {
      const campaign = useCampaignStore.getState().data;
      if (campaign?.currency) return campaign.currency;
      const config = useConfigStore.getState();
      return config?.selectedCurrency ?? config?.detectedCurrency ?? 'USD';
    }

    // currencySymbol
    if (property === 'currencySymbol') {
      const config = useConfigStore.getState();
      if (config?.locationData?.detectedCountryConfig?.currencySymbol) {
        return config.locationData.detectedCountryConfig.currencySymbol;
      }
      const campaign = useCampaignStore.getState().data;
      const currency =
        campaign?.currency ??
        config?.selectedCurrency ??
        config?.detectedCurrency ??
        'USD';
      return getCurrencySymbol(currency) || currency;
    }

    // subtotal with include-discounts applied
    if (this.includeDiscounts && property === 'subtotal') {
      const campaign = useCampaignStore.getState().data;
      const config = useConfigStore.getState();
      const currency =
        campaign?.currency ??
        config?.selectedCurrency ??
        config?.detectedCurrency ??
        'USD';
      const discountedSubtotal =
        state.subtotal.toNumber() - state.totalDiscount.toNumber();
      return { _preformatted: true, value: formatCurrency(discountedSubtotal, currency) };
    }

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
      case 'discounts':
        this.logger.warn(
          '"cart.discounts" is deprecated — use "cart.totalDiscount" instead',
        );
        return state.totalDiscount.toNumber();
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
    const base = property.endsWith('.raw') ? property.slice(0, -4) : property;
    return FORMAT_MAP[base] ?? 'auto';
  }

  public getCartProperty(cartState: CartState, property: string): unknown {
    return this.resolveValue(cartState, property);
  }

  public refreshDisplay(): void {
    void this.updateDisplay();
  }
}
