/**
 * Event Builder — context layer
 *
 * Session/event identity, page context, and campaign context: the fields
 * `EventBuilder.createEvent` stamps onto every event before the caller's own
 * data is merged in.
 */

import type {
  UserProperties,
  EventContext,
  EventMetadata,
} from '../types';
import { useCampaignStore } from '@/state/campaign';
import { useCheckoutStore } from '@/state/checkout';
import { useConfigStore } from '@/state/config';
import { createLogger } from '@/core/logger';
import { getCookie } from '@/utils/cookies';

const logger = createLogger('EventBuilder');

/**
 * Generate unique event ID
 */
export function generateEventId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get user properties from stores (Elevar format)
 */
export function getUserProperties(): UserProperties {
  const userProperties: UserProperties = {
    visitor_type: 'guest', // Default to guest for Elevar
  };

  // Try to get store states safely
  try {
    if (typeof window !== 'undefined') {
      // Access checkout store directly
      const checkoutState = useCheckoutStore.getState();

      // Add billing address info if available (Elevar format without address_ prefix)
      if (checkoutState.billingAddress) {
        const billing = checkoutState.billingAddress;
        userProperties.customer_first_name = billing.first_name;
        userProperties.customer_last_name = billing.last_name;
        userProperties.customer_city = billing.city; // No address_ prefix
        userProperties.customer_province = billing.province; // No address_ prefix
        userProperties.customer_province_code = billing.province;
        userProperties.customer_zip = billing.postal; // No address_ prefix
        userProperties.customer_country = billing.country; // No address_ prefix
        userProperties.customer_phone = billing.phone;

        // Add address lines for Elevar
        userProperties.customer_address_1 = billing.address1 || '';
        userProperties.customer_address_2 = billing.address2 || '';
      }

      // Add customer email if available from form data
      if (checkoutState.formData?.email) {
        userProperties.customer_email = checkoutState.formData.email;
      }

      // Add customer ID if available (from order or other sources)
      if (checkoutState.formData?.customerId) {
        userProperties.customer_id = String(checkoutState.formData.customerId);
        userProperties.visitor_type = 'logged_in'; // Elevar uses 'logged_in' not 'customer'
      }

      // Add customer metrics if available (convert to string for Elevar)
      if (checkoutState.formData?.orderCount !== undefined) {
        userProperties.customer_order_count = String(
          checkoutState.formData.orderCount
        );
      }
      if (checkoutState.formData?.totalSpent !== undefined) {
        userProperties.customer_total_spent = String(
          checkoutState.formData.totalSpent
        );
      }
      if (checkoutState.formData?.tags) {
        userProperties.customer_tags = String(checkoutState.formData.tags);
      }
    }
  } catch (error) {
    // Fallback to default properties if store access fails
    logger.warn('Could not access store state for user properties:', error);
  }

  return userProperties;
}

/**
 * Get event context (page info, session, etc.)
 */
export function getEventContext(): EventContext {
  const context: EventContext = {};

  if (typeof window !== 'undefined') {
    context.page_location = window.location.href;
    context.page_title = document.title;
    context.page_referrer = document.referrer;
    context.user_agent = navigator.userAgent;
    context.screen_resolution = `${window.screen.width}x${window.screen.height}`;
    context.viewport_size = `${window.innerWidth}x${window.innerHeight}`;
    context.session_id = getSessionId();
    context.timestamp = Date.now();
  }

  return context;
}

/**
 * campaign_* identifiers attached to every event (issue #473). Applied in
 * `DataLayerManager.enrichEvent` so events that bypass `createEvent`
 * (page_view, upsell, route change) get them too. Read fresh — campaign data
 * and the `ncsid` cookie load async; empty values omitted.
 */
export function getCampaignContext(): Record<string, string> {
  const ctx: Record<string, string> = {};
  if (typeof window === 'undefined') return ctx;

  try {
    const campaign = useCampaignStore.getState().data;
    const config = useConfigStore.getState();

    if (campaign?.name) ctx.campaign_name = campaign.name;
    if (config.apiKey) ctx.campaign_api_key = config.apiKey;
    if (campaign?.currency) ctx.campaign_currency = campaign.currency;
    if (campaign?.language) ctx.campaign_language = campaign.language;
    if (campaign?.id) ctx.campaign_id = String(campaign.id);

    const sessionId = getCookie('ncsid');
    if (sessionId) ctx.campaign_session_id = sessionId;
  } catch (error) {
    logger.warn('Could not build campaign context:', error);
  }

  return ctx;
}

/**
 * Get event metadata
 */
export function getEventMetadata(): EventMetadata {
  return {
    pushed_at: Date.now(),
    debug_mode: false, // Can be controlled via config
    session_id: getSessionId(),
    sequence_number: getNextSequenceNumber(),
    source: 'next-campaign-cart',
    // Replaced at build time with the package.json version (see __VERSION__
    // define in vite.config.ts); falls back to '0.2.0' when unset.
    version: __VERSION__,
  };
}

/**
 * Get or create session ID
 */
export function getSessionId(): string {
  if (typeof window !== 'undefined') {
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }
  return `session_${Date.now()}`;
}

/**
 * Get next sequence number for event ordering
 */
function getNextSequenceNumber(): number {
  if (typeof window !== 'undefined') {
    const current = parseInt(
      sessionStorage.getItem('analytics_sequence') || '0',
      10
    );
    const next = current + 1;
    sessionStorage.setItem('analytics_sequence', String(next));
    return next;
  }
  return 0;
}
