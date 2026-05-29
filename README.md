# Next Commerce Campaign Cart SDK

A TypeScript SDK that turns a plain HTML campaign page into a working cart,
checkout, and upsell flow on [NextCommerce](https://nextcommerce.com) — through
**progressive enhancement**. You annotate your markup with `data-next-*`
attributes; the SDK loads, scans the DOM, and wires those elements to the
cart / checkout / order API. No framework, no build step on the page, no
backend integration required.

```html
<!-- This is a working "add to cart" button. That's the whole API surface. -->
<button data-next-action="add-to-cart" data-next-package-id="2">Add to cart</button>
<span data-next-display="cart.total"></span>
```

## How it works

- **Packages** — purchasable units defined by your campaign; referenced in HTML by `ref_id` (e.g. `data-next-package-id="2"`).
- **Enhancers** — each feature is a small class bound to a `data-next-*` attribute (selectors, cart summary, quantity controls, checkout form, upsells, timers, …). They activate automatically when the SDK scans the page.
- **Stores** — cart, campaign, checkout, and order state live in Zustand stores; enhancers read and mutate them, and emit typed events.
- **Programmatic API** — the SDK exposes a `NextCommerce` singleton on `window.next` for code that needs to drive the cart, read state, or listen to events.

## Add it to a page

Set your configuration, then load the SDK from the CDN. The SDK auto-initializes
on `DOMContentLoaded`.

```html
<!doctype html>
<html>
  <head>
    <!-- 1. Configure the SDK (apiKey is required; campaignId is optional) -->
    <script>
      window.nextConfig = {
        apiKey: 'YOUR_CAMPAIGN_API_KEY',
      };
    </script>

    <!-- 2. Load the SDK (pin a version) -->
    <script src="https://cdn.jsdelivr.net/gh/NextCommerceCo/campaign-cart@v0.4.24/dist/loader.js"></script>
  </head>
  <body>
    <button data-next-action="add-to-cart" data-next-package-id="2">Buy now</button>
    <span data-next-display="cart.total"></span>
  </body>
</html>
```

Alternatives to the inline `window.nextConfig`: a `<meta name="next-api-key" content="…">`
tag, or a `data-config-url="/config.js"` attribute on the loader `<script>` pointing
at a file that sets `window.nextConfig`.

### Run code after the SDK is ready

The SDK assigns its singleton to `window.next` once initialized. Queue work with
`window.nextReady` — your callback runs immediately if the SDK is already up,
otherwise as soon as it is:

```html
<script>
  window.nextReady = window.nextReady || [];
  window.nextReady.push(async (next) => {
    await next.addItem({ packageId: 2, quantity: 1 });
    next.on('cart:updated', (cart) => console.log('Total:', cart.total));
  });
</script>
```

## Local development

Requires Node.js 18+ and `npm`.

```bash
git clone https://github.com/NextCommerceCo/campaign-cart.git
cd campaign-cart
npm install
npm run dev
```

`npm run dev` starts the Vite dev server on **http://localhost:3000** (with HMR)
and opens the hosted **playground** at `developers.29next.com/playground/?debug=true`.
The `?debug=true` flag tells the loader to pull the SDK from your local dev server
(`http://localhost:3000/src/index.ts`) instead of the CDN, so your source edits
hot-reload in the playground.

- **Dev config / test API key** lives in [`src/config.ts`](src/config.ts). It is loaded
  **only** in debug mode; production pages provide their own `window.nextConfig`.
- **Point any page at your local build** by adding `?debug=true` to its URL (and,
  if needed, `&sdk-host=http://localhost:3000`).

### Project commands

| Task | Command |
|---|---|
| Dev server + playground | `npm run dev` |
| Production build (`dist/`) | `npm run build` |
| Type check | `npm run type-check` |
| Lint / autofix | `npm run lint` / `npm run lint:fix` |
| Format | `npm run format` |
| Unit tests (Vitest) | `npm run test` |
| E2E tests (Playwright) | `npm run test:e2e` |
| Coverage | `npm run test:coverage` |

Run `npm run type-check` (and ideally `npm run test`) before opening a PR.

## API documentation

API reference is generated from the source with [TypeDoc](https://typedoc.org/),
covering the programmatic API (`NextCommerce`, `ApiClient`, the stores), the
typed event map, and every `data-next-*` enhancer with its attributes.

| Task | Command |
|---|---|
| Live preview (watch + auto-reload) | `npm run docs:dev` → http://localhost:8080 |
| Build Markdown docs (`docs/api/`) | `npm run docs` |
| Build HTML docs (`docs/api-html/`) | `npm run docs:html` |

## Links

- **Developer docs**: [developers.nextcommerce.com/docs/campaigns](https://developers.nextcommerce.com/docs/campaigns)
- **Starter templates**: [github.com/NextCommerceCo/campaign-cart-starter-templates](https://github.com/NextCommerceCo/campaign-cart-starter-templates)
- **Architecture & contribution guide**: [CLAUDE.md](CLAUDE.md)

## License

MIT
