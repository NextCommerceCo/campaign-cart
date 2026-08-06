---
title: "Core/Reference/Logs"
group: "Core"
category: "Core Reference"
---

# Logs

<!-- Generated from the logger calls in src/core plus the notes in
     src/docs/content/core-logs.ts. Do not edit by hand: change the log line in the
     code or the note in core-logs.ts, then run `npm run docs:reference`. -->

Every message the SDK's own machinery can print — 508 of them, across 62 console prefixes plus 13 lines that bypass the logger entirely. Search a line from your console here to find what produced it, what it means, and what to do about it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text on either side of it. **Extra context** means the call passes a second argument — an object or an error logged beside the message; expand that entry in the console, because the message alone will not tell you which element, package, or event was involved.

This page covers `src/core`: boot, DOM scanning, the shared base class, location and currency, attribution, analytics, and the debug tools. Each feature documents its own messages in its own `guide/reference/logs.md`.

## What prints in production

Which of these lines a live page prints depends on the bundle it loaded and on whether debug mode is on. The two bundles behave differently enough that "the console is empty" means different things.

**The module bundle** — `dist/index.js` and the chunks beside it, which is what the loader fetches for every browser that supports modules, so it is what almost every visitor runs. Its `console` calls are all still in the shipped code. `error` always prints. `warn`, `info`, and `debug` print only with debug mode on, because `Logger` returns early otherwise.

**The UMD bundle** — `dist/index.umd.js`, loaded only by a browser with no module support, or as the fallback when the module import fails. It is minified with `drop_console`, which removes **every** `console` call, `console.error` included. A page on this bundle prints nothing at any level, and debug mode cannot bring the lines back — they are not in the file to be re-enabled.

Turn debug mode on with `?debug=true` or `?debugger=true` in the URL, or by setting `debug: true` (or `debugger: true`) on `window.nextConfig` before the loader runs. **They are not equivalent, and `?debug=true` is the weakest of them.** `Logger` reads only the URL and `window.nextConfig` (`core/logger.ts › isDebugModeEnabled`), and the level is raised to `DEBUG` only by `config.debug` (`sdk-initializer.ts › SDKInitializer.initializeDebugMode`):

| What you set | `error` / `warn` / `info` | `debug` lines | On-page overlay |
|---|---|---|---|
| `?debug=true` | yes | **no** — the level stays at `INFO` | no |
| `window.nextConfig.debug = true` | yes | yes | **no** |
| `<meta name="next-debug" content="true">` | `error` only — `Logger` reads neither meta tags nor the config store, so `warn` and `info` stay suppressed | **no** | no |
| `?debugger=true` / `nextConfig.debugger = true` | yes | yes | yes |

The meta-tag row is the one that wastes an afternoon: it is the documented way to turn debugging on, it does install `window.nextDebug`, and beyond errors it prints nothing. Use `?debugger=true` when you want both the lines and the overlay.

> If a console is empty on a page that is clearly misbehaving, check which bundle loaded before concluding nothing failed. `window.__NEXT_SDK_VERSION__` is set by the loader either way; the UMD fallback announces itself with a `UMD fallback loaded` line from the loader itself, which is not routed through `Logger` and therefore survives.

## Healthy boot

With debug mode on, a page that starts correctly prints this sequence. Lines between these are normal detail; what matters is that they arrive in this order and end with the completion line.

```
[SDKInitializer] Initializing NextCommerce Campaign Cart SDK v2...
[SDKInitializer] Initializing location and currency detection...
[SDKInitializer] User location detected:
[SDKInitializer] Using detected currency:
[SDKInitializer] Initializing attribution...
[SDKInitializer] Attribution initialized
[SDKInitializer] Campaign data loaded
[SDKInitializer] Initializing analytics v2...
[NextAnalytics] NextAnalytics initialized successfully
[SDKInitializer] Cart store rehydration complete
[AttributeScanner] 🔍 Starting DOM scan for data attributes...
[AttributeScanner] Enhanced {enhancedCount} elements successfully
[AttributeScanner] Added next-display-ready class to HTML element
[SDKInitializer] DOM scanning and enhancement complete
[SDKInitializer] SDK initialization complete ✅
```

A sequence that stops part-way tells you which step failed without reading any further: no `Campaign data loaded` means the campaign request is the problem, and no `Enhanced … elements successfully` means the markup was never scanned.

## Which prefix is which

Console lines are prefixed with the part of the SDK that produced them. Find the prefix from your console line here, then read that section below.

### Boot and wiring

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[SDKInitializer]` | Detects the visitor's country and picks the display currency, before campaign prices are fetched so they arrive in the right currency. Runs as its own boot step, right after configuration loads. | 1 | 4 | 8 | 1 |
| `[SDKInitializer]` | Captures where the visitor came from — funnel name, UTM transfer, conversion timestamp, landing page — and keeps the attribution event listeners idempotent across a boot retry or `reinitialize()`. Runs as its own boot step, right after location/currency detection. | 1 | — | 1 | 6 |
| `[SDKInitializer]` | The `forcePackageId` / `forceShippingId` URL overrides and the session's captured URL parameters, applied once configuration and campaign data are loaded. | 2 | 4 | 5 | 5 |
| `[SDKInitializer]` | Clears the SDK's own sessionStorage, localStorage, and cookies when the page carries `?reset=true`, for a clean-slate reload. | — | — | 2 | — |
| `[SDKInitializer]` | Builds `window.nextDebug` — the console surface for inspecting and driving the stores, the cart, campaign, attribution, and analytics from devtools. | — | — | — | 1 |
| `[SDKInitializer]` | Starts the SDK: reads configuration, delegates to location/currency detection and attribution capture, loads the campaign, applies URL parameters such as `forcePackageId`, then hands over to the DOM scan. Most "the page did nothing" investigations start here. | 3 | 4 | 15 | 10 |
| `[AttributeScanner]` | Finds every `data-next-*` element on the page and starts the feature bound to it. If a feature never runs, this is where its element was either skipped or failed to initialize. | 6 | 4 | 3 | 28 |
| `[NextCommerce]` | Part of the `window.next` API — the analytics calls a page makes by hand — tracking a view, a sign-up, or a custom event through the SDK rather than the provider. | — | 1 | — | 3 |
| `[NextCommerce]` | Part of the `window.next` API — metadata and attribution a page sets on itself, which every later order carries. | 7 | — | — | 4 |
| `[NextCommerce]` | Part of the `window.next` API — the cart operations a page drives directly — adding, swapping, clearing. | — | — | — | 1 |
| `[NextCommerce]` | Part of the `window.next` API — the callbacks a page registers through `next.on…`, and the SDK calling them back. | 1 | — | — | — |
| `[NextCommerce]` | Part of the `window.next` API — exit-intent and FOMO popups a page turns on or off from JavaScript. | 2 | — | — | 2 |
| `[NextCommerce]` | Part of the `window.next` API — post-purchase upsells accepted from JavaScript rather than from markup. | 1 | — | 1 | — |
| `[NextCommerce]` | Part of the `window.next` API — the URL parameters a page reads or applies through the API. | — | — | — | 5 |
| `[ErrorHandler]` | Catches uncaught page errors and rejected promises, wraps them with SDK version and URL, and re-publishes them as the `error:occurred` event. | 1 | — | — | 1 |
| `[StorageManager]` | The thin wrapper the SDK uses for its own sessionStorage and localStorage reads and writes. Its errors are storage being unavailable, not data being wrong. | 4 | — | — | 5 |

### Shared base

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[{EnhancerClassName}]` | The behaviour every feature inherits: reading attributes, subscribing to stores, and the shared error path that turns a thrown error into a log line plus an `error:occurred` event. | 1 | — | — | — |
| `[DOMObserver]` | Watches the page for elements added or attributes changed after boot, so markup injected by a page builder or an A/B tool still gets enhanced. | 2 | 1 | — | 10 |
| `[AttributeParser]` | Turns attribute text into something the features can act on — including the comparison expressions behind `data-next-show` and `data-next-hide`. | 1 | — | — | 2 |
| `[{DisplayEnhancerClassName}]` | Everything behind a `data-next-display` binding: resolving the namespaced path to a value, formatting it, and re-rendering when the value or the currency changes. Four `features/cart/**` display files extend it as well as the display features, which is why it is a base class here rather than a file in the display folder. | — | 1 | — | 2 |
| `[DisplayErrorBoundary]` | Contains a failure inside one display binding so it cannot blank out the rest of the page. A line here means one element gave up, not that the SDK stopped — which is exactly the distinction to establish first when "some prices are missing". | 2 | — | — | — |
| `[TemplateRenderer]` | Renders the `data-next-*` placeholder templates that cart, package, and order item rows are built from. A line here means one field in one row could not be formatted — the row still renders, with that field blank. | — | 1 | — | — |
| `[DisplayValueValidator]` | Coerces a resolved value into the shape its format needs — a price to a 2-decimal number, a date string to a `Date`. Every line here means a value was replaced by a fallback, so the element rendered something plausible instead of the truth. These are the quietest wrong-number bugs in the SDK. | — | 5 | — | — |

### Location and currency

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[CountryService]` | Validates and formats a postal code against a country’s rules, and holds the built-in per-country defaults used when the CDN has none for a country. | 1 | — | — | — |
| `[CountryService]` | Filters the country and state lists to what the campaign actually ships to, and picks a fallback country when the visitor’s detected one is not on that list. | — | 2 | 7 | — |
| `[CountryService]` | Detects the visitor’s country, fetches and caches the country and state lists for the address form, and delegates postal-code rules and shipping-country filtering to its sibling modules. | 2 | 4 | — | 6 |

### Attribution

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[AttributionCollector]` | Collects where the visitor came from — funnel name, UTM tags, Everflow click id, tracking-tag meta tags — and keeps it for the order. | — | 1 | 3 | 13 |
| `[UtmTransfer]` | Copies the current page’s URL parameters onto the links leaving it, so attribution survives a click through to the next page. | 2 | — | — | 10 |

### Analytics core

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[NextAnalytics]` | The analytics entry point: reads configuration, builds the enabled providers, and accepts every event the rest of the SDK tracks. | 5 | 5 | 9 | 3 |
| `[NextDataLayer]` | Pushes finished events onto `window.dataLayer` and fans them out to the providers, adding attribution and validating required fields on the way. | 8 | — | 1 | — |
| `[AnalyticsConfig]` | Holds the per-provider settings — which fields each provider needs before it can be switched on. | 2 | — | — | — |
| `[UserDataStorage]` | Remembers who the visitor is across pages — email, name, ids — in a cookie plus sessionStorage, so events after a redirect still identify them. | 2 | 2 | 2 | 4 |
| `[EcommerceEvents]` | Builds the purchase-funnel events — view item, add to cart, begin checkout, purchase, upsell. Split across `ecommerce-events.browse.ts` / `.cart.ts` / `.checkout.ts` / `.upsell.ts`; this one logs a warn when the campaign store cannot be read for an accepted-upsell item. | — | 1 | — | — |
| `[EcommerceEvents]` | Builds `dl_begin_checkout` and `dl_purchase` from the order the API returned. Logs an error when an order payload carries no identifier to report as `transaction_id`, because that purchase is dropped rather than sent with a made-up id. | 1 | — | — | — |
| `[UserEvents]` | Builds the `dl_user_data` event that identifies the visitor and carries the current cart contents. | — | 1 | — | — |
| `[EventValidator]` | Checks an event against its schema in debug mode, so a missing or mistyped field is caught while you are looking rather than in a report a week later. | 1 | — | — | — |

### Analytics

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[EventBuilder]` | Session, page and campaign context attached to every analytics event. | — | 2 | — | — |
| `[EventBuilder]` | Turning a cart or order line into the item shape every provider expects — price, discount and currency resolution live here. | — | 7 | — | — |
| `[EventBuilder]` | The deprecated Elevar payload shape, kept for pages still reading it. | — | 1 | — | — |
| `[RudderStack]` | The per-event property builders the RudderStack adapter sends. | — | — | — | 1 |
| `[AutoEventListener]` | Cart events picked up from the event bus and pushed to the data layer. | 1 | 3 | — | 3 |
| `[AutoEventListener]` | Checkout and order-completed events picked up from the event bus. | — | — | 1 | 1 |
| `[AutoEventListener]` | Post-purchase upsell events picked up from the event bus. | — | 1 | 4 | 1 |
| `[AutoEventListener]` | Exit-intent popup events picked up from the event bus. | — | — | — | 5 |

### Analytics tracking

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[AutoEventListener]` | Turns the SDK’s own cart, upsell, and exit-intent events into analytics events, so a page gets tracking without writing any. | — | — | 1 | 4 |
| `[MetaTagController]` | Fires `view_item` / `view_item_list` and scroll-depth events from `<meta>` tags, including reading the package id out of a URL parameter and waiting for a time, an element, or a scroll threshold. | — | 8 | 10 | 13 |
| `[PendingEventsHandler]` | Holds events that were raised as the page was navigating away, and replays them on the next page so a redirect does not lose a purchase. | 4 | 2 | 2 | 6 |
| `[PurchaseTracking]` | Decides whether an order may be reported as a purchase yet — an order still awaiting payment at a gateway may not — and remembers the orders already reported so one order produces one `dl_purchase`. | — | 7 | — | — |
| `[UserDataTracker]` | Fires `dl_user_data` first on every page and again when the visitor is identified or the route changes. | — | — | 1 | 17 |
| `[ViewItemListTracker]` | Detects the products present on a page and fires `view_item` / `view_item_list` for them without any meta tags. | — | 1 | 1 | 18 |
| `[ListAttributionTracker]` | Remembers which list a product was clicked from so the next page’s events can say where the visitor came from within the site. | 3 | — | — | 7 |

### Analytics providers

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[{ProviderName}]` | The delivery contract every provider shares: the enabled and blocked-event gate, and reporting each event as sent, skipped, or failed. | 1 | 1 | — | 1 |
| `[Facebook]` | Delivers events to the Meta Pixel (`fbq`). | — | 1 | — | — |
| `[NextCampaign]` | Loads the NextCampaign script with the campaign API key and sends it the page view. | 2 | 2 | 6 | 2 |
| `[RudderStack]` | Translates events into RudderStack’s track / page / identify calls. | — | 1 | 1 | — |
| `[Custom]` | Posts batches of events to an endpoint you configure, with a retry queue for the ones that fail. | 2 | — | — | — |

### Debug tools

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[DebugModule]` | Loads the debug overlay on demand when debug mode is on, so none of it is in the bundle a normal visitor downloads. | 2 | — | 2 | — |
| `[DebugOverlay]` | The on-page debug panel itself — state inspectors, the event pipeline, and the country / currency / locale switchers. | — | — | 3 | 3 |
| `[CountrySelector]` | The debug overlay’s country switcher, for checking an address form and shipping options as a visitor in another country. | 2 | 1 | 6 | 6 |
| `[CurrencySelector]` | The debug overlay’s currency switcher, for checking prices in every currency the campaign offers. | 1 | 1 | 4 | 6 |
| `[LocaleSelector]` | The debug overlay’s locale switcher, for checking how prices and dates are formatted. | 1 | 1 | 4 | 4 |
| `[UpsellSelector]` | The debug overlay’s post-purchase upsell inspector: what the page offers and what is currently selected. | — | — | 1 | 12 |

## `[SDKInitializer]`

Detects the visitor's country and picks the display currency, before campaign prices are fetched so they arrive in the right currency. Runs as its own boot step, right after configuration loads.

Logged from `sdk-initializer/sdk-initializer.location-currency.ts`. A free function, not a class with its own logger. `SDKInitializer` builds one `Logger('SDKInitializer')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error fetching country config:`

`sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` · extra context attached

**Meaning:** The request for the forced country’s configuration threw rather than returning a bad answer. Detection is used instead, so the address form and currency may not match the forced country.

**Action:** Read the attached error. It is normally a network failure and clears on reload, since the result is cached once a request succeeds.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Failed to fetch country config for {forcedCountry}, falling back to detection`

`sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency`

**Meaning:** A country was forced — by `?country=` or a previous choice saved in the session — but the API returned no configuration for it, so normal detection is used instead. The visitor may see a different country than the one that was forced.

**Action:** Check that the forced code is a two-letter code the campaign ships to; the shipping list is logged at boot as `Campaign shipping countries set globally:`. Clear `next_selected_country` from sessionStorage to stop a stale saved choice from repeating this.

#### `Location detection failed or timed out, using defaults:`

`sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` · extra context attached

**Meaning:** Location detection did not answer within three seconds, so boot continued with the built-in defaults — the United States and the campaign’s default currency. Prices are still correct for that default, not for the visitor’s real country.

