import { announceLegacyLoaded, keepLegacyVisitorId, legacyGlobals } from './compat/config';
import { campaignUrl, keepCurrency, pagePreloads, readConfig, visitorCurrency } from './config';

const STYLESHEET = 'campaign-cart.css';

legacyGlobals(window);
(window as unknown as { nextReady?: unknown[] }).nextReady ??= [];
const config = readConfig(document, window);
document.head.append(
  Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL(STYLESHEET, import.meta.url).href }),
);

if (!config.apiKey) {
  console.error('[next] no campaign key: add data-campaign="pk_…" to the loader.js script tag');
  document.documentElement.setAttribute('data-next-error', 'config');
} else {
  const load = (currency?: string) =>
    fetch(campaignUrl(config.apiBase, currency), { headers: { Authorization: config.apiKey } }).then((r) =>
      r.ok
        ? r.json()
        : Promise.reject(Object.assign(new Error(`campaign request failed: ${r.status}`), { status: r.status })),
    );
  const located = config.autoCurrency ? visitorCurrency(window) : undefined;
  const campaign = located ? located.then(load) : load(config.currency);
  campaign.then(
    (answer: { currency?: string }) =>
      config.currency && answer.currency && keepCurrency(window, config.apiKey, answer.currency),
    () => {},
  );

  const parsed =
    document.readyState === 'loading'
      ? new Promise((done) => document.addEventListener('DOMContentLoaded', done, { once: true }))
      : undefined;

  if (!parsed) {
    for (const file of pagePreloads('%PRELOAD%', document, location.search)) {
      document.head.append(
        Object.assign(document.createElement('link'), {
          rel: 'modulepreload',
          href: new URL(file, import.meta.url).href,
        }),
      );
    }
  }

  import('./boot')
    .then(async ({ boot }) => {
      announceLegacyLoaded(window);
      await parsed;
      const next = boot(located ? { ...config, currency: await located } : config, campaign);
      keepLegacyVisitorId(document, window, config.apiKey, next.context().session_id);
    })
    .catch((err) => {
      console.error('[next] failed to start', err);
      document.documentElement.setAttribute('data-next-error', 'load');
    });
}
