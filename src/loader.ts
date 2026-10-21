import { announceLegacyLoaded, campaignUrl, legacyGlobals, readConfig } from './config';

const STYLESHEET = 'campaign-cart.css';

legacyGlobals(window);
const config = readConfig(document, window);
document.head.append(
  Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL(STYLESHEET, import.meta.url).href }),
);

if (!config.apiKey) {
  console.error('[next] no campaign key: add data-campaign="pk_…" to the loader.js script tag');
  document.documentElement.setAttribute('data-next-error', 'config');
} else {
  const campaign = fetch(campaignUrl(config.apiBase, config.currency), {
    headers: { Authorization: config.apiKey },
  }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`campaign request failed: ${r.status}`))));
  campaign.catch(() => {});

  const parsed =
    document.readyState === 'loading'
      ? new Promise((done) => document.addEventListener('DOMContentLoaded', done, { once: true }))
      : undefined;

  import('./core')
    .then(async ({ boot }) => {
      announceLegacyLoaded(window);
      await parsed;
      boot(config, campaign);
    })
    .catch((err) => {
      console.error('[next] failed to start', err);
      document.documentElement.setAttribute('data-next-error', 'load');
    });
}
