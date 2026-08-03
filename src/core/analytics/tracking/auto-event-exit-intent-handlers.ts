/**
 * AutoEventListener — exit-intent domain handlers
 *
 * Exit-intent popup shown, clicked/accepted, dismissed, closed, and template
 * actions (e.g. apply-coupon).
 */

import { createLogger } from '@/core/logger';
import { dataLayer } from '../data-layer-manager';
import type { AutoEventListenerContext } from './auto-event-listener.types';

const logger = createLogger('AutoEventListener');

/**
 * Set up exit intent event listeners
 */
export function setupExitIntentEventListeners(
  ctx: AutoEventListenerContext
): void {
  // Exit intent shown
  const handleExitIntentShown = (data: any) => {
    dataLayer.push({
      event: 'dl_exit_intent_shown',
      event_category: 'engagement',
      event_action: 'exit_intent_shown',
      event_label: data.imageUrl || data.template || 'exit-intent',
      exit_intent: {
        image_url: data.imageUrl || '',
        template: data.template || '',
      },
    });
    logger.debug('Tracked exit intent shown:', data);
  };

  ctx.eventBus.on('exit-intent:shown', handleExitIntentShown);
  ctx.eventHandlers.set('exit-intent:shown', handleExitIntentShown);

  // Exit intent clicked/accepted
  const handleExitIntentClicked = (data: any) => {
    dataLayer.push({
      event: 'dl_exit_intent_accepted',
      event_category: 'engagement',
      event_action: 'exit_intent_accepted',
      event_label: data.imageUrl || data.template || 'exit-intent',
      exit_intent: {
        image_url: data.imageUrl || '',
        template: data.template || '',
      },
    });
    logger.debug('Tracked exit intent accepted:', data);
  };

  ctx.eventBus.on('exit-intent:clicked', handleExitIntentClicked);
  ctx.eventHandlers.set('exit-intent:clicked', handleExitIntentClicked);

  // Exit intent dismissed
  const handleExitIntentDismissed = (data: any) => {
    dataLayer.push({
      event: 'dl_exit_intent_dismissed',
      event_category: 'engagement',
      event_action: 'exit_intent_dismissed',
      event_label: data.imageUrl || data.template || 'exit-intent',
      exit_intent: {
        image_url: data.imageUrl || '',
        template: data.template || '',
      },
    });
    logger.debug('Tracked exit intent dismissed:', data);
  };

  ctx.eventBus.on('exit-intent:dismissed', handleExitIntentDismissed);
  ctx.eventHandlers.set('exit-intent:dismissed', handleExitIntentDismissed);

  // Exit intent closed (X button)
  const handleExitIntentClosed = (data: any) => {
    dataLayer.push({
      event: 'dl_exit_intent_closed',
      event_category: 'engagement',
      event_action: 'exit_intent_closed',
      event_label: data.imageUrl || data.template || 'exit-intent',
      exit_intent: {
        image_url: data.imageUrl || '',
        template: data.template || '',
      },
    });
    logger.debug('Tracked exit intent closed:', data);
  };

  ctx.eventBus.on('exit-intent:closed', handleExitIntentClosed);
  ctx.eventHandlers.set('exit-intent:closed', handleExitIntentClosed);

  // Exit intent action (for template actions like apply-coupon)
  const handleExitIntentAction = (data: any) => {
    dataLayer.push({
      event: 'dl_exit_intent_action',
      event_category: 'engagement',
      event_action: `exit_intent_${data.action}`,
      event_label: data.couponCode || data.action,
      exit_intent: {
        action: data.action,
        coupon_code: data.couponCode || '',
      },
    });
    logger.debug('Tracked exit intent action:', data);
  };

  ctx.eventBus.on('exit-intent:action', handleExitIntentAction);
  ctx.eventHandlers.set('exit-intent:action', handleExitIntentAction);
}
