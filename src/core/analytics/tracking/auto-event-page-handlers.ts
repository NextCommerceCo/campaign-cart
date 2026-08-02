/**
 * AutoEventListener — page domain handlers
 *
 * Page view and SPA route change.
 */

import { dataLayer } from '../data-layer-manager';
import type { AutoEventListenerContext } from './auto-event-listener.types';

/**
 * Set up page event listeners
 */
export function setupPageEventListeners(ctx: AutoEventListenerContext): void {
  // Page view
  const handlePageView = async (data: any) => {
    dataLayer.push({
      event: 'dl_page_view',
      page: {
        title: data.title || document.title,
        url: data.url || window.location.href,
        path: data.path || window.location.pathname,
        referrer: document.referrer,
      },
    });
  };

  (ctx.eventBus as any).on('page:viewed', handlePageView);
  ctx.eventHandlers.set('page:viewed', handlePageView);

  // Route changed
  const handleRouteChanged = async (data: any) => {
    dataLayer.push({
      event: 'dl_route_changed',
      route: {
        from: data.from,
        to: data.to,
        path: data.path || window.location.pathname,
      },
    });
  };

  (ctx.eventBus as any).on('route:changed', handleRouteChanged);
  ctx.eventHandlers.set('route:changed', handleRouteChanged);
}
