# NEXT Campaign SDK v1 — design

Status: proposal, October 2026. A rewrite, not a port of `campaign-cart`.

## Principles

1. **One script, one URL, one setting.** Installing the SDK is one line.
2. **The page is the source of truth.** HTML says what to show and where to go next,
   the same way a normal link or form does.
3. **One API.** The SDK talks to Campaign App directly. The only other services are the
   two fixed ones: `payment.js` for cards and i18n-rules for addresses.
4. **Loud for the author, calm for the shopper.** Setup mistakes always print in the
   console; shoppers see a clear message and can retry.
5. **Fewer concepts.** If something needs its own diagram to be understood, cut it.

## 1. Install

```html
<script type="module" src="https://sdk.nextcommerce.com/v1/loader.js" data-campaign="pk_live_xxxxxxxx"></script>
```

That is the whole setup. A `pk_test_` key runs against the sandbox. `?debug=1` opens the
debug panel.

## 2. Versioning

- **One URL per major version:** `/v1/loader.js`. Merchants never pin a minor or patch.
- **Fixes reach every page at once.** Breaking changes go to `/v2/`, which should be rare.
- **Under the hood:**
  - Every build is uploaded to R2 under its own folder (`/v1/b/<build>/…`) and kept.
  - `loader.js` points to the current build and is cached for 5 minutes. A tab that is
    already open keeps working because old builds are never deleted.
- **Release** moves the pointer to the new build. **Rollback** moves it back. Nothing is
  rebuilt.
- **Two environments:**
  - `sdk-staging.nextcommerce.com` updates automatically on merge.
  - `sdk.nextcommerce.com` updates when a build is promoted after QA.
- `next.version` shows the build a page is running.

Not in v1: canary channels, per-campaign versions, pinned URLs, a UMD build.

## 3. What happens on each page

Every page starts the same way:

1. Load `loader.js`.
2. Read `data-campaign`.
3. Fetch the campaign from Campaign App and restore the cart from storage.
4. Bind the HTML.
5. Mark the page ready (`html[data-next-ready]`).

If loading fails, `html[data-next-error]` is set so the page can show its own fallback.

| Page      | What the SDK does                                                                    | Where it goes next                                    |
| --------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Landing   | Shows offers and prices, adds to cart, saves UTM and click IDs                       | The checkout link on the page                         |
| Checkout  | Validates the form (i18n-rules), gets a card token (`payment.js`), creates the order | 3-D Secure if the bank asks, then `data-next-success` |
| Upsell    | Accept adds the offer to the order; decline skips it                                 | The accept or decline link on the page                |
| Thank-you | Shows the order from `ref_id` in the URL                                             | —                                                     |

**On error** (decline, network, server): show the message on the page, keep what the
shopper typed, and let them retry. The SDK never moves to the next page after a failure.

## 4. HTML API

Attributes only, so it works in Webflow and plain HTML. The attribute names live
campaigns already use are kept, so templates need no edits.

| Need                            | Attribute                                                                                                   | Status |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| Show a value                    | `data-next-display="cart.total"`                                                                            | built  |
| Show or hide                    | `data-next-show="cart.hasItems"` · `data-next-hide="param.banner=='n'"`                                     | built  |
| Pick one bundle                 | `data-next-bundle-selector` with `data-next-bundle-card` · `data-next-bundle-display`                       | built  |
| Order bump                      | `data-next-toggle-card` · `data-next-toggle-display` · `data-next-package-sync`                             | built  |
| Add to cart                     | `data-next-action="add-to-cart"` · `data-next-url`                                                          | built  |
| Start a cart from a link        | `?forcePackageId=2:1`                                                                                       | built  |
| Cart summary and lines          | `data-next-cart-summary` with `{subtotal}` `{item.*}` tokens · `data-summary-lines` · `data-next-discounts` | built  |
| Coupon, quantity                | `data-next-coupon` · `data-next-quantity="increase\|decrease"` · `data-next-remove-item`                    | built  |
| Checkout form, payment, address | `data-next-checkout` · `data-next-checkout-field` · `data-next-payment-method`                              | next   |
| Upsell, receipt                 | `data-next-upsell` · `data-next-upsell-action` · `order.*`                                                  | next   |

- Values have types. Money is formatted as money in the campaign's currency and
  language; booleans show or hide the element. Nothing is guessed from a field's name.