**Action:** Expected occasionally on slow connections. If it is constant, check that the campaigns host is reachable and not blocked by an extension, because every visitor is then being treated as US.

#### `Failed to fetch countries list:`

`sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` · extra context attached

**Meaning:** The country a visitor is in was resolved, but the list of *all* countries was not, so the country dropdown in the address form has nothing to offer.

**Action:** Check the attached error. Until it succeeds a visitor cannot change country at checkout; a reload usually fixes it, as the list is cached once fetched.

#### `Failed to initialize location/currency, using defaults:`

`sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` · extra context attached

**Meaning:** The whole location-and-currency step threw. Boot continues with defaults and with any currency the visitor had already chosen this session.

**Action:** Read the attached error. Prices are being shown in the default currency, so treat this as a revenue-visible problem rather than a cosmetic one.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Skipping location/currency detection (currencyBehavior is not set to auto)` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | — |
| `Initializing location and currency detection...` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | — |
| `Using forced country: {forcedCountry} (source: {countryOverride ? 'URL' : 'session'})` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | — |
| `Country config loaded:` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | yes |
| `User location detected:` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | yes |
| `Currency override from URL:` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | yes |
| `Using saved currency preference:` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | yes |
| `Using detected currency:` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Location and currency initialized:` | `sdk-initializer/sdk-initializer.location-currency.ts › initializeLocationAndCurrency` | yes |

## `[SDKInitializer]`

Captures where the visitor came from — funnel name, UTM transfer, conversion timestamp, landing page — and keeps the attribution event listeners idempotent across a boot retry or `reinitialize()`. Runs as its own boot step, right after location/currency detection.

Logged from `sdk-initializer/sdk-initializer.attribution.ts`. A free function, not a class with its own logger. `SDKInitializer` builds one `Logger('SDKInitializer')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Attribution initialization failed:`

`sdk-initializer/sdk-initializer.attribution.ts › initializeAttribution` · extra context attached

**Meaning:** Attribution did not start, so the order will be missing UTM tags, funnel name, and click ids. The page and checkout still work — this is a reporting problem, not a buying one.

**Action:** Read the attached error. Orders placed while this is happening cannot be attributed after the fact, so it is worth fixing quickly on paid traffic.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Initializing attribution...` | `sdk-initializer/sdk-initializer.attribution.ts › initializeAttribution` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Added SDK version to attribution metadata: {sdkVersion}` | `sdk-initializer/sdk-initializer.attribution.ts › initializeAttribution` | — |
| `Added user IP to attribution metadata: {userIp}` | `sdk-initializer/sdk-initializer.attribution.ts › initializeAttribution` | — |
| `UTM transfer initialized` | `sdk-initializer/sdk-initializer.attribution.ts › initializeAttribution` | — |
| `Attribution initialized` | `sdk-initializer/sdk-initializer.attribution.ts › initializeAttribution` | — |
| `Set funnel name from campaign:` | `sdk-initializer/sdk-initializer.attribution.ts › setupAttributionListeners` | yes |
| `Updated attribution with conversion timestamp` | `sdk-initializer/sdk-initializer.attribution.ts › setupAttributionListeners` | — |

## `[SDKInitializer]`

The `forcePackageId` / `forceShippingId` URL overrides and the session's captured URL parameters, applied once configuration and campaign data are loaded.

Logged from `sdk-initializer/sdk-initializer.url-params.ts`. A free function, not a class with its own logger. `SDKInitializer` builds one `Logger('SDKInitializer')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error processing forcePackageId parameter:`

`sdk-initializer/sdk-initializer.url-params.ts › processForcePackageId` · extra context attached

**Meaning:** The `forcePackageId` parameter could not be applied, so the cart is not pre-filled. Boot deliberately continues — a bad link should not take the page down.

**Action:** Read the attached error: `Invalid package ID` and `Invalid quantity` name the offending value. The parameter format is `id` or `id:quantity`, comma-separated.

#### `Error processing forceShippingId parameter:`

`sdk-initializer/sdk-initializer.url-params.ts › processForceShippingId` · extra context attached

**Meaning:** Applying `forceShippingId` threw, so shipping is unchanged. Boot continues.

**Action:** Read the attached error — `Invalid shipping ID` means the parameter was not a positive number. Otherwise the cart update itself failed, and the visitor picks shipping manually.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Failed to capture URL parameters:`

`sdk-initializer/sdk-initializer.url-params.ts › captureUrlParameters` · extra context attached

**Meaning:** Reading the current URL’s parameters threw, so `forcePackageId`, currency overrides, and visibility parameters are not applied on this page. Boot continues.

**Action:** Check the attached error. A malformed URL or a blocked `sessionStorage` are the realistic causes; the page still works, but any behaviour driven by a URL parameter is silently off.

#### `Package {packageId} not found in campaign data, skipping`

`sdk-initializer/sdk-initializer.url-params.ts › processForcePackageId`

**Meaning:** A `forcePackageId` entry names a package the campaign does not contain, so that entry is skipped. Other valid entries in the same parameter are still added.

**Action:** Check the id against the campaign’s packages — it must be the package `ref_id`, not a product or variant id. A link built for a different campaign is the usual cause.

#### `No shipping methods available in campaign data`

`sdk-initializer/sdk-initializer.url-params.ts › processForceShippingId`

**Meaning:** `forceShippingId` was asked for, but the campaign came back with no shipping methods at all, so nothing could be selected.

**Action:** Check the campaign has shipping methods configured. Every visitor on this campaign will reach checkout with no shipping option, not only the ones using the parameter.

#### `Shipping method {shippingId} not found in campaign data`

`sdk-initializer/sdk-initializer.url-params.ts › processForceShippingId`

**Meaning:** The id in `forceShippingId` does not match any shipping method in this campaign, so the cart keeps whatever method it had.

**Action:** Use a `ref_id` from the campaign’s shipping methods — the debug line `Available shipping methods:` right after this one lists the valid ids, codes, and prices.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Visibility control parameters detected:` | `sdk-initializer/sdk-initializer.url-params.ts › captureUrlParameters` | yes |
| `Processing forcePackageId parameter:` | `sdk-initializer/sdk-initializer.url-params.ts › processForcePackageId` | yes |
| `Successfully processed forcePackageId: added {length} package(s) to cart` | `sdk-initializer/sdk-initializer.url-params.ts › processForcePackageId` | — |
| `Processing forceShippingId parameter:` | `sdk-initializer/sdk-initializer.url-params.ts › processForceShippingId` | yes |
| `Successfully set shipping method: {code} (ID: {shippingId}, Price: ${price})` | `sdk-initializer/sdk-initializer.url-params.ts › processForceShippingId` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Captured {length} URL parameters, total stored: {length}` | `sdk-initializer/sdk-initializer.url-params.ts › captureUrlParameters` | — |
| `Cart cleared for forcePackageId` | `sdk-initializer/sdk-initializer.url-params.ts › processForcePackageId` | — |
| `Parsed package specifications:` | `sdk-initializer/sdk-initializer.url-params.ts › processForcePackageId` | yes |
| `Added package {packageId} with quantity {quantity} to cart` | `sdk-initializer/sdk-initializer.url-params.ts › processForcePackageId` | — |
| `Available shipping methods:` | `sdk-initializer/sdk-initializer.url-params.ts › processForceShippingId` | yes |

## `[SDKInitializer]`

Clears the SDK's own sessionStorage, localStorage, and cookies when the page carries `?reset=true`, for a clean-slate reload.

Logged from `sdk-initializer/sdk-initializer.storage-reset.ts`. A free function, not a class with its own logger. `SDKInitializer` builds one `Logger('SDKInitializer')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Clearing all Next Campaign Cart storage...` | `sdk-initializer/sdk-initializer.storage-reset.ts › clearAllStorage` | — |
| `Cleared {length} sessionStorage items, {length} localStorage items` | `sdk-initializer/sdk-initializer.storage-reset.ts › clearAllStorage` | — |

## `[SDKInitializer]`

Builds `window.nextDebug` — the console surface for inspecting and driving the stores, the cart, campaign, attribution, and analytics from devtools.

Logged from `sdk-initializer/sdk-initializer.debug-utils.ts`. A free function, not a class with its own logger. `SDKInitializer` builds one `Logger('SDKInitializer')` in `sdk-initializer.ts` and passes it in through a `{ logger }` context, so every line here prints under `[SDKInitializer]`.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `🎯 Highlighting element: {selector}` | `sdk-initializer/sdk-initializer.debug-utils.ts › highlightElement` | — |

## `[SDKInitializer]`

Starts the SDK: reads configuration, delegates to location/currency detection and attribution capture, loads the campaign, applies URL parameters such as `forcePackageId`, then hands over to the DOM scan. Most "the page did nothing" investigations start here.

Logged from `sdk-initializer/sdk-initializer.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `SDK initialization failed:`

`sdk-initializer/sdk-initializer.ts › SDKInitializer.initialize` · extra context attached

**Meaning:** Boot threw before it finished. Nothing on the page is enhanced yet: prices show their placeholders and buttons do nothing. The attached error says which step failed.

**Action:** Read the attached error first. A missing API key is the most common cause and says so plainly. Boot retries up to three times (`Retrying initialization …`); if all attempts fail the page stays un-enhanced, so fix the cause rather than reloading.

#### `Failed to auto-load order:`

`sdk-initializer/sdk-initializer.ts › SDKInitializer.checkAndLoadOrder` · extra context attached

**Meaning:** A `ref_id` in the URL was found but the order behind it could not be loaded, so a receipt or upsell page has nothing to show and `next.addUpsell()` will reject.

**Action:** Check the attached error and the `ref_id`. An expired or wrong reference gives this; so does the API being unreachable. Until it loads, treat the page as having no order rather than an empty one.

#### `Ready callback error:`

`sdk-initializer/sdk-initializer.ts › SDKInitializer.setupReadyCallbacks` · extra context attached

**Meaning:** One of your own `window.nextReady` callbacks threw. The SDK caught it and ran the remaining callbacks, so this is your page code failing, not the SDK.

**Action:** Fix the callback named in the attached stack. Note that a callback failing part-way can leave your own page half-configured even though boot reports success.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `SDK already initialized`

`sdk-initializer/sdk-initializer.ts › SDKInitializer.initialize`

**Meaning:** Something called `initialize()` a second time and the call was ignored. Usually the loader script is on the page twice, or a page builder duplicated it into a template.

**Action:** Harmless in itself — the second call does nothing. Remove the duplicate loader anyway: two loaders can disagree about which SDK version to fetch, and that difference is much harder to diagnose than this line.

#### `Retrying initialization (attempt {retryAttempts}/{maxRetries})...`

`sdk-initializer/sdk-initializer.ts › SDKInitializer.initialize`

**Meaning:** Boot failed and is trying again after a pause. Expected to be followed either by `SDK initialization complete ✅` or by another `SDK initialization failed:`.

**Action:** Nothing while the retries are running. If you see the third attempt, treat the page as broken for that visitor and fix the error logged above it — retrying a missing API key never succeeds.

#### `Analytics v2 initialization failed (non-critical):`

`sdk-initializer/sdk-initializer.ts › SDKInitializer.initializeAnalytics` · extra context attached

**Meaning:** The analytics module failed to load or initialize. No analytics events will be sent from this page load; everything else works.

**Action:** Read the attached error. A blocked script or an ad blocker is the common cause. Do not treat the resulting gap in reporting as a drop in sales.

#### `Error handler initialization failed:`

`sdk-initializer/sdk-initializer.ts › SDKInitializer.initializeErrorHandler` · extra context attached

**Meaning:** The global error handler did not start, so uncaught page errors are no longer re-published as `error:occurred` events. Nothing else changes.

**Action:** Read the attached error. Low urgency, but while it lasts your own `next.on('error:occurred')` handlers will not fire.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Initializing NextCommerce Campaign Cart SDK v2...` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initialize` | — |
| `SDK initialization complete ✅` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initialize` | — |
| `forcePackageId parameter detected:` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.loadConfiguration` | yes |
| `forceShippingId parameter detected:` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.loadConfiguration` | yes |
| `forceBundleId parameter detected:` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.loadConfiguration` | yes |
| `Campaign shipping countries set globally:` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.loadCampaignData` | yes |
| `Initializing analytics v2...` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initializeAnalytics` | — |
| `Page loaded with {paramName} parameter, auto-loading order:` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.checkAndLoadOrder` | yes |
| `Order loaded successfully:` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.checkAndLoadOrder` | yes |
| `Order supports upsells:` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.checkAndLoadOrder` | yes |
| `DOM scanning and enhancement complete` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.scanAndEnhanceDOM` | yes |
| `Debug mode enabled - initializing debug utilities` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initializeDebugMode` | — |
| `Logger level set to DEBUG` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initializeDebugMode` | — |
| `Debug utilities initialized ✅` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initializeDebugMode` | — |
| `Reinitializing SDK...` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.reinitialize` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Cart cleared on init (next-clear-cart)` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initialize` | — |
| `Configuration loaded (metatags have priority):` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.loadConfiguration` | yes |
| `Campaign data loaded` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.loadCampaignData` | — |
| `Emitted sdk:url-parameters-processed event` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.loadCampaignData` | — |
| `Analytics v2 initialized successfully` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initializeAnalytics` | — |
| `Error handler initialized` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.initializeErrorHandler` | — |
| `nextReady callback system and window.next API initialized` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.setupReadyCallbacks` | — |
| `Waiting for cart store rehydration...` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.waitForStoreRehydration` | — |
| `Cart store rehydration complete` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.waitForStoreRehydration` | yes |
| `No cart data to rehydrate` | `sdk-initializer/sdk-initializer.ts › SDKInitializer.waitForStoreRehydration` | — |

## `[AttributeScanner]`

Finds every `data-next-*` element on the page and starts the feature bound to it. If a feature never runs, this is where its element was either skipped or failed to initialize.

Logged from `attribute-scanner/attribute-scanner.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error during scan and enhance:`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.scanAndEnhance` · extra context attached

**Meaning:** The DOM scan threw part-way, so some elements were enhanced and others were not. The page is in a mixed state: some prices update, some do not.

**Action:** Read the attached error, then reload with `?debug=true` and look at the lines above to see which element the scan was on when it failed.

#### `Failed to initialize {type} enhancer:`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.enhanceElement` · extra context attached

**Meaning:** One feature threw while starting up. It is destroyed and that element is left as plain markup — its button does nothing, its display keeps its placeholder. Everything else on the page is unaffected. A missing required attribute is the usual cause.

**Action:** The element is attached to the log line: expand it, then check its attributes against that feature’s `reference/attributes.md`. `Required attribute {name} not found on element` in the attached error names the missing one directly.

#### `Failed to enhance element:`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.enhanceElement` · extra context attached

**Meaning:** Enhancing one element failed outside any single feature’s own start-up — while resolving which features it needs, for example. That element stays plain markup.

**Action:** The element is attached. Check for contradictory attributes on it, such as a display path that names no known namespace, and compare against a working element nearby.

#### `Failed to create enhancer of type {type}:`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` · extra context attached

**Meaning:** Loading the code for a feature failed, so no element using it is enhanced. Features are imported on demand, so a network problem or a broken deployment produces this rather than a markup mistake.

**Action:** Read the attached error. A failed dynamic import points at the deployed bundle — check that the SDK version the loader asked for is actually published.

#### `Failed to enhance queued element:`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.processQueue` · extra context attached

**Meaning:** An element that arrived after boot — injected by a page builder or an A/B tool — could not be enhanced. The rest of the queue is still processed.

**Action:** The element is attached. Treat it as `Failed to enhance element:`: compare its attributes with an equivalent element that was present at boot.

#### `Failed to destroy enhancer:`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.destroyEnhancers` · extra context attached

**Meaning:** One feature's own `destroy()` threw while the scanner was tearing the page down. The scanner carries on with the rest, so the other features are still torn down — but this one may have left a listener, a timer or a subscription behind.

**Action:** Fix the `destroy()` named in the attached error. Until then, expect the leak that teardown was meant to prevent: on a single-page flow that re-enhances, the stale handler keeps firing on an element nobody is managing.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Scanner destroyed, ignoring scan request`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.scanAndEnhance`

**Meaning:** Something asked the scanner to scan after `destroy()` had already run. Expected during teardown — a queued or in-flight scan finishing after the SDK was torn down — and the scan is correctly refused rather than enhancing elements nothing would ever clean up.

**Action:** Nothing, if the page is unloading or re-initializing. If it appears on a page that is still live, something is calling `scanAndEnhance()` on a scanner it already destroyed — use the new instance instead.

#### `Already scanning, queuing request`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.scanAndEnhance`

