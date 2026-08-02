/**
 * `SDKInitializer`'s URL-parameter handling — extracted verbatim from
 * `sdk-initializer.ts`. None of these are boot steps in their own right: they run
 * from inside `loadConfiguration` and `loadCampaignData`, which are the steps the
 * boot-sequence generator inspects, so unlike the location-currency and
 * attribution modules the whole body moved — there is no shell left behind.
 */

import type { Logger } from '@/core/logger';
import { useCampaignStore } from '@/state/campaign';
import { cartOperations } from '@/state/cart';

export async function captureUrlParameters(
  ctx: { logger: Logger },
  urlParams: URLSearchParams
): Promise<void> {
  try {
    // Import parameter store
    const { useParameterStore } = await import('@/state/parameter');
    const paramStore = useParameterStore.getState();

    // Get existing stored parameters
    const existingParams = { ...paramStore.params };

    // Capture all current URL parameters
    const currentParams: Record<string, string> = {};
    urlParams.forEach((value, key) => {
      currentParams[key] = value;
    });

    // Merge with existing parameters (new URL params override stored ones)
    const mergedParams = { ...existingParams, ...currentParams };

    // Update the store with merged parameters
    if (Object.keys(mergedParams).length > 0) {
      paramStore.updateParams(mergedParams);
      ctx.logger.debug(
        `Captured ${Object.keys(currentParams).length} URL parameters, total stored: ${Object.keys(mergedParams).length}`
      );

      // Log special parameters we're interested in for visibility control
      const visibilityParams = [
        'seen',
        'timer',
        'reviews',
        'loading',
        'banner',
        'exit',
      ];
      const relevantParams = Object.keys(mergedParams).filter(key =>
        visibilityParams.includes(key)
      );
      if (relevantParams.length > 0) {
        ctx.logger.info(
          'Visibility control parameters detected:',
          relevantParams.map(k => `${k}=${mergedParams[k]}`).join(', ')
        );
      }
    }
  } catch (error) {
    ctx.logger.warn('Failed to capture URL parameters:', error);
    // Non-critical error, continue with initialization
  }
}

export async function processForcePackageId(ctx: {
  logger: Logger;
}): Promise<void> {
  const forcePackageId = (window as any)._nextForcePackageId;

  if (!forcePackageId) {
    return;
  }

  try {
    ctx.logger.info('Processing forcePackageId parameter:', forcePackageId);

    const campaignStore = useCampaignStore.getState();

    // Clear existing cart
    cartOperations.clear();
    ctx.logger.debug('Cart cleared for forcePackageId');

    // Parse the format: x:2,y:1 -> [{id: x, quantity: 2}, {id: y, quantity: 1}]
    const packageSpecs = forcePackageId.split(',').map((spec: string) => {
      const [idStr, quantityStr] = spec.trim().split(':');
      const packageId = parseInt(idStr || '', 10);
      const quantity = quantityStr ? parseInt(quantityStr, 10) : 1;

      if (isNaN(packageId) || packageId <= 0) {
        throw new Error(`Invalid package ID: ${idStr}`);
      }

      if (isNaN(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity: ${quantityStr}`);
      }

      return { packageId, quantity };
    });

    ctx.logger.debug('Parsed package specifications:', packageSpecs);

    // Add each package to cart
    for (const spec of packageSpecs) {
      const packageData = campaignStore.getPackage(spec.packageId);

      if (!packageData) {
        ctx.logger.warn(
          `Package ${spec.packageId} not found in campaign data, skipping`
        );
        continue;
      }

      await cartOperations.addItem({
        packageId: spec.packageId,
        quantity: spec.quantity,
        isUpsell: false,
      });

      ctx.logger.debug(
        `Added package ${spec.packageId} with quantity ${spec.quantity} to cart`
      );
    }

    ctx.logger.info(
      `Successfully processed forcePackageId: added ${packageSpecs.length} package(s) to cart`
    );

    // Clean up the temporary storage
    delete (window as any)._nextForcePackageId;
  } catch (error) {
    ctx.logger.error('Error processing forcePackageId parameter:', error);
    // Don't throw - this shouldn't break SDK initialization
  }
}

export async function processForceShippingId(ctx: {
  logger: Logger;
}): Promise<void> {
  const forceShippingId = (window as any)._nextForceShippingId;

  if (!forceShippingId) {
    return;
  }

  try {
    ctx.logger.info(
      'Processing forceShippingId parameter:',
      forceShippingId
    );

    const campaignStore = useCampaignStore.getState();

    // Parse the shipping ID (should be a number)
    const shippingId = parseInt(forceShippingId, 10);

    if (isNaN(shippingId) || shippingId <= 0) {
      throw new Error(`Invalid shipping ID: ${forceShippingId}`);
    }

    // Verify the shipping method exists in campaign data
    const campaignData = campaignStore.data;
    if (!campaignData?.shipping_methods) {
      ctx.logger.warn('No shipping methods available in campaign data');
      return;
    }

    const shippingMethod = campaignData.shipping_methods.find(
      method => method.ref_id === shippingId
    );

    if (!shippingMethod) {
      ctx.logger.warn(
        `Shipping method ${shippingId} not found in campaign data`
      );
      ctx.logger.debug(
        'Available shipping methods:',
        campaignData.shipping_methods.map(m => ({
          id: m.ref_id,
          code: m.code,
          price: m.price,
        }))
      );
      return;
    }

    // Set the shipping method
    await cartOperations.setShippingMethod(shippingId);

    ctx.logger.info(
      `Successfully set shipping method: ${shippingMethod.code} (ID: ${shippingId}, Price: $${shippingMethod.price})`
    );

    // Clean up the temporary storage
    delete (window as any)._nextForceShippingId;
  } catch (error) {
    ctx.logger.error('Error processing forceShippingId parameter:', error);
    // Don't throw - this shouldn't break SDK initialization
  }
}
