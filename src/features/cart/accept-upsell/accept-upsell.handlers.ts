import { useOrderStore } from '@/state/order.state';
import { useCampaignStore } from '@/state/campaign';
import { useConfigStore } from '@/state/config.state';
import { GeneralModal } from '@/shared/modals/general-modal';
import { preserveQueryParams } from '@/utils/url-utils';
import type { AddUpsellLine } from '@/types/api';
import { resolveOrderTaxBasis } from '@/core/analytics/taxBasis';
import type { UpsellHandlerContext } from './accept-upsell.types';

function resolvePackageId(ctx: UpsellHandlerContext): number | undefined {
  if (ctx.selectorId && ctx.selectedItemRef.value) {
    return ctx.selectedItemRef.value.packageId;
  }
  return ctx.packageId;
}

function resolveQuantity(ctx: UpsellHandlerContext): number {
  if (ctx.selectorId && ctx.selectedItemRef.value?.quantity) {
    return ctx.selectedItemRef.value.quantity;
  }
  return ctx.quantity;
}

function getCurrency(): string {
  return (
    useCampaignStore.getState().data?.currency ??
    useConfigStore.getState().getCurrency()
  );
}

function isAlreadyAccepted(packageId: number): boolean {
  const { completedUpsells, upsellJourney } = useOrderStore.getState();
  if (completedUpsells.includes(packageId.toString())) return true;
  return upsellJourney.some(
    e => e.packageId === packageId.toString() && e.action === 'accepted'
  );
}

function resolveRedirectUrl(
  nextUrl: string | undefined,
  metaName: string,
  logger: UpsellHandlerContext['logger']
): string | undefined {
  if (nextUrl) return nextUrl;
  const metaUrl =
    document
      .querySelector(`meta[name="${metaName}"]`)
      ?.getAttribute('content') ?? undefined;
  if (metaUrl)
    logger.debug(`Using fallback URL from <meta name="${metaName}">:`, metaUrl);
  return metaUrl;
}

async function confirmDuplicate(
  logger: UpsellHandlerContext['logger']
): Promise<boolean> {
  const proceed = await GeneralModal.showDuplicateUpsell();
  logger.info(
    proceed
      ? 'User confirmed to add duplicate upsell'
      : 'User declined to add duplicate upsell'
  );
  return proceed;
}

async function acceptBundleUpsell(ctx: UpsellHandlerContext): Promise<void> {
  const items = ctx.bundleItemsRef.value;
  if (!items || items.length === 0) {
    ctx.logger.warn('No bundle items selected for upsell');
    return;
  }

  const orderStore = useOrderStore.getState();
  if (!orderStore.order) {
    ctx.logger.error('No order loaded');
    return;
  }

  ctx.loadingOverlay.show();
  try {
    const previousLineIds =
      orderStore.order.lines?.map((line: any) => line.id) ?? [];

    const upsellData: AddUpsellLine = {
      lines: items.map(i => ({
        package_id: i.packageId,
        quantity: i.quantity,
      })),
      currency: getCurrency(),
    };

    const updatedOrder = await orderStore.addUpsell(upsellData, ctx.apiClient);
    if (!updatedOrder)
      throw new Error('Failed to add bundle upsell — no order returned');

    const addedLines: any[] =
      updatedOrder.lines?.filter(
        (line: any) => line.is_upsell && !previousLineIds.includes(line.id)
      ) ?? [];
    // Item revenue on the displayed basis (incl tax for VAT stores, excl for
    // tax-exclusive) — matches the purchase event and excludes shipping.
    const inclusive =
      resolveOrderTaxBasis(
        updatedOrder,
        useCampaignStore.getState().data?.packages ?? []
      ) === 'incl';
    const totalValue = addedLines.reduce(
      (sum: number, line: any) =>
        sum +
        parseFloat(
          (inclusive ? line.price_incl_tax : line.price_excl_tax) ??
            line.price_incl_tax ??
            '0'
        ),
      0
    );
    // Pre-discount total on the same tax basis; the difference is the discount
    // the customer received, surfaced as GA4 item `discount`.
    const totalValueExclDiscounts = addedLines.reduce(
      (sum: number, line: any) =>
        sum +
        parseFloat(
          (inclusive
            ? line.price_incl_tax_excl_discounts
            : line.price_excl_tax_excl_discounts) ??
            line.price_incl_tax_excl_discounts ??
            '0'
        ),
      0
    );
    const totalDiscount = Math.max(0, totalValueExclDiscounts - totalValue);
    // Coupon applied to the order, if any (read from the order, not the cart).
    const coupon =
      (updatedOrder as any).vouchers?.[0]?.code ??
      (updatedOrder as any).vouchers?.[0];

    for (const item of items) {
      ctx.emit('upsell:accepted', {
        packageId: item.packageId,
        quantity: item.quantity,
        orderId: useOrderStore.getState().refId,
        value: totalValue,
        discount: totalDiscount,
        ...(coupon ? { coupon: String(coupon) } : {}),
      });
    }

    const acceptUrl = resolveRedirectUrl(
      ctx.nextUrl,
      'next-upsell-accept-url',
      ctx.logger
    );
    if (acceptUrl) {
      window.location.href = preserveQueryParams(acceptUrl);
    } else {
      ctx.loadingOverlay.hide();
    }
  } catch (error) {
    ctx.logger.error('Failed to accept bundle upsell:', error);
    ctx.loadingOverlay.hide(true);
    throw error;
  }
}