**Meaning:** A second DOM scan was asked for while one was running; the request is queued rather than run in parallel. Expected on a page that injects markup while booting.

**Action:** Nothing. If it repeats continuously, something is mutating the DOM in a loop — look at what is adding elements, not at the scanner.

#### `Unknown action type: {action}`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer`

**Meaning:** `data-next-action` has a value the SDK does not recognise, so the element does nothing when clicked. A typo in the value is almost always the reason.

**Action:** Use one of the supported actions — `add-to-cart` or `accept-upsell`. The value is printed in the message, so compare it character by character, including case.

#### `Unknown enhancer type: {type}`

`attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer`

**Meaning:** The scanner matched an element to a feature name it has no constructor for, so nothing is attached to that element. This means an attribute is spelled in a way that resolves to an unknown feature.

**Action:** Check the `data-next-*` attributes on the element against the feature catalog. If the name in the message looks correct, the feature exists but is not registered in `attribute-scanner.ts` — that is a code fix, not a markup one.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `🔍 Starting DOM scan for data attributes...` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.scanAndEnhance` | yes |
| `Found {length} conditional display elements:` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.scanAndEnhance` | yes |
| `Creating CheckoutReviewEnhancer for element:` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Found {length} elements with data attributes` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.scanAndEnhance` | — |
| `Enhanced {enhancedCount} elements successfully` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.scanAndEnhance` | — |
| `Added next-display-ready class to HTML element` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.scanAndEnhance` | — |
| `Element already enhanced, skipping` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.enhanceElement` | yes |
| `Skipping element inside cart items template` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.enhanceElement` | yes |
| `Skipping element with template variable` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.enhanceElement` | yes |
| `No enhancer types found for element` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.enhanceElement` | yes |
| `Initialized {type} enhancer for element` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.enhanceElement` | yes |
| `Enhanced element with {length} enhancer(s)` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.enhanceElement` | yes |
| `Creating display enhancer for path: "{displayPath}"` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | yes |
| `Using CartDisplayEnhancer` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using SelectionDisplayEnhancer` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using ProductDisplayEnhancer` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using OrderDisplayEnhancer` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using ShippingDisplayEnhancer` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using BundleDisplayEnhancer` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using PackageSelectorDisplayEnhancer` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using PackageToggleDisplayEnhancer` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using ProductDisplayEnhancer (fallback with package context)` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Using CartDisplayEnhancer (fallback without package context)` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Creating ConditionalDisplayEnhancer for element:` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | yes |
| `Skipping individual express checkout button - managed by container` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.createEnhancer` | — |
| `Started DOM observation` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.startObserving` | — |
| `Data attribute changed, re-enhancing element` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.handleDOMChange` | yes |
| `Processing {length} queued elements` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.processQueue` | — |
| `AttributeScanner destroyed` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.destroy` | — |
| `AttributeScanner paused` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.pause` | — |
| `AttributeScanner resumed` | `attribute-scanner/attribute-scanner.ts › AttributeScanner.resume` | — |

## `[NextCommerce]`

Part of the `window.next` API — the analytics calls a page makes by hand — tracking a view, a sign-up, or a custom event through the SDK rather than the provider.

Logged from `next-commerce/next-commerce.analytics.ts`. A free function, not a class with its own logger. `NextCommerce` builds one `Logger('NextCommerce')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Package not found in store:`

`next-commerce/next-commerce.analytics.ts › trackViewItem` · extra context attached

**Meaning:** A product element on the page names a package that is not in the campaign data, so it is left out of automatic `view_item` / `view_item_list` tracking.

**Action:** The id is attached. Check the `data-next-package-id` on that element against the campaign’s packages; a leftover card from another campaign is the usual cause.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Analytics tracking failed (non-critical):` | `next-commerce/next-commerce.analytics.ts › trackViewItemList` | yes |
| `Analytics debug mode failed (non-critical):` | `next-commerce/next-commerce.analytics.ts › setDebugMode` | yes |
| `Analytics context invalidation failed (non-critical):` | `next-commerce/next-commerce.analytics.ts › invalidateAnalyticsContext` | yes |

## `[NextCommerce]`

Part of the `window.next` API — metadata and attribution a page sets on itself, which every later order carries.

Logged from `next-commerce/next-commerce.attribution.ts`. A free function, not a class with its own logger. `NextCommerce` builds one `Logger('NextCommerce')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to add attribution metadata:`

`next-commerce/next-commerce.attribution.ts › addMetadata` · extra context attached

**Meaning:** A single metadata value could not be added, so it will be missing from the order. Nothing else is affected.

**Action:** Read the attached error. Values must be serialisable — a DOM element or a function passed as metadata fails here.

#### `Failed to set attribution metadata:`

`next-commerce/next-commerce.attribution.ts › setMetadata` · extra context attached

**Meaning:** A whole metadata object could not be merged in, so none of those values reach the order.

**Action:** Read the attached error and check the object is plain and serialisable. Confirm afterwards with `next.getMetadata()`.

#### `Failed to clear attribution metadata:`

`next-commerce/next-commerce.attribution.ts › clearMetadata` · extra context attached

**Meaning:** Resetting metadata failed, so previously set values may still be attached to the next order.

**Action:** Read the attached error, then verify with `next.getMetadata()` rather than assuming the reset worked.

#### `Failed to get attribution metadata:`

`next-commerce/next-commerce.attribution.ts › getMetadata` · extra context attached

**Meaning:** Reading metadata threw, and `next.getMetadata()` returned `undefined` — which is indistinguishable from "no metadata set" to the caller.

**Action:** Read the attached error. Do not treat the `undefined` as proof there is no metadata; check the attribution store in the debug overlay.

#### `Failed to set attribution:`

`next-commerce/next-commerce.attribution.ts › setAttribution` · extra context attached

**Meaning:** Updating attribution threw, so the values you passed are not recorded and the order will carry whatever was there before.

**Action:** Read the attached error and confirm with `next.getAttribution()`. On paid traffic this is worth fixing quickly, since it decides which channel gets credit for the sale.

#### `Failed to get attribution:`

`next-commerce/next-commerce.attribution.ts › getAttribution` · extra context attached

**Meaning:** Reading attribution threw and `next.getAttribution()` returned `undefined`.

**Action:** Read the attached error. Inspect the attribution store in the debug overlay before concluding attribution is empty.

#### `Failed to debug attribution:`

`next-commerce/next-commerce.attribution.ts › debugAttribution` · extra context attached

**Meaning:** The `next.debugAttribution()` helper threw. It only prints attribution state, so nothing about the page or the order changed.

**Action:** Nothing on a customer page — this call exists for debugging. Read the attached error if you were using it to investigate something else.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Attribution metadata added: {key}` | `next-commerce/next-commerce.attribution.ts › addMetadata` | yes |
| `Attribution metadata set:` | `next-commerce/next-commerce.attribution.ts › setMetadata` | yes |
| `Attribution metadata cleared` | `next-commerce/next-commerce.attribution.ts › clearMetadata` | — |
| `Attribution set:` | `next-commerce/next-commerce.attribution.ts › setAttribution` | yes |

## `[NextCommerce]`

Part of the `window.next` API — the cart operations a page drives directly — adding, swapping, clearing.

Logged from `next-commerce/next-commerce.cart.ts`. A free function, not a class with its own logger. `NextCommerce` builds one `Logger('NextCommerce')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Cart swapped with {length} items` | `next-commerce/next-commerce.cart.ts › swapCart` | — |

## `[NextCommerce]`

Part of the `window.next` API — the callbacks a page registers through `next.on…`, and the SDK calling them back.

Logged from `next-commerce/next-commerce.events.ts`. A free function, not a class with its own logger. `NextCommerce` builds one `Logger('NextCommerce')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Callback error for {type}:`

`next-commerce/next-commerce.events.ts › triggerCallback` · extra context attached

**Meaning:** One of your own callbacks registered through `next.on…` threw. The SDK caught it and carried on with the other callbacks for that type.

**Action:** Fix the callback named in the attached error. The SDK’s own state is unaffected, but anything your callback was supposed to do — a pixel, a redirect — did not happen.

## `[NextCommerce]`

Part of the `window.next` API — exit-intent and FOMO popups a page turns on or off from JavaScript.

Logged from `next-commerce/next-commerce.popups.ts`. A free function, not a class with its own logger. `NextCommerce` builds one `Logger('NextCommerce')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to setup exit intent:`

`next-commerce/next-commerce.popups.ts › exitIntent` · extra context attached

**Meaning:** The exit-intent popup could not be configured, so it will never show. The error is also re-thrown, so your own `await next.exitIntent(...)` rejects.

**Action:** Read the attached error and check the options you passed, particularly the image URL. Handle the rejection in your own code so a popup failing does not stop the rest of your setup.

#### `Failed to start FOMO popup:`

`next-commerce/next-commerce.popups.ts › fomo` · extra context attached

**Meaning:** The FOMO popup did not start, so no social-proof messages appear. The error is re-thrown to your caller.

**Action:** Read the attached error and check the configuration you passed — an empty or malformed customer list is the usual cause.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Exit intent configured with image:` | `next-commerce/next-commerce.popups.ts › exitIntent` | yes |
| `FOMO popup started` | `next-commerce/next-commerce.popups.ts › fomo` | — |

## `[NextCommerce]`

Part of the `window.next` API — post-purchase upsells accepted from JavaScript rather than from markup.

Logged from `next-commerce/next-commerce.upsells.ts`. A free function, not a class with its own logger. `NextCommerce` builds one `Logger('NextCommerce')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to add upsell(s) via SDK:`

`next-commerce/next-commerce.upsells.ts › addUpsell` · extra context attached

**Meaning:** A post-purchase upsell could not be added. The error is re-thrown, so the promise from `next.addUpsell()` rejects.

**Action:** Read the attached error before offering the visitor a retry: the line may already exist on the order, and a blind retry can charge them twice. Re-read the order first.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Adding upsell(s) via SDK:` | `next-commerce/next-commerce.upsells.ts › addUpsell` | yes |

## `[NextCommerce]`

Part of the `window.next` API — the URL parameters a page reads or applies through the API.

Logged from `next-commerce/next-commerce.url-params.ts`. A free function, not a class with its own logger. `NextCommerce` builds one `Logger('NextCommerce')` in `next-commerce.ts` and passes it in, so every line here prints under `[NextCommerce]`.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `URL parameter set: {key}={value}` | `next-commerce/next-commerce.url-params.ts › setParam` | — |
| `URL parameters set:` | `next-commerce/next-commerce.url-params.ts › setParams` | yes |
| `URL parameter cleared: {key}` | `next-commerce/next-commerce.url-params.ts › clearParam` | — |
| `All URL parameters cleared` | `next-commerce/next-commerce.url-params.ts › clearAllParams` | — |
| `URL parameters merged:` | `next-commerce/next-commerce.url-params.ts › mergeParams` | yes |

## `[ErrorHandler]`

Catches uncaught page errors and rejected promises, wraps them with SDK version and URL, and re-publishes them as the `error:occurred` event.

Logged from `monitoring/error-handler.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Captured error:`

`monitoring/error-handler.ts › GlobalErrorHandler.handleError` · extra context attached

**Meaning:** The global handler caught an uncaught error, a rejected promise, or something written to `console.error`, and re-published it as `error:occurred`. The attached objects carry the original error plus SDK version, URL, and user agent. The failure itself happened somewhere else — this line is the report, not the cause.

**Action:** Read the attached error and stack to find the real source. Errors from your own page code arrive here too, so check the stack before assuming it is the SDK.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Global error handler initialized` | `monitoring/error-handler.ts › GlobalErrorHandler.initialize` | — |

## `[StorageManager]`

The thin wrapper the SDK uses for its own sessionStorage and localStorage reads and writes. Its errors are storage being unavailable, not data being wrong.

Logged from `storage.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to store value for key {key}:`

`storage.ts › StorageManager.set` · extra context attached

**Meaning:** Writing to storage failed and the write was abandoned — the caller received `false`. Storage being full or unavailable, which is normal in some private-browsing modes, produces this.

**Action:** Read the attached error. Nothing recovers a blocked storage from the page; expect the value not to survive a reload, and check anything that assumes it will.

#### `Failed to retrieve value for key {key}:`

`storage.ts › StorageManager.get` · extra context attached

**Meaning:** Reading a key threw, so the caller got its default value. A stored value that is no longer valid JSON does this as well as storage being unavailable.

**Action:** Read the attached error. If it names one key repeatedly, remove that key: a corrupt entry keeps failing until it is cleared.

#### `Failed to remove value for key {key}:`

`storage.ts › StorageManager.remove` · extra context attached

**Meaning:** Deleting a key failed, so a value you expected to be gone may still be there and be read back later.

**Action:** Read the attached error, then confirm the key is actually gone before relying on it — a stale cache surviving a reset produces confusing follow-on behaviour.

#### `Failed to clear storage:`

`storage.ts › StorageManager.clear` · extra context attached

**Meaning:** Clearing storage failed, so previous values remain. Anything meant to start from a clean slate does not.

**Action:** Read the attached error. Clear the site’s storage in devtools when you need a genuinely fresh session for testing.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Stored value for key: {key}` | `storage.ts › StorageManager.set` | — |
| `No value found for key: {key}` | `storage.ts › StorageManager.get` | — |
| `Retrieved value for key: {key}` | `storage.ts › StorageManager.get` | — |
| `Removed value for key: {key}` | `storage.ts › StorageManager.remove` | — |
| `Cleared all storage` | `storage.ts › StorageManager.clear` | — |

## `[{EnhancerClassName}]`

The behaviour every feature inherits: reading attributes, subscribing to stores, and the shared error path that turns a thrown error into a log line plus an `error:occurred` event.

Logged from `base/base-enhancer.ts`. The base class every feature extends builds its logger from the subclass name, so this line appears under the feature’s own prefix — `[AddToCartEnhancer]`, `[TimerEnhancer]`, and so on.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error in {context}:`

`base/base-enhancer.ts › BaseEnhancer.handleError` · extra context attached

**Meaning:** A feature caught an error inside itself and reported it under its own prefix, naming the operation that failed. It also emits `error:occurred`. The feature stays alive but that operation did not complete.

**Action:** Read the operation name and the message. Which feature it is comes from the log prefix, and the matching `guide/reference/errors.md` covers the messages that feature raises.

## `[DOMObserver]`

Watches the page for elements added or attributes changed after boot, so markup injected by a page builder or an A/B tool still gets enhanced.

Logged from `base/dom-observer.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to start DOM observation:`

`base/dom-observer.ts › DOMObserver.start` · extra context attached

**Meaning:** The observer could not attach, so elements added after boot will not be enhanced. Markup present at boot still works, which makes this look like "only dynamic content is broken".

**Action:** Read the attached error. A missing target element is the usual cause — the observer needs a `<body>` to watch, so starting the SDK before the body exists produces this.

#### `Handler error:`

`base/dom-observer.ts › DOMObserver.notifyHandlers` · extra context attached

**Meaning:** A handler subscribed to DOM changes threw. The observer caught it and carried on with the other handlers, so one broken handler does not stop the rest.

**Action:** Read the attached error to find the handler. If it fires on every mutation, the console noise alone will slow the page down.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Already observing, ignoring start request`

`base/dom-observer.ts › DOMObserver.start`

**Meaning:** Something asked the DOM observer to start while it was already running; the request was ignored. One observer is all that is needed, so nothing is lost.

**Action:** Nothing. Repeated occurrences mean code is starting the observer in a loop — look at the caller.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Added handler, total: {size}` | `base/dom-observer.ts › DOMObserver.addHandler` | — |
| `Removed handler, total: {size}` | `base/dom-observer.ts › DOMObserver.removeHandler` | — |
| `Started observing DOM changes` | `base/dom-observer.ts › DOMObserver.start` | yes |
| `Stopped observing DOM changes` | `base/dom-observer.ts › DOMObserver.stop` | — |
| `Paused DOM observation` | `base/dom-observer.ts › DOMObserver.pause` | — |
| `Resumed DOM observation` | `base/dom-observer.ts › DOMObserver.resume` | — |
| `Processing {length} relevant mutations` | `base/dom-observer.ts › DOMObserver.handleMutations` | — |
| `Processing {size} pending changes` | `base/dom-observer.ts › DOMObserver.processePendingChanges` | — |
| `DOM observer destroyed` | `base/dom-observer.ts › DOMObserver.destroy` | — |
| `Updated configuration` | `base/dom-observer.ts › DOMObserver.updateConfig` | yes |

## `[AttributeParser]`

Turns attribute text into something the features can act on — including the comparison expressions behind `data-next-show` and `data-next-hide`.

Logged from `base/attribute-parser.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to parse condition:`

`base/attribute-parser.ts › AttributeParser.parseCondition` · extra context attached

**Meaning:** A `data-next-show` or `data-next-hide` expression could not be parsed. The parser falls back to `cart.isEmpty`, so the element will show or hide on cart emptiness rather than on what you wrote — visible but wrong, which goes unnoticed longer than a blank element would.

**Action:** The unparsed condition is attached: check it against the conditional-display grammar. Unbalanced quotes and a comparison operator with no right-hand side are the common mistakes.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Parsing condition:` | `base/attribute-parser.ts › AttributeParser.parseCondition` | yes |
| `Parsed comparison:` | `base/attribute-parser.ts › AttributeParser.parseCondition` | yes |

