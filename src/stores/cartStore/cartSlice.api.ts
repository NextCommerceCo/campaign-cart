import Decimal from 'decimal.js';
import type { StateCreator } from 'zustand';
import type { CartItem } from '@/types/global';
import { EventBus } from '@/utils/events';
import { createLogger } from '@/utils/logger';
import { initialCartState } from './cartSlice.items';
import type { CartApiSlice, CartStore } from './cartStore.types';

const logger = createLogger('CartStore');

// Debounce + abort for calculateTotals.
// Debounce coalesces rapid calls (e.g. 3 bundles initializing) into one request.
// AbortController cancels any in-flight fetch when a newer call starts.
const CALC_DEBOUNCE_MS = 150;
let calcTimer: ReturnType<typeof setTimeout> | null = null;
let calcController: AbortController | null = null;

function scheduleCalculate(fn: (signal: AbortSignal) => Promise<void>): void {
  calcController?.abort();
  calcController = new AbortController();
  const { signal } = calcController;
  if (calcTimer) clearTimeout(calcTimer);
  calcTimer = setTimeout(() => fn(signal), CALC_DEBOUNCE_MS);
}

// Compute subtotal/total/totalQuantity immediately from local item data.
// This gives the UI an instant price update without waiting for the API.
// The API result will override these values with accurate discounts/shipping.
function optimisticTotals(items: CartItem[]): {
  subtotal: Decimal;
  total: Decimal;
  totalQuantity: number;
  isEmpty: boolean;
} {
  const subtotal = items.reduce(
    (sum, item) => sum.plus(new Decimal(item.price).times(item.quantity)),
    new Decimal(0)
  );
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);
  return { subtotal, total: subtotal, totalQuantity, isEmpty: items.length === 0 };
}

export const createCartApiSlice: StateCreator<
  CartStore,
  [],
  [],
  CartApiSlice
