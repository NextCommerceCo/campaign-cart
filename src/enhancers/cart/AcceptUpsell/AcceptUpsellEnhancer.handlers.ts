import { useOrderStore } from '@/stores/orderStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useConfigStore } from '@/stores/configStore';
import { GeneralModal } from '@/components/modals/GeneralModal';
import { preserveQueryParams } from '@/utils/url-utils';
import type { AddUpsellLine } from '@/types/api';
import type { UpsellHandlerContext } from './AcceptUpsellEnhancer.types';

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
  const campaign = useCampaignStore.getState().data;
  if (campaign?.currency) return campaign.currency;
  const config = useConfigStore.getState();
  return config?.selectedCurrency ?? config?.detectedCurrency ?? 'USD';
}

function isAlreadyAccepted(packageId: number): boolean {
  const { completedUpsells, upsellJourney } = useOrderStore.getState();
  if (completedUpsells.includes(packageId.toString())) return true;
  return upsellJourney.some(
    e => e.packageId === packageId.toString() && e.action === 'accepted',
  );
}

function resolveRedirectUrl(
  nextUrl: string | undefined,
  metaName: string,
  logger: UpsellHandlerContext['logger'],
): string | undefined {
  if (nextUrl) return nextUrl;
  const metaUrl =
    document.querySelector(`meta[name="${metaName}"]`)?.getAttribute('content') ??
    undefined;
  if (metaUrl) logger.debug(`Using fallback URL from <meta name="${metaName}">:`, metaUrl);
  return metaUrl;
}

async function confirmDuplicate(
  logger: UpsellHandlerContext['logger'],
): Promise<boolean> {
  const proceed = await GeneralModal.showDuplicateUpsell();
  logger.info(
    proceed
      ? 'User confirmed to add duplicate upsell'
      : 'User declined to add duplicate upsell',
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
    const previousLineIds = orderStore.order.lines?.map((line: any) => line.id) ?? [];

    const upsellData: AddUpsellLine = {
      lines: items.map(i => ({ package_id: i.packageId, quantity: i.quantity })),
      currency: getCurrency(),
    };

    const updatedOrder = await orderStore.addUpsell(upsellData, ctx.apiClient);
    if (!updatedOrder) throw new Error('Failed to add bundle upsell — no order returned');

    const addedLines: any[] =
      updatedOrder.lines?.filter(
        (line: any) => line.is_upsell && !previousLineIds.includes(line.id),
      ) ?? [];
    const totalValue = addedLines.reduce(
      (sum: number, line: any) =>
        sum + (line.price_incl_tax ? parseFloat(line.price_incl_tax) : 0),
      0,
    );

    for (const item of items) {
      ctx.emit('upsell:accepted', {
        packageId: item.packageId,
        quantity: item.quantity,
        orderId: useOrderStore.getState().refId,
        value: totalValue,
      });
    }

    const acceptUrl = resolveRedirectUrl(
      ctx.nextUrl,
      'next-upsell-accept-url',
      ctx.logger,
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
        ctx.logger,
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

    if (!updatedOrder) throw new Error('Failed to add upsell — no order returned');

    const addedLine = updatedOrder.lines?.find(
      (line: any) => line.is_upsell && !previousLineIds.includes(line.id),
    );
    const upsellValue = addedLine?.price_incl_tax
      ? parseFloat(addedLine.price_incl_tax)
      : 0;

    ctx.emit('upsell:accepted', {
      packageId: packageIdToAdd,
      quantity: quantityToAdd,
      orderId: useOrderStore.getState().refId,
      value: upsellValue,
    });

    const acceptUrl = resolveRedirectUrl(
      ctx.nextUrl,
      'next-upsell-accept-url',
      ctx.logger,
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
