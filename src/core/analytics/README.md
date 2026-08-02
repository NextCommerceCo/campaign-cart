# core/analytics/

Turns shopper behaviour into ecommerce events and hands them to whichever providers
the page configured. The largest subsystem in the SDK — 27 files — and the only part
of `core/` that talks to third parties.

> **Reader-facing documentation lives elsewhere, and is generated.** This README is
> orientation for whoever changes the code. If you want to know what an event contains,
> which provider reshapes it, or why nothing is arriving, read these instead — they are
> generated from the source and drift-checked, so they cannot go stale the way the list
> that used to be in this file did:
>
> - [Analytics events](../guide/reference/analytics-events.md) — every `dl_*` event, per field
> - [Analytics providers](../guide/reference/analytics-providers.md) — which provider forwards, reshapes, or drops what
> - [Analytics overview](../guide/subsystems/analytics.md) — the mental model and the failure ladder

## Contents

| Path | What it is |
|------|------------|
| `index.ts` | `NextAnalytics` — the subsystem's facade and singleton (`nextAnalytics`), and the `window.*` installs |
| `data-layer-manager.ts` | Owns `window.NextDataLayer`, enriches every event, applies `window.NextDataLayerTransformFn`, then fans out to the providers |
| `providers/` | One adapter per destination, all extending `ProviderAdapter` |
| `events/` | `EventBuilder` (shared context stamping) plus the `EcommerceEvents` and `UserEvents` factories |
| `schemas/` | `DL_EVENTS` — the event vocabulary, and the generated `events.manifest.json` that gates it |
| `tracking/` | Automatic capture: route changes, list attribution, pending events, user data, `MetaTagController` |
| `validation/` | `EventValidator` (schema check before the push) and `reconcileValue` |
| `debug/` | `AnalyticsDebugTracker` — per-provider outcome, payload, error, and duration for every event |
| `tax-basis.ts` | Decides whether a value is tax-inclusive or exclusive |
| `user-data-storage.ts` | Persists the user identity fields between page loads |

## Providers

Five concrete adapters, plus the base class they extend:

| Adapter | Destination |
|---|---|
| `GTMAdapter` | Google Tag Manager (`window.dataLayer`) |
| `FacebookAdapter` | Facebook / Meta Pixel |
| `RudderStackAdapter` | RudderStack |
| `NextCampaignAdapter` | NEXT's own campaign endpoint |
| `CustomAdapter` | Any HTTP endpoint the page configures |
| `ProviderAdapter` | Base class — retry, error swallowing, `notSupported` handling |

This list was wrong in this file until 2026-07-31: it advertised "GTM, Facebook Pixel,
custom endpoints" and omitted RudderStack and NextCampaign, so the file closest to the
code gave the wrong answer to "is RudderStack supported?". The per-provider behaviour
table is generated now — see
[analytics-providers.md](../guide/reference/analytics-providers.md) — precisely so a
hand-maintained list cannot drift again.

## Two things to know before changing anything here

**Analytics sends nothing until it is switched on, and no meta tag switches it on.**
`configStore` has no `analytics` default, so `config.analytics?.enabled` is `undefined`
and `initialize()` returns early. Enabling it with *zero* providers configured still
pushes every event to `window.NextDataLayer`. Both halves surprise people; neither is a
bug to fix without a decision.

**The event vocabulary is gated.** `DL_EVENTS` in `schemas/events.ts` is the single
source of truth, and [`src/tests/utils/analyticsVocabulary.test.ts`](../../tests/utils/analyticsVocabulary.test.ts)
regenerates `schemas/events.manifest.json` from it and **fails CI on drift**, including a
bidirectional scan of the emit sites. Adding an event means adding it there — a name
invented at an emit site fails the build. Regenerate with `npm run analytics:manifest`.

## Configuration

Set on the SDK config, before the SDK loads:

```js
window.nextConfig = {
  apiKey: 'YOUR_CAMPAIGN_API_KEY',
  analytics: {
    enabled: true,           // required — there is no default and no meta tag for it
    mode: 'auto',            // 'auto' | 'manual' | 'disabled'
    debug: false,
    providers: {
      gtm: { enabled: true, settings: {} },
      facebook: { enabled: true, settings: { pixelId: 'YOUR_PIXEL_ID' } },
    },
  },
};
```

## Campaign identifiers on every event

For segmentation and cross-system joins (RudderStack → Mixpanel → NEXT order
attribution), every event carries the campaign's identity. **Configure only the API
key** — the rest derives from the campaign data it loads:

```html
<meta name="next-api-key" content="YOUR_CAMPAIGN_API_KEY" />
```

| Identifier | Source |
|---|---|
| `campaign_id` | campaign data `id` (from the API) |
| `campaign_name` | campaign data |
| `campaign_currency` | campaign data |
| `campaign_language` | campaign data |
| `campaign_api_key` | the configured API key |
| `campaign_session_id` | `ncsid` cookie set by the nextCampaign script (read automatically) |

`EventBuilder.getCampaignContext()` builds them and `DataLayerManager.enrichEvent`
stamps them centrally, so events that bypass `EventBuilder.createEvent` — page views,
upsells, route changes — carry them too, for every provider.

They stay `snake_case` all the way out. `buildContextProps` in
`providers/rudderstack-context.ts` copies the six keys onto the RudderStack payload
**unchanged**, omitting empty values. An earlier version of this README claimed the adapter
remapped them to camelCase (`campaignName`, `campaignApiKey`, …); it does not, and a
downstream consumer built on that claim would have looked for fields that never arrive.
The camelCase spelling exists only in `getCampaignData()`, also in
`providers/rudderstack-context.ts`, an internal shape used to fill `currency` and
`affiliation` defaults — it is not what leaves the page.

Without an API key the SDK warns at init (visible in debug mode) and events go out with
no campaign identifiers.

## Working with it from a page

```js
// Import path is `@/core/analytics` — an older `@/utils/analytics/v2` appeared in this
// README for a while and does not exist.
import { nextAnalytics, EcommerceEvents } from '@/core/analytics';

nextAnalytics.trackAddToCart('PRODUCT_ID', 1);
nextAnalytics.track(EcommerceEvents.createAddToCartEvent({ packageId: '123', quantity: 2 }));

// Turn on validation logging. This method is on NextAnalytics — not on
// `window.NextDataLayer`, which is a plain array and has no methods.
nextAnalytics.setDebugMode(true);

// SPA route change: rebuild the page context so the next events are attributed right.
window.NextInvalidateContext();
```

## Dependency direction

`analytics/` may use `state/`, `types/`, `utils/`, and the rest of `core/`. It must never
import `features/` — features emit on the event bus and analytics listens.
