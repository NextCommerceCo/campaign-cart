import { useOrderStore } from '@/stores/orderStore';
import { useCampaignStore } from '@/stores/campaignStore';
import { useConfigStore } from '@/stores/configStore';
import { GeneralModal } from '@/components/modals/GeneralModal';
import { preserveQueryParams } from '@/utils/url-utils';
import type { AddUpsellLine } from '@/types/api';
import { renderProcessingState, renderSuccess, renderError } from './UpsellEnhancer.renderer';
import type { UpsellHandlerContext } from './UpsellEnhancer.types';

// Module-level deduplication: only track one page view per unique path per page load
let pageViewTracked = false;
let trackedPagePath: string | null = null;

function getCurrency(): string {
  const campaign = useCampaignStore.getState();
  if (campaign?.currency) return campaign.currency;
  const config = useConfigStore.getState();
  return config?.selectedCurrency ?? config?.detectedCurrency ?? 'USD';
}

export function checkIfUpsellAlreadyAccepted(packageId: number): boolean {
  const store = useOrderStore.getState();
  return (
    store.completedUpsells.includes(packageId.toString()) ||
    store.upsellJourney.some(
      e => e.packageId === packageId.toString() && e.action === 'accepted',
    )
  );
}

async function showDuplicateUpsellDialog(
  logger: UpsellHandlerContext['logger'],
): Promise<boolean> {
  const result = await GeneralModal.showDuplicateUpsell();
  logger.info(
    result
      ? 'User confirmed to add duplicate upsell'
      : 'User declined to add duplicate upsell',
  );
  return result;
}

export function navigateToUrl(
  url: string,
  refId: string | undefined,
  logger: UpsellHandlerContext['logger'],
): void {
  if (!url) {
    logger.warn('No URL provided for navigation');
    return;
  }
  try {
    const targetUrl = new URL(url, window.location.origin);
    const orderRefId = refId ?? useOrderStore.getState().order?.ref_id;
    if (orderRefId && !targetUrl.searchParams.has('ref_id')) {
      targetUrl.searchParams.append('ref_id', orderRefId);
    }
    const finalUrl = preserveQueryParams(targetUrl.href);
    logger.info(`Navigating to ${finalUrl}`);
    window.location.href = finalUrl;
  } catch (error) {
    logger.error('Invalid URL for navigation:', url, error);
    window.location.href = preserveQueryParams(url);
  }
}

export function trackUpsellPageView(
  logger: UpsellHandlerContext['logger'],
  emit: UpsellHandlerContext['emit'],
): void {
  const meta = document.querySelector('meta[name="next-page-type"]');
  if (!meta || meta.getAttribute('content') !== 'upsell') return;
  const pagePath = window.location.pathname;
  if (pageViewTracked && trackedPagePath === pagePath) return;
  pageViewTracked = true;
  trackedPagePath = pagePath;
  const orderStore = useOrderStore.getState();
  if (orderStore.order) {
    orderStore.markUpsellPageViewed(pagePath);
    logger.debug('Tracked upsell page view:', pagePath);
    emit('upsell:viewed', { pagePath, orderId: orderStore.order.ref_id });
  }
}

