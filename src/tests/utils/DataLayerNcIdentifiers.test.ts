import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { dataLayer } from '@/core/analytics/DataLayerManager';
import { useConfigStore } from '@/state/config';
import { useCampaignStore } from '@/state/campaign';

/**
 * Issue #473: every event dispatched through the data layer must carry the NEXT
 * campaign/session identifiers so any provider can forward them. They are stamped
 * centrally in DataLayerManager.enrichEvent (via EventBuilder.getCampaignContext)
 * — campaign_name/currency/language from campaign data, campaign_id from
 * config, and campaign_session_id from the `ncsid` cookie — pushed to
 * window.NextDataLayer, which we assert against here.
 */
describe('DataLayerManager stamps campaign/session identifiers on every event', () => {
  const lastPushed = (): any =>
    window.NextDataLayer[window.NextDataLayer.length - 1];

  beforeEach(() => {
    window.NextDataLayer = [];
    document.cookie = 'ncsid=ncsid-xyz';
    useConfigStore.setState({ apiKey: 'key-123' });
    useCampaignStore.setState({
      data: { id: 42, name: 'Summer Sale', currency: 'USD', language: 'en' },
    } as any);
  });

  afterEach(() => {
    document.cookie = 'ncsid=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;';
    useConfigStore.setState({ apiKey: '' });
    useCampaignStore.setState({ data: null } as any);
  });

  it('adds campaign_* identifiers (snake_case)', () => {
    dataLayer.push({ event: 'dl_test_event' } as any);

    const event = lastPushed();
    expect(event.event).toBe('dl_test_event');
    expect(event.campaign_session_id).toBe('ncsid-xyz');
    expect(event.campaign_id).toBe('42'); // from campaign data (API)
    expect(event.campaign_name).toBe('Summer Sale');
    expect(event.campaign_api_key).toBe('key-123');
    expect(event.campaign_currency).toBe('USD');
    expect(event.campaign_language).toBe('en');
  });

  it('does not overwrite values already on the event', () => {
    dataLayer.push({
      event: 'dl_test_event',
      campaign_session_id: 'preset-session',
    } as any);

    expect(lastPushed().campaign_session_id).toBe('preset-session');
  });

  it('omits campaign_id when neither campaign data nor config has one', () => {
    useConfigStore.setState({ campaignId: '' });
    useCampaignStore.setState({
      data: { name: 'Summer Sale', currency: 'USD', language: 'en' },
    } as any);
    dataLayer.push({ event: 'dl_test_event' } as any);

    expect(lastPushed().campaign_id).toBeUndefined();
  });
});
