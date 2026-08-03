/**
 * `NextCommerce`'s Popups category — extracted verbatim from
 * `next-commerce.ts`. `exitIntent`/`fomo` lazy-load and cache their enhancer
 * on first call, so the cached instance has to be a **ref the caller owns**,
 * not a copied value — the same shape as `inProgress` in
 * `features/checkout/checkout-form/billing-animation.ts`. The two former
 * private fields (`exitIntentEnhancer`, `fomoEnhancer`) became one
 * `PopupsState` ref object for that reason; the class still owns the single
 * instance, this module only reads/writes through it.
 */

import type { Logger } from '@/core/logger';

/** Owned by `NextCommerce`, one per instance, passed by reference. */
export interface PopupsState {
  exitIntentEnhancer: any;
  fomoEnhancer: any;
}

export async function exitIntent(
  ctx: { state: PopupsState; logger: Logger },
  options: {
    image?: string;
    template?: string;
    action?: () => void | Promise<void>;
    disableOnMobile?: boolean;
    mobileScrollTrigger?: boolean;
    maxTriggers?: number;
    useSessionStorage?: boolean;
    sessionStorageKey?: string;
    overlayClosable?: boolean;
    showCloseButton?: boolean;
    imageClickable?: boolean;
    actionButtonText?: string;
  }
): Promise<void> {
  try {
    // Lazy load the enhancer
    if (!ctx.state.exitIntentEnhancer) {
      const { ExitIntentEnhancer } = await import(
        '@/features/behavior/simple-exit-intent'
      );
      ctx.state.exitIntentEnhancer = new ExitIntentEnhancer();
      await ctx.state.exitIntentEnhancer.initialize();
    }

    // Set up exit intent with simple config
    ctx.state.exitIntentEnhancer.setup(options);
    ctx.logger.debug('Exit intent configured with image:', options.image);
  } catch (error) {
    ctx.logger.error('Failed to setup exit intent:', error);
    throw error;
  }
}

export function disableExitIntent(ctx: { state: PopupsState }): void {
  if (ctx.state.exitIntentEnhancer) {
    ctx.state.exitIntentEnhancer.disable();
  }
}

export async function fomo(
  ctx: { state: PopupsState; logger: Logger },
  config?: {
    items?: Array<{ text: string; image: string }>;
    customers?: { [country: string]: string[] };
    maxMobileShows?: number;
    displayDuration?: number;
    delayBetween?: number;
    initialDelay?: number;
  }
): Promise<void> {
  try {
    // Lazy load the enhancer
    if (!ctx.state.fomoEnhancer) {
      const { FomoPopupEnhancer } = await import(
        '@/features/behavior/fomo-popup'
      );
      ctx.state.fomoEnhancer = new FomoPopupEnhancer();
      await ctx.state.fomoEnhancer.initialize();
    }

    // Configure and start
    ctx.state.fomoEnhancer.setup(config);
    ctx.state.fomoEnhancer.start();
    ctx.logger.debug('FOMO popup started');
  } catch (error) {
    ctx.logger.error('Failed to start FOMO popup:', error);
    throw error;
  }
}

export function stopFomo(ctx: { state: PopupsState }): void {
  if (ctx.state.fomoEnhancer) {
    ctx.state.fomoEnhancer.stop();
  }
}
