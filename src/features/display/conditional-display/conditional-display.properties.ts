import { PropertyResolver } from '@/core/base/base-display-enhancer';
import { getPropertyConfig } from '@/core/base/display-types';
import { PriceCalculator } from '@/features/display/display-core';
import { useCampaignStore } from '@/state/campaign';
import { useOrderStore } from '@/state/order';
import { useParameterStore } from '@/state/parameter';
import type { CartState } from '@/types/global';
import type { Package } from '@/types/campaign';
import type { ConditionalDisplayContext } from './conditional-display.types';
import { getPackagePropertyValue } from './conditional-display.package-properties';
import { getOrderPropertyValue } from './conditional-display.order-properties';

/**
 * Resolves `{object}.{property}` for any condition object — cart, package,
 * selection, order, shipping or URL params.
 */
export function getPropertyValue(
  ctx: ConditionalDisplayContext,
  cartState: CartState,
  object: string,
  property: string
): any {
  if (object === 'cart') {
    // Handle special cart properties
    switch (property) {
      case 'total':
        return cartState.total.toNumber();
      case 'subtotal':
        return cartState.subtotal.toNumber();
      case 'shipping':
        return cartState.shippingMethod?.price.toNumber() ?? 0;
      case 'discounts':
      case 'totalDiscount':
        return cartState.totalDiscount.toNumber();
      case 'totalDiscountPercentage':
        return cartState.totalDiscountPercentage.toNumber();
      case 'count':
        return cartState.totalQuantity;
      case 'isEmpty':
        return cartState.isEmpty;
      case 'hasItems':
        return !cartState.isEmpty;
      case 'hasDiscounts':
        return cartState.hasDiscounts;
      case 'hasShipping':
        return cartState.shippingMethod?.price.gt(0) ?? false;
      case 'hasFreeShipping':
        return cartState.shippingMethod?.price.isZero() ?? true;
      case 'hasShippingDiscount':
        return cartState.shippingMethod?.hasDiscounts ?? false;
      default:
        // Check for mapped properties first
        const config = getPropertyConfig('cart', property);
        if (config) {
          const { path, validator } = config;

          // Handle negation
          if (path.startsWith('!')) {
            const actualPath = path.substring(1);
            const value = PropertyResolver.getNestedProperty(
              cartState,
              actualPath
            );
            return !value;
          }

          // Get the value using the mapped path
          let value = PropertyResolver.getNestedProperty(cartState, path);

          // Apply validator if present
          if (validator && value !== undefined) {
            value = validator(value);
          }

          return value;
        }

        // Fallback to direct property access for unmapped properties
        return PropertyResolver.getNestedProperty(cartState, property);
    }
  }

  if (object === 'package') {
    return getPackagePropertyValue(ctx, property);
  }

  if (object === 'selection' || (object && object.startsWith('selection.'))) {
    // Handle embedded selector ID
    let actualSelectorId: string | null = ctx.selectorId;
    let actualProperty = property;

    if (object.startsWith('selection.')) {
      const parts = object.split('.');
      if (parts.length >= 2) {
        actualSelectorId = parts[1] ?? null;
        // If property is part of the object path, reconstruct it
        if (parts.length > 2) {
          actualProperty =
            parts.slice(2).join('.') + (property ? '.' + property : '');
        }
      }
    }

    return getSelectionPropertyValue(ctx, actualProperty, actualSelectorId);
  }

  if (object === 'order') {
    const orderStore = useOrderStore.getState();
    return getOrderPropertyValue(orderStore, property);
  }

  if (object === 'shipping') {
    return getShippingPropertyValue(ctx, property);
  }

  if (object === 'param' || object === 'params') {
    const paramStore = useParameterStore.getState();
    return paramStore.getParam(property);
  }

  return null;
}

/**
 * Reads a `selection.*` property off whatever package a package selector
 * currently has selected.
 */
