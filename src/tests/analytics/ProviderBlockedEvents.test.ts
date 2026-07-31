import { describe, it, expect, vi } from 'vitest';
import { NextCampaignAdapter } from '@/core/analytics/providers/NextCampaignAdapter';
import { RudderStackAdapter } from '@/core/analytics/providers/RudderStackAdapter';
import { CustomAdapter } from '@/core/analytics/providers/CustomAdapter';
import type { DataLayerEvent } from '@/core/analytics/types';

/**
 * Finding 45: `blockedEvents` reaches only GTM and Facebook because their
 * constructors are the only ones that accept it and forward it to the shared
 * `ProviderAdapter` base (which does the actual filtering in `trackEvent`).
 * NextCampaign, RudderStack and Custom must accept the same option so a page
 * that blocks an event gets it suppressed everywhere, not just two of five
 * destinations.
 *
 * `ProviderAdapter.trackEvent` checks `blockedEvents` before ever calling
 * `sendEvent`, so a passing adapter here never dispatches for a blocked event
 * name — asserted by spying on `sendEvent` directly rather than on a
 * provider-specific side effect (script loading, fetch, etc.).
 */
describe('blockedEvents reaches every provider adapter, not just GTM/Facebook (finding 45)', () => {
  it('NextCampaignAdapter drops a blocked event before calling sendEvent', () => {
    const adapter = new NextCampaignAdapter({
      blockedEvents: ['dl_page_view'],
    } as never);
    const sendEvent = vi.spyOn(adapter, 'sendEvent');

    adapter.trackEvent({ event: 'dl_page_view' } as DataLayerEvent);

    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('RudderStackAdapter drops a blocked event before calling sendEvent', () => {
    const adapter = new RudderStackAdapter({
      blockedEvents: ['dl_purchase'],
    } as never);
    const sendEvent = vi.spyOn(adapter, 'sendEvent');

    adapter.trackEvent({
      event: 'dl_purchase',
      ecommerce: { currency: 'USD', value: 10, items: [] },
    } as DataLayerEvent);

    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('CustomAdapter drops a blocked event before calling sendEvent', () => {
    const adapter = new CustomAdapter({
      endpoint: 'https://example.com/collect',
      blockedEvents: ['dl_add_to_cart'],
    } as never);
    const sendEvent = vi.spyOn(adapter, 'sendEvent');

    adapter.trackEvent({ event: 'dl_add_to_cart' } as DataLayerEvent);

    expect(sendEvent).not.toHaveBeenCalled();
  });

  it('an unblocked event still reaches sendEvent for all three adapters', () => {
    const nextCampaign = new NextCampaignAdapter({
      blockedEvents: ['dl_page_view'],
    } as never);
    const rudderstack = new RudderStackAdapter({
      blockedEvents: ['dl_purchase'],
    } as never);
    const custom = new CustomAdapter({
      endpoint: 'https://example.com/collect',
      blockedEvents: ['dl_add_to_cart'],
    } as never);

    const ncSend = vi
      .spyOn(nextCampaign, 'sendEvent')
      .mockReturnValue(undefined);
    const rsSend = vi
      .spyOn(rudderstack, 'sendEvent')
      .mockReturnValue(undefined);
    const cSend = vi.spyOn(custom, 'sendEvent').mockReturnValue(undefined);

    nextCampaign.trackEvent({ event: 'dl_view_item' } as DataLayerEvent);
    rudderstack.trackEvent({ event: 'dl_view_item' } as DataLayerEvent);
    custom.trackEvent({ event: 'dl_view_item' } as DataLayerEvent);

    expect(ncSend).toHaveBeenCalledTimes(1);
    expect(rsSend).toHaveBeenCalledTimes(1);
    expect(cSend).toHaveBeenCalledTimes(1);
  });
});
