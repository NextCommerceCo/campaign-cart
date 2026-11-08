import type { Engine } from '../../engine/engine';
import { startDestination } from '../../engine/events/analytics';
import { rudderStackCalls } from './calls';
import type { RudderStackCall, RudderStackOptions } from './types';

type Win = Window & {
  rudderanalytics?: {
    page?: (category: string, name: string, properties: object) => void;
    track?: (name: string, properties: object) => void;
    identify?: (userId: string, traits: object) => void;
    ready?: (fn: () => void) => void;
  };
  nextConfig?: { pageType?: string };
};

const STEP = 'rudderstack:Checkout Step Completed';
const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content || undefined;

/** Sends every tracking event of this page, and each later one, to the page's `rudderanalytics`. */
export function startRudderStack(engine: Engine, options: Pick<RudderStackOptions, 'apiKey'> = {}): void {
  const win = window as Win;
  const page: RudderStackOptions = {
    ...options,
    pageType: meta('next-page-type') || win.nextConfig?.pageType,
    pageName: meta('next-page-name'),
  };
  const firstStep = (call: RudderStackCall) => {
    const checkout = engine.checkout;
    if (call.call !== 'track' || call.name !== 'Checkout Step Completed' || !checkout) return true;
    if (checkout.reported(STEP)) return false;
    checkout.markReported(STEP);
    return true;
  };
  startDestination(engine, {
    destination: 'rudderstack',
    vendor: () => {
      const ra = win.rudderanalytics;
      return typeof ra?.track === 'function' || typeof ra?.ready === 'function' ? ra : undefined;
    },
    missing:
      "RudderStack destination is on but the page has no rudderanalytics; add RudderStack's JS SDK snippet. Events before it loads are not sent",
    failed: 'RudderStack destination failed',
    calls: (e) => rudderStackCalls(e, engine, page).filter(firstStep),
    send: (sdk, c) => {
      if (c.call === 'page') sdk.page!(c.category, c.name, c.properties);
      else if (c.call === 'identify') sdk.identify!(c.userId, c.traits);
      else sdk.track!(c.name, c.properties);
    },
    trace: (c) =>
      c.call === 'identify'
        ? { name: c.call, payload: c }
        : { name: c.name, label: c.name ? `${c.call} ${c.name}` : c.call, payload: c },
    ready: (ra, flush) => {
      if (typeof ra.track === 'function') flush(ra);
      else ra.ready!(() => flush(win.rudderanalytics!));
    },
  });
}