export async function acceptUpsell(ctx: UpsellHandlerContext): Promise<void> {
  if (ctx.bundleSelectorId) {
    await acceptBundleUpsell(ctx);
    return;
  }

  const packageIdToAdd = resolvePackageId(ctx);
  const quantityToAdd = resolveQuantity(ctx);

  if (!packageIdToAdd) {
    ctx.logger.warn('No package ID available for accept-upsell action');
    return;
  }

  const orderStore = useOrderStore.getState();

  if (!orderStore.order) {
    ctx.logger.error('No order loaded');
    return;
  }

  if (isAlreadyAccepted(packageIdToAdd)) {
    const proceed = await confirmDuplicate(ctx.logger);
    if (!proceed) {
      const declineUrl = resolveRedirectUrl(
        ctx.nextUrl,
        'next-upsell-decline-url',
        ctx.logger
      );
      if (declineUrl) window.location.href = preserveQueryParams(declineUrl);
      return;
    }
  }

  ctx.loadingOverlay.show();

  try {
    const previousLineIds =
      orderStore.order.lines?.map((line: any) => line.id) ?? [];

    const upsellData: AddUpsellLine = {
      lines: [{ package_id: packageIdToAdd, quantity: quantityToAdd }],
      currency: getCurrency(),
    };

    const updatedOrder = await orderStore.addUpsell(upsellData, ctx.apiClient);

    if (!updatedOrder)
      throw new Error('Failed to add upsell — no order returned');

    const addedLine = updatedOrder.lines?.find(
      (line: any) => line.is_upsell && !previousLineIds.includes(line.id)
    );
    // Item revenue on the displayed basis (incl tax for VAT stores, excl for
    // tax-exclusive) — matches the purchase event and excludes shipping.
    const inclusive =
      resolveOrderTaxBasis(
        updatedOrder,
        useCampaignStore.getState().data?.packages ?? []
      ) === 'incl';
    const upsellValue = parseFloat(
      (inclusive ? addedLine?.price_incl_tax : addedLine?.price_excl_tax) ??
        addedLine?.price_incl_tax ??
        '0'
    );
    // Pre-discount line total on the same tax basis; the difference is the
    // discount the customer received, surfaced as GA4 item `discount`.
    const upsellValueExclDiscounts = parseFloat(
      (inclusive
        ? addedLine?.price_incl_tax_excl_discounts
        : addedLine?.price_excl_tax_excl_discounts) ??
        addedLine?.price_incl_tax_excl_discounts ??
        '0'
    );
    const upsellDiscount = Math.max(0, upsellValueExclDiscounts - upsellValue);
    // Coupon applied to the order, if any. Read from the order itself (not the
    // cart) so a main-order promo code isn't mis-attributed to the upsell;
    // offer-priced upsells carry no code and leave this undefined.
    const coupon =
      (updatedOrder as any).vouchers?.[0]?.code ??
      (updatedOrder as any).vouchers?.[0];

    ctx.emit('upsell:accepted', {
      packageId: packageIdToAdd,
      quantity: quantityToAdd,
      orderId: useOrderStore.getState().refId,
      value: upsellValue,
      discount: upsellDiscount,
      ...(coupon ? { coupon: String(coupon) } : {}),
    });

    const acceptUrl = resolveRedirectUrl(
      ctx.nextUrl,
      'next-upsell-accept-url',
      ctx.logger
    );

    if (acceptUrl) {
      window.location.href = preserveQueryParams(acceptUrl);
    } else {
      ctx.loadingOverlay.hide();
    }
  } catch (error) {
    ctx.logger.error('Failed to accept upsell:', error);
    ctx.loadingOverlay.hide(true);
    throw error;
  }
}