> = (set, get) => ({
  addItem: async item => {
    const { useCampaignStore } = await import('../campaignStore');
    const campaignStore = useCampaignStore.getState();

    const finalPackageId = item.packageId ?? 0;
    const packageData = campaignStore.getPackage(finalPackageId);
    if (!packageData) {
      throw new Error(`Package ${finalPackageId} not found in campaign data`);
    }

    set(state => {
      const newItem: CartItem = {
        id: Date.now(),
        packageId: finalPackageId,
        originalPackageId: item.originalPackageId,
        quantity: item.quantity ?? 1,
        price: parseFloat(packageData.price_total),
        title: item.title ?? packageData.name,
        is_upsell: item.isUpsell ?? false,
        image: item.image ?? packageData.image ?? undefined,
        sku: item.sku ?? packageData.product_sku ?? undefined,
        price_per_unit: packageData.price,
        qty: packageData.qty,
        price_total: packageData.price_total,
        price_retail: packageData.price_retail,
        price_retail_total: packageData.price_retail_total,
        price_recurring: packageData.price_recurring,
        is_recurring: packageData.is_recurring,
        interval: packageData.interval,
        interval_count: packageData.interval_count,
        productId: packageData.product_id,
        productName: packageData.product_name,
        variantId: packageData.product_variant_id,
        variantName: packageData.product_variant_name,
        variantAttributes: packageData.product_variant_attribute_values,
        variantSku: packageData.product_sku ?? undefined,
      };

      if (item.isUpsell) {
        logger.debug('Adding upsell item:', {
          packageId: newItem.packageId,
          isUpsell: item.isUpsell,
          finalItemIsUpsell: newItem.is_upsell,
          itemData: newItem,
        });
      }

      const existingIndex = state.items.findIndex(
        existing => existing.packageId === newItem.packageId
      );

      let newItems;
      if (existingIndex >= 0) {
        newItems = [...state.items];
        newItems[existingIndex]!.quantity += newItem.quantity;
      } else {
        newItems = [...state.items, newItem];
      }

      return { ...state, items: newItems, ...optimisticTotals(newItems) };
    });

    EventBus.getInstance().emit('cart:item-added', {
      packageId: item.packageId ?? 0,
      quantity: item.quantity ?? 1,
    });
    get().calculateTotals();
  },

  removeItem: async packageId => {
    const removedItem = get().items.find(item => item.packageId === packageId);

    set(state => {
      const newItems = state.items.filter(item => item.packageId !== packageId);
      return { ...state, items: newItems, ...optimisticTotals(newItems) };
    });

    if (removedItem) {
      EventBus.getInstance().emit('cart:item-removed', { packageId });
    }
    get().calculateTotals();
  },

  updateQuantity: async (packageId, quantity) => {
    if (quantity <= 0) {
      return get().removeItem(packageId);
    }

    const currentItem = get().items.find(item => item.packageId === packageId);
    const oldQuantity = currentItem?.quantity ?? 0;

    set(state => {
      const newItems = state.items.map(item =>
        item.packageId === packageId ? { ...item, quantity } : item
      );
      return { ...state, items: newItems, ...optimisticTotals(newItems) };
    });

    if (currentItem) {
      EventBus.getInstance().emit('cart:quantity-changed', {
        packageId,
        quantity,
        oldQuantity,
      });
    }
    get().calculateTotals();
  },

  swapPackage: async (removePackageId, addItem) => {
    const { useCampaignStore } = await import('../campaignStore');
    const campaignStore = useCampaignStore.getState();

    const finalPackageId = addItem.packageId ?? 0;
    const newPackageData = campaignStore.getPackage(finalPackageId);
    if (!newPackageData) {
      throw new Error(`Package ${finalPackageId} not found in campaign data`);
    }

    const previousItem = get().items.find(
      item => item.packageId === removePackageId
    );

    const newItem: CartItem = {
      id: Date.now(),
      packageId: finalPackageId,
      originalPackageId: undefined,
      quantity: addItem.quantity ?? 1,
      price: parseFloat(newPackageData.price_total),
      title: addItem.title ?? newPackageData.name,
      is_upsell: addItem.isUpsell ?? false,
      image: addItem.image ?? newPackageData.image ?? undefined,
      sku: addItem.sku ?? newPackageData.product_sku ?? undefined,
      price_per_unit: newPackageData.price,
      qty: newPackageData.qty,
      price_total: newPackageData.price_total,
      price_retail: newPackageData.price_retail,
      price_retail_total: newPackageData.price_retail_total,
      price_recurring: newPackageData.price_recurring,
      is_recurring: newPackageData.is_recurring,
      interval: newPackageData.interval,
      interval_count: newPackageData.interval_count,
      productId: newPackageData.product_id,
      productName: newPackageData.product_name,
      variantId: newPackageData.product_variant_id,
      variantName: newPackageData.product_variant_name,
      variantAttributes: newPackageData.product_variant_attribute_values,
      variantSku: newPackageData.product_sku ?? undefined,
    };

    const priceDifference = newItem.price - (previousItem?.price ?? 0);

    set(state => {
      const newItems = state.items.filter(
        item => item.packageId !== removePackageId
      );

      const existingIndex = newItems.findIndex(
        existing => existing.packageId === newItem.packageId
      );

      if (existingIndex >= 0) {
        newItems[existingIndex]!.quantity += newItem.quantity;
      } else {
        newItems.push(newItem);
      }

      return { ...state, items: newItems, swapInProgress: false, ...optimisticTotals(newItems) };
    });

    const eventBus = EventBus.getInstance();
    const swapEvent: Parameters<
      typeof eventBus.emit<'cart:package-swapped'>
    >[1] = {
      previousPackageId: removePackageId,
      newPackageId: finalPackageId,
      newItem,
      priceDifference,
      source: 'package-selector',
    };

    if (previousItem) {
      swapEvent.previousItem = previousItem;
    }

    eventBus.emit('cart:package-swapped', swapEvent);
    get().calculateTotals();
  },

  swapCart: async items => {
    const { useCampaignStore } = await import('../campaignStore');
    const campaignStore = useCampaignStore.getState();

    logger.debug('Swapping cart with new items:', items);

    set(state => ({ ...state, swapInProgress: true }));

    const newItems: CartItem[] = [];

    for (const item of items) {
      const finalPackageId = item.packageId;
      const originalPackageId = (item as any).originalPackageId;

      const packageData = campaignStore.getPackage(finalPackageId);
      if (!packageData) {
        logger.warn(`Package ${finalPackageId} not found in campaign data, skipping`);
        logger.debug(
          'Available packages:',
          campaignStore.data?.packages?.map(p => p.ref_id)
        );
        continue;
      }

      logger.debug(`Package ${finalPackageId} found:`, packageData);

      newItems.push({
        id: Date.now() + Math.random(),
        packageId: finalPackageId,
        originalPackageId,
        title: packageData.name || `Package ${finalPackageId}`,
        price: parseFloat(packageData.price_total),
        price_retail: packageData.price_retail,
        quantity: item.quantity,
        is_upsell: (item as any).isUpsell ?? false,
        selectorId: (item as any).selectorId,
        image: packageData.image,
        sku: packageData.product_sku ?? undefined,
        qty: packageData.qty,
        price_total: packageData.price_total,
        price_retail_total: packageData.price_retail_total,
        price_per_unit: packageData.price,
        price_recurring: packageData.price_recurring,
        is_recurring: packageData.is_recurring,
        interval: packageData.interval,
        interval_count: packageData.interval_count,
        productId: packageData.product_id,
        productName: packageData.product_name,
        variantId: packageData.product_variant_id,
        variantName: packageData.product_variant_name,
        variantAttributes: packageData.product_variant_attribute_values,
        variantSku: packageData.product_sku ?? undefined,
      });
    }

    set(state => ({ ...state, items: newItems, swapInProgress: false, ...optimisticTotals(newItems) }));
    get().calculateTotals();

    logger.info(`Cart swapped successfully with ${newItems.length} items`);
  },

  clear: () => {
    set(state => ({ ...state, items: [], ...optimisticTotals([]) }));
    get().calculateTotals();
  },

  syncWithAPI: async () => {
    logger.debug('syncWithAPI not yet implemented');
  },

  calculateTotals: () => {
    set({ isCalculating: true });
    scheduleCalculate(async signal => {
      try {
        const { useCampaignStore } = await import('../campaignStore');
        const { useCheckoutStore } = await import('../checkoutStore');
        const { calculateCart } = await import(
          '@/utils/calculations/CartCalculator'
        );

        const campaignState = useCampaignStore.getState();
        const checkoutState = useCheckoutStore.getState();
        const state = get();

        try {
          const { subtotal, total, hasDiscounts, totalDiscount, totalDiscountPercentage, shippingMethod, summary } = await calculateCart({
            lines: state.items.map(item => ({
              package_id: item.packageId,
              quantity: item.quantity,
              is_upsell: item.is_upsell ?? false,
            })),
            vouchers: [...checkoutState.vouchers],
            currency: campaignState.currency ?? null,
            shippingMethod: 1,
            signal,
          });

          if (!summary) return;

          const updatedItems = state.items.map(item => {
            const line = summary.lines.find(
              l => l.package_id === item.packageId
            );
            if (line) {
              return {
                ...item,
                unit_price: line.unit_price,
                original_unit_price: line.original_unit_price,
                package_price: line.package_price,
                original_package_price: line.original_package_price,
                total: line.total,
                total_discount: line.total_discount,
                discounts: line.discounts ?? [],
              };
            }
            return item;
          });

          const enrichedSummaryLines = summary.lines.map(line => {
            const pkg = campaignState.getPackage(line.package_id);
            if (!pkg) return line;
            return {
              ...line,
              name: pkg.name,
              image: pkg.image,
              qty: pkg.qty,
              price: pkg.price,
              price_total: pkg.price_total,
              price_retail: pkg.price_retail,
              price_retail_total: pkg.price_retail_total,
              price_recurring: pkg.price_recurring,
              price_recurring_total: pkg.price_recurring_total,
              is_recurring: pkg.is_recurring,
              interval: pkg.interval,
              interval_count: pkg.interval_count,
              product_name: pkg.product_name,
              product_variant_name: pkg.product_variant_name,
              product_sku: pkg.product_sku,
              product_variant_attribute_values:
                pkg.product_variant_attribute_values,
            };
          });

          if (signal.aborted) return;
          const totalQuantity = summary.lines.reduce((s, l) => s + l.quantity, 0);
          set({
            items: updatedItems,
            subtotal,
            total,
            hasDiscounts,
            totalDiscount,
            totalDiscountPercentage,
            shippingMethod,
            totalQuantity,
            isEmpty: updatedItems.length === 0,
            vouchers: [...checkoutState.vouchers],
            offerDiscounts: summary.offer_discounts ?? [],
            voucherDiscounts: summary.voucher_discounts ?? [],
            summary: { ...summary, lines: enrichedSummaryLines },
            isCalculating: false,
          });
          EventBus.getInstance().emit('cart:updated', get());
        } catch (error) {
          if (signal.aborted) return;
          logger.error('Failed to sync cart with API:', error);
          set({ isCalculating: false });
        }
      } catch (error) {
        logger.error('Error calculating totals:', error);
        set({
          subtotal: new Decimal(0),
          total: new Decimal(0),
          hasDiscounts: false,
          totalDiscount: new Decimal(0),
          totalDiscountPercentage: new Decimal(0),
          totalQuantity: 0,
          isEmpty: true,
          isCalculating: false,
        });
      }
    });
  },

  refreshItemPrices: async () => {
    try {
      logger.info('Refreshing cart item prices with new currency data...');

      const { useCampaignStore } = await import('../campaignStore');
      const campaignStore = useCampaignStore.getState();

      if (!campaignStore.data) {
        logger.warn('No campaign data available to refresh prices');
        return;
      }

      const state = get();

      const updatedItems = state.items.map(item => {
        const packageData = campaignStore.getPackage(item.packageId);
        if (!packageData) {
          logger.warn(`Package ${item.packageId} not found in campaign data`);
          return item;
        }
        return {
          ...item,
          price: parseFloat(packageData.price_total),
          price_per_unit: packageData.price,
          price_total: packageData.price_total,
          price_retail: packageData.price_retail,
          price_retail_total: packageData.price_retail_total,
          price_recurring: packageData.price_recurring,
          productId: item.productId ?? packageData.product_id,
          productName: item.productName ?? packageData.product_name,
          variantId: item.variantId ?? packageData.product_variant_id,
          variantName: item.variantName ?? packageData.product_variant_name,
          variantAttributes:
            item.variantAttributes ??
            packageData.product_variant_attribute_values,
          variantSku: item.variantSku ?? packageData.product_sku ?? undefined,
        };
      });

      let updatedShippingMethod = state.shippingMethod;
      if (updatedShippingMethod && campaignStore.data.shipping_methods) {
        const shippingMethodData = campaignStore.data.shipping_methods.find(
          method => method.ref_id === updatedShippingMethod!.id
        );
        if (shippingMethodData) {
          const newPrice = new Decimal(shippingMethodData.price ?? '0');
          updatedShippingMethod = {
            ...updatedShippingMethod,
            price: newPrice,
            originalPrice: newPrice,
          };
          logger.info(
            `Updated shipping method price: ${updatedShippingMethod.code} = ${newPrice.toNumber()} ${campaignStore.currency ?? ''}`
          );
        }
      }

      set(state => ({
        ...state,
        items: updatedItems,
        shippingMethod: updatedShippingMethod,
      }));

      logger.info('Cart item prices and shipping refreshed with new currency');

      get().calculateTotals();
    } catch (error) {
      logger.error('Failed to refresh item prices:', error);
    }
  },

  setShippingMethod: async methodId => {
    try {
      const { useCampaignStore } = await import('../campaignStore');
      const { useCheckoutStore } = await import('../checkoutStore');

      const campaignStore = useCampaignStore.getState();
      const checkoutStore = useCheckoutStore.getState();
      const campaignData = campaignStore.data;

      if (!campaignData?.shipping_methods) {
        throw new Error('No shipping methods available');
      }

      const shippingMethod = campaignData.shipping_methods.find(
        method => method.ref_id === methodId
      );

      if (!shippingMethod) {
        throw new Error(`Shipping method ${methodId} not found`);
      }

      const price = new Decimal(shippingMethod.price ?? '0');

      set(state => ({
        ...state,
        shippingMethod: {
          id: shippingMethod.ref_id,
          name: shippingMethod.code,
          code: shippingMethod.code,
          originalPrice: price,
          price,
          discountAmount: new Decimal(0),
          discountPercentage: new Decimal(0),
          hasDiscounts: false,
        },
      }));

      checkoutStore.setShippingMethod({
        id: shippingMethod.ref_id,
        name: shippingMethod.code,
        price: price.toNumber(),
        code: shippingMethod.code,
      });

      get().calculateTotals();

      EventBus.getInstance().emit('shipping:method-changed', {
        methodId,
        method: shippingMethod,
      });
    } catch (error) {
      logger.error('Failed to set shipping method:', error);
      throw error;
    }
  },

  applyCoupon: async code => {
    const { useCheckoutStore } = await import('../checkoutStore');
    const checkoutState = useCheckoutStore.getState();

    const normalizedCode = code.toUpperCase().trim();

    if (checkoutState.vouchers.includes(normalizedCode)) {
      return { success: false, message: 'Coupon already applied' };
    }

    checkoutState.addVoucher(normalizedCode);
    get().calculateTotals();

    return {
      success: true,
      message: `Coupon ${normalizedCode} applied successfully`,
    };
  },

  removeCoupon: async code => {
    const { useCheckoutStore } = await import('../checkoutStore');
    useCheckoutStore.getState().removeVoucher(code);
    get().calculateTotals();
  },
});