## `[{DisplayEnhancerClassName}]`

Everything behind a `data-next-display` binding: resolving the namespaced path to a value, formatting it, and re-rendering when the value or the currency changes. Four `features/cart/**` display files extend it as well as the display features, which is why it is a base class here rather than a file in the display folder.

Logged from `base/base-display-enhancer.ts`. Like `base-enhancer.ts`, the logger is built from the subclass name, so the line appears under whichever display feature you are looking at — `[ProductDisplayEnhancer]`, `[CartSummaryEnhancer]`, and so on.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Validator failed for {displayPath}:`

`base/base-display-enhancer.ts › BaseDisplayEnhancer.getPropertyValueWithValidation` · extra context attached

**Meaning:** A `data-next-display` binding resolved to a value its format rejected — a price path that produced text, a date path that produced something unparseable. The element shows the fallback for that format instead of the real value, so the page looks finished while one number is quietly wrong. The path is in the message and the thrown error is attached.

**Action:** Compare the named path against the data actually in the store (`window.next.getCartData()`, or the campaign in the debug overlay). Usually the path is right and the data is missing for this campaign, in which case the fix is upstream in the campaign setup, not in the markup. A path that is simply misspelled produces no value at all rather than this line.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `{name} initialized with path: {displayPath}` | `base/base-display-enhancer.ts › BaseDisplayEnhancer.initialize` | — |
| `Currency changed, updating display for {displayPath}` | `base/base-display-enhancer.ts › BaseDisplayEnhancer.setupCurrencyChangeListener` | — |

## `[DisplayErrorBoundary]`

Contains a failure inside one display binding so it cannot blank out the rest of the page. A line here means one element gave up, not that the SDK stopped — which is exactly the distinction to establish first when "some prices are missing".

Logged from `base/display-error-boundary.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `[Display Error] {operation}:`

`base/display-error-boundary.ts › DisplayErrorBoundary.handleError` · extra context attached

**Meaning:** One display binding threw and the boundary caught it, so that single element stopped updating while the rest of the page carried on. `{operation}` names the step that failed and the attached object carries the error, its stack, and the binding’s context.

**Action:** Read the attached `context` to find which element and path were involved, then the `error`. Because the failure is contained, this line is the only signal — nothing on the page will look broken except one stale or blank value, so treat it as a real defect rather than noise.

#### `Error in error handler:`

`base/display-error-boundary.ts › DisplayErrorBoundary.handleError` · extra context attached

**Meaning:** A custom handler registered on the display error boundary threw while handling another error. The original error was still logged; this is the handler failing on top of it.

**Action:** Fix the handler — it is your code, registered via the boundary’s handler list. Look for the preceding `[Display Error]` line to see what it was reacting to. A handler that throws can hide the real problem, so it should never do more than report.

## `[TemplateRenderer]`

Renders the `data-next-*` placeholder templates that cart, package, and order item rows are built from. A line here means one field in one row could not be formatted — the row still renders, with that field blank.

Logged from `rendering/template-renderer.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Template rendering error for placeholder {placeholder}:`

`rendering/template-renderer.ts › replacer` · extra context attached

**Meaning:** One placeholder in a cart, package, or order item template threw while being formatted. That placeholder falls back to its default — usually an empty string — so the row still renders with one field blank or stale, and the rest of the template is unaffected.

**Action:** Read the attached error and check the named placeholder against the data the row was given; a missing price or currency on the item is the usual cause. Note this used to print through `console.warn` and so appeared on production pages regardless of log level — it is now gated like every other warning, so reproduce it with `?debug=true` if a field is blank on a live page.

## `[DisplayValueValidator]`

Coerces a resolved value into the shape its format needs — a price to a 2-decimal number, a date string to a `Date`. Every line here means a value was replaced by a fallback, so the element rendered something plausible instead of the truth. These are the quietest wrong-number bugs in the SDK.

Logged from `base/display-value-validator.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Invalid percentage value: {value}`

`base/display-value-validator.ts › DisplayValueValidator.validatePercentage`

**Meaning:** A path formatted as a percentage produced something that is not a number, so the element shows **0%**. A real 0% and a failed conversion look identical on the page.

**Action:** The offending value is in the message. Check whether the path should be a percentage at all — `data-next-format="percentage"` on a plain number path is the usual cause — or whether the campaign is missing that field.

#### `Percentage exceeds 100: {num}`

`base/display-value-validator.ts › DisplayValueValidator.validatePercentage`

**Meaning:** A percentage resolved above 100 and was clamped to **100%**. Most often a fraction that was already converted once, so 0.85 became 85 and then 8500.

**Action:** Check whether the source field stores a fraction (0–1) or a percentage (0–100); the validator accepts both, so a value that has been scaled twice is the thing to look for.

#### `Invalid currency value: {value}`

`base/display-value-validator.ts › DisplayValueValidator.validateCurrency`

**Meaning:** A money path produced something unparseable, so the element shows **0** in the campaign currency. This is the one to take most seriously: a zero price reads as free.

**Action:** Read the value in the message. Currency symbols and commas are stripped before conversion, so a failure here usually means the field is absent or holds text. Verify the package actually carries that price in the campaign.

#### `Invalid number value: {value}`

`base/display-value-validator.ts › DisplayValueValidator.validateNumber`

**Meaning:** A numeric path produced a non-number and the element shows **0**.

**Action:** Check the path against the campaign or cart data. A `0` on the page with no line here is a genuine zero; a `0` with this line is a conversion that failed.

#### `Invalid date value: {value}`

`base/display-value-validator.ts › DisplayValueValidator.validateDate`

**Meaning:** A date path could not be parsed, so the element renders **nothing** — this is the one failure in this file that leaves a blank rather than a wrong number.

**Action:** Read the value in the message. `new Date()` parses ISO 8601 reliably and little else consistently across browsers, so a format that works in one browser and blanks in another is the pattern to expect.

## `[CountryService]`

Validates and formats a postal code against a country’s rules, and holds the built-in per-country defaults used when the CDN has none for a country.

Logged from `country-service/country-service.postal-code.ts`. A free function, not a class with its own logger. `CountryService` builds one `Logger('CountryService')` in `country-service.ts` and passes it in as a parameter, so every line here prints under `[CountryService]`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Invalid postal code regex:`

`country-service/country-service.postal-code.ts › validatePostalCode` · extra context attached

**Meaning:** The postal-code pattern configured for a country is not a valid regular expression, so validation was skipped and any postal code is accepted. Orders can be placed with an address the carrier will reject.

**Action:** Fix the pattern in the country configuration. Until then postal codes are unvalidated — the failure is silent from the visitor’s side, so do not wait for a complaint.

## `[CountryService]`

Filters the country and state lists to what the campaign actually ships to, and picks a fallback country when the visitor’s detected one is not on that list.

Logged from `country-service/country-service.filtering.ts`. A free function, not a class with its own logger. `CountryService` builds one `Logger('CountryService')` in `country-service.ts` and passes it in through a `{ campaignShippingCountries, config, logger }` context, so every line here prints under `[CountryService]`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `⚠️ Using deprecated showCountries config. Please use campaign API instead.`

`country-service/country-service.filtering.ts › applyCountryFiltering`

**Meaning:** The country list is being filtered by the `showCountries` setting in configuration. That setting is deprecated: the campaign’s `available_shipping_countries` is the intended source, and it is ignored while `showCountries` is set.

**Action:** Set the shipping countries on the campaign, then remove `showCountries` from the page configuration. Leaving both in place means the page and the campaign can disagree about where you ship.

#### `⚠️ No countries available in filtered list. Using config defaultCountry: {defaultCountry}`

`country-service/country-service.filtering.ts › applyCountryFiltering`

**Meaning:** Filtering left no countries at all, so the configured default is used on its own. The visitor sees a country dropdown with one entry, whatever their real location.

**Action:** Check the campaign’s shipping countries and any `showCountries` filter — an overlap of zero between them produces this. This one blocks visitors from ordering, so treat it as urgent.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `✅ Filtering countries based on campaign API (available_shipping_countries):` | `country-service/country-service.filtering.ts › applyCountryFiltering` | yes |
| `Using custom countries list from addressConfig.countries` | `country-service/country-service.filtering.ts › applyCountryFiltering` | — |
| `Filtering countries based on addressConfig.showCountries (legacy):` | `country-service/country-service.filtering.ts › applyCountryFiltering` | yes |
| `✅ Detected country ({detectedCountryCode}) not available for shipping. Using fallback: United States (US)` | `country-service/country-service.filtering.ts › applyCountryFiltering` | — |
| `✅ Detected country ({detectedCountryCode}) not available and US not in list. Using first available country: {fallbackCountryCode}` | `country-service/country-service.filtering.ts › applyCountryFiltering` | — |
| `Preserving detected currency: {currencyCode} from detected location: {detectedCountryCode}` | `country-service/country-service.filtering.ts › applyCountryFiltering` | — |
| `✅ Using detected country: {detectedCountryCode} (available for shipping)` | `country-service/country-service.filtering.ts › applyCountryFiltering` | — |

## `[CountryService]`

Detects the visitor’s country, fetches and caches the country and state lists for the address form, and delegates postal-code rules and shipping-country filtering to its sibling modules.

Logged from `country-service/country-service.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to fetch location data:`

`country-service/country-service.ts › CountryService.getLocationData` · extra context attached

**Meaning:** The location request failed and the built-in fallback is in use: the configured country list and the United States as the detected country. Prices and shipping options are for that fallback, not for the visitor.

**Action:** Read the attached error. It is often an ad blocker or a network failure. A single successful response is cached in localStorage, so a reload usually clears it.

#### `Failed to fetch states for {countryCode}:`

`country-service/country-service.ts › CountryService.getCountryStates` · extra context attached

**Meaning:** The state list for that country could not be loaded, so the state field renders with no options. In countries where a state is required, the visitor cannot complete the address.

**Action:** Read the attached error and re-select the country to retry; a good response is cached. If one country always fails, check that its code is in the campaign’s shipping countries.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Failed to clear cache:`

`country-service/country-service.ts › CountryService.clearCache` · extra context attached

**Meaning:** Clearing the cached country and state data failed, so stale lists may still be served this session.

**Action:** Read the attached error. Clear site data in devtools if you are testing a change to the country list and it will not take effect.

#### `Failed to clear cache for country {countryCode}:`

`country-service/country-service.ts › CountryService.clearCountryCache` · extra context attached

**Meaning:** The cached states for one country could not be removed, so the old list may still be shown.

**Action:** Same as above — read the attached error, and clear site data when testing a change to that country’s states.

#### `Failed to read from cache:`

`country-service/country-service.ts › CountryService.getFromCache` · extra context attached

**Meaning:** A cached entry could not be read, so the data is fetched from the API instead. Correct behaviour, one request slower.

**Action:** Nothing. If it repeats on every page, storage is unavailable in this browser mode and every visit will re-fetch the country data.

#### `Failed to write to cache:`

`country-service/country-service.ts › CountryService.setCache` · extra context attached

**Meaning:** A response could not be cached, so the next page will fetch it again. Nothing is wrong with the data.

**Action:** Nothing. Persistent occurrences mean storage is full or blocked, which costs a request per page rather than breaking anything.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Address configuration updated:` | `country-service/country-service.ts › CountryService.setConfig` | yes |
| `Campaign shipping countries updated:` | `country-service/country-service.ts › CountryService.setCampaignShippingCountries` | yes |
| `Location data fetched` | `country-service/country-service.ts › CountryService.getLocationData` | yes |
| `States data fetched for {countryCode}` | `country-service/country-service.ts › CountryService.getCountryStates` | yes |
| `Country service cache cleared ({length} session + {length} local entries)` | `country-service/country-service.ts › CountryService.clearCache` | — |
| `Cache cleared for country: {countryCode}` | `country-service/country-service.ts › CountryService.clearCountryCache` | — |

## `[AttributionCollector]`

Collects where the visitor came from — funnel name, UTM tags, Everflow click id, tracking-tag meta tags — and keeps it for the order.

Logged from `attribution/attribution-collector.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Subaffiliate value truncated from {length} to 225 characters`

`attribution/attribution-collector.ts › AttributionCollector.limitSubaffiliateLength`

**Meaning:** A subaffiliate value was longer than the API accepts and was cut to 225 characters. The order is still created; the value stored is shortened, so reports may not match the tracking link exactly.

**Action:** Shorten the value at the source — the affiliate link or the tracking template. Two long values that differ only after character 225 become indistinguishable once truncated.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `🔄 Funnel override: "{existingFunnel}" -> "{urlFunnel}" (from URL parameter)` | `attribution/attribution-collector.ts › AttributionCollector.getFunnelName` | — |
| `Persisted funnel name from URL: {urlFunnel}` | `attribution/attribution-collector.ts › AttributionCollector.getFunnelName` | — |
| `Persisted funnel name: {value}` | `attribution/attribution-collector.ts › AttributionCollector.getFunnelName` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Funnel found in URL parameter: {urlFunnel}` | `attribution/attribution-collector.ts › AttributionCollector.getFunnelName` | — |
| `Using persisted funnel from session: {sessionFunnel}` | `attribution/attribution-collector.ts › AttributionCollector.getFunnelName` | — |
| `Using persisted funnel from localStorage: {localFunnel}` | `attribution/attribution-collector.ts › AttributionCollector.getFunnelName` | — |
| `Using persisted funnel from attribution: {funnel}` | `attribution/attribution-collector.ts › AttributionCollector.getFunnelName` | — |
| `New funnel found from meta tag: {value}` | `attribution/attribution-collector.ts › AttributionCollector.getFunnelName` | — |
| `Everflow click ID found in URL: {evclid}` | `attribution/attribution-collector.ts › AttributionCollector.handleEverflowClickId` | — |
| `Everflow click ID found in sessionStorage: {evclid}` | `attribution/attribution-collector.ts › AttributionCollector.handleEverflowClickId` | — |
| `Added Everflow transaction ID to metadata: {evclid}` | `attribution/attribution-collector.ts › AttributionCollector.handleEverflowClickId` | — |
| `Found {length} tracking tags` | `attribution/attribution-collector.ts › AttributionCollector.collectTrackingTags` | — |
| `Added tracking tag: {tagName} = {tagValue}` | `attribution/attribution-collector.ts › AttributionCollector.collectTrackingTags` | — |
| `Persisted tracking tag: {tagName}` | `attribution/attribution-collector.ts › AttributionCollector.collectTrackingTags` | — |
| `Facebook Pixel ID found from meta tag: {pixelId}` | `attribution/attribution-collector.ts › AttributionCollector.getFacebookPixelId` | — |
| `Facebook Pixel ID found from script: {match[1]}` | `attribution/attribution-collector.ts › AttributionCollector.getFacebookPixelId` | — |

## `[UtmTransfer]`

Copies the current page’s URL parameters onto the links leaving it, so attribution survives a click through to the next page.

Logged from `attribution/utm-transfer.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Invalid link element provided`

`attribution/utm-transfer.ts › UtmTransfer.applyParamsToLink`

**Meaning:** UTM transfer was handed something that is not a usable link element, so no parameters were copied onto it. Only code calling the API directly can cause this; the automatic pass over the page’s links does not.

**Action:** Pass an `<a>` element that is in the document. A `null` from a selector that matched nothing is the usual cause.

#### `Invalid URL:`

`attribution/utm-transfer.ts › UtmTransfer.applyParamsToLink` · extra context attached

**Meaning:** A link’s `href` could not be parsed as a URL, so attribution parameters were not added to it. A visitor clicking that link arrives on the next page with no UTM tags.

