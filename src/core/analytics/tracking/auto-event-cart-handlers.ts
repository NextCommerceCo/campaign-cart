/**
 * AutoEventListener — cart domain handlers
 *
 * Add to cart, remove from cart, package swap, and the generic cart-updated
 * event.
 */

import { createLogger } from '@/core/logger';
import { useCampaignStore } from '@/state/campaign';
import { useCartStore } from '@/state/cart';
import { dataLayer } from '../data-layer-manager';
import { listAttributionTracker } from './list-attribution-tracker';
import { EcommerceEvents } from '../events/ecommerce-events';
import type { AutoEventListenerContext } from './auto-event-listener.types';

const logger = createLogger('AutoEventListener');

/**
 * Get current cart data
 */
function getCartData(): any {
  try {
    const cartStore = useCartStore.getState();
    const campaignStore = useCampaignStore.getState();

    const toNum = (v: unknown): number => {
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      if (typeof v === 'string') {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : 0;
      }
      return 0;
    };

    const items = cartStore.items.map(item => {
      // `quantity` is the number of packages, so `price` is the final
      // per-package price AFTER discounts. Prefer the calculated figures the
      // cart store writes onto the line (`package_price`, or `total` /
      // quantity); fall back to the catalog package total only before the
      // calculation has run.
      let price = 0;
      if (item.package_price !== undefined && item.package_price !== null) {
        price = toNum(item.package_price);
      } else if (
        item.total !== undefined &&
        item.total !== null &&
        item.quantity > 0
      ) {
        price = toNum(item.total) / item.quantity;
      } else {
        const pkg = campaignStore.getPackage(item.packageId);
        price = toNum(pkg?.price_total ?? pkg?.price);
      }

      return {
        package_id: item.packageId,
        quantity: item.quantity,
        price,
      };
    });

    // total_value is the item revenue as a plain number. The store's `total`
    // is a Decimal (serializes to a string) and includes shipping, so derive
    // the value from the items instead — keeps it numeric and reconciled with
    // `price * quantity`.
    const totalValue =
      Math.round(
        items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100
      ) / 100;

    return {
      total_value: totalValue,
      total_items: cartStore.totalQuantity || 0,
      currency: campaignStore.currency ?? 'USD',
      items,
    };
  } catch (error) {
    logger.error('Error getting cart data:', error);
    return null;
  }
}

/**
 * Set up cart event listeners
 */
