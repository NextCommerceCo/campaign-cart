import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FacebookAdapter } from '@/utils/analytics/providers/FacebookAdapter';
import { NextCampaignAdapter } from '@/utils/analytics/providers/NextCampaignAdapter';
import { DispatchError } from '@/utils/analytics/providers/ProviderAdapter';
import type { DataLayerEvent } from '@/utils/analytics/types';

/**
 * A dispatch that throws must surface honestly (DispatchError) so the base
 * ProviderAdapter records it as `failed`, not a misleading `sent`. Previously
 * both adapters swallowed the error and returned the payload → `sent`.
 */
describe('adapter dispatch failures are surfaced, not swallowed', () => {
  afterEach(() => {
    delete (window as any).fbq;
    delete (window as any).nextCampaign;
  });

  it('FacebookAdapter re-throws DispatchError when fbq() throws', () => {
    (window as any).fbq = vi.fn(() => {
      throw new Error('fbq boom');
    });
    const adapter = new FacebookAdapter();

    expect(() =>
      adapter.sendEvent({
        event: 'dl_add_to_cart',
        ecommerce: { currency: 'USD', value: 10, items: [] },
      } as DataLayerEvent)
    ).toThrow(DispatchError);
  });

  it('NextCampaignAdapter rejects with DispatchError when nextCampaign.event() throws', async () => {
    (window as any).nextCampaign = {
      event: vi.fn(() => {
        throw new Error('nc boom');
      }),
    };
    const adapter = new NextCampaignAdapter();
    // Skip the async script load — the SDK is "already loaded".
    (adapter as any).scriptLoaded = true;

    await expect(
      adapter.sendEvent({ event: 'dl_page_view' } as DataLayerEvent)
    ).rejects.toBeInstanceOf(DispatchError);
  });

  it('FacebookAdapter warns once with the fix when the pixel never loads', async () => {
    const adapter = new FacebookAdapter();
    const warn = vi.spyOn((adapter as any).logger, 'warn');
    (adapter as any).waitForFbq = vi.fn().mockRejectedValue(new Error('timeout'));

    await expect(
      adapter.sendEvent({
        event: 'dl_add_to_cart',
        ecommerce: { currency: 'USD', value: 10, items: [] },
      } as DataLayerEvent)
    ).rejects.toBeInstanceOf(DispatchError);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('Meta Pixel base code');
  });

  it('NextCampaignAdapter warns with the fix when the SDK fails to load', async () => {
    const adapter = new NextCampaignAdapter();
    const warn = vi.spyOn((adapter as any).logger, 'warn');
    (adapter as any).loadScript = vi.fn().mockRejectedValue(new Error('load fail'));

    await expect(
      adapter.sendEvent({ event: 'dl_page_view' } as DataLayerEvent)
    ).rejects.toBeInstanceOf(DispatchError);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('NextCampaign SDK failed to load');
  });
});