export function getSelectionPropertyValue(
  ctx: ConditionalDisplayContext,
  property: string,
  selectorId?: string | null
): any {
  let targetSelectorId: string | null = selectorId || ctx.selectorId;
  let actualProperty = property;

  // Check if property contains the selector ID
  if (property && property.includes('.')) {
    const parts = property.split('.');
    if (parts.length >= 2) {
      targetSelectorId = parts[0] ?? null;
      actualProperty = parts.slice(1).join('.');
    }
  }

  if (!targetSelectorId) {
    ctx.logger.warn('Selection condition used but no selector context found');
    return null;
  }

  // Find the selector element
  const selectorElement = document.querySelector(
    `[data-next-selector-id="${targetSelectorId}"]`
  ) as HTMLElement;

  if (!selectorElement) {
    ctx.logger.debug(`Selector element not found for ID: ${targetSelectorId}`);
    return null;
  }

  // Try to get the selected item from the selector
  const getSelectedItem = (selectorElement as any)._getSelectedItem;
  const selectedItem =
    typeof getSelectedItem === 'function' ? getSelectedItem() : null;

  if (!selectedItem) {
    // No selection made yet
    if (actualProperty === 'hasSelection') return false;
    return null;
  }

  // Get package data if available
  let packageData: Package | undefined;
  try {
    const campaignStore = useCampaignStore.getState();
    packageData = campaignStore.getPackage(selectedItem.packageId) ?? undefined;
  } catch (error) {
    ctx.logger.debug('Could not get package data for selection');
  }

  // Evaluate selection properties (similar to SelectionDisplayEnhancer)
  switch (actualProperty) {
    case 'hasSelection':
      return true;

    case 'packageId':
      return selectedItem.packageId;

    case 'quantity':
      return selectedItem.quantity || 1;

    case 'name':
      return packageData?.name || selectedItem.name || '';

    case 'price':
      return packageData
        ? parseFloat(packageData.price || '0')
        : selectedItem.price || 0;

    case 'total':
    case 'price_total':
      if (packageData) {
        return (
          parseFloat(packageData.price_total || '0') ||
          parseFloat(packageData.price || '0') * selectedItem.quantity
        );
      }
      return (selectedItem.price || 0) * selectedItem.quantity;

    case 'hasSavings':
      if (!packageData) return false;
      const hasSavingsMetrics = PriceCalculator.calculatePackageMetrics({
        price: parseFloat(packageData.price || '0'),
        retailPrice: parseFloat(packageData.price_retail || '0'),
        quantity: selectedItem.quantity,
        priceTotal: parseFloat(packageData.price_total || '0'),
        retailPriceTotal: parseFloat(packageData.price_retail_total || '0'),
      });
      return hasSavingsMetrics.hasSavings;

    case 'savingsAmount':
      if (!packageData) return 0;
      const metrics = PriceCalculator.calculatePackageMetrics({
        price: parseFloat(packageData.price || '0'),
        retailPrice: parseFloat(packageData.price_retail || '0'),
        quantity: selectedItem.quantity,
        priceTotal: parseFloat(packageData.price_total || '0'),
        retailPriceTotal: parseFloat(packageData.price_retail_total || '0'),
      });
      return metrics.totalSavings;

    case 'savingsPercentage':
      if (!packageData) return 0;
      const metricsPerc = PriceCalculator.calculatePackageMetrics({
        price: parseFloat(packageData.price || '0'),
        retailPrice: parseFloat(packageData.price_retail || '0'),
        quantity: selectedItem.quantity,
        priceTotal: parseFloat(packageData.price_total || '0'),
        retailPriceTotal: parseFloat(packageData.price_retail_total || '0'),
      });
      return metricsPerc.totalSavingsPercentage;

    case 'compareTotal':
    case 'price_retail_total':
      if (!packageData) return 0;
      const rtlTotal = parseFloat(packageData.price_retail_total || '0');
      if (rtlTotal > 0) return rtlTotal;
      const rtlPrice = parseFloat(packageData.price_retail || '0');
      if (rtlPrice > 0) return rtlPrice * selectedItem.quantity;
      return getSelectionPropertyValue(ctx, 'total', targetSelectorId);

    case 'isBundle':
    case 'isMultiPack':
      return (selectedItem.quantity || 1) > 1;

    case 'isSingleUnit':
      return (selectedItem.quantity || 1) === 1;

    case 'totalUnits':
    case 'totalQuantity':
      return selectedItem.quantity || 1;

    default:
      // Try to get from package data
      if (packageData) {
        return PropertyResolver.getNestedProperty(packageData, actualProperty);
      }
      return null;
  }
}

/**
 * Reads a `shipping.*` property off the shipping method named by the closest
 * `data-next-shipping-id` ancestor.
 */
export function getShippingPropertyValue(
  ctx: ConditionalDisplayContext,
  property: string
): any {
  // Find the closest parent element with data-next-shipping-id
  const shippingElement = ctx.element.closest(
    '[data-next-shipping-id]'
  ) as HTMLElement;

  if (!shippingElement) {
    ctx.logger.warn('Shipping condition used but no shipping context found');
    return null;
  }

  const shippingId = shippingElement.getAttribute('data-next-shipping-id');
  if (!shippingId) {
    return null;
  }

  // Get shipping method from campaign data
  const campaignStore = useCampaignStore.getState();
  const shippingMethods = campaignStore.data?.shipping_methods || [];
  const shippingMethod = shippingMethods.find(
    method => method.ref_id === parseInt(shippingId, 10)
  );

  if (!shippingMethod) {
    ctx.logger.warn(`Shipping method ${shippingId} not found in campaign data`);
    return null;
  }

  // Return the requested property
  switch (property) {
    case 'isFree':
      return parseFloat(shippingMethod.price || '0') === 0;

    case 'cost':
    case 'price':
      return parseFloat(shippingMethod.price || '0');

    case 'name':
    case 'code':
      return shippingMethod.code;

    case 'id':
    case 'refId':
      return shippingMethod.ref_id;

    case 'method':
      return shippingMethod;

    default:
      return null;
  }
}

// getPackageShippingCost method removed - unused