**Action:** The offending `href` is attached. Fix the link — a stray space, an unsubstituted template token such as `{{url}}`, or a `javascript:` href all produce this.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `UTM Transfer disabled by configuration` | `attribution/utm-transfer.ts › UtmTransfer.init` | — |
| `No URL parameters to transfer` | `attribution/utm-transfer.ts › UtmTransfer.init` | — |
| `Available parameters: {join(', ')}` | `attribution/utm-transfer.ts › UtmTransfer.init` | — |
| `No matching parameters to transfer` | `attribution/utm-transfer.ts › UtmTransfer.init` | — |
| `UTM Transfer initialized with parameters: {toString()}` | `attribution/utm-transfer.ts › UtmTransfer.init` | — |
| `Filtering to specific parameters: {join(', ')}` | `attribution/utm-transfer.ts › UtmTransfer.prepareParameters` | — |
| `Found parameter to copy: {param}={get(param)}` | `attribution/utm-transfer.ts › UtmTransfer.prepareParameters` | — |
| `No specific parameters configured, will copy all parameters` | `attribution/utm-transfer.ts › UtmTransfer.prepareParameters` | — |
| `Found {length} links on the page` | `attribution/utm-transfer.ts › UtmTransfer.enhanceLinks` | — |
| `Updated link {href} to {toString()}` | `attribution/utm-transfer.ts › UtmTransfer.applyParamsToLink` | — |

## `[NextAnalytics]`

The analytics entry point: reads configuration, builds the enabled providers, and accepts every event the rest of the SDK tracks.

Logged from `analytics/index.ts`.

Rows marked *message assembled in code* are built from several string literals joined together, so searching the source for the whole sentence finds nothing — search for the first few words instead. The location given is where the message text begins, which is a line or two after the `logger.*` call itself.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error checking ignore parameter:`

`analytics/index.ts › NextAnalytics.checkAndSetIgnoreFlag` · extra context attached

**Meaning:** Reading `?ignore=true` or writing its session flag threw, so analytics may not be suppressed on a page where you asked for it to be. Events could be sent from a session you meant to exclude.

**Action:** Read the attached error — a blocked `sessionStorage` is the usual cause. Do not rely on `?ignore=true` for excluding your own test traffic while this appears.

#### `Error checking ignore status:`

`analytics/index.ts › NextAnalytics.shouldIgnoreAnalytics` · extra context attached

**Meaning:** Deciding whether this session is ignored threw, and the answer defaulted to "not ignored" — so events are sent.

**Action:** Read the attached error. Same practical consequence as above: internal traffic may be landing in reports.

#### `Failed to initialize analytics:`

`analytics/index.ts › NextAnalytics.initialize` · extra context attached

**Meaning:** Analytics did not start and the error is re-thrown to boot, which logs `Analytics v2 initialization failed (non-critical):`. No events are sent from this page load.

**Action:** Read the attached error. A provider that cannot load its own script is the common cause, and the provider name in the message tells you which to look at.

#### `Event validation failed:`

`analytics/index.ts › NextAnalytics.track` · extra context attached

**Meaning:** In debug mode only, an event did not match its schema; the attached list names the fields. The event is still sent, so the problem shows up as bad data in the destination rather than a missing event.

**Action:** Fix the fields named in the attachment. This check does not run outside debug mode, so run `?debug=true` before a launch rather than after a report of odd numbers.

#### `Error clearing ignore flag:`

`analytics/index.ts › NextAnalytics.clearIgnoreFlag` · extra context attached

**Meaning:** Removing the analytics ignore flag failed, so the session stays excluded from analytics — no events will be sent from it until storage is cleared.

**Action:** Read the attached error, then clear `analytics_ignore` from sessionStorage in devtools. A tester left in this state reports "no events" for a reason unrelated to the tracking setup.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Analytics not initialized, queuing event:`

`analytics/index.ts › NextAnalytics.track` · extra context attached

**Meaning:** An event arrived before analytics finished starting. It is held and sent once initialization completes, so this is expected once or twice at the top of a page load.

**Action:** Nothing if `NextAnalytics initialized successfully` follows. If it never does, the queued events are never sent — investigate the initialization failure instead of this line.

#### `Event validation warnings:`

`analytics/index.ts › NextAnalytics.track` · extra context attached

**Meaning:** Debug-mode validation found things worth noting on an event that already failed — a missing recommended field, or an event with no schema at all.

**Action:** Read the list. Warnings do not stop delivery; treat them as the list of fields a destination will silently ignore.

#### `No campaign apiKey configured — analytics events will lack campaign identifiers. Set <meta name="next-api-key" content="..."> or window.nextConfig.apiKey.`

`analytics/index.ts › NextAnalytics.warnMissingConfig` · message assembled in code

**Meaning:** Analytics started without a campaign API key, so no event can carry campaign id, name, currency, or language. Events still arrive; they cannot be grouped by campaign.

**Action:** Add the key before the loader script — `<meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">` or `window.nextConfig.apiKey`. Without it the campaign never loads, so this warning usually comes with a page full of placeholder prices.

#### `Provider "{key}" is enabled but {required} is missing — set it to enable {key}; skipping.`

`analytics/index.ts › NextAnalytics.initializeProviders` · message assembled in code

**Meaning:** A provider is switched on in configuration but one setting it cannot start without is absent, so it is skipped. Events go to the other providers only, and that destination reports nothing.

**Action:** Set the setting named in the message, or turn the provider off so the gap in its reporting is deliberate rather than a surprise.

#### `Provider "{key}" is enabled but its preconditions are not met; skipping.`

`analytics/index.ts › NextAnalytics.initializeProviders` · message assembled in code

**Meaning:** A provider is switched on but its own start-up check said no, and it lists no single required setting to name. It is skipped and receives no events.

**Action:** Check that provider’s configuration block as a whole. `?debug=true` shows the providers that did start, which is the quickest way to confirm which one is missing.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Analytics ignore flag set from URL parameter` | `analytics/index.ts › NextAnalytics.checkAndSetIgnoreFlag` | — |
| `Analytics ignored due to ignore parameter` | `analytics/index.ts › NextAnalytics.initialize` | — |
| `Analytics disabled in configuration` | `analytics/index.ts › NextAnalytics.initialize` | — |
| `Auto-tracking initialized (user data fired first, meta tags processed)` | `analytics/index.ts › NextAnalytics.initialize` | — |
| `Manual mode - meta tags processed, auto-tracking disabled` | `analytics/index.ts › NextAnalytics.initialize` | — |
| `NextAnalytics initialized successfully` | `analytics/index.ts › NextAnalytics.initialize` | yes |
| `{key} adapter initialized` | `analytics/index.ts › NextAnalytics.initializeProviders` | yes |
| `Debug mode {enabled ? 'enabled' : 'disabled'}` | `analytics/index.ts › NextAnalytics.setDebugMode` | — |
| `Analytics ignore flag cleared` | `analytics/index.ts › NextAnalytics.clearIgnoreFlag` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Analytics already initialized` | `analytics/index.ts › NextAnalytics.initialize` | — |
| `Event tracking skipped due to ignore flag:` | `analytics/index.ts › NextAnalytics.track` | yes |
| `Called ElevarInvalidateContext` | `analytics/index.ts › NextAnalytics.invalidateContext` | — |

## `[NextDataLayer]`

Pushes finished events onto `window.dataLayer` and fans them out to the providers, adding attribution and validating required fields on the way.

Logged from `analytics/data-layer-manager.ts`.

Rows marked *wording lives at the caller* are passed to a private logging helper, so the `logger.*` call is elsewhere in the file. The location given is where the wording is, which is the line you want.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to persist debug mode`

`analytics/data-layer-manager.ts › DataLayerManager.setDebugMode` · extra context attached

**Meaning:** Debug mode was switched on or off but the choice could not be saved to localStorage, so it will not survive a page navigation.

**Action:** Add `?debug=true` to the URL instead of relying on the saved setting. The attached error is normally storage being blocked.

#### `Error pushing event to data layer`

`analytics/data-layer-manager.ts › DataLayerManager.push` · extra context attached · wording lives at the caller

**Meaning:** An event could not be pushed to `window.dataLayer`, so nothing downstream — GTM included — sees it. The event is lost, not retried.

**Action:** Read the attached error and data. Note that these `NextDataLayer` errors print only when `debug.logErrors` is on, so an apparently silent console does not mean nothing failed.

#### `Failed to save user properties`

`analytics/data-layer-manager.ts › DataLayerManager.setUserProperties` · extra context attached · wording lives at the caller

**Meaning:** User properties could not be stored, so later events on this page load may go out without them.

**Action:** Read the attached error — storage being blocked is the usual cause.

#### `Failed to load user properties`

`analytics/data-layer-manager.ts › DataLayerManager.getUserProperties` · extra context attached · wording lives at the caller

**Meaning:** Stored user properties could not be read back, so events start without them even though the visitor identified themselves earlier.

**Action:** Read the attached error. A corrupt stored value keeps failing until it is cleared.

#### `Missing required field: {field}`

`analytics/data-layer-manager.ts › DataLayerManager.validateEvent` · extra context attached · wording lives at the caller

**Meaning:** An event reached the data layer without a field every event must have. It is still pushed, so the destination receives an incomplete event rather than none.

**Action:** The event is attached — find where it is built and set the named field. Fields required of every event are the shared ones (event name, id, timestamp), so this normally means an event was hand-built rather than made by `EventBuilder`.

#### `Missing required field for {event}: {field}`

`analytics/data-layer-manager.ts › DataLayerManager.validateEvent` · extra context attached · wording lives at the caller

**Meaning:** An event is missing a field its own type requires — a purchase with no transaction id, for example. It is still pushed.

**Action:** Set the named field where that event is built. Destinations may accept the event and then report it as unattributed, which is harder to notice than a rejected event.

#### `Invalid type for field {field}: expected {expectedType}, got {typeof value}`

`analytics/data-layer-manager.ts › DataLayerManager.validateEvent` · extra context attached · wording lives at the caller

**Meaning:** A field has the wrong type — most often a number sent as a string, or the reverse. The event is still pushed, and destinations that coerce silently will report a wrong value rather than an error.

**Action:** Convert the field at the point the event is built. Revenue fields are the ones to check first, since a string total can be dropped or read as zero.

#### `Error in provider {name}`

`analytics/data-layer-manager.ts › DataLayerManager.notifyProviders` · extra context attached · wording lives at the caller

**Meaning:** One provider threw while handling an event. The others still receive it, so this is a gap in one destination rather than a lost event.

**Action:** Read the attached error and the provider named in the message; that adapter’s own errors are in [errors.md](./errors.md).

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Purchase already reported for {transactionId} — dropping duplicate dl_purchase` | `analytics/data-layer-manager.ts › DataLayerManager.push` | — |

## `[AnalyticsConfig]`

Holds the per-provider settings — which fields each provider needs before it can be switched on.

Logged from `analytics/config.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Missing config for provider "{name}"`

`analytics/config.ts › validateProviderConfig`

**Meaning:** A provider was checked for its settings and had none. This cannot appear in a shipped build: the function that logs it, `validateProviderConfig()` in `analytics/config.ts`, is exported but never called anywhere in the SDK.

**Action:** Nothing to act on from a page. If you see it, something outside the SDK is calling that function — the live check that decides whether a provider can start is in `analytics/index.ts` and warns with `Provider "{key}" is enabled but …` instead.

#### `Missing required field "{field}" for provider "{name}"`

`analytics/config.ts › validateProviderConfig`

**Meaning:** A provider’s settings are missing a field it needs. Like the message above, it comes from `validateProviderConfig()`, which nothing in the SDK calls, so a shipped build never prints it.

**Action:** Nothing to act on from a page. For a provider that genuinely will not start, look for `Provider "{key}" is enabled but {required} is missing …` from `NextAnalytics`.

## `[UserDataStorage]`

Remembers who the visitor is across pages — email, name, ids — in a cookie plus sessionStorage, so events after a redirect still identify them.

Logged from `analytics/user-data-storage.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to load user data:`

`analytics/user-data-storage.ts › UserDataStorage.loadUserData` · extra context attached

**Meaning:** Loading visitor data threw, so events go out without identity fields and without a stable session id. Purchase attribution to a visitor’s earlier pages breaks.

**Action:** Read the attached error. Cookies or storage being blocked is the usual cause; in that case identity cannot be kept across pages and the gap in reporting is expected, not a tracking bug.

#### `Failed to save user data:`

`analytics/user-data-storage.ts › UserDataStorage.saveUserData` · extra context attached

**Meaning:** Newly captured visitor details — typically an email typed at checkout — could not be stored, so the next page will not know them.

**Action:** Read the attached error. While this happens, events on later pages are anonymous even though the visitor identified themselves.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Failed to parse user data cookie:`

`analytics/user-data-storage.ts › UserDataStorage.loadUserData` · extra context attached

**Meaning:** The stored visitor cookie is not valid JSON, so it is ignored. Events on this page will not identify the visitor from the cookie; a fresh identity is built when they next enter their details.

**Action:** Read the attached error. One occurrence after a format change is expected; a cookie written by other code on the same name would explain a persistent one.

#### `Failed to parse sessionStorage user data:`

`analytics/user-data-storage.ts › UserDataStorage.loadUserData` · extra context attached

**Meaning:** The sessionStorage copy of the visitor data could not be parsed, so the older cookie copy is used. Recent details, such as an email typed on the previous step, may be missing from events.

**Action:** Read the attached error, then clear `user_data` from sessionStorage. It keeps failing on every page until the bad entry is removed.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `User email updated:` | `analytics/user-data-storage.ts › UserDataStorage.updateUserData` | yes |
| `User data cleared` | `analytics/user-data-storage.ts › UserDataStorage.clearUserData` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Loaded user data from cookie:` | `analytics/user-data-storage.ts › UserDataStorage.loadUserData` | yes |
| `Merged user data from sessionStorage` | `analytics/user-data-storage.ts › UserDataStorage.loadUserData` | — |
| `Saved user data to storage:` | `analytics/user-data-storage.ts › UserDataStorage.saveUserData` | yes |
| `Updated user data from form fields:` | `analytics/user-data-storage.ts › UserDataStorage.updateFromFormFields` | yes |

## `[EventBuilder]`

Session, page and campaign context attached to every analytics event.

Logged from `analytics/events/event-builder.context.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Could not access store state for user properties:`

`analytics/events/event-builder.context.ts › getUserProperties` · extra context attached

**Meaning:** The event was built without user properties because reading the stores threw. It is still sent, minus the customer fields.

**Action:** Read the attached error. Expect events with no customer email or name for as long as it happens, which affects audience matching more than event counts.

#### `Could not build campaign context:`

`analytics/events/event-builder.context.ts › getCampaignContext` · extra context attached

**Meaning:** The event carries no campaign identifiers — campaign id, name, currency, language — because building them threw. Destinations that group by campaign will file it under nothing.

**Action:** Read the attached error. If `apiKey` is unset, the separate warning `No campaign apiKey configured …` names the fix; otherwise the campaign store had not loaded when the event was built.

## `[EventBuilder]`

Turning a cart or order line into the item shape every provider expects — price, discount and currency resolution live here.

Logged from `analytics/events/ecommerce-item-formatter.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Could not access campaign store for currency:`

`analytics/events/ecommerce-item-formatter.ts › getCurrency` · extra context attached

**Meaning:** Currency could not be read and the event fell back to `USD`. Revenue from a non-USD campaign is then reported in the wrong currency, which looks like a change in order value rather than an error.

**Action:** Read the attached error. Verify the currency on the affected events before trusting any revenue figure from the period.

#### `Could not access campaign store for item formatting:`

`analytics/events/ecommerce-item-formatter.ts › formatEcommerceItem` · extra context attached

**Meaning:** An item in the event has no image URL because the campaign data could not be read. Everything else about the item is intact.

**Action:** Read the attached error. Cosmetic for most destinations; product feeds that require an image will reject the item.

#### `Could not find package data for packageId: {packageId}`

`analytics/events/ecommerce-item-formatter.ts › formatEcommerceItem` · extra context attached

**Meaning:** The event refers to a package that is not in the loaded campaign data, so the item falls back to ids instead of product name, SKU, and variant. The attachment lists the packages that *were* available, which is the fastest way to see what went wrong.

**Action:** Compare the id in the message with the attached list. A package removed from the campaign, or an id from a different campaign, gives this; so does an event fired before the campaign finished loading.

#### `Could not access campaign store for product data:`

`analytics/events/ecommerce-item-formatter.ts › formatEcommerceItem` · extra context attached

**Meaning:** Product details for an item could not be read, so the item is reported with ids only — no name, no SKU.

**Action:** Read the attached error. Reports built on product names will show these items as blank or as raw ids.

#### `Could not access campaign store for quantity:`

`analytics/events/ecommerce-item-formatter.ts › formatEcommerceItem` · extra context attached

**Meaning:** The units-per-package figure could not be read, so quantity is reported as the number of packages rather than the number of units. A "3-pack" then counts as 1.

