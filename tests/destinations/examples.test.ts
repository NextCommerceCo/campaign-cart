import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NAMES } from '../../src/compat/analytics';
import { GA4, ga4Event } from '../../src/destinations/ga4';
import { META, metaEvent } from '../../src/destinations/meta';
import { RUDDERSTACK, rudderStackCalls } from '../../src/destinations/rudderstack/calls';
import type { RudderStackCall } from '../../src/destinations/rudderstack/types';
import type { TrackingEvent, TrackingName } from '../../src/engine/events/analytics';
import type { EventContext } from '../../src/engine/events/context';
import { createOrder } from '../../src/order/state';
import { fakeApi, json } from '../fixtures/api';
import { makeEngine } from '../fixtures/engine';
import { ORDER, withUpsell } from '../fixtures/order';

const FILE = 'docs/destination-examples.json';
const STORE_NAME = 'shop';

type Example = { object: string; data: unknown; dataLayer: { event: string } };
const tracking = JSON.parse(readFileSync('docs/analytics-examples.json', 'utf8')) as Record<TrackingName, Example>;

const CONTEXT: EventContext = {
  page_location: 'https://shop.test/checkout/',
  page_title: 'Olympus Earbuds',
  page_referrer: '',
  campaign: { id: 1310, name: 'Olympus', currency: 'USD', language: 'en' },
  session_id: '0b8f3c2d1e4a4f6b9c7d5e3f2a1b0c9d',
  attribution: { funnel: 'Olympus' },
  browser: { user_agent: 'Mozilla/5.0 …', language: 'en-US', device_type: 'desktop' },
};

/** The `event_id` of a tracking event: the transaction id on a purchase, else the event's own. */
const eventId = (name: TrackingName, data: { number?: string; ref_id?: string; upsell?: { number: number } }) => {
  if (name === 'checkout_completed') return String(data.number ?? data.ref_id);
  if (name === 'upsell_completed') return `${data.ref_id}-US${data.upsell!.number}`;
  return '3f2b8c1d9e7a4b6c8d5e2f1a0b9c8d7e';
};

const trackingEvent = (name: TrackingName, example: Example, data = example.data) =>
  ({
    event_id: eventId(name, example.data as never),
    event_type: name,
    object: example.object,
    data,
    created_at: '2026-11-04T08:30:00.000Z',
    session_id: CONTEXT.session_id,
    sdk_version: '1.0.0',
    context: CONTEXT,
  }) as TrackingEvent;

type Entry = { from: TrackingName[] } & Record<string, unknown>;

const API_KEY = 'pk_test';
/** The shopper of the lead example, whose `checkout` has none. */
const LEAD = {
  email: 'jane@example.com',
  first_name: 'Jane',
  last_name: 'Doe',
  accepts_marketing: false,
  language: 'en',
  user_agent: 'Mozilla/5.0 …',
};

/** The RudderStackEventMap member a call documents: `page` for the page view track too. */
const memberOf = (c: RudderStackCall) =>
  c.call === 'track' && !c.name.endsWith(' Page View') ? c.name : c.call === 'identify' ? 'identify' : 'page';

/** Adds `name` to `from` of `vendor[event]`, the first example of each vendor event kept. */
const add = (vendor: Record<string, Entry>, event: string, name: TrackingName, example: () => object) => {
  if (vendor[event]) vendor[event].from.push(name);
  else vendor[event] = { from: [name], ...example() };
};

describe('destination examples', () => {
  it('records what each destination sends for every tracking event, each vendor event once, as the Destinations pages show it', async () => {
    const { engine } = makeEngine({ fetch: fakeApi({ getOrder: () => json(withUpsell(ORDER, 99, 1)) }).fetch });
    engine.log.level = 'silent';
    await engine.start();
    engine.order = engine.attach((ctx) => createOrder(ctx, engine.cart));
    await engine.order.load('R1');
    const ga4: Record<string, Entry> = {};
    const meta: Record<string, Entry> = {};
    const gtm: Record<string, Entry> = {};
    const rudderstack: Record<string, Entry> = {};
    for (const [name, example] of Object.entries(tracking) as Array<[TrackingName, Example]>) {
      const e = trackingEvent(name, example);
      const g = ga4Event(e, engine);
      if (g) add(ga4, g.name, name, () => ({ params: g.params }));
      const m = metaEvent(e, {}, engine);
      if (m) {
        const stored = metaEvent(e, { storeName: STORE_NAME }, engine);
        add(meta, m.name, name, () => ({
          event_id: m.event_id,
          params: m.params,
          ...(stored && stored.event_id !== m.event_id && { storeName_event_id: stored.event_id }),
        }));
      }
      add(gtm, example.dataLayer.event, name, () => ({ push: example.dataLayer }));
      const data =
        name === 'checkout_contact_info_submitted' ? { ...(example.data as object), user: LEAD } : example.data;
      const calls = rudderStackCalls(trackingEvent(name, example, data), engine, { apiKey: API_KEY });
      for (const key of new Set(calls.map(memberOf)))
        add(rudderstack, key, name, () => ({ calls: calls.filter((c) => memberOf(c) === key) }));
    }
    const sorted = (names: Iterable<string>) => [...new Set(names)].sort();
    expect(sorted(Object.keys(ga4))).toEqual(sorted(Object.values(GA4)));
    expect(sorted(Object.keys(meta))).toEqual(sorted(Object.values(META)));
    expect(sorted(Object.keys(gtm))).toEqual(sorted(Object.values(NAMES)));
    expect(sorted(Object.keys(rudderstack))).toEqual(sorted(Object.values(RUDDERSTACK)));
    const recorded = { ga4, meta, gtm, rudderstack };
    if (process.env.UPDATE_DOCS || !existsSync(FILE)) writeFileSync(FILE, `${JSON.stringify(recorded, null, 2)}\n`);
    expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(recorded);
  });
});