export async function addUpsellToOrder(
  nextUrl: string | null | undefined,
  ctx: UpsellHandlerContext,
): Promise<void> {
  const orderStore = useOrderStore.getState();
  ctx.logger.debug('Order state check:', {
    hasOrder: !!orderStore.order,
    supportsUpsells: orderStore.order?.supports_post_purchase_upsells,
    isProcessingUpsell: orderStore.isProcessingUpsell,
    canAddUpsells: orderStore.canAddUpsells(),
  });

  if (!orderStore.canAddUpsells()) {
    ctx.logger.warn('Order does not support upsells or is currently processing');
    if (orderStore.isProcessingUpsell && orderStore.order?.supports_post_purchase_upsells) {
      ctx.logger.warn('Processing flag stuck, resetting...');
      orderStore.setProcessingUpsell(false);
    }
    if (!orderStore.canAddUpsells()) {
      renderError(ctx.element, 'Unable to add upsell at this time', ctx.logger);
      if (nextUrl) setTimeout(() => navigateToUrl(nextUrl, undefined, ctx.logger), 1000);
      return;
    }
  }

  const packageToAdd = ctx.isSelector
    ? (ctx.selectedPackageId ?? ctx.packageId)
    : ctx.packageId;

  if (packageToAdd && checkIfUpsellAlreadyAccepted(packageToAdd)) {
    const proceed = await showDuplicateUpsellDialog(ctx.logger);
    if (!proceed) {
      if (nextUrl) navigateToUrl(nextUrl, undefined, ctx.logger);
      return;
    }
  }

  ctx.logger.debug('Package selection:', {
    isSelector: ctx.isSelector,
    packageId: ctx.packageId,
    selectedPackageId: ctx.selectedPackageId,
    packageToAdd,
  });

  if (!packageToAdd) {
    ctx.logger.warn('No package selected for upsell');
    renderError(ctx.element, 'Please select an option first', ctx.logger);
    return;
  }

  try {
    ctx.isProcessingRef.value = true;
    renderProcessingState(ctx.element, ctx.actionButtons, true);
    ctx.loadingOverlay.show();
    ctx.emit('upsell:adding', { packageId: packageToAdd });

    let quantityToUse = ctx.quantity;
    if (ctx.selectorId && ctx.quantityBySelectorId.has(ctx.selectorId)) {
      quantityToUse = ctx.quantityBySelectorId.get(ctx.selectorId)!;
    } else if (
      ctx.currentQuantitySelectorId &&
      ctx.quantityBySelectorId.has(ctx.currentQuantitySelectorId)
    ) {
      quantityToUse = ctx.quantityBySelectorId.get(ctx.currentQuantitySelectorId)!;
    }

    const upsellData: AddUpsellLine = {
      lines: [{ package_id: packageToAdd, quantity: quantityToUse }],
      currency: getCurrency(),
    };
    ctx.logger.info('Adding upsell to order:', upsellData);
    const updatedOrder = await orderStore.addUpsell(upsellData, ctx.apiClient);
    if (!updatedOrder) throw new Error('Failed to add upsell - no updated order returned');

    ctx.logger.info('Upsell added successfully');
    renderSuccess(ctx.element);

    let upsellValue = 0;
    const prevLineIds = orderStore.order?.lines?.map((l: { id: unknown }) => l.id) ?? [];
    const addedLine = updatedOrder.lines?.find(
      (l: { is_upsell: boolean; id: unknown; price_incl_tax?: string }) =>
        l.is_upsell && !prevLineIds.includes(l.id),
    );
    if (addedLine?.price_incl_tax) upsellValue = parseFloat(addedLine.price_incl_tax);
    const pkgData = useCampaignStore.getState().getPackage(packageToAdd);
    if (pkgData && !upsellValue && pkgData.price) {
      upsellValue = parseFloat(pkgData.price) * ctx.quantity;
    }

    ctx.emit('upsell:added', {
      packageId: packageToAdd,
      quantity: quantityToUse,
      order: updatedOrder,
      value: upsellValue,
      willRedirect: !!nextUrl,
    });

    if (nextUrl) {
      setTimeout(() => navigateToUrl(nextUrl, updatedOrder.ref_id, ctx.logger), 100);
    } else {
      ctx.loadingOverlay.hide();
    }
  } catch (error) {
    ctx.logger.error('Failed to add upsell:', error);
    renderError(
      ctx.element,
      error instanceof Error ? error.message : 'Failed to add upsell',
      ctx.logger,
    );
    ctx.emit('upsell:error', {
      packageId: ctx.packageId ?? 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    ctx.loadingOverlay.hide(true);
    if (nextUrl) {
      ctx.logger.info('Navigating to next page despite API error');
      setTimeout(() => navigateToUrl(nextUrl, undefined, ctx.logger), 1000);
    }
  } finally {
    ctx.isProcessingRef.value = false;
    renderProcessingState(ctx.element, ctx.actionButtons, false);
  }
}

export function skipUpsell(
  nextUrl: string | null | undefined,
  ctx: UpsellHandlerContext,
): void {
  ctx.logger.info('Upsell skipped by user');
  ctx.element.classList.add('next-skipped');
  ctx.actionButtons.forEach(btn => {
    if (btn instanceof HTMLButtonElement) btn.disabled = true;
    btn.classList.add('next-disabled');
  });

  if (ctx.packageId !== undefined) {
    useOrderStore.getState().markUpsellSkipped(ctx.packageId.toString(), ctx.currentPagePath);
  }

  const eventData: { packageId?: number; orderId?: string } = {};
  if (ctx.packageId !== undefined) eventData.packageId = ctx.packageId;
  const refId = useOrderStore.getState().order?.ref_id;
  if (refId !== undefined) eventData.orderId = refId;
  ctx.emit('upsell:skipped', eventData);

  if (nextUrl) navigateToUrl(nextUrl, undefined, ctx.logger);
}

export async function handleActionClick(
  event: Event,
  ctx: UpsellHandlerContext,
): Promise<void> {
  event.preventDefault();
  if (ctx.isProcessingRef.value) {
    ctx.logger.debug('Upsell action blocked - already processing');
    return;
  }

  const button = event.currentTarget as HTMLElement;
  const action = button.getAttribute('data-next-upsell-action') ?? '';

  let nextUrl =
    button.getAttribute('data-next-url') ??
    button.getAttribute('data-next-next-url') ??
    button.getAttribute('data-os-next-url') ??
    undefined;

  if (!nextUrl) {
    const metaName =
      action === 'add' || action === 'accept'
        ? 'next-upsell-accept-url'
        : action === 'skip' || action === 'decline'
          ? 'next-upsell-decline-url'
          : null;
    if (metaName) {
      nextUrl =
        document.querySelector(`meta[name="${metaName}"]`)?.getAttribute('content') ?? undefined;
      if (nextUrl) ctx.logger.debug('Using fallback URL from meta tag:', nextUrl);
    }
  }

  ctx.logger.debug('Upsell action clicked:', { action, nextUrl });

  switch (action) {
    case 'add':
    case 'accept':
      await addUpsellToOrder(nextUrl, ctx);
      break;
    case 'skip':
    case 'decline':
      skipUpsell(nextUrl, ctx);
      break;
    default:
      ctx.logger.warn(`Unknown upsell action: ${action}`);
  }
}
