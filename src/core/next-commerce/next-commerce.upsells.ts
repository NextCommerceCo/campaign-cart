/**
 * `NextCommerce`'s Upsells category — extracted verbatim from
 * `next-commerce.ts`. Only `addUpsell` reads instance state (`logger`,
 * `eventBus`); the other three read only the order store.
 */

import type { AddUpsellLine } from '@/types/api';
import { useOrderStore } from '@/state/order';
import { useConfigStore } from '@/state/config';
import { getApiClient } from '@/client';
import type { EventBus } from '@/core/events';
import type { Logger } from '@/core/logger';

/** Options accepted by {@link addUpsell}. */
export interface AddUpsellOptions {
  packageId?: number;
  quantity?: number;
  items?: Array<{ packageId: number; quantity?: number }>;
}

/**
 * Adds packages to the already-paid order, charging the saved payment
 * method. Throws when there is no order in session, when the order cannot
 * take upsells or is mid-processing, and when neither `packageId` nor
 * `items` is given.
 * @category Upsells
 */
export async function addUpsell(
  ctx: { logger: Logger; eventBus: EventBus },
  options: AddUpsellOptions
): Promise<any> {
  const orderStore = useOrderStore.getState();
  const configStore = useConfigStore.getState();

  // Check if order exists
  if (!orderStore.order) {
    throw new Error(
      'No order found. Upsells can only be added after order completion.'
    );
  }

  // Check if order supports upsells
  if (!orderStore.canAddUpsells()) {
    throw new Error(
      'Order does not support post-purchase upsells or is currently processing.'
    );
  }

  // The shared API client for this page
  const apiClient = getApiClient(configStore.apiKey);

  // Build upsell data - support both single item and multiple items
  let lines: Array<{ package_id: number; quantity: number }> = [];

  if (options.items && options.items.length > 0) {
    // Multiple items provided
    lines = options.items.map(item => ({
      package_id: item.packageId,
      quantity: item.quantity || 1,
    }));
  } else if (options.packageId) {
    // Single item provided
    lines = [
      {
        package_id: options.packageId,
        quantity: options.quantity || 1,
      },
    ];
  } else {
    throw new Error('Either packageId or items array must be provided');
  }

  const upsellData: AddUpsellLine = { lines };

  ctx.logger.info('Adding upsell(s) via SDK:', upsellData);

  try {
    // Store previous line IDs to identify new additions
    const previousLineIds =
      orderStore.order?.lines?.map((line: any) => line.id) || [];

    // Add the upsell(s)
    const updatedOrder = await orderStore.addUpsell(upsellData, apiClient);

    if (!updatedOrder) {
      throw new Error('Failed to add upsell - no updated order returned');
    }

    // Find all newly added upsell lines
    const addedLines =
      updatedOrder.lines?.filter(
        (line: any) => line.is_upsell && !previousLineIds.includes(line.id)
      ) || [];

    // Calculate total value of added upsells
    const totalUpsellValue = addedLines.reduce((sum: number, line: any) => {
      return sum + (line.price_incl_tax ? parseFloat(line.price_incl_tax) : 0);
    }, 0);

    // Emit event for each added item
    lines.forEach((line, index) => {
      const addedLine = addedLines[index];
      const value = addedLine?.price_incl_tax
        ? parseFloat(addedLine.price_incl_tax)
        : 0;

      ctx.eventBus.emit('upsell:added', {
        packageId: line.package_id,
        quantity: line.quantity,
        order: updatedOrder,
        value: value,
      });
    });

    return {
      order: updatedOrder,
      addedLines: addedLines,
      totalValue: totalUpsellValue,
    };
  } catch (error) {
    ctx.logger.error('Failed to add upsell(s) via SDK:', error);
    throw error;
  }
}

/**
 * Whether the order in session can take a post-purchase upsell right now.
 * Also `false` while one is processing, so it guards a double submit.
 * @category Upsells
 */
export function canAddUpsells(): boolean {
  const orderStore = useOrderStore.getState();
  return orderStore.canAddUpsells();
}

/**
 * Package ids already accepted on this order, as strings rather than
 * numbers.
 * @category Upsells
 */
export function getCompletedUpsells(): string[] {
  const orderStore = useOrderStore.getState();
  return orderStore.completedUpsells;
}

/**
 * Whether a package was already accepted on this order — checks the
 * completed list and the accepted entries of the upsell journey, so it
 * survives a reload.
 * @category Upsells
 */
export function isUpsellAlreadyAdded(packageId: number): boolean {
  const orderStore = useOrderStore.getState();

  // Check in completed upsells
  if (orderStore.completedUpsells.includes(packageId.toString())) {
    return true;
  }

  // Also check in upsell journey for accepted items
  const acceptedInJourney = orderStore.upsellJourney.some(
    entry =>
      entry.packageId === packageId.toString() && entry.action === 'accepted'
  );

  return acceptedInJourney;
}
