# NEXT Campaign SDK

One headless **Engine** owns all campaign state (Action → State → Event). DOM bindings,
analytics and debug tools subscribe to its events. Design:
[docs/architecture/design.md](docs/architecture/design.md).

```html
<script type="module" src=".../loader.js" data-campaign="pk_live_…" data-funnel="my-funnel"></script>
```

**Status:** landing, cart and checkout are built and run on the live 0.4.x template markup
(see [migrating-from-0.4.md](docs/guides/migrating-from-0.4.md)), plus analytics and
attribution. Upsell and receipt are not built yet, so this is not a drop-in replacement for
the 0.4.x SDK on those pages.

| Command             |                                                                                   |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm test`          | unit tests (the Engine suite runs in plain Node)                                  |
| `npm run typecheck` | TypeScript                                                                        |
| `npm run build`     | build `dist/` (CI only, not committed) and fail if a file is over its gzip budget |
| `bun dev`           | the real campaign pages with this SDK from source; see below                      |
| `bun run e2e`       | checkout → upsells → receipt in headless Chromium against `bun dev`, all mocked   |

## Local development

`bun dev` serves the campaign pages built in `../my-campaigns/_site` (or `SITE=/path/to/_site`)
on http://localhost:5173, with their `loader.js` tag swapped for this repo's source. Saving a
file reloads the page. Nothing leaves your machine:

- the Campaigns API is a local mock: cart totals from the campaign's prices, prospect carts
  and orders logged in the terminal;
- i18n-rules runs in-process from `../i18n-rules` (or `I18N_RULES=…`);
- payment.js is a fake card form: `4242 4242 4242 4242` pays, `4000 0000 0000 0002` declines;
  express and redirect methods go to a local gateway page with Approve / Fail;
- the NextCampaign analytics script is a stub that logs to the console.

The mock needs each campaign's real JSON once, saved in `dev/campaigns/` (not committed).
`bun dev --live` fetches it from the live Campaigns API and saves it; in that mode campaign
data and cart totals are live, while prospect carts, orders and payment.js stay mocked. The
terminal prints a `curl` command for any campaign it has not saved yet.

Page scripts other than the SDK (GTM, page JS) run as they are.

`bun run e2e` drives the olympus funnel (card order, stepped upsell, skip, tier upsell,
receipt) with a synthetic test campaign in `dev/e2e/`, aborts any request to a production
host, and fails on a console error. It needs `../my-campaigns/_site` and a Chromium
(`bunx playwright-core install chromium`, or `CHROME=/path/to/chrome`).
