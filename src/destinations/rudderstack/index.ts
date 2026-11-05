import type { Engine } from '../../engine/engine';
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
  let warned = false;
  engine.on(
    'analytics',
    ({ data: e }) => {
      const calls = rudderStackCalls(e, engine, page).filter(firstStep);
      if (!calls.length) return;
      const ra = win.rudderanalytics;
      if (typeof ra?.track !== 'function' && typeof ra?.ready !== 'function') {
        if (!warned)
          engine.log.warn(
            "RudderStack destination is on but the page has no rudderanalytics; add RudderStack's JS SDK snippet. Events before it loads are not sent",
          );
        warned = true;
        return;
      }
      const send = () => {
        const sdk = win.rudderanalytics!;
        for (const c of calls) {
          try {
            if (c.call === 'page') sdk.page!(c.category, c.name, c.properties);
            else if (c.call === 'identify') sdk.identify!(c.userId, c.traits);
            else sdk.track!(c.name, c.properties);
            const name = c.call === 'identify' ? undefined : c.name;
            engine.log.debug(`destination rudderstack ${c.call}${name ? ` ${name}` : ''} sent`, {
              trace: 'destination',
              destination: 'rudderstack',
              name: name ?? c.call,
              tracking: e.event_type,
              event_id: e.event_id,
            });
          } catch (err) {
            engine.log.error('RudderStack destination failed', err);
          }
        }
      };
      if (typeof ra!.track === 'function') send();
      else ra!.ready!(send);
    },
    { replay: true },
  );
}