**Action:** Read the attached error. Check quantity on the affected events before comparing units sold with the store’s own figures.

#### `Could not access campaign store for price:`

`analytics/events/ecommerce-item-formatter.ts › formatEcommerceItem` · extra context attached

**Meaning:** The catalogue price could not be read, so the item’s price field is left at its default. Revenue on the event may be understated.

**Action:** Read the attached error, then check the value of the affected events against the orders they belong to.

#### `Could not access campaign store for retail price:`

`analytics/events/ecommerce-item-formatter.ts › formatEcommerceItem` · extra context attached

**Meaning:** The pre-discount retail price could not be read, so the event has no "price before discount". Discount reporting is affected; revenue is not.

**Action:** Read the attached error. Low urgency unless you report on discount depth.

## `[EventBuilder]`

The deprecated Elevar payload shape, kept for pages still reading it.

Logged from `analytics/events/elevar-legacy-formatter.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Could not access campaign store:`

`analytics/events/elevar-legacy-formatter.ts › formatElevarProduct` · extra context attached

**Meaning:** Campaign data could not be read while building an item, so it is sent with whatever fields were already resolved.

**Action:** Read the attached error. If it appears in bulk, the campaign store failed to load and the same reason explains most other analytics warnings on the page.

## `[RudderStack]`

The per-event property builders the RudderStack adapter sends.

Logged from `analytics/providers/rudderstack-properties.ts`.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `User Identified on Purchase` | `analytics/providers/rudderstack-properties.ts › identifyFromUserProperties` | yes |

## `[AutoEventListener]`

Cart events picked up from the event bus and pushed to the data layer.

Logged from `analytics/tracking/auto-event-cart-handlers.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error getting cart data:`

`analytics/tracking/auto-event-cart-handlers.ts › getCartData` · extra context attached

**Meaning:** Reading the cart for an event threw, so the event goes out with no cart value and no items — or is skipped, depending on which event needed it.

**Action:** Read the attached error. If it coincides with a purchase, check that order’s value in the destination before trusting revenue reporting for the period.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Package not found for add to cart:`

`analytics/tracking/auto-event-cart-handlers.ts › handleAddToCart` · extra context attached

**Meaning:** Something was added to the cart but the matching package is not in the campaign data, so **no** `add_to_cart` event is sent. The cart itself is correct; the funnel loses a step.

**Action:** The id is attached. Check it against the campaign’s packages — markup pointing at a package from another campaign is the usual cause. Add-to-cart counts will be lower than orders until it is fixed.

#### `Package not found for remove from cart:`

`analytics/tracking/auto-event-cart-handlers.ts › handleRemoveFromCart` · extra context attached

**Meaning:** An item was removed from the cart but its package could not be found, so no `remove_from_cart` event is sent.

**Action:** The id is attached; check it against the campaign’s packages. Same cause as the add-to-cart version, and the two normally appear together.

#### `Package data not found for swap:`

`analytics/tracking/auto-event-cart-handlers.ts › handlePackageSwapped` · extra context attached

**Meaning:** A package swap happened but one or both packages are missing from the campaign data, so no swap event is sent. The cart still holds the right item.

**Action:** Both ids are attached. Check each against the campaign’s packages; a selector offering a package the campaign no longer contains produces this.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Tracked add to cart:` | `analytics/tracking/auto-event-cart-handlers.ts › handleAddToCart` | yes |
| `Tracked remove from cart:` | `analytics/tracking/auto-event-cart-handlers.ts › handleRemoveFromCart` | yes |
| `Tracked package swap:` | `analytics/tracking/auto-event-cart-handlers.ts › handlePackageSwapped` | yes |

## `[AutoEventListener]`

Checkout and order-completed events picked up from the event bus.

Logged from `analytics/tracking/auto-event-checkout-handlers.ts`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Tracked purchase:` | `analytics/tracking/auto-event-checkout-handlers.ts › reportPurchase` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Marked purchase event for queueing with _willRedirect = true` | `analytics/tracking/auto-event-checkout-handlers.ts › reportPurchase` | — |

## `[AutoEventListener]`

Post-purchase upsell events picked up from the event bus.

Logged from `analytics/tracking/auto-event-upsell-handlers.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Package not found for upsell view:`

`analytics/tracking/auto-event-upsell-handlers.ts › handleUpsellViewed` · extra context attached

**Meaning:** An upsell was shown but its package is not in the campaign data, so no upsell view event is sent. Accept and skip events for the same offer are affected in the same way.

**Action:** The id is attached. Check the upsell markup’s package id against the campaign — an upsell page reused across campaigns is the common cause.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Tracked upsell page view:` | `analytics/tracking/auto-event-upsell-handlers.ts › handleUpsellViewed` | yes |
| `Tracked upsell view:` | `analytics/tracking/auto-event-upsell-handlers.ts › handleUpsellViewed` | yes |
| `Tracked upsell accepted:` | `analytics/tracking/auto-event-upsell-handlers.ts › handleUpsellAccepted` | yes |
| `Tracked upsell skipped:` | `analytics/tracking/auto-event-upsell-handlers.ts › handleUpsellSkipped` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Upsell event already marked for queueing due to redirect` | `analytics/tracking/auto-event-upsell-handlers.ts › handleUpsellAccepted` | — |

## `[AutoEventListener]`

Exit-intent popup events picked up from the event bus.

Logged from `analytics/tracking/auto-event-exit-intent-handlers.ts`.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Tracked exit intent shown:` | `analytics/tracking/auto-event-exit-intent-handlers.ts › handleExitIntentShown` | yes |
| `Tracked exit intent accepted:` | `analytics/tracking/auto-event-exit-intent-handlers.ts › handleExitIntentClicked` | yes |
| `Tracked exit intent dismissed:` | `analytics/tracking/auto-event-exit-intent-handlers.ts › handleExitIntentDismissed` | yes |
| `Tracked exit intent closed:` | `analytics/tracking/auto-event-exit-intent-handlers.ts › handleExitIntentClosed` | yes |
| `Tracked exit intent action:` | `analytics/tracking/auto-event-exit-intent-handlers.ts › handleExitIntentAction` | yes |

## `[EcommerceEvents]`

Builds the purchase-funnel events — view item, add to cart, begin checkout, purchase, upsell. Split across `ecommerce-events.browse.ts` / `.cart.ts` / `.checkout.ts` / `.upsell.ts`; this one logs a warn when the campaign store cannot be read for an accepted-upsell item.

Logged from `analytics/events/ecommerce-events.upsell.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Could not access campaign store for upsell data:`

`analytics/events/ecommerce-events.upsell.ts › createAcceptedUpsellEvent` · extra context attached

**Meaning:** An upsell event was built without campaign name or package details because the campaign store could not be read. The event is still sent.

**Action:** Read the attached error. Upsell revenue is still counted; the product name attached to it may be missing.

## `[EcommerceEvents]`

Builds `dl_begin_checkout` and `dl_purchase` from the order the API returned. Logs an error when an order payload carries no identifier to report as `transaction_id`, because that purchase is dropped rather than sent with a made-up id.

Logged from `analytics/events/ecommerce-events.checkout.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Cannot build dl_purchase: order payload has no number, ref_id, orderId or transactionId`

`analytics/events/ecommerce-events.checkout.ts › createPurchaseEvent`

**Meaning:** A purchase was reported for a payload with nothing to use as `transaction_id`, so no event was sent. The order (if there is one) is missing from every purchase report. This used to be sent as `order_<timestamp>` instead, which no tag could match to an order.

**Action:** Look at what called it. `next.trackPurchase()` must be handed the order the API returned — `{ number, ref_id, lines, … }` — not a summary of it. From the SDK’s own paths this line means the orders API returned an order with neither a number nor a ref_id, which is worth raising with support.

## `[UserEvents]`

Builds the `dl_user_data` event that identifies the visitor and carries the current cart contents.

Logged from `analytics/events/user-events.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Could not add cart contents to user data event:`

`analytics/events/user-events.ts › UserEvents.createUserDataEvent` · extra context attached

**Meaning:** `dl_user_data` went out without the cart contents. Identity fields are intact; audiences built on "has these products in cart" will not see this visitor.

**Action:** Read the attached error. It usually means the cart store was not ready when the event fired, which is expected very early in a page load.

## `[EventValidator]`

Checks an event against its schema in debug mode, so a missing or mistyped field is caught while you are looking rather than in a report a week later.

Logged from `analytics/validation/event-validator.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Validation failed for {event}:`

`analytics/validation/event-validator.ts › EventValidator.validateEvent` · extra context attached

**Meaning:** Debug-mode validation rejected an event and the attached list names each problem. The event is still delivered — validation reports, it does not block.

**Action:** Fix the fields in the attachment. Nothing outside debug mode prints this, so make a `?debug=true` pass part of launching a page rather than a reaction to bad data.

## `[AutoEventListener]`

Turns the SDK’s own cart, upsell, and exit-intent events into analytics events, so a page gets tracking without writing any.

Logged from `analytics/tracking/auto-event-listener.ts`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `AutoEventListener initialized` | `analytics/tracking/auto-event-listener.ts › AutoEventListener.initialize` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Event {eventName} debounced` | `analytics/tracking/auto-event-listener.ts › AutoEventListener.shouldProcessEvent` | — |
| `AutoEventListener reset` | `analytics/tracking/auto-event-listener.ts › AutoEventListener.reset` | — |
| `AutoEventListener destroyed` | `analytics/tracking/auto-event-listener.ts › AutoEventListener.destroy` | — |
| `Updated debounce config:` | `analytics/tracking/auto-event-listener.ts › AutoEventListener.setDebounceConfig` | yes |

## `[MetaTagController]`

Fires `view_item` / `view_item_list` and scroll-depth events from `<meta>` tags, including reading the package id out of a URL parameter and waiting for a time, an element, or a scroll threshold.

Logged from `analytics/tracking/meta-tag-controller.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `URL param "{paramName}" not found for view_item event`

`analytics/tracking/meta-tag-controller.ts › MetaTagController.parseViewItemConfig`

**Meaning:** A meta tag asked for the package id to come from a URL parameter (`content="url:pid"`) and that parameter is not in the URL, so no `view_item` fires.

**Action:** Either link to the page with the parameter (`?pid=42`) or put the id in the meta tag directly. The parameter name in the message is what to look for in the link.

#### `URL param "{paramName}" not found for view_item_list event`

`analytics/tracking/meta-tag-controller.ts › MetaTagController.parseViewItemListConfig`

**Meaning:** Same as above for `view_item_list`: the URL parameter naming the package list is missing, so no list event fires.

**Action:** Add the parameter to the links that lead here, or list the package ids in the meta tag. Ad platforms that strip unknown parameters are worth checking.

#### `Package {packageId} not found for view_item event`

`analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemEvent`

**Meaning:** The meta tag names a package the campaign does not contain, so no `view_item` fires for it and the page reports no product view.

**Action:** Check the id in the meta tag against the campaign’s packages. It must be the package `ref_id`, not a product or variant id.

#### `Invalid time trigger value: {triggerValue}, firing immediately`

`analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemEvent`

**Meaning:** A time-based trigger was configured with something that is not a positive number of milliseconds, so the event fired at once instead of after the delay. The event is not lost, only mistimed.

**Action:** Set the trigger to a positive whole number of milliseconds — `time:3000`. Views recorded before the visitor actually looked at the product will inflate view counts.

#### `Element {selector} not found for view_item trigger, firing immediately`

`analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemEvent`

**Meaning:** The event was meant to wait until an element scrolled into view, but no element matches that selector, so it fired immediately.

**Action:** Check the selector against the page — an element rendered later than the meta tag is read gives this. Until fixed, the "viewed" figure counts page loads, not views.

#### `Unknown trigger type: {triggerType}, firing immediately`

`analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemEvent`

**Meaning:** The trigger in the meta tag is not one the SDK recognises, so it fired immediately. A typo in the trigger name is the usual reason.

**Action:** Use a supported trigger — `immediate`, `time:{ms}`, or an element selector. The unrecognised value is printed in the message.

#### `Package {packageId} not found for view_item_list event`

`analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemListEvent`

**Meaning:** One package in a `view_item_list` meta tag is not in the campaign data and is left out of the list. The event still fires with the remaining packages, so the list is quietly shorter than intended.

**Action:** Check that id against the campaign’s packages. Item positions in the list shift when one is dropped, so list-position reporting is affected as well as the count.

#### `No valid packages found for view_item_list event`

`analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemListEvent`

**Meaning:** Every package in the meta tag was missing from the campaign data, so no list event fires at all.

**Action:** Check the whole id list against the campaign. This is usually a page reused from another campaign whose ids do not exist here.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Initializing MetaTagController...` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.initialize` | — |
| `Set list context from meta tags:` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.initialize` | yes |
| `MetaTagController initialized` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.initialize` | yes |
| `Parsed view_item from URL param: {paramName}={packageId}` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.parseViewItemConfig` | — |
| `Parsed view_item from meta tag: packageId={content}, trigger={trigger \|\| 'immediate'}` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.parseViewItemConfig` | — |
| `Parsed view_item_list from URL param: {paramName}={join(',')}` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.parseViewItemListConfig` | — |
| `Parsed view_item_list from meta tag: {join(',')}` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.parseViewItemListConfig` | — |
| `Fired dl_view_item from meta tag:` | `analytics/tracking/meta-tag-controller.ts › fireEvent` | yes |
| `Fired dl_view_item_list from meta tag:` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemListEvent` | yes |
| `Setting up scroll tracking for thresholds:` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.setupScrollTracking` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `MetaTagController already initialized` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.initialize` | — |
| `Parsed meta tag config:` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.initialize` | yes |
| `Event {eventName} blocked by enable-only whitelist` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.shouldBlockEvent` | — |
| `Event {eventName} blocked by disable list` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.shouldBlockEvent` | — |
| `Campaign data not yet loaded, deferring view_item event` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemEvent` | — |
| `view_item already fired from meta tag, skipping` | `analytics/tracking/meta-tag-controller.ts › fireEvent` | — |
| `Scheduling view_item to fire after {duration}ms` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemEvent` | — |
| `Setting up IntersectionObserver for view_item trigger: {selector}` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemEvent` | — |
| `Campaign data not yet loaded, deferring view_item_list event` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemListEvent` | — |
| `view_item_list already fired from meta tag, skipping` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.fireViewItemListEvent` | — |
| `Fired dl_scroll_depth at {threshold}%` | `analytics/tracking/meta-tag-controller.ts › scrollHandler` | — |
| `All scroll thresholds reached, removing listener` | `analytics/tracking/meta-tag-controller.ts › scrollHandler` | — |
| `MetaTagController reset` | `analytics/tracking/meta-tag-controller.ts › MetaTagController.reset` | — |

## `[PendingEventsHandler]`

Holds events that were raised as the page was navigating away, and replays them on the next page so a redirect does not lose a purchase.

Logged from `analytics/tracking/pending-events-handler.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to queue event:`

`analytics/tracking/pending-events-handler.ts › PendingEventsHandler.queueEvent` · extra context attached

**Meaning:** An event raised while the page was navigating away could not be stored, so it will not be replayed on the next page — it is lost. A purchase event on a redirect is the case that matters.

**Action:** Read the attached error; a blocked or full sessionStorage is the cause. Compare purchase events with orders for the period, because this loses events silently.

#### `Failed to get pending events:`

`analytics/tracking/pending-events-handler.ts › PendingEventsHandler.getPendingEvents` · extra context attached

**Meaning:** The queue of events held for after a redirect could not be read, so nothing is replayed on this page. Anything queued before is lost.

**Action:** Read the attached error. If the stored value is corrupt it keeps failing; clearing the SDK’s sessionStorage keys resets it.

#### `Failed to process pending event:`

`analytics/tracking/pending-events-handler.ts › PendingEventsHandler.processPendingEvents` · extra context attached

**Meaning:** Replaying one queued event threw. That event is dropped; the rest of the queue is still processed.

**Action:** Read the attached error and the event name beside it. A queued shape from an older SDK version can fail against newer validation.

#### `Failed to clear pending events:`

`analytics/tracking/pending-events-handler.ts › PendingEventsHandler.clearPendingEvents` · extra context attached

**Meaning:** The queue could not be emptied, so events already replayed may be replayed again — duplicate events in the destination.

