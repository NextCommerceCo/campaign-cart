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
<script src="https://sdk.nextcommerce.com/v1/campaign.js"
        data-campaign="pk_live_xxxxxxxx" defer></script>
```

That is the whole setup. A `pk_test_` key runs against the sandbox. `?debug=1` opens the
debug panel.

## 2. Versioning

- **One URL per major version:** `/v1/campaign.js`. Merchants never pin a minor or patch.
- **Fixes reach every page at once.** Breaking changes go to `/v2/`, which should be rare.
- **Under the hood:**
  - Every build is uploaded to R2 under its own folder (`/v1/b/<build>/…`) and kept.
  - `campaign.js` points to the current build and is cached for 5 minutes. A tab that is
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

1. Load `campaign.js`.
2. Read `data-campaign`.
3. Fetch the campaign from Campaign App and restore the cart from storage.
4. Bind the HTML.
5. Mark the page ready (`html[data-next-ready]`).

If loading fails, `html[data-next-error]` is set so the page can show its own fallback.

| Page | What the SDK does | Where it goes next |
|---|---|---|
| Landing | Shows offers and prices, adds to cart, saves UTM and click IDs | The checkout link on the page |
| Checkout | Validates the form (i18n-rules), gets a card token (`payment.js`), creates the order | 3-D Secure if the bank asks, then `data-next-success` |
| Upsell | Accept adds the offer to the order; decline skips it | The accept or decline link on the page |
| Thank-you | Shows the order from `ref_id` in the URL | — |

**On error** (decline, network, server): show the message on the page, keep what the
shopper typed, and let them retry. The SDK never moves to the next page after a failure.

## 4. HTML API

Attributes only, so it works in Webflow and plain HTML.

| Need | Attribute |
|---|---|
| Show a value | `data-next-text="cart.total"` |
| Show or hide | `data-next-show="cart.hasItems"` |
| Repeat | `<template data-next-each="cart.lines">` |
| Add to cart | `data-next-add="12"` (package id) |
| Pick one package | `data-next-selector` with `data-next-option="12"` on each card |
| Change quantity / remove | `data-next-qty="+1"`, `data-next-remove` |
| Coupon | `data-next-coupon` |
| Checkout form | `<form data-next-checkout data-next-success="/up1">` |
| Card fields | `data-next-card` |
| Upsell offer | `data-next-offer="34"` with `data-next-accept="/up2"` and `data-next-decline="/thank-you"` |
| Countdown | `data-next-countdown="15m"` |
| Translate | `data-next-i18n="checkout.title"` |

- Values have types. Money is always formatted as money in the page's language and
  currency. Nothing is guessed from a field's name.
- Values are written as text, never as HTML.
- Old pages can load an optional compat file that maps the old attributes.

## 5. Inside the SDK

```
campaign.js (tiny)  →  core  →  features, loaded only when the page uses them
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

- **Keys:** everything is stored under the campaign key, e.g. `next:pk_live_xxx:cart`,
  never under the URL path. Two campaigns on `abc.com/campaigns/...` never share a cart.
  Two pages with the same key share one cart, which is how one funnel's pages stay
  connected.
- **localStorage:** cart, visitor id, attribution.
- **sessionStorage:** checkout draft, current order.
- **Never stored:** personal data in cookies, or anything about the card.
- **Session:** ends after 30 minutes of inactivity. The current order always comes from
  `ref_id` in the URL.
- **Reset:** `?reset=1` clears this campaign's keys.

## 7. Tracking

- **One event list:** keep the existing `dl_*` names so GTM containers keep working.
- **Every event goes three ways:**
  1. `dataLayer`, for GTM.
  2. Each vendor pixel the campaign enabled, only after consent.
  3. The NEXT collector, sent with `sendBeacon`. Unsent events are kept and retried on
     the next page.
- **Deduplication:** every event has one `event_id`, used by all three paths, so vendors
  can remove duplicates.
- **Server side:** Collector (Cloudflare Worker) → Queue → NEXT Analytics.
- **Revenue:** purchases are confirmed by the server (Prime), so revenue never depends on
  the thank-you page loading.
- Server copies to Meta or TikTok are a later option, not v1.

## 8. Errors and debugging

- `?debug=1` shows the panel and full logs. It never changes which code loads or where
  it loads from.
- Setup mistakes always print in the console: missing key, unknown attribute, unknown
  field.
- SDK errors are reported to the collector, so failures are visible.

## 9. Release

PR → checks → merge → staging (automatic) → QA → promote to production.
Rollback moves the pointer back.

**Checks:** lint, type check, unit tests, browser tests in Chrome and Safari, and a size
limit.

## 10. What we need from the backend

| # | Need | Why |
|---|---|---|
| B1 | `Idempotency-Key` accepted on order and upsell requests | A retry can never charge twice |
| B2 | Campaign GET cacheable (`Cache-Control`) | Fast first page load |
| B3 | Paid-order webhook from Prime to the collector | Correct revenue |
| B4 | Publishable key with an allowed-domains list | A copied key is useless elsewhere |
