import { campaignUrl, readConfig } from './config';

const config = readConfig(document, window);

if (!config.apiKey) {
  console.error('[next] no campaign key: add data-campaign="pk_…" to the loader.js script tag');
  document.documentElement.setAttribute('data-next-error', 'config');
} else {
  const campaign = fetch(campaignUrl(config.apiBase, config.currency), { headers: { Authorization: config.apiKey } }).then((r) =>
    r.ok ? r.json() : Promise.reject(new Error(`campaign request failed: ${r.status}`)),
  );
  campaign.catch(() => {});

  import('./core')
    .then(({ boot }) => boot(config, campaign))
    .catch((err) => {
      console.error('[next] failed to start', err);
      document.documentElement.setAttribute('data-next-error', 'load');
    });
}