export function setupCartEventListeners(ctx: AutoEventListenerContext): void {
  // Add to cart
  const handleAddToCart = async (data: any) => {
    if (!ctx.shouldProcessEvent('cart:item-added')) {
      return;
    }

    const packageId = data.packageId;
    const quantity = data.quantity || 1;

    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.getPackage(packageId);

    if (!packageData) {
      logger.warn('Package not found for add to cart:', packageId);
      return;
    }

    // Get list attribution
    const listContext = listAttributionTracker.getCurrentList();

    // Wait for the debounced cart calculation to settle so the event reports
    // the final, discounted line price rather than the catalog price. On a
    // redirect we cannot wait — the page may navigate before calc completes,
    // so we fall back to the package data below.
    if (!data.willRedirect) {
      await ctx.waitForCartCalculation();
    }

    // Get the (now calculated) cart item to use EcommerceEvents method
    const cartStore = useCartStore.getState();
    const cartItem = cartStore.getItem(packageId);

    // Create the event using EcommerceEvents which formats it correctly
    const event = EcommerceEvents.createAddToCartEvent(
      cartItem || {
        packageId,
        quantity,
        title: packageData.name,
        price: parseFloat(packageData.price_total),
        productId: packageData.product_id,
        productName: packageData.product_name,
        variantId: packageData.product_variant_id,
        variantName: packageData.product_variant_name,
        variantSku: packageData.product_sku,
      },
      listContext?.listId,
      listContext?.listName
    );

    // Check if this will redirect
    if (data.willRedirect) {
      // The DataLayerManager will handle queuing
      (event as any)._willRedirect = true;
    }

    dataLayer.push(event);
    logger.debug('Tracked add to cart:', packageId);
  };

  ctx.eventBus.on('cart:item-added', handleAddToCart);
  ctx.eventHandlers.set('cart:item-added', handleAddToCart);

  // Remove from cart
  const handleRemoveFromCart = async (data: any) => {
    if (!ctx.shouldProcessEvent('cart:item-removed')) {
      return;
    }

    const packageId = data.packageId;
    const quantity = data.quantity || 1;

    const campaignStore = useCampaignStore.getState();
    const packageData = campaignStore.getPackage(packageId);

    if (!packageData) {
      logger.warn('Package not found for remove from cart:', packageId);
      return;
    }

    // Create proper remove from cart event using EcommerceEvents
    const event = EcommerceEvents.createRemoveFromCartEvent({
      packageId,
      quantity,
      title: packageData.name,
      price: parseFloat(packageData.price_total),
      productId: packageData.product_id,
      productName: packageData.product_name,
      variantId: packageData.product_variant_id,
      variantName: packageData.product_variant_name,
      variantSku: packageData.product_sku,
    });

    dataLayer.push(event);
    logger.debug('Tracked remove from cart:', packageId);
  };

  ctx.eventBus.on('cart:item-removed', handleRemoveFromCart);
  ctx.eventHandlers.set('cart:item-removed', handleRemoveFromCart);

  // Package swapped (atomic swap operation)
  const handlePackageSwapped = async (data: any) => {
    const { previousPackageId, newPackageId, priceDifference } = data;

    const campaignStore = useCampaignStore.getState();
    const previousPackageData = campaignStore.getPackage(previousPackageId);
    const newPackageData = campaignStore.getPackage(newPackageId);

    if (!previousPackageData || !newPackageData) {
      logger.warn('Package data not found for swap:', {
        previousPackageId,
        newPackageId,
      });
      return;
    }

    // Format items for analytics
    const previousItemFormatted = {
      item_id: previousPackageData.external_id.toString(),
      item_name: previousPackageData.name || `Package ${previousPackageId}`,
      currency: campaignStore.currency ?? 'USD',
      price: parseFloat(previousPackageData.price_total || '0'),
      quantity: 1,
      item_category: campaignStore.data?.name || 'Campaign',
      item_variant:
        previousPackageData.product_variant_name ||
        previousPackageData.product?.variant?.name,
      item_brand:
        previousPackageData.product_name || previousPackageData.product?.name,
      item_sku:
        previousPackageData.product_sku ||
        previousPackageData.product?.variant?.sku ||
        undefined,
      ...(previousPackageData.image && {
        item_image: previousPackageData.image,
      }),
    };

    const newItemFormatted = {
      item_id: newPackageData.external_id.toString(),
      item_name: newPackageData.name || `Package ${newPackageId}`,
      currency: campaignStore.currency ?? 'USD',
      price: parseFloat(newPackageData.price_total || '0'),
      quantity: 1,
      item_category: campaignStore.data?.name || 'Campaign',
      item_variant:
        newPackageData.product_variant_name ||
        newPackageData.product?.variant?.name,
      item_brand: newPackageData.product_name || newPackageData.product?.name,
      item_sku:
        newPackageData.product_sku ||
        newPackageData.product?.variant?.sku ||
        undefined,
      ...(newPackageData.image && { item_image: newPackageData.image }),
    };

    // Push single swap event instead of remove + add
    const event = {
      event: 'dl_package_swapped',
      event_category: 'ecommerce',
      event_action: 'swap',
      event_label: `${previousItemFormatted.item_name} → ${newItemFormatted.item_name}`,
      ecommerce: {
        currency: campaignStore.currency ?? 'USD',
        value_change: priceDifference,
        items_removed: [previousItemFormatted],
        items_added: [newItemFormatted],
      },
      swap_details: {
        previous_package_id: previousPackageId,
        new_package_id: newPackageId,
        price_difference: priceDifference,
      },
    };

    dataLayer.push(event);
    logger.debug('Tracked package swap:', {
      previousPackageId,
      newPackageId,
      priceDifference,
    });
  };

  ctx.eventBus.on('cart:package-swapped', handlePackageSwapped);
  ctx.eventHandlers.set('cart:package-swapped', handlePackageSwapped);

  // Cart updated (generic cart change)
  const handleCartUpdated = async () => {
    if (!ctx.shouldProcessEvent('cart:updated')) {
      return;
    }

    // Full GA4 ecommerce block (line items + value) so every analytics
    // provider gets the cart contents; keep the thin `cart` summary attached
    // for backward-compatible consumers.
    const event = EcommerceEvents.createCartUpdatedEvent();
    (event as any).cart = getCartData();
    dataLayer.push(event);
  };

  ctx.eventBus.on('cart:updated', handleCartUpdated);
  ctx.eventHandlers.set('cart:updated', handleCartUpdated);
}
