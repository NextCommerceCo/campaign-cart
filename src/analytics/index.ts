import type { Engine } from '../engine/engine';
import type { SummaryLine } from '../engine/cart/types';
import type { EventMap } from '../engine/events/bus';
import type { LegacyAnalytics } from '../compat/legacy/globals';
import { cartReports } from './carts';
import { readDestinations, startDestinations } from './destinations';
import { checkoutReports } from './checkout';
import { orderReports } from './orders';
import { reportPage } from './pages';
import { promotionReports } from './promotions';
import { createReport, dispatch } from './report';

export interface AnalyticsOptions {
  apiKey: string;
  version: string;
  nextCampaign: boolean;
  /** What the 0.4.x `nextConfig.analytics` and `storeName` asked for. */
  legacy?: Pick<LegacyAnalytics, 'dataLayer' | 'meta' | 'rudderstack' | 'storeName'>;
}

type Win = Window & {
  nextCampaign?: { config(o: { apiKey: string }): void; event(name: string, data: object): void };
};

const NEXT_CAMPAIGN_SCRIPT = 'https://campaigns.apps.29next.com/js/v1/campaign/';

export function startAnalytics(engine: Engine, options: AnalyticsOptions): void {
  const win = window as Win;
  const legacyExitIntent = startDestinations(engine, readDestinations(options.legacy), {
    apiKey: options.apiKey,
    version: options.version,
  });
  const report = createReport(engine);
  const carts = cartReports(report);
  const checkout = checkoutReports(report);
  const groups = [carts.handlers, checkout.handlers, orderReports(report), promotionReports(report)];

  let ready = false;
  let priced: SummaryLine[] | undefined;
  engine.on(
    '*',
    (e) => {
      if (e.name === 'sdk.ready') {
        ready = true;
        reportPage(report);
        if (!(e.data as EventMap['sdk.ready']).cart.lines.length) return carts.reportCart([], 'sdk.ready');
        return priced && carts.reportCart(priced, 'sdk.ready');
      }
      if (!ready) {
        if (e.name === 'cart.updated') priced = undefined;
        if (e.name === 'cart.calculated') priced = engine.getState().cart.summary?.lines;
        return;
      }
      legacyExitIntent(e);
      dispatch(groups, e);
    },
    { replay: true },
  );
  checkout.beginOwed();

  if (options.nextCampaign && !document.querySelector(`script[src="${NEXT_CAMPAIGN_SCRIPT}"]`)) {
    const script = Object.assign(document.createElement('script'), { src: NEXT_CAMPAIGN_SCRIPT, async: true });
    script.onload = () => {
      win.nextCampaign?.config({ apiKey: options.apiKey });
      win.nextCampaign?.event('page_view', { title: document.title, url: location.href });
    };
    document.head.append(script);
  }
}
