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

/** Options accepted by {@link exitIntent}. */
export interface ExitIntentOptions {
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

/**
 * Arms the exit-intent popup, lazy-loading its enhancer on the first call.
 * Rethrows when that import fails.
 * @category Popups
 */
export async function exitIntent(
  ctx: { state: PopupsState; logger: Logger },
  options: ExitIntentOptions
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

/**
 * Stops the exit-intent popup from appearing again. No-op when {@link
 * core/next-commerce!NextCommerce.exitIntent} was never called.
 * @category Popups
 */
export function disableExitIntent(ctx: { state: PopupsState }): void {
  if (ctx.state.exitIntentEnhancer) {
    ctx.state.exitIntentEnhancer.disable();
  }
}

/** Config accepted by {@link fomo}. */
export interface FomoConfig {
  items?: Array<{ text: string; image: string }>;
  customers?: { [country: string]: string[] };
  maxMobileShows?: number;
  displayDuration?: number;
  delayBetween?: number;
  initialDelay?: number;
}

/**
 * Starts the rotating social-proof popup, lazy-loading its enhancer on the
 * first call. With no config it uses the enhancer's own defaults.
 * @category Popups
 */
export async function fomo(
  ctx: { state: PopupsState; logger: Logger },
  config?: FomoConfig
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

/**
 * Stops the social-proof popup rotation. No-op when {@link
 * core/next-commerce!NextCommerce.fomo} was never called.
 * @category Popups
 */
export function stopFomo(ctx: { state: PopupsState }): void {
  if (ctx.state.fomoEnhancer) {
    ctx.state.fomoEnhancer.stop();
  }
}
