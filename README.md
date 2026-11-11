# NEXT Campaign SDK

One headless **Engine** owns all campaign state (Action → State → Event). DOM bindings,
analytics and debug tools subscribe to its events. Design:
[docs/architecture/design.md](docs/architecture/design.md).

```html
<script type="module" src=".../loader.js" data-campaign="pk_live_…"></script>
```

**Status:** landing, cart, checkout, upsell and receipt pages are built and run on the live 0.4.x
template markup (see [migrating-from-0.4.md](docs/guides/migrating-from-0.4.md)), plus analytics
and attribution.

**Reading the code for the first time:** run `bun dev`, open a campaign page with `?debug=1`
and watch the panel's state and events while you click. Then read
[structure.md](docs/architecture/structure.md) (where code goes, and a glossary) and
[walkthrough.md](docs/architecture/walkthrough.md) (one click followed through the code).

| Command              |                                                                                   |
| -------------------- | --------------------------------------------------------------------------------- |
| `npm test`           | unit tests (the Engine suite runs in plain Node)                                  |
| `npm run typecheck`  | TypeScript                                                                        |
| `npm run build`      | build `dist/` (CI only, not committed) and fail if a file is over its gzip budget |
| `bun dev`            | the real campaign pages with this SDK from source; see below                      |
| `bun run e2e`        | the browser scenarios in headless Chromium against `bun dev`, all mocked          |
| `bun run perf`       | after a build: load time of the built SDK on Slow 4G, all mocked                  |
| `bun run qa`         | a passcode link for QA on another network (Cloudflare quick tunnel)               |
| `npm run docs`       | build the docs site from `docs/guides` and the public types into `docs/site/`     |
| `npm run docs:serve` | serve `docs/site` on http://localhost:3500 and rebuild it on changes              |

## Local development

`bun dev` serves the campaign pages of
[campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates),
cloned and built into `.campaigns/` on the first run (`--update` pulls and rebuilds; the clone
cannot push), or any built site with `SITE=/path/to/_site`, with their `loader.js` tag swapped for this repo's SDK. Open http://localhost:5173/ for a list
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

In every mode i18n-rules is the live service, so geo resolves as it does for a shopper, the
NextCampaign analytics script is a stub, and page scripts (GTM, page JS) run as they
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

### Browser scenarios

`bun run e2e` runs every scenario in `dev/e2e/scenarios/`, each in a browser of its own against
`bun dev` in MOCK with the synthetic campaigns in `dev/e2e/campaigns/`; `bun run e2e -- currency`
runs one. It prints `ok` or `FAIL` per check with the value seen, saves
`test-results/e2e-<scenario>.png` for a scenario that failed, aborts any request to a production
host, and fails on a console error. It needs the campaign pages above and a Chromium
(`bunx playwright-core install chromium`, or `CHROME=/path/to/chrome`).

A scenario is a file there that exports `scenario`; its file name is its name:

```ts
import type { Scenario } from '../harness';

export const scenario: Scenario = async (t) => {
  await t.open('/olympus/checkout/', { affid: 'A1' });
  await t.fillCheckout();
  await t.pay();
  await t.arrive(/upsell-bundle-stepper/);
  t.check(t.orderBody()?.attribution?.affiliate === 'A1', 'the order keeps the affiliate', t.orderBody()?.attribution);
};
```

| To set up                         | In the scenario                                                               |
| --------------------------------- | ----------------------------------------------------------------------------- |
| What the page's `nextConfig` says | `t.config({ locale: 'en-CA' })`                                               |
| Another campaign, such as CAD     | a JSON in `dev/e2e/campaigns/`, then `t.config({ apiKey: 'e2e-cad' })`        |
| An answer of the API              | `t.api('/api/v1/orders/', 400, { lines: ['…'] })`                             |
| A Meta Pixel on the page          | `t.pixel()`, read with `t.fbq()`                                              |
| A page the starter templates lack | a folder in `dev/e2e/pages/`, served where the campaign pages have none       |
| What the page sent                | `t.events()`, `t.tracking()`, `t.requests()`, `t.orderBody()`, `t.cartBody()` |

### Load time

`npm run build && bun run perf` times the built SDK on the Olympus landing and checkout pages under
Chrome's Slow 4G, for a first and a second visit: when `html[data-next-ready]` was set, and each SDK
request before it with its start, end and size.

## Releasing

A release is a git tag that carries `dist/`; jsDelivr serves it. Try each release as a beta first.

1. On main, set `version` in `package.json` to the beta, such as `0.5.1-beta.1`.
2. In GitHub, open Actions > CI > Run workflow on main. It builds `dist/` and tags `v0.5.1-beta.1`.
3. Test a page that loads
   `https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.5.1-beta.1/dist/loader.js`.
4. Optional: create a GitHub release from the tag and tick **Set as a pre-release** before
   publishing. Its docs go to their own folder and `latest/` stays on the last full release.
5. When the beta is good, set `version` to `0.5.1` and run the workflow again.
6. Create the GitHub release from `v0.5.1`. Publishing it makes its docs `latest/`.

A tag is never moved: to fix a beta, go to `beta.2`. Write `beta.1`, not `beta1`, so `beta.10`
sorts after `beta.2`.