- Values are written as text, never as HTML.
- Old JavaScript entry points (`nextConfig.apiKey`, `next.addItem`, `next.clearCart`,
  `next.swapCart`, `next.getCartData`, `next.exitIntent`, `next.on('bundle:selection-changed')`,
  `next:initialized`, `window.nextReady`, …) still work and are marked `@deprecated` in the
  code. `next.exitIntent` loads its own 1 KB chunk on first use. `next.fomo` was already
  removed in 0.4.x and is not coming back.

## 5. Inside the SDK

```
loader.js (tiny)  →  core  →  features, loaded only when the page uses them
                                cart · checkout · offers · display · countdown
                       core  →  tracking
                       debug panel, loaded only with ?debug=1
```

- **Core** holds one state store, the API client, storage, and an event list.
- **Features** read and change state through core. They never call each other, the
  network or storage directly.
- **Rules:** no code runs when a file is imported, and every listener is removed when its
  element goes away.

## 6. Data and storage

- **Keys:** `next:<scope>:<name>`, where scope = hash(campaign key + funnel). The funnel
  comes from `data-funnel`, else `<meta name="next-funnel">`, else the top folder when the
  path has one (`/helloweenA/landing` → `helloweena`). Two funnels on one domain never
  share a cart; every page of one funnel does.
- **sessionStorage:** the cart and URL params. A cart lives as long as its tab, so tabs
  never overwrite each other and a finished order is not restored next week.
- **localStorage:** the campaign snapshot, for 10 minutes. It paints prices before the
  campaign request returns.
- **Never stored:** totals (they come from the server on each page), personal data in
  cookies, anything about the card. The old SDK's `next_user_data` cookie is deleted.
- **Storage blocked** (private mode, in-app webviews): everything keeps working in memory
  and `storage.degraded` is emitted.
- **Back button:** a page restored from the back-forward cache reloads, so it never acts
  on a stale cart.
- **Reset:** `?reset=1` clears this funnel's keys once and is removed from the URL.

## 7. Tracking

Analytics is a subscriber in its own chunk. It loads when the browser is idle after
`next:ready` and replays the events it missed, so it never delays prices.

- **`dl_*` events in the 0.4.x shape** (`event`, `event_id`, `event_time`,
  `user_properties`, `ecommerce {currency, value, items}`, `attribution`, `campaign_*`).
  Each one goes through `window.NextDataLayerTransformFn` first (a falsy return drops it),
  then into `window.NextDataLayer`, then into `dataLayer` after a `{ecommerce: null}` reset.
  Page forwarders and GTM keep working unchanged.
- **Events today:** `dl_user_data` and `dl_view_item(_list)` on ready; `dl_add_to_cart` and
  `dl_remove_from_cart` from the priced cart against what was already reported in the tab, so a
  cart filled before the page loaded is reported once; `dl_cart_updated` after each server
  calculation. Checkout and upsell events come with
  their chunks.
- **No personal data** in events: `user_properties` is `{visitor_type}` only and
  `page_location` has no query string.
- **NEXT page view:** the `nextCampaign` script loads on idle and sends one `page_view`.
- **Vendors** (Meta, TikTok, GA4, …) go through GTM or the page's forwarder adapters. The
  old built-in Meta, RudderStack and custom providers are not rebuilt; enabling them in
  `nextConfig` prints a warning.
- **Attribution:** UTM, gclid, fbclid, affiliate, sub1–5, clickid, evclid, `_fbp`/`_fbc`
  and the funnel are kept for the tab session, with the first landing page. The same
  object goes on every event and on the order.
- **Links:** same-site links carry the session's params (this replaces `utmTransfer`).

## 8. Errors and debugging

- `?debug=1` shows the panel and full logs. It never changes which code loads or where
  it loads from.
- Setup mistakes always print in the console: missing key, unknown attribute, unknown
  field.
- SDK errors go out as the `error` event (debug panel, analytics); a collector endpoint is a backend ask (B3).

## 9. Release

PR → checks → merge → staging (automatic) → QA → promote to production.
Rollback moves the pointer back.

**Checks:** lint, type check, unit tests, browser tests in Chrome and Safari, and a size
limit.

## 10. What we need from the backend

| #   | Need                                                    | Why                               |
| --- | ------------------------------------------------------- | --------------------------------- |
| B1  | `Idempotency-Key` accepted on order and upsell requests | A retry can never charge twice    |
| B2  | Campaign GET cacheable (`Cache-Control`)                | Fast first page load              |
| B3  | Paid-order webhook from Prime to the collector          | Correct revenue                   |
| B4  | Publishable key with an allowed-domains list            | A copied key is useless elsewhere |
