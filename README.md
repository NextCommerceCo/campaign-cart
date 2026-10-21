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
| `bun run qa`        | a passcode link for QA on another network (Cloudflare quick tunnel)               |

## Local development

`bun dev` serves the campaign pages built in `../my-campaigns/_site` (or `SITE=/path/to/_site`)
with their `loader.js` tag swapped for this repo's SDK. Open http://localhost:5173/ for a list
of every campaign page. Every page shows a badge with the mode it runs in.

| Command                               | API                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------- |
| `bun dev`                             | **MOCK** — nothing leaves your machine                                          |
| `bun dev --api live`                  | **LIVE** — real campaign data and prices; orders, prospects and payment.js fake |
| `bun dev --api full --key pk_…`       | **FULL** — the real API: real orders and real payment.js. Use a test campaign   |
| `bun dev --api http://localhost:8000` | **LOCAL API** — everything goes to your local backend                           |

Options: `--key pk_…` uses that campaign key on every page instead of the page's own;
`--dist` serves the built SDK (`bun run build` first) instead of the source; `--port 5180`.

In MOCK and LIVE:

- the Campaigns API is a local mock: cart totals from the campaign's prices, prospect carts
  and orders logged in the terminal;
- payment.js is a fake card form: `4242 4242 4242 4242` pays, `4000 0000 0000 0002` declines;
  express and redirect methods go to a local gateway page with Approve / Fail.

In every mode i18n-rules runs in-process from `../i18n-rules` (or `I18N_RULES=…`) when it is
there, the NextCampaign analytics script is a stub, and page scripts (GTM, page JS) run as they
are. MOCK needs each campaign's JSON once in `dev/campaigns/` (not committed): `bun dev --api
live` saves it, or run the `curl` command the terminal prints.

### Sharing with QA on another network

`bun run qa` builds the SDK, serves the pages with the built files (fast on phones), and opens
a Cloudflare quick tunnel ([`cloudflared`](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
installed once, no account). It prints a link with a passcode, for example
`https://random-words.trycloudflare.com/?qa=…`. The link opens the page list; without the
passcode the server answers "Ask for the full link". It works only while the command runs.
Every request from QA goes through your machine, so QA never needs your network or your local
backend. Takes the same `--api` / `--key` options, e.g. `bun run qa --api full --key pk_test_…`;
`--no-tunnel` serves on this machine only.

`bun run e2e` drives the olympus funnel (card order, stepped upsell, skip, tier upsell,
receipt) with a synthetic test campaign in `dev/e2e/`, aborts any request to a production
host, and fails on a console error. It needs `../my-campaigns/_site` and a Chromium
(`bunx playwright-core install chromium`, or `CHROME=/path/to/chrome`).
