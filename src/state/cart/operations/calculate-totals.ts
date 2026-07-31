import Decimal from 'decimal.js';
import { EventBus } from '@/core/events';
import { useCartStore } from '@/state/cart';
import { logger, scheduleCalculate } from './shared';

export function calculateTotals(): void {
  useCartStore.setState({ isCalculating: true });
  scheduleCalculate(async signal => {
    try {
      const { useCampaignStore } = await import('@/state/campaign');
      const { useCheckoutStore } = await import('@/state/checkout');
      const { calculateCart } = await import(
        '@/state/cart/cart-calculator'
      );

      const campaignState = useCampaignStore.getState();
      const checkoutState = useCheckoutStore.getState();
      const state = useCartStore.getState();

      try {
        const {
          subtotal,
          total,
          hasDiscounts,
          totalDiscount,
          totalDiscountPercentage,
          shippingMethod,
          summary,
        } = await calculateCart({
          lines: state.items.map(item => ({
            package_id: item.packageId,
            quantity: item.quantity,
            is_upsell: item.is_upsell ?? false,
          })),
          vouchers: [...checkoutState.vouchers],
          currency: campaignState.currency ?? null,
          shippingMethod: state.shippingMethod?.id ?? 1,
          signal,
        });

        if (!summary) return;

        const updatedItems = state.items.map(item => {
          const line = summary.lines.find(l => l.package_id === item.packageId);
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

        // Enrich each summary line with package data and cart item properties.
        //
        // When multiple cart items share the same packageId but have different
        // properties (personalised slots), we need to match properties to the
        // correct display row:
        //
        // - API returns N lines for packageId X (already split) AND we have N
        //   property groups → assign properties by position (line[i] → group[i]).
        // - API returns 1 merged line for packageId X AND we have N groups →
        //   expand the single line into N rows (first occurrence only).
        //
        // This avoids doubling rows when the API already returns one per slot.
        type PropGroup = {
          properties: Record<string, string> | undefined;
          quantity: number;
        };

        // Pre-compute property groups per packageId (ordered, deduped by fingerprint).
        const propGroupsByPackage = new Map<number, PropGroup[]>();
        for (const ci of state.items) {
          if (!propGroupsByPackage.has(ci.packageId)) {
            propGroupsByPackage.set(ci.packageId, []);
          }
          const groups = propGroupsByPackage.get(ci.packageId)!;
          const key =
            ci.properties && Object.keys(ci.properties).length > 0
              ? JSON.stringify(
                  Object.fromEntries(Object.entries(ci.properties).sort())
                )
              : '';
          const existingIdx = groups.findIndex(g => {
            const gKey =
              g.properties && Object.keys(g.properties).length > 0
                ? JSON.stringify(
                    Object.fromEntries(Object.entries(g.properties).sort())
                  )
                : '';
            return gKey === key;
          });
          if (existingIdx >= 0) {
            groups[existingIdx]!.quantity += ci.quantity;
          } else {
            groups.push({ properties: ci.properties, quantity: ci.quantity });
          }
        }

        // Count how many API lines were returned per packageId.
        const apiLineCountByPackage = new Map<number, number>();
        for (const l of summary.lines) {
          apiLineCountByPackage.set(
            l.package_id,
            (apiLineCountByPackage.get(l.package_id) ?? 0) + 1
          );
        }

        // Per-packageId index so we can assign groups positionally.
        const apiLineIdxByPackage = new Map<number, number>();

        const enrichedSummaryLines: (typeof summary.lines)[number][] = [];
        for (const line of summary.lines) {
          const pkg = campaignState.getPackage(line.package_id);
          if (!pkg) {
            enrichedSummaryLines.push(line);
            continue;
          }

          const baseEnriched = {
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

          const groups = propGroupsByPackage.get(line.package_id) ?? [];
          const apiCount = apiLineCountByPackage.get(line.package_id) ?? 1;
          const currentIdx = apiLineIdxByPackage.get(line.package_id) ?? 0;
          apiLineIdxByPackage.set(line.package_id, currentIdx + 1);

          if (apiCount >= groups.length) {
            // API already has at least one line per property group → assign by position.
            const group = groups[currentIdx];
            enrichedSummaryLines.push({
              ...baseEnriched,
              ...(group?.properties !== undefined && {
                properties: group.properties,
              }),
            });
          } else if (currentIdx === 0) {
            // API merged multiple slots into one line → expand into N rows.
            const totalQty = line.quantity > 0 ? line.quantity : 1;
            for (const group of groups) {
              const ratio = group.quantity / totalQty;
              enrichedSummaryLines.push({
                ...baseEnriched,
                quantity: group.quantity,
                subtotal: (parseFloat(line.subtotal) * ratio).toFixed(2),
                total: (parseFloat(line.total) * ratio).toFixed(2),
                total_discount: (
                  parseFloat(line.total_discount) * ratio
                ).toFixed(2),
                ...(group.properties !== undefined && {
                  properties: group.properties,
                }),
              });
            }
            // Remaining API lines for this packageId are absorbed — skip them.
          }
          // else: currentIdx > 0 with apiCount < groups.length → already handled above, skip.
        }

        if (signal.aborted) return;
        const totalQuantity = summary.lines.reduce((s, l) => s + l.quantity, 0);
        useCartStore.setState({
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
        EventBus.getInstance().emit('cart:updated', useCartStore.getState());
      } catch (error) {
        if (signal.aborted) return;
        logger.error('Failed to sync cart with API:', error);
        useCartStore.setState({ isCalculating: false });
      }
    } catch (error) {
      logger.error('Error calculating totals:', error);
      useCartStore.setState({
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
}
