/**
 * Order line, attribution, and calculated-property readers for OrderDisplayEnhancer.
 * Pure functions — read an Order (or a sub-shape of it) and return a display value.
 */

import { DisplayFormatter } from '@/core/base/base-display-enhancer';
import type { Order, OrderLine } from '@/types/api';

export function getOrderLinesProperty(order: Order, property: string): any {
  const lines = order.lines || [];

  switch (property) {
    case 'count':
      return lines.length;
    case 'totalQuantity':
      return lines.reduce((sum, line) => sum + (line.quantity || 0), 0);
    case 'upsellCount':
      return lines.filter(line => line.is_upsell).length;
    case 'mainProduct':
      return lines[0]?.product_title || '';
    case 'mainProductSku':
      return lines[0]?.product_sku || '';
    default:
      // Handle array index access like lines[0].title
      const match = property.match(/^\[(\d+)\]\.(.+)$/);
      if (match && match[1] && match[2]) {
        const index = parseInt(match[1], 10);
        const prop = match[2];
        const line = lines[index];
        if (line && prop) {
          return getOrderLineProperty(line, prop);
        }
      }
      return '';
  }
}

export function getOrderLineProperty(line: OrderLine, property: string): any {
  switch (property) {
    case 'title':
    case 'product_title':
      return line.product_title || '';
    case 'sku':
    case 'product_sku':
      return line.product_sku || '';
    case 'quantity':
      return line.quantity || 0;
    case 'price':
      return DisplayFormatter.formatCurrency(
        parseFloat(line.price_incl_tax || '0')
      );
    case 'price.raw':
      return parseFloat(line.price_incl_tax || '0');
    case 'priceExclTax':
      return DisplayFormatter.formatCurrency(
        parseFloat(line.price_excl_tax || '0')
      );
    case 'priceExclTax.raw':
      return parseFloat(line.price_excl_tax || '0');
    case 'priceExclTaxExclDiscounts':
      return DisplayFormatter.formatCurrency(
        parseFloat(line.price_excl_tax_excl_discounts || '0')
      );
    case 'priceExclTaxExclDiscounts.raw':
      return parseFloat(line.price_excl_tax_excl_discounts || '0');
    case 'priceInclTaxExclDiscounts':
      return DisplayFormatter.formatCurrency(
        parseFloat(line.price_incl_tax_excl_discounts || '0')
      );
    case 'priceInclTaxExclDiscounts.raw':
      return parseFloat(line.price_incl_tax_excl_discounts || '0');
    case 'total':
      return DisplayFormatter.formatCurrency(
        parseFloat(line.price_incl_tax || '0') * (line.quantity || 1)
      );
    case 'total.raw':
      return parseFloat(line.price_incl_tax || '0') * (line.quantity || 1);
    case 'totalExclTax':
      return DisplayFormatter.formatCurrency(
        parseFloat(line.price_excl_tax || '0') * (line.quantity || 1)
      );
    case 'totalExclTax.raw':
      return parseFloat(line.price_excl_tax || '0') * (line.quantity || 1);
    case 'isUpsell':
      return line.is_upsell || false;
    case 'image':
      return line.image || '';
    default:
      return '';
  }
}

export function getOrderAttributionProperty(
  attribution: any,
  property: string
): any {
  if (!attribution) return '';

  switch (property) {
    case 'source':
    case 'utm_source':
      return attribution.utm_source || '';
    case 'medium':
    case 'utm_medium':
      return attribution.utm_medium || '';
    case 'campaign':
    case 'utm_campaign':
      return attribution.utm_campaign || '';
    case 'term':
    case 'utm_term':
      return attribution.utm_term || '';
    case 'content':
    case 'utm_content':
      return attribution.utm_content || '';
    case 'gclid':
      return attribution.gclid || '';
    case 'funnel':
      return attribution.funnel || '';
    case 'affiliate':
      return attribution.affiliate || '';
    case 'hasTracking':
      return !!(
        attribution.utm_source ||
        attribution.utm_medium ||
        attribution.gclid
      );
    default:
      return '';
  }
}