**Action:** Read the attached error. If purchase events are duplicated in reports, this line is the reason to look at first.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Skipping queued dl_user_data - current page should fire its own`

`analytics/tracking/pending-events-handler.ts › PendingEventsHandler.processPendingEvents`

**Meaning:** A queued `dl_user_data` was dropped on purpose: every page fires its own, and replaying an old one would report stale details. Expected behaviour, not a problem.

**Action:** Nothing. Confirm the page’s own `dl_user_data` appears — `UserDataTracker initialized - dl_user_data fired first` is that confirmation.

#### `Skipping stale event:`

`analytics/tracking/pending-events-handler.ts › PendingEventsHandler.processPendingEvents` · extra context attached

**Meaning:** A queued event was more than five minutes old and was discarded rather than replayed. It normally means the visitor left the tab and came back much later.

**Action:** Nothing in isolation. In bulk it means events are being queued and never replayed promptly — check whether the redirect they were queued for is happening at all.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Event queued for after redirect: {event} ({length} total queued)` | `analytics/tracking/pending-events-handler.ts › PendingEventsHandler.queueEvent` | — |
| `Processing {length} pending analytics events` | `analytics/tracking/pending-events-handler.ts › PendingEventsHandler.processPendingEvents` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `No pending analytics events to process` | `analytics/tracking/pending-events-handler.ts › PendingEventsHandler.processPendingEvents` | — |
| `Processed pending event:` | `analytics/tracking/pending-events-handler.ts › PendingEventsHandler.processPendingEvents` | yes |
| `Removed processed events:` | `analytics/tracking/pending-events-handler.ts › PendingEventsHandler.processPendingEvents` | yes |
| `Cleared all pending events` | `analytics/tracking/pending-events-handler.ts › PendingEventsHandler.clearPendingEvents` | — |
| `PendingEventsHandler reset` | `analytics/tracking/pending-events-handler.ts › PendingEventsHandler.reset` | — |
| `PendingEventsHandler initialized` | `analytics/tracking/pending-events-handler.ts › PendingEventsHandler.initialize` | — |

## `[PurchaseTracking]`

Decides whether an order may be reported as a purchase yet — an order still awaiting payment at a gateway may not — and remembers the orders already reported so one order produces one `dl_purchase`.

Logged from `analytics/tracking/purchase-tracking.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Failed to record the checkout return paths:`

`analytics/tracking/purchase-tracking.ts › rememberCheckoutReturnPaths` · extra context attached

**Meaning:** The checkout page could not store where the orders API will send the shopper back to. A redirect payment that then fails, and lands on a merchant-configured failure page, cannot be recognised as a failure by its path — so if the API no longer reports that order as awaiting payment, the visit could be counted as a purchase.

**Action:** Read the attached error — blocked or full sessionStorage. The `?payment_failed=true` check is unaffected, so stores on the default failure URL are still covered.

#### `Failed to read the checkout return paths:`

`analytics/tracking/purchase-tracking.ts › readReturnPaths` · extra context attached

**Meaning:** The landing page could not read which of the two return legs it is, so it falls back to the `?payment_failed=true` parameter alone. Same consequence as failing to write them.

**Action:** Read the attached error. A corrupt stored value keeps failing until it is overwritten by the next order; clearing the SDK’s sessionStorage keys resets it.

#### `Failed to record the checkout coupon:`

`analytics/tracking/purchase-tracking.ts › rememberCheckoutCoupon` · extra context attached

**Meaning:** The checkout page could not store the voucher code applied to this order. The order does not carry the code back and the cart holding it is reset before the page navigates away, so the purchase this order eventually produces will go out without `ecommerce.coupon`.

**Action:** Read the attached error — blocked or full sessionStorage. Only discount attribution is affected; the purchase itself is still reported, with its value and items intact.

#### `Failed to read the checkout coupon:`

`analytics/tracking/purchase-tracking.ts › recallCheckoutCoupon` · extra context attached

**Meaning:** The page building `dl_purchase` could not read the voucher code the checkout page recorded, so the event goes out without `ecommerce.coupon`. Same consequence as failing to write it.

**Action:** Read the attached error. A blocked sessionStorage is the usual cause; the purchase is still reported in full apart from the code.

#### `Failed to read reported purchases:`

`analytics/tracking/purchase-tracking.ts › readReported` · extra context attached

**Meaning:** The list of orders already reported as a purchase could not be read, so this page cannot tell whether an order has been reported before. It behaves as if none had been, which risks a second `dl_purchase` for an order that already produced one.

**Action:** Read the attached error — a blocked or corrupt localStorage is the cause. If purchases look over-counted for one visitor, this line is why.

#### `Failed to record reported purchase:`

`analytics/tracking/purchase-tracking.ts › markPurchaseReported` · extra context attached

**Meaning:** A purchase was reported but could not be written to the already-reported list, so a later page in the same journey may report the same order again.

**Action:** Read the attached error. Blocked or full localStorage is the usual cause; the event itself was sent, only the record of it was lost.

#### `Failed to clear reported purchases:`

`analytics/tracking/purchase-tracking.ts › resetReportedPurchases` · extra context attached

**Meaning:** The already-reported list could not be emptied. Only tests clear it, so on a real page this line should never appear.

**Action:** Read the attached error. In production, treat it as a sign that something outside the SDK is calling into its test helpers.

## `[UserDataTracker]`

Fires `dl_user_data` first on every page and again when the visitor is identified or the route changes.

Logged from `analytics/tracking/user-data-tracker.ts`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `UserDataTracker initialized - dl_user_data fired first` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.initialize` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `User data tracking listeners set up after initial tracking` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.initialize` | — |
| `trackUserData called after initial:` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.trackUserData` | yes |
| `User data tracking debounced` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.trackUserData` | — |
| `No user data to track` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.trackUserData` | — |
| `Tracked user data:` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.trackUserData` | yes |
| `Cart store not available or error accessing:` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.collectUserData` | yes |
| `Error getting checkout data:` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.collectUserData` | yes |
| `Route changed, tracking user data` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.setupListeners` | — |
| `SDK route invalidated, tracking user data` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.setupListeners` | — |
| `User logged in, tracking user data` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.setupListeners` | — |
| `User logged out, tracking user data` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.setupListeners` | — |
| `Browser navigation, tracking user data` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.setupListeners` | — |
| `pushState changed path, tracking user data` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.setupListeners` | — |
| `replaceState called, not tracking user data (query param update)` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.setupListeners` | — |
| `User data tracking listeners set up` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.setupListeners` | — |
| `UserDataTracker reset` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.reset` | — |
| `UserDataTracker destroyed` | `analytics/tracking/user-data-tracker.ts › UserDataTracker.destroy` | — |

## `[ViewItemListTracker]`

Detects the products present on a page and fires `view_item` / `view_item_list` for them without any meta tags.

Logged from `analytics/tracking/view-item-list-tracker.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Package not found in store:`

`analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.trackViewItemForSelected` · extra context attached

**Meaning:** A product element on the page names a package that is not in the campaign data, so it is left out of automatic `view_item` / `view_item_list` tracking.

**Action:** The id is attached. Check the `data-next-package-id` on that element against the campaign’s packages; a leftover card from another campaign is the usual cause.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `ViewItemListTracker initialized` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.initialize` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Scan debounced (too soon after last scan)` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.scan` | — |
| `Both view_item and view_item_list handled by meta tags, skipping auto-detection` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.scan` | — |
| `No products found on page` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.scan` | — |
| `Found {length} products on page` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.scan` | — |
| `view_item handled by meta tag, skipping auto-detection` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.scan` | — |
| `view_item_list handled by meta tag, skipping auto-detection` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.scan` | — |
| `Manual rescan triggered` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.rescan` | — |
| `Found {length} products in selectors` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.findProductElements` | — |
| `Campaign data not yet loaded, deferring tracking` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.trackViewItemForSelected` | — |
| `Tracked view_item for selected package:` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.trackViewItemForSelected` | yes |
| `Product already tracked:` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.trackViewItem` | yes |
| `Tracked view_item:` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.trackViewItem` | yes |
| `No new products to track` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.trackViewItemList` | — |
| `Tracked view_item_list with {length} items` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.trackViewItemList` | — |
| `Detected DOM changes with products` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.setupObserver` | — |
| `Mutation observer set up` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.setupObserver` | — |
| `ViewItemListTracker reset` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.reset` | — |
| `ViewItemListTracker destroyed` | `analytics/tracking/view-item-list-tracker.ts › ViewItemListTracker.destroy` | — |

## `[ListAttributionTracker]`

Remembers which list a product was clicked from so the next page’s events can say where the visitor came from within the site.

Logged from `analytics/tracking/list-attribution-tracker.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error loading list context from storage:`

`analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.loadFromStorage` · extra context attached

**Meaning:** The record of which list a product was clicked from could not be read, so events on this page cannot say where within the site the visitor came from. Nothing else is affected.

**Action:** Read the attached error. A corrupt stored value keeps failing on every page until it is cleared; storage being blocked cannot be fixed from the page, and list attribution is then unavailable for the whole session.

#### `Error saving list context to storage:`

`analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.saveToStorage` · extra context attached

**Meaning:** The list a product was clicked from could not be stored, so the next page will not know it and its events lose the list name and position.

**Action:** Read the attached error — storage full or blocked is the usual cause. Expect gaps in "which list drove the sale" reporting while it lasts.

#### `Error removing list context from storage:`

`analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.removeFromStorage` · extra context attached

**Meaning:** An expired list record could not be deleted, so a stale list name may be attached to events it does not belong to — wrong attribution rather than missing attribution.

**Action:** Read the attached error, then clear the SDK’s sessionStorage keys if you are checking list attribution, so you are not reading a leftover value.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `ListAttributionTracker initialized` | `analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.initialize` | — |
| `Set current list:` | `analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.setCurrentList` | yes |
| `List context expired` | `analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.getCurrentList` | — |
| `Cleared current list` | `analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.clearCurrentList` | — |
| `ListAttributionTracker reset` | `analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.reset` | — |
| `Detected list from URL:` | `analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.detectListFromUrl` | yes |
| `Loaded list context from storage:` | `analytics/tracking/list-attribution-tracker.ts › ListAttributionTracker.loadFromStorage` | yes |

## `[{ProviderName}]`

The delivery contract every provider shares: the enabled and blocked-event gate, and reporting each event as sent, skipped, or failed.

Logged from `analytics/providers/provider-adapter.ts`. The shared adapter base logs under the provider’s own name, so these lines appear as `[GTM]`, `[Facebook]`, `[RudderStack]`, `[NextCampaign]`, or `[Custom]` depending on which provider was delivering the event.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to send event "{event}"`

`analytics/providers/provider-adapter.ts › reject` · extra context attached

**Meaning:** A provider threw something the delivery layer did not expect, so this event is lost for that provider. Unlike `Event "{event}" not delivered:`, this is not a known delivery outcome — it points at a fault in the adapter or the vendor script.

**Action:** Read the attached error. The provider is identified by the log prefix; that adapter’s own errors are in [errors.md](./errors.md).

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Event "{event}" not delivered: {message}`

`analytics/providers/provider-adapter.ts › reject`

**Meaning:** One provider could not deliver one event, for a reason it expected — its script never loaded, or the vendor call threw. The reason is in the message. Other providers are unaffected, and the visitor sees nothing. The provider name is the log prefix.

**Action:** Read the reason after the colon: a "load timeout" means the vendor snippet is missing from the page, and the individual adapters warn once with the exact fix. The payload that would have been sent is in the debug overlay’s Provider Delivery panel (`?debug=true`).

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Event "{event}" is blocked for {name}` | `analytics/providers/provider-adapter.ts › ProviderAdapter.trackEvent` | — |

## `[Facebook]`

Delivers events to the Meta Pixel (`fbq`).

Logged from `analytics/providers/facebook-adapter.ts`. Set by the name the adapter passes to the shared base — `super('Facebook')`.

Rows marked *message assembled in code* are built from several string literals joined together, so searching the source for the whole sentence finds nothing — search for the first few words instead. The location given is where the message text begins, which is a line or two after the `logger.*` call itself.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Meta Pixel (fbq) not found — add the Meta Pixel base code to the page so events can be delivered. See https://www.facebook.com/business/help/952192354843755`

`analytics/providers/facebook-adapter.ts › FacebookAdapter.warnScriptMissing` · message assembled in code

**Meaning:** The Facebook provider is running but `fbq` is not on the page, so nothing can be delivered to Meta. Printed once per page load, not once per event.

**Action:** Add the Meta Pixel base code above the SDK loader. If it is already there, an ad blocker removed it — verify in a clean browser profile before changing the page.

## `[NextCampaign]`

Loads the NextCampaign script with the campaign API key and sends it the page view.

Logged from `analytics/providers/next-campaign-adapter.ts`. Set by the name the adapter passes to the shared base — `super('NextCampaign')`.

Rows marked *message assembled in code* are built from several string literals joined together, so searching the source for the whole sentence finds nothing — search for the first few words instead. The location given is where the message text begins, which is a line or two after the `logger.*` call itself.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to load NextCampaign SDK:`

`analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.loadScript` · extra context attached

**Meaning:** The NextCampaign script did not load, so no events reach it. The error is re-thrown, which surfaces as a failed provider initialization in the analytics log above.

**Action:** Read the attached error and check that `campaigns.apps.29next.com` is reachable and not blocked by an extension.

#### `Error sending initial page view to NextCampaign:`

`analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.sendPageView` · extra context attached

**Meaning:** The script loaded but the first `page_view` threw, so that page view is missing from NextCampaign reporting. Later events are still attempted.

**Action:** Read the attached error — it comes from the NextCampaign script rather than from this SDK.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `No API key available for NextCampaign initialization`

`analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.initialize`

**Meaning:** The NextCampaign provider is enabled but has no API key, so it stops before loading its script. Nothing is sent to it; the rest of analytics is unaffected.

**Action:** Set the campaign API key with `<meta name="next-api-key" content="…">` or `window.nextConfig.apiKey` before the loader. The adapter logs `API key from config store: found` once it can see one.

#### `NextCampaign SDK failed to load — check that a valid apiKey is set and that campaigns.apps.29next.com is reachable.`

`analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.warnScriptMissing` · message assembled in code

**Meaning:** The NextCampaign script never became available, so its events cannot be delivered. Printed once per page load.

**Action:** Confirm the campaign API key is set and that `campaigns.apps.29next.com` is reachable from the visitor’s network.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `NextCampaign adapter initializing...` | `analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.initialize` | — |
| `API key provided via config parameter` | `analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.initialize` | — |
| `API key from config store: {apiKey ? 'found' : 'not found'}` | `analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.initialize` | — |
| `NextCampaign API key found: {substring(0, 8)}...{length - 4)}` | `analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.initialize` | — |
| `NextCampaign SDK loaded and initialized successfully ✅` | `analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.loadScript` | — |
| `Initial page_view event sent to NextCampaign` | `analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.sendPageView` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `NextCampaign script loaded` | `analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.performLoad` | — |
| `NextCampaign configured with API key` | `analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.performLoad` | — |

## `[RudderStack]`

Translates events into RudderStack’s track / page / identify calls.

Logged from `analytics/providers/rudderstack-adapter.ts`.

Rows marked *message assembled in code* are built from several string literals joined together, so searching the source for the whole sentence finds nothing — search for the first few words instead. The location given is where the message text begins, which is a line or two after the `logger.*` call itself.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `rudderanalytics not found — add the RudderStack JavaScript SDK snippet to the page so events can be delivered. See https://www.rudderstack.com/docs/sources/event-streams/sdks/rudderstack-javascript-sdk/`

`analytics/providers/rudderstack-adapter.ts › RudderStackAdapter.warnScriptMissing` · message assembled in code

**Meaning:** The RudderStack provider is running but its SDK is not on the page, so nothing is delivered. Printed once per page load.

**Action:** Add the RudderStack JavaScript SDK snippet above the SDK loader, then reload and check for `Processing event "…"` lines.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Processing event "{event}"` | `analytics/providers/rudderstack-adapter.ts › RudderStackAdapter.sendEvent` | yes |

## `[Custom]`

Posts batches of events to an endpoint you configure, with a retry queue for the ones that fail.

Logged from `analytics/providers/custom-adapter.ts`. Set by the name the adapter passes to the shared base — `super('Custom')`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error sending batch to custom endpoint:`

`analytics/providers/custom-adapter.ts › CustomAdapter.sendBatch` · extra context attached

**Meaning:** A batch of events was rejected or the request failed. Every event in the batch goes onto the retry queue, so this alone does not mean they are lost.

**Action:** Read the attached error and check the endpoint. `HTTP {status}: {statusText}` in the attachment is the endpoint’s own answer.

#### `Failed to send event after {maxRetries} attempts:`

`analytics/providers/custom-adapter.ts › CustomAdapter.addToRetryQueue` · extra context attached