export function getCalculatedProperty(order: Order, property: string): any {
  switch (property) {
    // Subtotal (line items only, excluding shipping and tax)
    case 'subtotal':
    case 'subtotalExclShipping':
      // Calculate subtotal from line items only (excludes shipping)
      if (order.lines && order.lines.length > 0) {
        return order.lines.reduce((sum: number, line: OrderLine) => {
          return sum + parseFloat(line.price_excl_tax || '0');
        }, 0);
      }
      // Fallback: subtract shipping from total_excl_tax
      const totalExclTax = parseFloat(order.total_excl_tax || '0');
      const shippingExclTax = parseFloat(order.shipping_excl_tax || '0');
      return totalExclTax - shippingExclTax;

    // Savings calculations
    case 'savings':
    case 'savingsAmount':
      // Calculate savings from line items if available
      if (order.lines && order.lines.length > 0) {
        const originalTotal = order.lines.reduce(
          (sum: number, line: OrderLine) => {
            return (
              sum +
              parseFloat(
                line.price_incl_tax_excl_discounts || line.price_incl_tax || '0'
              ) *
                line.quantity
            );
          },
          0
        );
        const currentTotal = parseFloat(order.total_incl_tax || '0');
        return Math.max(0, originalTotal - currentTotal);
      }
      // Fallback to discounts if no line item data
      return parseFloat(order.total_discounts || '0');

    case 'savingsPercentage':
      // Calculate savings percentage from line items if available
      if (order.lines && order.lines.length > 0) {
        const originalPrice = order.lines.reduce(
          (sum: number, line: OrderLine) => {
            return (
              sum +
              parseFloat(
                line.price_incl_tax_excl_discounts || line.price_incl_tax || '0'
              ) *
                line.quantity
            );
          },
          0
        );
        const currentPrice = parseFloat(order.total_incl_tax || '0');
        if (originalPrice > 0 && originalPrice > currentPrice) {
          return ((originalPrice - currentPrice) / originalPrice) * 100;
        }
      }
      return 0;

    case 'hasSavings':
      // Check if any discounts applied or line items have pre-discount prices
      if (parseFloat(order.total_discounts || '0') > 0) {
        return true;
      }
      if (order.lines && order.lines.length > 0) {
        return order.lines.some((line: OrderLine) => {
          const beforeDiscount = parseFloat(
            line.price_incl_tax_excl_discounts || '0'
          );
          const afterDiscount = parseFloat(line.price_incl_tax || '0');
          return beforeDiscount > afterDiscount;
        });
      }
      return false;

    // Boolean flags
    case 'hasItems':
      return order.lines && order.lines.length > 0;
    case 'isEmpty':
      return !order.lines || order.lines.length === 0;
    case 'hasShipping':
      return parseFloat(order.shipping_incl_tax || '0') > 0;
    case 'hasTax':
      return parseFloat(order.total_tax || '0') > 0;
    case 'hasDiscounts':
      return parseFloat(order.total_discounts || '0') > 0;
    case 'hasUpsells':
      return order.lines?.some((line: OrderLine) => line.is_upsell) || false;

    // Line items calculations
    case 'lines.count':
      return order.lines?.length || 0;
    case 'lines.totalQuantity':
      return (
        order.lines?.reduce(
          (sum: number, line: OrderLine) => sum + (line.quantity || 0),
          0
        ) || 0
      );
    case 'lines.upsellCount':
      return (
        order.lines?.filter((line: OrderLine) => line.is_upsell).length || 0
      );
    case 'lines.mainProduct':
      return order.lines?.[0]?.product_title || '';
    case 'lines.mainProductSku':
      return order.lines?.[0]?.product_sku || '';

    default:
      return undefined;
  }
}