**Meaning:** The retries for one event are exhausted and it is dropped. This is the point at which data is actually lost, unlike the batch error above.

**Action:** Read the attached event and fix the endpoint before comparing its numbers with anything else. The count in the message is the configured `maxRetries`.

## `[DebugModule]`

Loads the debug overlay on demand when debug mode is on, so none of it is in the bundle a normal visitor downloads.

Logged from `debug/debug-module.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to load debug overlay module:`

`debug/debug-module.ts › DebugModule.loadDebugOverlay` · extra context attached

**Meaning:** The debug overlay code could not be fetched, so no overlay appears even though debug mode is on. The SDK itself keeps working.

**Action:** Read the attached error. The overlay is loaded on demand, so this is a network or deployment problem — check that the version the loader asked for is published.

#### `Failed to initialize debug mode:`

`debug/debug-module.ts › DebugModule.initializeIfEnabled` · extra context attached

**Meaning:** Debug mode did not start: no overlay, and none of the `window` debug helpers. Log level is still raised, so debug lines continue to print.

**Action:** Read the attached error. Investigate with the console alone until it is fixed — the log output is unaffected.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Loading debug overlay module...` | `debug/debug-module.ts › DebugModule.loadDebugOverlay` | — |
| `Debug overlay module loaded successfully ✅` | `debug/debug-module.ts › DebugModule.loadDebugOverlay` | — |

## `[DebugOverlay]`

The on-page debug panel itself — state inspectors, the event pipeline, and the country / currency / locale switchers.

Logged from `debug/debug-overlay/debug-overlay.ts`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Debug overlay initialized` | `debug/debug-overlay/debug-overlay.ts › DebugOverlay.initialize` | — |
| `Selector container initialized` | `debug/debug-overlay/debug-overlay.ts › DebugOverlay.initialize` | — |
| `Upsell selector initialized` | `debug/debug-overlay/debug-overlay.ts › DebugOverlay.initialize` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `[Debug] Action clicked:` | `debug/debug-overlay/debug-overlay.ts › DebugOverlay.handleDebugAction` | yes |
| `[Debug] Panel switch:` | `debug/debug-overlay/debug-overlay.ts › DebugOverlay.handleTabSwitch` | yes |
| `[Debug] Horizontal tab switch:` | `debug/debug-overlay/debug-overlay.ts › DebugOverlay.handleTabSwitch` | yes |

## `[CountrySelector]`

The debug overlay’s country switcher, for checking an address form and shipping options as a visitor in another country.

Logged from `debug/country-selector.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to load countries:`

`debug/country-selector.ts › CountrySelector.loadCountries` · extra context attached

**Meaning:** The debug overlay’s country switcher has no countries to offer and hides itself. Only the debug tool is affected — the page’s own address form is separate.

**Action:** Read the attached error; it is the same country-list fetch that `CountryService` logs about. Fix that and the switcher returns.

#### `Failed to change country:`

`debug/country-selector.ts › CountrySelector.handleCountryChange` · extra context attached

**Meaning:** Switching country from the debug overlay failed and the overlay shows its error state. The page may be left part-way: currency updated, country not, or the reverse.

**Action:** Read the attached error and reload before continuing to test, so you are not looking at a half-applied state. Debug-only.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Country change already in progress`

`debug/country-selector.ts › CountrySelector.setupEventListeners`

**Meaning:** A second country was picked in the debug overlay while the first change was still applying; the second was ignored. Expected when clicking quickly.

**Action:** Wait for the first change to finish, then pick again. Debug-only.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Country selector initialized` | `debug/country-selector.ts › CountrySelector.initialize` | — |
| `Changing country to {newCountry}` | `debug/country-selector.ts › CountrySelector.handleCountryChange` | — |
| `Cleared selected country override, using detected country` | `debug/country-selector.ts › CountrySelector.handleCountryChange` | — |
| `Saved selected country to session: {newCountry}` | `debug/country-selector.ts › CountrySelector.handleCountryChange` | — |
| `Country currency is {currencyCode}, updating...` | `debug/country-selector.ts › CountrySelector.handleCountryChange` | — |
| `Country changed successfully to {newCountry}` | `debug/country-selector.ts › CountrySelector.handleCountryChange` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Loaded {length} countries` | `debug/country-selector.ts › CountrySelector.loadCountries` | — |
| `No countries available, hiding country selector` | `debug/country-selector.ts › CountrySelector.doRender` | — |
| `Country select changed to: {newCountry}` | `debug/country-selector.ts › CountrySelector.setupEventListeners` | — |
| `Resetting to detected country:` | `debug/country-selector.ts › CountrySelector.setupEventListeners` | yes |
| `External country change detected, re-rendering selector` | `debug/country-selector.ts › CountrySelector.setupEventListeners` | — |
| `Event listeners attached to country selector` | `debug/country-selector.ts › CountrySelector.setupEventListeners` | — |

## `[CurrencySelector]`

The debug overlay’s currency switcher, for checking prices in every currency the campaign offers.

Logged from `debug/currency-selector.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to change currency:`

`debug/currency-selector.ts › CurrencySelector.handleCurrencyChange` · extra context attached

**Meaning:** Switching currency from the debug overlay failed. Prices on the page may still be in the previous currency while the selector shows the new one.

**Action:** Read the attached error and reload, then check whether the campaign actually offers that currency — `currency:fallback` is emitted when it does not. Debug-only.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Currency change already in progress`

`debug/currency-selector.ts › CurrencySelector.setupEventListeners`

**Meaning:** A second currency was picked while the first change was still applying, and was ignored.

**Action:** Wait for the first change to finish. Debug-only.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Currency selector initialized` | `debug/currency-selector.ts › CurrencySelector.initialize` | — |
| `Changing currency to {newCurrency}` | `debug/currency-selector.ts › CurrencySelector.handleCurrencyChange` | — |
| `Saved currency preference to session: {newCurrency}` | `debug/currency-selector.ts › CurrencySelector.handleCurrencyChange` | — |
| `Currency changed successfully to {newCurrency}` | `debug/currency-selector.ts › CurrencySelector.handleCurrencyChange` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Campaign currency changed or data loaded, re-rendering currency selector` | `debug/currency-selector.ts › CurrencySelector.setupStoreSubscriptions` | — |
| `No campaign data available yet, skipping currency selector render` | `debug/currency-selector.ts › CurrencySelector.doRender` | — |
| `Only one currency available, hiding currency selector` | `debug/currency-selector.ts › CurrencySelector.doRender` | — |
| `Currency select changed to: {newCurrency}` | `debug/currency-selector.ts › CurrencySelector.setupEventListeners` | — |
| `External currency change detected, re-rendering selector` | `debug/currency-selector.ts › CurrencySelector.setupEventListeners` | — |
| `Event listeners attached to currency selector` | `debug/currency-selector.ts › CurrencySelector.setupEventListeners` | — |

## `[LocaleSelector]`

The debug overlay’s locale switcher, for checking how prices and dates are formatted.

Logged from `debug/locale-selector.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to change locale:`

`debug/locale-selector.ts › LocaleSelector.handleLocaleChange` · extra context attached

**Meaning:** Switching locale from the debug overlay failed, so number and date formatting stays as it was.

**Action:** Read the attached error. An unsupported locale string is the usual cause. Debug-only.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Locale change already in progress`

`debug/locale-selector.ts › LocaleSelector.setupEventListeners`

**Meaning:** A second locale was picked while the first change was still applying, and was ignored.

**Action:** Wait for the first change to finish. Debug-only.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Locale selector initialized` | `debug/locale-selector.ts › LocaleSelector.initialize` | — |
| `Changing locale to {newLocale}` | `debug/locale-selector.ts › LocaleSelector.handleLocaleChange` | — |
| `Cleared selected locale override, using browser locale` | `debug/locale-selector.ts › LocaleSelector.handleLocaleChange` | — |
| `Saved selected locale to session: {newLocale}` | `debug/locale-selector.ts › LocaleSelector.handleLocaleChange` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Locale select changed to: {newLocale}` | `debug/locale-selector.ts › LocaleSelector.setupEventListeners` | — |
| `Resetting to browser locale:` | `debug/locale-selector.ts › LocaleSelector.setupEventListeners` | yes |
| `External locale change detected, re-rendering selector` | `debug/locale-selector.ts › LocaleSelector.setupEventListeners` | — |
| `Event listeners attached to locale selector` | `debug/locale-selector.ts › LocaleSelector.setupEventListeners` | — |

## `[UpsellSelector]`

The debug overlay’s post-purchase upsell inspector: what the page offers and what is currently selected.

Logged from `debug/upsell-selector.ts`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `UpsellSelector initialized` | `debug/upsell-selector.ts › UpsellSelector.initialize` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Not an upsell page, skipping initialization` | `debug/upsell-selector.ts › UpsellSelector.initialize` | — |
| `Scanning for existing upsell elements:` | `debug/upsell-selector.ts › UpsellSelector.scanExistingUpsells` | yes |
| `No upsell elements found` | `debug/upsell-selector.ts › UpsellSelector.scanExistingUpsells` | — |
| `Initialized state from bundle selector:` | `debug/upsell-selector.ts › UpsellSelector.scanExistingUpsells` | yes |
| `Found selected option:` | `debug/upsell-selector.ts › UpsellSelector.scanExistingUpsells` | yes |
| `Found first available option:` | `debug/upsell-selector.ts › UpsellSelector.scanExistingUpsells` | yes |
| `Found nested selector:` | `debug/upsell-selector.ts › UpsellSelector.scanExistingUpsells` | yes |
| `Initialized state from existing upsell element:` | `debug/upsell-selector.ts › UpsellSelector.scanExistingUpsells` | yes |
| `Upsell initialized:` | `debug/upsell-selector.ts › UpsellSelector.setupEventListeners` | yes |
| `Bundle selection changed:` | `debug/upsell-selector.ts › UpsellSelector.setupEventListeners` | yes |
| `Upsell option selected:` | `debug/upsell-selector.ts › UpsellSelector.setupEventListeners` | yes |
| `Upsell quantity changed:` | `debug/upsell-selector.ts › UpsellSelector.setupEventListeners` | yes |

## Lines that bypass the logger

13 messages in `src/core` are printed with a bare `console.error` or `console.warn` instead of through `Logger`. They behave differently from everything above, and the difference matters when you are reading a console:

- **No `[Prefix]`**, unless the message writes one out by hand — which the attribution collector does and the event bus does not. An unprefixed error line from the SDK is one of these.
- **Not gated by debug mode or the log level.** On the module bundle they print for every visitor. On the UMD bundle they are stripped like everything else.
- **`Logger.setLogLevel()` cannot silence them.**

They come from `attribution/attribution-collector.ts`, `events.ts`, `storage.ts`, `sdk-initializer/sdk-initializer.debug-utils.ts`, `url-utils.ts`. The debug tooling under `core/debug/` also writes to the console directly; that output is the tool talking to whoever opened it, so it is not listed here.

### `[AttributionCollector] Error storing {key} in sessionStorage:`

`attribution/attribution-collector.ts › AttributionCollector.getStoredValue` · `console.error` · extra context attached

**Meaning:** An attribution value arrived in the URL but could not be saved for the rest of the session, so the next page will not have it and the order may be attributed to nothing. The value named is the URL parameter.

**Action:** Read the attached error — sessionStorage blocked or full is the cause. On paid traffic, check whether orders from this session carry their UTM tags before spending more on the campaign.

### `[AttributionCollector] Error reading {key} from sessionStorage:`

`attribution/attribution-collector.ts › AttributionCollector.getStoredValue` · `console.error` · extra context attached

**Meaning:** A stored attribution value could not be read back. The collector falls through to localStorage and then to the persisted attribution copy, so the value may still be found — this line alone does not mean it was lost.

**Action:** Read the attached error. Confirm the final result with `next.getAttribution()` rather than assuming from this line.

### `[AttributionCollector] Error reading {key} from localStorage:`

`attribution/attribution-collector.ts › AttributionCollector.getStoredValue` · `console.error` · extra context attached

**Meaning:** The localStorage fallback for one attribution value failed. One more fallback remains (the persisted attribution record), after which the value is empty.

**Action:** Read the attached error. Check `next.getAttribution()` for the field named to see whether anything was recovered.

### `[AttributionCollector] Error reading persisted attribution:`

`attribution/attribution-collector.ts › AttributionCollector.getStoredValue` · `console.error` · extra context attached

**Meaning:** The stored `next-attribution` record could not be read or parsed, so the last fallback for every attribution value is unavailable. Values not in the current URL are lost.

**Action:** Read the attached error. If the record is corrupt it keeps failing on every page; clearing `next-attribution` from storage resets it, at the cost of the visitor’s earlier attribution.

### `[AttributionCollector] Error persisting funnel from URL:`

`attribution/attribution-collector.ts › AttributionCollector.getFunnelName` · `console.error` · extra context attached

**Meaning:** A funnel name taken from the URL could not be saved, so later pages in the funnel will fall back to their own meta tag or to no funnel at all. Funnel reporting splits one journey into several.

**Action:** Read the attached error. Until it is fixed, set the funnel name with a meta tag on every page rather than relying on it carrying over from the URL.

### `[AttributionCollector] Error reading persisted funnel:`

`attribution/attribution-collector.ts › AttributionCollector.getFunnelName` · `console.error` · extra context attached

**Meaning:** The saved funnel name could not be read, so this page uses whatever its own configuration says — which on an upsell or receipt page is often nothing.

**Action:** Read the attached error, then check the funnel on the resulting order. `next.debugAttribution()` prints what the SDK resolved.

### `[AttributionCollector] Error persisting funnel name:`

`attribution/attribution-collector.ts › AttributionCollector.getFunnelName` · `console.error` · extra context attached

**Meaning:** A funnel name read from a meta tag could not be saved for later pages. Same effect as the URL version: the funnel does not follow the visitor.

**Action:** Read the attached error. Put the funnel meta tag on every page of the funnel so each one can resolve it without storage.

### `[AttributionCollector] Error persisting tag {tagName}:`

`attribution/attribution-collector.ts › AttributionCollector.collectTrackingTags` · `console.error` · extra context attached

**Meaning:** One tracking tag from a `<meta>` tag could not be saved, so it will be missing from later pages and from the order. The tag named is the one lost.

**Action:** Read the attached error. Repeat the tag’s meta tag on the pages that need it rather than depending on it persisting.

### `[AttributionCollector] Error reading first visit timestamp:`

`attribution/attribution-collector.ts › AttributionCollector.getFirstVisitTimestamp` · `console.error` · extra context attached

**Meaning:** The first-visit timestamp could not be read, so this visit is treated as a first visit. Anything that distinguishes new from returning visitors will say "new".

**Action:** Read the attached error. Do not build returning-visitor logic on this field while it is failing — write your own marker instead.

### `Event handler error for {event}:`

`events.ts › EventBus.emit` · `console.error` · extra context attached

**Meaning:** A subscriber to an SDK event threw. The event bus catches it and continues with the other subscribers, so one broken handler cannot stop the rest. The line has **no** `[Prefix]`, because it is written with a bare `console.error` — that absence is how you recognise it.

**Action:** Read the attached error and the event name. Your own `next.on(...)` handlers arrive here too, so check the stack before assuming the SDK is at fault. Wrap risky handler bodies in their own try/catch so a failure is reported where you can see it.

### `Failed to estimate storage quota:`

`storage.ts › getStorageQuota` · `console.warn` · extra context attached

**Meaning:** The browser would not report how much storage is available. Nothing depends on the answer — it is used for diagnostics — so this affects no behaviour.

**Action:** Nothing. Some browsers do not implement the estimate at all, and the SDK works either way.

### `❌ Failed to set shipping method {methodId}:`

`sdk-initializer/sdk-initializer.debug-utils.ts › testShippingMethod` · `console.error` · extra context attached

**Meaning:** The `testShippingMethod()` debug helper could not apply a shipping method. It only appears when someone calls that helper from the console, never on its own.

**Action:** Read the attached error and check the method id against the campaign’s `shipping_methods`. Debug-only; a visitor never triggers it.

### `[URL Utils] Error preserving query parameters:`

`url-utils.ts › preserveQueryParams` · `console.error` · extra context attached

**Meaning:** A target URL could not be parsed, so the visitor is sent there with none of the tracking parameters carried over. Navigation still happens — the original URL is used unchanged — but the next page starts with no UTM tags, so an order placed after it can be attributed to nothing.

**Action:** Read the attached error and check the URL that was passed — a relative path with a stray space or an unencoded template placeholder left in the markup is the usual cause. On paid traffic, confirm the destination page still receives its parameters before spending more on the campaign.
