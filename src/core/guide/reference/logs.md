---
title: "Core/Reference/Logs"
group: "Core"
category: "Core Reference"
---

# Logs

<!-- Generated from the logger calls in src/core plus the notes in
     src/core/docs/core-logs.ts. Do not edit by hand: change the log line in the
     code or the note in core-logs.ts, then run `npm run docs:reference`. -->

Every message the SDK's own machinery can print — 482 of them, across 36 console prefixes plus 12 lines that bypass the logger entirely. Search a line from your console here to find what produced it, what it means, and what to do about it.

Messages are listed at the wording the code uses. A `{name}` inside one is a value filled in at runtime, so search for the text on either side of it. **Extra context** means the call passes a second argument — an object or an error logged beside the message; expand that entry in the console, because the message alone will not tell you which element, package, or event was involved.

This page covers `src/core`: boot, DOM scanning, the shared base class, location and currency, attribution, analytics, and the debug tools. Each feature documents its own messages in its own `guide/reference/logs.md`.

## What prints in production

Which of these lines a live page prints depends on the bundle it loaded and on whether debug mode is on. The two bundles behave differently enough that "the console is empty" means different things.

**The module bundle** — `dist/index.js` and the chunks beside it, which is what the loader fetches for every browser that supports modules, so it is what almost every visitor runs. Its `console` calls are all still in the shipped code. `error` always prints. `warn`, `info`, and `debug` print only with debug mode on, because `Logger` returns early otherwise.

**The UMD bundle** — `dist/index.umd.js`, loaded only by a browser with no module support, or as the fallback when the module import fails. It is minified with `drop_console`, which removes **every** `console` call, `console.error` included. A page on this bundle prints nothing at any level, and debug mode cannot bring the lines back — they are not in the file to be re-enabled.

Turn debug mode on with `?debug=true` or `?debugger=true` in the URL, or by setting `debug: true` (or `debugger: true`) on `window.nextConfig` before the loader runs. **They are not equivalent, and `?debug=true` is the weakest of them.** `Logger` reads only the URL and `window.nextConfig` (`core/logger.ts:16-26`), and the level is raised to `DEBUG` only by `config.debug` (`sdk-initializer.ts:779`):

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
| `[SDKInitializer]` | Starts the SDK: reads configuration, detects country and currency, loads the campaign, applies URL parameters such as `forcePackageId`, then hands over to the DOM scan. Most "the page did nothing" investigations start here. | 7 | 12 | 31 | 23 |
| `[AttributeScanner]` | Finds every `data-next-*` element on the page and starts the feature bound to it. If a feature never runs, this is where its element was either skipped or failed to initialize. | 5 | 3 | 3 | 28 |
| `[NextCommerce]` | The `window.next` API a page calls directly — callbacks, attribution, URL parameters, exit intent, FOMO, post-purchase upsells. | 11 | 1 | 1 | 15 |
| `[ErrorHandler]` | Catches uncaught page errors and rejected promises, wraps them with SDK version and URL, and re-publishes them as the `error:occurred` event. | 1 | — | — | 1 |
| `[StorageManager]` | The thin wrapper the SDK uses for its own sessionStorage and localStorage reads and writes. Its errors are storage being unavailable, not data being wrong. | 4 | — | — | 5 |

### Shared base

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[{EnhancerClassName}]` | The behaviour every feature inherits: reading attributes, subscribing to stores, and the shared error path that turns a thrown error into a log line plus an `error:occurred` event. | 1 | — | — | — |
| `[DOMObserver]` | Watches the page for elements added or attributes changed after boot, so markup injected by a page builder or an A/B tool still gets enhanced. | 2 | 1 | — | 10 |
| `[AttributeParser]` | Turns attribute text into something the features can act on — including the comparison expressions behind `data-next-show` and `data-next-hide`. | 1 | — | — | 2 |

### Location and currency

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[CountryService]` | Detects the visitor’s country, fetches the country and state lists for the address form, filters them to the campaign’s shipping countries, and caches the results. | 3 | 6 | 7 | 6 |

### Attribution

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[AttributionCollector]` | Collects where the visitor came from — funnel name, UTM tags, Everflow click id, tracking-tag meta tags — and keeps it for the order. | — | 1 | 3 | 13 |
| `[UtmTransfer]` | Copies the current page’s URL parameters onto the links leaving it, so attribution survives a click through to the next page. | 2 | — | — | 10 |

### Analytics core

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[NextAnalytics]` | The analytics entry point: reads configuration, builds the enabled providers, and accepts every event the rest of the SDK tracks. | 5 | 5 | 9 | 3 |
| `[NextDataLayer]` | Pushes finished events onto `window.dataLayer` and fans them out to the providers, adding attribution and validating required fields on the way. | 8 | — | — | — |
| `[AnalyticsConfig]` | Holds the per-provider settings — which fields each provider needs before it can be switched on. | 2 | — | — | — |
| `[UserDataStorage]` | Remembers who the visitor is across pages — email, name, ids — in a cookie plus sessionStorage, so events after a redirect still identify them. | 2 | 2 | 2 | 4 |
| `[EventBuilder]` | Builds each event’s payload: campaign context, currency, and the item fields taken from the package in the campaign data. | — | 10 | — | — |
| `[EcommerceEvents]` | Builds the purchase-funnel events — view item, add to cart, begin checkout, purchase, upsell. | — | 1 | — | — |
| `[UserEvents]` | Builds the `dl_user_data` event that identifies the visitor and carries the current cart contents. | — | 1 | — | — |
| `[EventValidator]` | Checks an event against its schema in debug mode, so a missing or mistyped field is caught while you are looking rather than in a report a week later. | 1 | — | — | — |

### Analytics tracking

| Prefix | What it does | Error | Warn | Info | Debug |
|---|---|---|---|---|---|
| `[AutoEventListener]` | Turns the SDK’s own cart, upsell, and exit-intent events into analytics events, so a page gets tracking without writing any. | 1 | 4 | 6 | 14 |
| `[MetaTagController]` | Fires `view_item` / `view_item_list` and scroll-depth events from `<meta>` tags, including reading the package id out of a URL parameter and waiting for a time, an element, or a scroll threshold. | — | 8 | 10 | 13 |
| `[PendingEventsHandler]` | Holds events that were raised as the page was navigating away, and replays them on the next page so a redirect does not lose a purchase. | 4 | 2 | 2 | 6 |
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
| `[DebugOverlay]` | The on-page debug panel itself — state inspectors, the event pipeline, and the country / currency / locale switchers. | — | — | 3 | — |
| `[CountrySelector]` | The debug overlay’s country switcher, for checking an address form and shipping options as a visitor in another country. | 2 | 1 | 6 | 6 |
| `[CurrencySelector]` | The debug overlay’s currency switcher, for checking prices in every currency the campaign offers. | 1 | 1 | 4 | 6 |
| `[LocaleSelector]` | The debug overlay’s locale switcher, for checking how prices and dates are formatted. | 1 | 1 | 4 | 5 |
| `[UpsellSelector]` | The debug overlay’s post-purchase upsell inspector: what the page offers and what is currently selected. | — | — | 1 | 12 |

## `[SDKInitializer]`

Starts the SDK: reads configuration, detects country and currency, loads the campaign, applies URL parameters such as `forcePackageId`, then hands over to the DOM scan. Most "the page did nothing" investigations start here.

Logged from `sdk-initializer.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `SDK initialization failed:`

`sdk-initializer.ts:102` · extra context attached

**Meaning:** Boot threw before it finished. Nothing on the page is enhanced yet: prices show their placeholders and buttons do nothing. The attached error says which step failed.

**Action:** Read the attached error first. A missing API key is the most common cause and says so plainly. Boot retries up to three times (`Retrying initialization …`); if all attempts fail the page stays un-enhanced, so fix the cause rather than reloading.

#### `Error fetching country config:`

`sdk-initializer.ts:233` · extra context attached

**Meaning:** The request for the forced country’s configuration threw rather than returning a bad answer. Detection is used instead, so the address form and currency may not match the forced country.

**Action:** Read the attached error. It is normally a network failure and clears on reload, since the result is cached once a request succeeds.

#### `Error processing forcePackageId parameter:`

`sdk-initializer.ts:528` · extra context attached

**Meaning:** The `forcePackageId` parameter could not be applied, so the cart is not pre-filled. Boot deliberately continues — a bad link should not take the page down.

**Action:** Read the attached error: `Invalid package ID` and `Invalid quantity` name the offending value. The parameter format is `id` or `id:quantity`, comma-separated.

#### `Error processing forceShippingId parameter:`

`sdk-initializer.ts:580` · extra context attached

**Meaning:** Applying `forceShippingId` threw, so shipping is unchanged. Boot continues.

**Action:** Read the attached error — `Invalid shipping ID` means the parameter was not a positive number. Otherwise the cart update itself failed, and the visitor picks shipping manually.

#### `Attribution initialization failed:`

`sdk-initializer.ts:629` · extra context attached

**Meaning:** Attribution did not start, so the order will be missing UTM tags, funnel name, and click ids. The page and checkout still work — this is a reporting problem, not a buying one.

**Action:** Read the attached error. Orders placed while this is happening cannot be attributed after the fact, so it is worth fixing quickly on paid traffic.

#### `Failed to auto-load order:`

`sdk-initializer.ts:720` · extra context attached

**Meaning:** A `ref_id` in the URL was found but the order behind it could not be loaded, so a receipt or upsell page has nothing to show and `next.addUpsell()` will reject.

**Action:** Check the attached error and the `ref_id`. An expired or wrong reference gives this; so does the API being unreachable. Until it loads, treat the page as having no order rather than an empty one.

#### `Ready callback error:`

`sdk-initializer.ts:749` · extra context attached

**Meaning:** One of your own `window.nextReady` callbacks threw. The SDK caught it and ran the remaining callbacks, so this is your page code failing, not the SDK.

**Action:** Fix the callback named in the attached stack. Note that a callback failing part-way can leave your own page half-configured even though boot reports success.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `SDK already initialized`

`sdk-initializer.ts:35`

**Meaning:** Something called `initialize()` a second time and the call was ignored. Usually the loader script is on the page twice, or a page builder duplicated it into a template.

**Action:** Harmless in itself — the second call does nothing. Remove the duplicate loader anyway: two loaders can disagree about which SDK version to fetch, and that difference is much harder to diagnose than this line.

#### `Retrying initialization (attempt {retryAttempts}/{maxRetries})...`

`sdk-initializer.ts:108`

**Meaning:** Boot failed and is trying again after a pause. Expected to be followed either by `SDK initialization complete ✅` or by another `SDK initialization failed:`.

**Action:** Nothing while the retries are running. If you see the third attempt, treat the page as broken for that visitor and fix the error logged above it — retrying a missing API key never succeeds.

#### `Failed to capture URL parameters:`

`sdk-initializer.ts:150` · extra context attached

**Meaning:** Reading the current URL’s parameters threw, so `forcePackageId`, currency overrides, and visibility parameters are not applied on this page. Boot continues.

**Action:** Check the attached error. A malformed URL or a blocked `sessionStorage` are the realistic causes; the page still works, but any behaviour driven by a URL parameter is silently off.

#### `Failed to fetch country config for {forcedCountry}, falling back to detection`

`sdk-initializer.ts:230`

**Meaning:** A country was forced — by `?country=` or a previous choice saved in the session — but the API returned no configuration for it, so normal detection is used instead. The visitor may see a different country than the one that was forced.

**Action:** Check that the forced code is a two-letter code the campaign ships to; the shipping list is logged at boot as `Campaign shipping countries set globally:`. Clear `next_selected_country` from sessionStorage to stop a stale saved choice from repeating this.

#### `Location detection failed or timed out, using defaults:`

`sdk-initializer.ts:253` · extra context attached

**Meaning:** Location detection did not answer within three seconds, so boot continued with the built-in defaults — the United States and the campaign’s default currency. Prices are still correct for that default, not for the visitor’s real country.

**Action:** Expected occasionally on slow connections. If it is constant, check that the campaigns host is reachable and not blocked by an extension, because every visitor is then being treated as US.

#### `Failed to fetch countries list:`

`sdk-initializer.ts:279` · extra context attached

**Meaning:** The country a visitor is in was resolved, but the list of *all* countries was not, so the country dropdown in the address form has nothing to offer.

**Action:** Check the attached error. Until it succeeds a visitor cannot change country at checkout; a reload usually fixes it, as the list is cached once fetched.

#### `Failed to initialize location/currency, using defaults:`

`sdk-initializer.ts:346` · extra context attached

**Meaning:** The whole location-and-currency step threw. Boot continues with defaults and with any currency the visitor had already chosen this session.

**Action:** Read the attached error. Prices are being shown in the default currency, so treat this as a revenue-visible problem rather than a cosmetic one.

#### `Package {packageId} not found in campaign data, skipping`

`sdk-initializer.ts:509`

**Meaning:** A `forcePackageId` entry names a package the campaign does not contain, so that entry is skipped. Other valid entries in the same parameter are still added.

**Action:** Check the id against the campaign’s packages — it must be the package `ref_id`, not a product or variant id. A link built for a different campaign is the usual cause.

#### `No shipping methods available in campaign data`

`sdk-initializer.ts:555`

**Meaning:** `forceShippingId` was asked for, but the campaign came back with no shipping methods at all, so nothing could be selected.

**Action:** Check the campaign has shipping methods configured. Every visitor on this campaign will reach checkout with no shipping option, not only the ones using the parameter.

#### `Shipping method {shippingId} not found in campaign data`

`sdk-initializer.ts:564`

**Meaning:** The id in `forceShippingId` does not match any shipping method in this campaign, so the cart keeps whatever method it had.

**Action:** Use a `ref_id` from the campaign’s shipping methods — the debug line `Available shipping methods:` right after this one lists the valid ids, codes, and prices.

#### `Analytics v2 initialization failed (non-critical):`

`sdk-initializer.ts:680` · extra context attached

**Meaning:** The analytics module failed to load or initialize. No analytics events will be sent from this page load; everything else works.

**Action:** Read the attached error. A blocked script or an ad blocker is the common cause. Do not treat the resulting gap in reporting as a drop in sales.

#### `Error handler initialization failed:`

`sdk-initializer.ts:694` · extra context attached

**Meaning:** The global error handler did not start, so uncaught page errors are no longer re-published as `error:occurred` events. Nothing else changes.

**Action:** Read the attached error. Low urgency, but while it lasts your own `next.on('error:occurred')` handlers will not fire.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Initializing NextCommerce Campaign Cart SDK v2...` | `sdk-initializer.ts:40` | — |
| `SDK initialization complete ✅` | `sdk-initializer.ts:91` | — |
| `Visibility control parameters detected:` | `sdk-initializer.ts:146` | yes |
| `Skipping location/currency detection (currencyBehavior is not set to auto)` | `sdk-initializer.ts:161` | — |
| `Initializing location and currency detection...` | `sdk-initializer.ts:179` | — |
| `Using forced country: {forcedCountry} (source: {countryOverride ? 'URL' : 'session'})` | `sdk-initializer.ts:196` | — |
| `Country config loaded:` | `sdk-initializer.ts:225` | yes |
| `User location detected:` | `sdk-initializer.ts:284` | yes |
| `Currency override from URL:` | `sdk-initializer.ts:314` | yes |
| `Using saved currency preference:` | `sdk-initializer.ts:320` | yes |
| `Using detected currency:` | `sdk-initializer.ts:324` | yes |
| `forcePackageId parameter detected:` | `sdk-initializer.ts:407` | yes |
| `forceShippingId parameter detected:` | `sdk-initializer.ts:414` | yes |
| `forceBundleId parameter detected:` | `sdk-initializer.ts:423` | yes |
| `Campaign shipping countries set globally:` | `sdk-initializer.ts:453` | yes |
| `Processing forcePackageId parameter:` | `sdk-initializer.ts:477` | yes |
| `Successfully processed forcePackageId: added {length} package(s) to cart` | `sdk-initializer.ts:522` | — |
| `Processing forceShippingId parameter:` | `sdk-initializer.ts:541` | yes |
| `Successfully set shipping method: {code} (ID: {shippingId}, Price: ${price})` | `sdk-initializer.ts:574` | — |
| `Initializing attribution...` | `sdk-initializer.ts:587` | — |
| `Initializing analytics v2...` | `sdk-initializer.ts:672` | — |
| `Page loaded with {paramName} parameter, auto-loading order:` | `sdk-initializer.ts:705` | yes |
| `Order loaded successfully:` | `sdk-initializer.ts:713` | yes |
| `Order supports upsells:` | `sdk-initializer.ts:717` | yes |
| `DOM scanning and enhancement complete` | `sdk-initializer.ts:735` | yes |
| `Debug mode enabled - initializing debug utilities` | `sdk-initializer.ts:776` | — |
| `Logger level set to DEBUG` | `sdk-initializer.ts:780` | — |
| `Debug utilities initialized ✅` | `sdk-initializer.ts:794` | — |
| `Reinitializing SDK...` | `sdk-initializer.ts:1002` | — |
| `Clearing all Next Campaign Cart storage...` | `sdk-initializer.ts:1099` | — |
| `Cleared {length} sessionStorage items, {length} localStorage items` | `sdk-initializer.ts:1132` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Cart cleared on init (next-clear-cart)` | `sdk-initializer.ts:71` | — |
| `Captured {length} URL parameters, total stored: {length}` | `sdk-initializer.ts:140` | — |
| `Location and currency initialized:` | `sdk-initializer.ts:338` | yes |
| `Configuration loaded (metatags have priority):` | `sdk-initializer.ts:427` | yes |
| `Campaign data loaded` | `sdk-initializer.ts:446` | — |
| `Emitted sdk:url-parameters-processed event` | `sdk-initializer.ts:466` | — |
| `Cart cleared for forcePackageId` | `sdk-initializer.ts:483` | — |
| `Parsed package specifications:` | `sdk-initializer.ts:502` | yes |
| `Added package {packageId} with quantity {quantity} to cart` | `sdk-initializer.ts:519` | — |
| `Available shipping methods:` | `sdk-initializer.ts:565` | yes |
| `Added SDK version to attribution metadata: {sdkVersion}` | `sdk-initializer.ts:611` | — |
| `Added user IP to attribution metadata: {userIp}` | `sdk-initializer.ts:613` | — |
| `UTM transfer initialized` | `sdk-initializer.ts:624` | — |
| `Attribution initialized` | `sdk-initializer.ts:627` | — |
| `Set funnel name from campaign:` | `sdk-initializer.ts:642` | yes |
| `Updated attribution with conversion timestamp` | `sdk-initializer.ts:654` | — |
| `Analytics v2 initialized successfully` | `sdk-initializer.ts:678` | — |
| `Error handler initialized` | `sdk-initializer.ts:691` | — |
| `nextReady callback system and window.next API initialized` | `sdk-initializer.ts:768` | — |
| `🎯 Highlighting element: {selector}` | `sdk-initializer.ts:935` | — |
| `Waiting for cart store rehydration...` | `sdk-initializer.ts:1041` | — |
| `Cart store rehydration complete` | `sdk-initializer.ts:1058` | yes |
| `No cart data to rehydrate` | `sdk-initializer.ts:1064` | — |

## `[AttributeScanner]`

Finds every `data-next-*` element on the page and starts the feature bound to it. If a feature never runs, this is where its element was either skipped or failed to initialize.

Logged from `attribute-scanner.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error during scan and enhance:`

`attribute-scanner.ts:158` · extra context attached

**Meaning:** The DOM scan threw part-way, so some elements were enhanced and others were not. The page is in a mixed state: some prices update, some do not.

**Action:** Read the attached error, then reload with `?debug=true` and look at the lines above to see which element the scan was on when it failed.

#### `Failed to initialize {type} enhancer:`

`attribute-scanner.ts:217` · extra context attached

**Meaning:** One feature threw while starting up. It is destroyed and that element is left as plain markup — its button does nothing, its display keeps its placeholder. Everything else on the page is unaffected. A missing required attribute is the usual cause.

**Action:** The element is attached to the log line: expand it, then check its attributes against that feature’s `reference/attributes.md`. `Required attribute {name} not found on element` in the attached error names the missing one directly.

#### `Failed to enhance element:`

`attribute-scanner.ts:233` · extra context attached

**Meaning:** Enhancing one element failed outside any single feature’s own start-up — while resolving which features it needs, for example. That element stays plain markup.

**Action:** The element is attached. Check for contradictory attributes on it, such as a display path that names no known namespace, and compare against a working element nearby.

#### `Failed to create enhancer of type {type}:`

`attribute-scanner.ts:432` · extra context attached

**Meaning:** Loading the code for a feature failed, so no element using it is enhanced. Features are imported on demand, so a network problem or a broken deployment produces this rather than a markup mistake.

**Action:** Read the attached error. A failed dynamic import points at the deployed bundle — check that the SDK version the loader asked for is actually published.

#### `Failed to enhance queued element:`

`attribute-scanner.ts:494` · extra context attached

**Meaning:** An element that arrived after boot — injected by a page builder or an A/B tool — could not be enhanced. The rest of the queue is still processed.

**Action:** The element is attached. Treat it as `Failed to enhance element:`: compare its attributes with an equivalent element that was present at boot.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Already scanning, queuing request`

`attribute-scanner.ts:46`

**Meaning:** A second DOM scan was asked for while one was running; the request is queued rather than run in parallel. Expected on a page that injects markup while booting.

**Action:** Nothing. If it repeats continuously, something is mutating the DOM in a loop — look at what is adding elements, not at the scanner.

#### `Unknown action type: {action}`

`attribute-scanner.ts:327`

**Meaning:** `data-next-action` has a value the SDK does not recognise, so the element does nothing when clicked. A typo in the value is almost always the reason.

**Action:** Use one of the supported actions — `add-to-cart` or `accept-upsell`. The value is printed in the message, so compare it character by character, including case.

#### `Unknown enhancer type: {type}`

`attribute-scanner.ts:428`

**Meaning:** The scanner matched an element to a feature name it has no constructor for, so nothing is attached to that element. This means an attribute is spelled in a way that resolves to an unknown feature.

**Action:** Check the `data-next-*` attributes on the element against the feature catalog. If the name in the message looks correct, the feature exists but is not registered in `attribute-scanner.ts` — that is a code fix, not a markup one.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `🔍 Starting DOM scan for data attributes...` | `attribute-scanner.ts:51` | yes |
| `Found {length} conditional display elements:` | `attribute-scanner.ts:95` | yes |
| `Creating CheckoutReviewEnhancer for element:` | `attribute-scanner.ts:356` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Found {length} elements with data attributes` | `attribute-scanner.ts:90` | — |
| `Enhanced {enhancedCount} elements successfully` | `attribute-scanner.ts:135` | — |
| `Added next-display-ready class to HTML element` | `attribute-scanner.ts:144` | — |
| `Element already enhanced, skipping` | `attribute-scanner.ts:167` | yes |
| `Skipping element inside cart items template` | `attribute-scanner.ts:174` | yes |
| `Skipping element with template variable` | `attribute-scanner.ts:181` | yes |
| `No enhancer types found for element` | `attribute-scanner.ts:189` | yes |
| `Initialized {type} enhancer for element` | `attribute-scanner.ts:211` | yes |
| `Enhanced element with {length} enhancer(s)` | `attribute-scanner.ts:226` | yes |
| `Creating display enhancer for path: "{displayPath}"` | `attribute-scanner.ts:245` | yes |
| `Using CartDisplayEnhancer` | `attribute-scanner.ts:252` | — |
| `Using SelectionDisplayEnhancer` | `attribute-scanner.ts:256` | — |
| `Using ProductDisplayEnhancer` | `attribute-scanner.ts:260` | — |
| `Using OrderDisplayEnhancer` | `attribute-scanner.ts:264` | — |
| `Using ShippingDisplayEnhancer` | `attribute-scanner.ts:268` | — |
| `Using BundleDisplayEnhancer` | `attribute-scanner.ts:272` | — |
| `Using PackageSelectorDisplayEnhancer` | `attribute-scanner.ts:276` | — |
| `Using PackageToggleDisplayEnhancer` | `attribute-scanner.ts:280` | — |
| `Using ProductDisplayEnhancer (fallback with package context)` | `attribute-scanner.ts:298` | — |
| `Using CartDisplayEnhancer (fallback without package context)` | `attribute-scanner.ts:303` | — |
| `Creating ConditionalDisplayEnhancer for element:` | `attribute-scanner.ts:340` | yes |
| `Skipping individual express checkout button - managed by container` | `attribute-scanner.ts:366` | — |
| `Started DOM observation` | `attribute-scanner.ts:440` | — |
| `Data attribute changed, re-enhancing element` | `attribute-scanner.ts:456` | yes |
| `Processing {length} queued elements` | `attribute-scanner.ts:488` | — |
| `AttributeScanner destroyed` | `attribute-scanner.ts:527` | — |
| `AttributeScanner paused` | `attribute-scanner.ts:532` | — |
| `AttributeScanner resumed` | `attribute-scanner.ts:537` | — |

## `[NextCommerce]`

The `window.next` API a page calls directly — callbacks, attribution, URL parameters, exit intent, FOMO, post-purchase upsells.

Logged from `next-commerce.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Callback error for {type}:`

`next-commerce.ts:359` · extra context attached

**Meaning:** One of your own callbacks registered through `next.on…` threw. The SDK caught it and carried on with the other callbacks for that type.

**Action:** Fix the callback named in the attached error. The SDK’s own state is unaffected, but anything your callback was supposed to do — a pixel, a redirect — did not happen.

#### `Failed to add attribution metadata:`

`next-commerce.ts:613` · extra context attached

**Meaning:** A single metadata value could not be added, so it will be missing from the order. Nothing else is affected.

**Action:** Read the attached error. Values must be serialisable — a DOM element or a function passed as metadata fails here.

#### `Failed to set attribution metadata:`

`next-commerce.ts:638` · extra context attached

**Meaning:** A whole metadata object could not be merged in, so none of those values reach the order.

**Action:** Read the attached error and check the object is plain and serialisable. Confirm afterwards with `next.getMetadata()`.

#### `Failed to clear attribution metadata:`

`next-commerce.ts:666` · extra context attached

**Meaning:** Resetting metadata failed, so previously set values may still be attached to the next order.

**Action:** Read the attached error, then verify with `next.getMetadata()` rather than assuming the reset worked.

#### `Failed to get attribution metadata:`

`next-commerce.ts:680` · extra context attached

**Meaning:** Reading metadata threw, and `next.getMetadata()` returned `undefined` — which is indistinguishable from "no metadata set" to the caller.

**Action:** Read the attached error. Do not treat the `undefined` as proof there is no metadata; check the attribution store in the debug overlay.

#### `Failed to set attribution:`

`next-commerce.ts:697` · extra context attached

**Meaning:** Updating attribution threw, so the values you passed are not recorded and the order will carry whatever was there before.

**Action:** Read the attached error and confirm with `next.getAttribution()`. On paid traffic this is worth fixing quickly, since it decides which channel gets credit for the sale.

#### `Failed to get attribution:`

`next-commerce.ts:711` · extra context attached

**Meaning:** Reading attribution threw and `next.getAttribution()` returned `undefined`.

**Action:** Read the attached error. Inspect the attribution store in the debug overlay before concluding attribution is empty.

#### `Failed to debug attribution:`

`next-commerce.ts:726` · extra context attached

**Meaning:** The `next.debugAttribution()` helper threw. It only prints attribution state, so nothing about the page or the order changed.

**Action:** Nothing on a customer page — this call exists for debugging. Read the attached error if you were using it to investigate something else.

#### `Failed to setup exit intent:`

`next-commerce.ts:878` · extra context attached

**Meaning:** The exit-intent popup could not be configured, so it will never show. The error is also re-thrown, so your own `await next.exitIntent(...)` rejects.

**Action:** Read the attached error and check the options you passed, particularly the image URL. Handle the rejection in your own code so a popup failing does not stop the rest of your setup.

#### `Failed to start FOMO popup:`

`next-commerce.ts:925` · extra context attached

**Meaning:** The FOMO popup did not start, so no social-proof messages appear. The error is re-thrown to your caller.

**Action:** Read the attached error and check the configuration you passed — an empty or malformed customer list is the usual cause.

#### `Failed to add upsell(s) via SDK:`

`next-commerce.ts:1045` · extra context attached

**Meaning:** A post-purchase upsell could not be added. The error is re-thrown, so the promise from `next.addUpsell()` rejects.

**Action:** Read the attached error before offering the visitor a retry: the line may already exist on the order, and a blind retry can charge them twice. Re-read the order first.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Package not found in store:`

`next-commerce.ts:404` · extra context attached

**Meaning:** A product element on the page names a package that is not in the campaign data, so it is left out of automatic `view_item` / `view_item_list` tracking.

**Action:** The id is attached. Check the `data-next-package-id` on that element against the campaign’s packages; a leftover card from another campaign is the usual cause.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Adding upsell(s) via SDK:` | `next-commerce.ts:997` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Cart swapped with {length} items` | `next-commerce.ts:178` | — |
| `Analytics tracking failed (non-critical):` | `next-commerce.ts:381` | yes |
| `Analytics debug mode failed (non-critical):` | `next-commerce.ts:569` | yes |
| `Analytics context invalidation failed (non-critical):` | `next-commerce.ts:585` | yes |
| `Attribution metadata added: {key}` | `next-commerce.ts:611` | yes |
| `Attribution metadata set:` | `next-commerce.ts:636` | yes |
| `Attribution metadata cleared` | `next-commerce.ts:664` | — |
| `Attribution set:` | `next-commerce.ts:695` | yes |
| `Exit intent configured with image:` | `next-commerce.ts:876` | yes |
| `FOMO popup started` | `next-commerce.ts:923` | — |
| `URL parameter set: {key}={value}` | `next-commerce.ts:1102` | — |
| `URL parameters set:` | `next-commerce.ts:1113` | yes |
| `URL parameter cleared: {key}` | `next-commerce.ts:1154` | — |
| `All URL parameters cleared` | `next-commerce.ts:1165` | — |
| `URL parameters merged:` | `next-commerce.ts:1176` | yes |

## `[ErrorHandler]`

Catches uncaught page errors and rejected promises, wraps them with SDK version and URL, and re-publishes them as the `error:occurred` event.

Logged from `monitoring/error-handler.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Captured error:`

`monitoring/error-handler.ts:79` · extra context attached

**Meaning:** The global handler caught an uncaught error, a rejected promise, or something written to `console.error`, and re-published it as `error:occurred`. The attached objects carry the original error plus SDK version, URL, and user agent. The failure itself happened somewhere else — this line is the report, not the cause.

**Action:** Read the attached error and stack to find the real source. Errors from your own page code arrive here too, so check the stack before assuming it is the SDK.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Global error handler initialized` | `monitoring/error-handler.ts:51` | — |

## `[StorageManager]`

The thin wrapper the SDK uses for its own sessionStorage and localStorage reads and writes. Its errors are storage being unavailable, not data being wrong.

Logged from `storage.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to store value for key {key}:`

`storage.ts:34` · extra context attached

**Meaning:** Writing to storage failed and the write was abandoned — the caller received `false`. Storage being full or unavailable, which is normal in some private-browsing modes, produces this.

**Action:** Read the attached error. Nothing recovers a blocked storage from the page; expect the value not to survive a reload, and check anything that assumes it will.

#### `Failed to retrieve value for key {key}:`

`storage.ts:51` · extra context attached

**Meaning:** Reading a key threw, so the caller got its default value. A stored value that is no longer valid JSON does this as well as storage being unavailable.

**Action:** Read the attached error. If it names one key repeatedly, remove that key: a corrupt entry keeps failing until it is cleared.

#### `Failed to remove value for key {key}:`

`storage.ts:62` · extra context attached

**Meaning:** Deleting a key failed, so a value you expected to be gone may still be there and be read back later.

**Action:** Read the attached error, then confirm the key is actually gone before relying on it — a stale cache surviving a reset produces confusing follow-on behaviour.

#### `Failed to clear storage:`

`storage.ts:73` · extra context attached

**Meaning:** Clearing storage failed, so previous values remain. Anything meant to start from a clean slate does not.

**Action:** Read the attached error. Clear the site’s storage in devtools when you need a genuinely fresh session for testing.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Stored value for key: {key}` | `storage.ts:31` | — |
| `No value found for key: {key}` | `storage.ts:43` | — |
| `Retrieved value for key: {key}` | `storage.ts:48` | — |
| `Removed value for key: {key}` | `storage.ts:59` | — |
| `Cleared all storage` | `storage.ts:70` | — |

## `[{EnhancerClassName}]`

The behaviour every feature inherits: reading attributes, subscribing to stores, and the shared error path that turns a thrown error into a log line plus an `error:occurred` event.

Logged from `base/base-enhancer.ts`. The base class every feature extends builds its logger from the subclass name, so this line appears under the feature’s own prefix — `[AddToCartEnhancer]`, `[TimerEnhancer]`, and so on.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error in {context}:`

`base/base-enhancer.ts:135` · extra context attached

**Meaning:** A feature caught an error inside itself and reported it under its own prefix, naming the operation that failed. It also emits `error:occurred`. The feature stays alive but that operation did not complete.

**Action:** Read the operation name and the message. Which feature it is comes from the log prefix, and the matching `guide/reference/errors.md` covers the messages that feature raises.

## `[DOMObserver]`

Watches the page for elements added or attributes changed after boot, so markup injected by a page builder or an A/B tool still gets enhanced.

Logged from `base/dom-observer.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to start DOM observation:`

`base/dom-observer.ts:89` · extra context attached

**Meaning:** The observer could not attach, so elements added after boot will not be enhanced. Markup present at boot still works, which makes this look like "only dynamic content is broken".

**Action:** Read the attached error. A missing target element is the usual cause — the observer needs a `<body>` to watch, so starting the SDK before the body exists produces this.

#### `Handler error:`

`base/dom-observer.ts:339` · extra context attached

**Meaning:** A handler subscribed to DOM changes threw. The observer caught it and carried on with the other handlers, so one broken handler does not stop the rest.

**Action:** Read the attached error to find the handler. If it fires on every mutation, the console noise alone will slow the page down.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Already observing, ignoring start request`

`base/dom-observer.ts:80`

**Meaning:** Something asked the DOM observer to start while it was already running; the request was ignored. One observer is all that is needed, so nothing is lost.

**Action:** Nothing. Repeated occurrences mean code is starting the observer in a loop — look at the caller.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Added handler, total: {size}` | `base/dom-observer.ts:64` | — |
| `Removed handler, total: {size}` | `base/dom-observer.ts:72` | — |
| `Started observing DOM changes` | `base/dom-observer.ts:87` | yes |
| `Stopped observing DOM changes` | `base/dom-observer.ts:105` | — |
| `Paused DOM observation` | `base/dom-observer.ts:115` | — |
| `Resumed DOM observation` | `base/dom-observer.ts:125` | — |
| `Processing {length} relevant mutations` | `base/dom-observer.ts:146` | — |
| `Processing {size} pending changes` | `base/dom-observer.ts:316` | — |
| `DOM observer destroyed` | `base/dom-observer.ts:360` | — |
| `Updated configuration` | `base/dom-observer.ts:388` | yes |

## `[AttributeParser]`

Turns attribute text into something the features can act on — including the comparison expressions behind `data-next-show` and `data-next-hide`.

Logged from `base/attribute-parser.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to parse condition:`

`base/attribute-parser.ts:358` · extra context attached

**Meaning:** A `data-next-show` or `data-next-hide` expression could not be parsed. The parser falls back to `cart.isEmpty`, so the element will show or hide on cart emptiness rather than on what you wrote — visible but wrong, which goes unnoticed longer than a blank element would.

**Action:** The unparsed condition is attached: check it against the conditional-display grammar. Unbalanced quotes and a comparison operator with no right-hand side are the common mistakes.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Parsing condition:` | `base/attribute-parser.ts:236` | yes |
| `Parsed comparison:` | `base/attribute-parser.ts:335` | yes |

## `[CountryService]`

Detects the visitor’s country, fetches the country and state lists for the address form, filters them to the campaign’s shipping countries, and caches the results.

Logged from `country-service.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to fetch location data:`

`country-service.ts:146` · extra context attached

**Meaning:** The location request failed and the built-in fallback is in use: the configured country list and the United States as the detected country. Prices and shipping options are for that fallback, not for the visitor.

**Action:** Read the attached error. It is often an ad blocker or a network failure. A single successful response is cached in localStorage, so a reload usually clears it.

#### `Failed to fetch states for {countryCode}:`

`country-service.ts:193` · extra context attached

**Meaning:** The state list for that country could not be loaded, so the state field renders with no options. In countries where a state is required, the visitor cannot complete the address.

**Action:** Read the attached error and re-select the country to retry; a good response is cached. If one country always fails, check that its code is in the campaign’s shipping countries.

#### `Invalid postal code regex:`

`country-service.ts:241` · extra context attached

**Meaning:** The postal-code pattern configured for a country is not a valid regular expression, so validation was skipped and any postal code is accepted. Orders can be placed with an address the carrier will reject.

**Action:** Fix the pattern in the country configuration. Until then postal codes are unvalidated — the failure is silent from the visitor’s side, so do not wait for a complaint.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Failed to clear cache:`

`country-service.ts:343` · extra context attached

**Meaning:** Clearing the cached country and state data failed, so stale lists may still be served this session.

**Action:** Read the attached error. Clear site data in devtools if you are testing a change to the country list and it will not take effect.

#### `Failed to clear cache for country {countryCode}:`

`country-service.ts:359` · extra context attached

**Meaning:** The cached states for one country could not be removed, so the old list may still be shown.

**Action:** Same as above — read the attached error, and clear site data when testing a change to that country’s states.

#### `Failed to read from cache:`

`country-service.ts:383` · extra context attached

**Meaning:** A cached entry could not be read, so the data is fetched from the API instead. Correct behaviour, one request slower.

**Action:** Nothing. If it repeats on every page, storage is unavailable in this browser mode and every visit will re-fetch the country data.

#### `Failed to write to cache:`

`country-service.ts:402` · extra context attached

**Meaning:** A response could not be cached, so the next page will fetch it again. Nothing is wrong with the data.

**Action:** Nothing. Persistent occurrences mean storage is full or blocked, which costs a request per page rather than breaking anything.

#### `⚠️ Using deprecated showCountries config. Please use campaign API instead.`

`country-service.ts:575`

**Meaning:** The country list is being filtered by the `showCountries` setting in configuration. That setting is deprecated: the campaign’s `available_shipping_countries` is the intended source, and it is ignored while `showCountries` is set.

**Action:** Set the shipping countries on the campaign, then remove `showCountries` from the page configuration. Leaving both in place means the page and the campaign can disagree about where you ship.

#### `⚠️ No countries available in filtered list. Using config defaultCountry: {defaultCountry}`

`country-service.ts:623`

**Meaning:** Filtering left no countries at all, so the configured default is used on its own. The visitor sees a country dropdown with one entry, whatever their real location.

**Action:** Check the campaign’s shipping countries and any `showCountries` filter — an overlap of zero between them produces this. This one blocks visitors from ordering, so treat it as urgent.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `✅ Filtering countries based on campaign API (available_shipping_countries):` | `country-service.ts:549` | yes |
| `Using custom countries list from addressConfig.countries` | `country-service.ts:559` | — |
| `Filtering countries based on addressConfig.showCountries (legacy):` | `country-service.ts:578` | yes |
| `✅ Detected country ({detectedCountryCode}) not available for shipping. Using fallback: United States (US)` | `country-service.ts:609` | — |
| `✅ Detected country ({detectedCountryCode}) not available and US not in list. Using first available country: {fallbackCountryCode}` | `country-service.ts:616` | — |
| `Preserving detected currency: {currencyCode} from detected location: {detectedCountryCode}` | `country-service.ts:629` | — |
| `✅ Using detected country: {detectedCountryCode} (available for shipping)` | `country-service.ts:642` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Address configuration updated:` | `country-service.ts:73` | yes |
| `Campaign shipping countries updated:` | `country-service.ts:102` | yes |
| `Location data fetched` | `country-service.ts:139` | yes |
| `States data fetched for {countryCode}` | `country-service.ts:183` | yes |
| `Country service cache cleared ({length} session + {length} local entries)` | `country-service.ts:339` | — |
| `Cache cleared for country: {countryCode}` | `country-service.ts:357` | — |

## `[AttributionCollector]`

Collects where the visitor came from — funnel name, UTM tags, Everflow click id, tracking-tag meta tags — and keeps it for the order.

Logged from `attribution/attribution-collector.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Subaffiliate value truncated from {length} to 225 characters`

`attribution/attribution-collector.ts:94`

**Meaning:** A subaffiliate value was longer than the API accepts and was cut to 225 characters. The order is still created; the value stored is shortened, so reports may not match the tracking link exactly.

**Action:** Shorten the value at the source — the affiliate link or the tracking template. Two long values that differ only after character 225 become indistinguishable once truncated.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `🔄 Funnel override: "{existingFunnel}" -> "{urlFunnel}" (from URL parameter)` | `attribution/attribution-collector.ts:194` | — |
| `Persisted funnel name from URL: {urlFunnel}` | `attribution/attribution-collector.ts:203` | — |
| `Persisted funnel name: {value}` | `attribution/attribution-collector.ts:261` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Funnel found in URL parameter: {urlFunnel}` | `attribution/attribution-collector.ts:196` | — |
| `Using persisted funnel from session: {sessionFunnel}` | `attribution/attribution-collector.ts:216` | — |
| `Using persisted funnel from localStorage: {localFunnel}` | `attribution/attribution-collector.ts:223` | — |
| `Using persisted funnel from attribution: {funnel}` | `attribution/attribution-collector.ts:234` | — |
| `New funnel found from meta tag: {value}` | `attribution/attribution-collector.ts:256` | — |
| `Everflow click ID found in URL: {evclid}` | `attribution/attribution-collector.ts:285` | — |
| `Everflow click ID found in sessionStorage: {evclid}` | `attribution/attribution-collector.ts:292` | — |
| `Added Everflow transaction ID to metadata: {evclid}` | `attribution/attribution-collector.ts:299` | — |
| `Found {length} tracking tags` | `attribution/attribution-collector.ts:312` | — |
| `Added tracking tag: {tagName} = {tagValue}` | `attribution/attribution-collector.ts:321` | — |
| `Persisted tracking tag: {tagName}` | `attribution/attribution-collector.ts:327` | — |
| `Facebook Pixel ID found from meta tag: {pixelId}` | `attribution/attribution-collector.ts:348` | — |
| `Facebook Pixel ID found from script: {match[1]}` | `attribution/attribution-collector.ts:360` | — |

## `[UtmTransfer]`

Copies the current page’s URL parameters onto the links leaving it, so attribution survives a click through to the next page.

Logged from `attribution/utm-transfer.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Invalid link element provided`

`attribution/utm-transfer.ts:135`

**Meaning:** UTM transfer was handed something that is not a usable link element, so no parameters were copied onto it. Only code calling the API directly can cause this; the automatic pass over the page’s links does not.

**Action:** Pass an `<a>` element that is in the document. A `null` from a selector that matched nothing is the usual cause.

#### `Invalid URL:`

`attribution/utm-transfer.ts:166` · extra context attached

**Meaning:** A link’s `href` could not be parsed as a URL, so attribution parameters were not added to it. A visitor clicking that link arrives on the next page with no UTM tags.

**Action:** The offending `href` is attached. Fix the link — a stray space, an unsubstituted template token such as `{{url}}`, or a `javascript:` href all produce this.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `UTM Transfer disabled by configuration` | `attribution/utm-transfer.ts:40` | — |
| `No URL parameters to transfer` | `attribution/utm-transfer.ts:49` | — |
| `Available parameters: {join(', ')}` | `attribution/utm-transfer.ts:59` | — |
| `No matching parameters to transfer` | `attribution/utm-transfer.ts:66` | — |
| `UTM Transfer initialized with parameters: {toString()}` | `attribution/utm-transfer.ts:76` | — |
| `Filtering to specific parameters: {join(', ')}` | `attribution/utm-transfer.ts:85` | — |
| `Found parameter to copy: {param}={get(param)}` | `attribution/utm-transfer.ts:90` | — |
| `No specific parameters configured, will copy all parameters` | `attribution/utm-transfer.ts:95` | — |
| `Found {length} links on the page` | `attribution/utm-transfer.ts:107` | — |
| `Updated link {href} to {toString()}` | `attribution/utm-transfer.ts:190` | — |

## `[NextAnalytics]`

The analytics entry point: reads configuration, builds the enabled providers, and accepts every event the rest of the SDK tracks.

Logged from `analytics/index.ts`.

Rows marked *message assembled in code* are built from several string literals joined together, so searching the source for the whole sentence finds nothing — search for the first few words instead. The location given is where the message text begins, which is a line or two after the `logger.*` call itself.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error checking ignore parameter:`

`analytics/index.ts:113` · extra context attached

**Meaning:** Reading `?ignore=true` or writing its session flag threw, so analytics may not be suppressed on a page where you asked for it to be. Events could be sent from a session you meant to exclude.

**Action:** Read the attached error — a blocked `sessionStorage` is the usual cause. Do not rely on `?ignore=true` for excluding your own test traffic while this appears.

#### `Error checking ignore status:`

`analytics/index.ts:135` · extra context attached

**Meaning:** Deciding whether this session is ignored threw, and the answer defaulted to "not ignored" — so events are sent.

**Action:** Read the attached error. Same practical consequence as above: internal traffic may be landing in reports.

#### `Failed to initialize analytics:`

`analytics/index.ts:220` · extra context attached

**Meaning:** Analytics did not start and the error is re-thrown to boot, which logs `Analytics v2 initialization failed (non-critical):`. No events are sent from this page load.

**Action:** Read the attached error. A provider that cannot load its own script is the common cause, and the provider name in the message tells you which to look at.

#### `Event validation failed:`

`analytics/index.ts:296` · extra context attached

**Meaning:** In debug mode only, an event did not match its schema; the attached list names the fields. The event is still sent, so the problem shows up as bad data in the destination rather than a missing event.

**Action:** Fix the fields named in the attachment. This check does not run outside debug mode, so run `?debug=true` before a launch rather than after a report of odd numbers.

#### `Error clearing ignore flag:`

`analytics/index.ts:363` · extra context attached

**Meaning:** Removing the analytics ignore flag failed, so the session stays excluded from analytics — no events will be sent from it until storage is cleared.

**Action:** Read the attached error, then clear `analytics_ignore` from sessionStorage in devtools. A tester left in this state reports "no events" for a reason unrelated to the tracking setup.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Analytics not initialized, queuing event:`

`analytics/index.ts:288` · extra context attached

**Meaning:** An event arrived before analytics finished starting. It is held and sent once initialization completes, so this is expected once or twice at the top of a page load.

**Action:** Nothing if `NextAnalytics initialized successfully` follows. If it never does, the queued events are never sent — investigate the initialization failure instead of this line.

#### `Event validation warnings:`

`analytics/index.ts:298` · extra context attached

**Meaning:** Debug-mode validation found things worth noting on an event that already failed — a missing recommended field, or an event with no schema at all.

**Action:** Read the list. Warnings do not stop delivery; treat them as the list of fields a destination will silently ignore.

#### `No campaign apiKey configured — analytics events will lack campaign identifiers. Set <meta name="next-api-key" content="..."> or window.nextConfig.apiKey.`

`analytics/index.ts:234` · message assembled in code

**Meaning:** Analytics started without a campaign API key, so no event can carry campaign id, name, currency, or language. Events still arrive; they cannot be grouped by campaign.

**Action:** Add the key before the loader script — `<meta name="next-api-key" content="{YOUR_CAMPAIGN_API_KEY}">` or `window.nextConfig.apiKey`. Without it the campaign never loads, so this warning usually comes with a page full of placeholder prices.

#### `Provider "{key}" is enabled but {required} is missing — set it to enable {key}; skipping.`

`analytics/index.ts:262` · message assembled in code

**Meaning:** A provider is switched on in configuration but one setting it cannot start without is absent, so it is skipped. Events go to the other providers only, and that destination reports nothing.

**Action:** Set the setting named in the message, or turn the provider off so the gap in its reporting is deliberate rather than a surprise.

#### `Provider "{key}" is enabled but its preconditions are not met; skipping.`

`analytics/index.ts:263` · message assembled in code

**Meaning:** A provider is switched on but its own start-up check said no, and it lists no single required setting to name. It is skipped and receives no events.

**Action:** Check that provider’s configuration block as a whole. `?debug=true` shows the providers that did start, which is the quickest way to confirm which one is missing.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Analytics ignore flag set from URL parameter` | `analytics/index.ts:110` | — |
| `Analytics ignored due to ignore parameter` | `analytics/index.ts:158` | — |
| `Analytics disabled in configuration` | `analytics/index.ts:167` | — |
| `Auto-tracking initialized (user data fired first, meta tags processed)` | `analytics/index.ts:203` | — |
| `Manual mode - meta tags processed, auto-tracking disabled` | `analytics/index.ts:205` | — |
| `NextAnalytics initialized successfully` | `analytics/index.ts:215` | yes |
| `{key} adapter initialized` | `analytics/index.ts:271` | yes |
| `Debug mode {enabled ? 'enabled' : 'disabled'}` | `analytics/index.ts:312` | — |
| `Analytics ignore flag cleared` | `analytics/index.ts:361` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Analytics already initialized` | `analytics/index.ts:152` | — |
| `Event tracking skipped due to ignore flag:` | `analytics/index.ts:283` | yes |
| `Called ElevarInvalidateContext` | `analytics/index.ts:331` | — |

## `[NextDataLayer]`

Pushes finished events onto `window.dataLayer` and fans them out to the providers, adding attribution and validating required fields on the way.

Logged from `analytics/DataLayerManager.ts`.

Rows marked *wording lives at the caller* are passed to a private logging helper, so the `logger.*` call is elsewhere in the file. The location given is where the wording is, which is the line you want.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to persist debug mode`

`analytics/DataLayerManager.ts:147` · extra context attached

**Meaning:** Debug mode was switched on or off but the choice could not be saved to localStorage, so it will not survive a page navigation.

**Action:** Add `?debug=true` to the URL instead of relying on the saved setting. The attached error is normally storage being blocked.

#### `Error pushing event to data layer`

`analytics/DataLayerManager.ts:128` · extra context attached · wording lives at the caller

**Meaning:** An event could not be pushed to `window.dataLayer`, so nothing downstream — GTM included — sees it. The event is lost, not retried.

**Action:** Read the attached error and data. Note that these `NextDataLayer` errors print only when `debug.logErrors` is on, so an apparently silent console does not mean nothing failed.

#### `Failed to save user properties`

`analytics/DataLayerManager.ts:178` · extra context attached · wording lives at the caller

**Meaning:** User properties could not be stored, so later events on this page load may go out without them.

**Action:** Read the attached error — storage being blocked is the usual cause.

#### `Failed to load user properties`

`analytics/DataLayerManager.ts:190` · extra context attached · wording lives at the caller

**Meaning:** Stored user properties could not be read back, so events start without them even though the visitor identified themselves earlier.

**Action:** Read the attached error. A corrupt stored value keeps failing until it is cleared.

#### `Missing required field: {field}`

`analytics/DataLayerManager.ts:213` · extra context attached · wording lives at the caller

**Meaning:** An event reached the data layer without a field every event must have. It is still pushed, so the destination receives an incomplete event rather than none.

**Action:** The event is attached — find where it is built and set the named field. Fields required of every event are the shared ones (event name, id, timestamp), so this normally means an event was hand-built rather than made by `EventBuilder`.

#### `Missing required field for {event}: {field}`

`analytics/DataLayerManager.ts:223` · extra context attached · wording lives at the caller

**Meaning:** An event is missing a field its own type requires — a purchase with no transaction id, for example. It is still pushed.

**Action:** Set the named field where that event is built. Destinations may accept the event and then report it as unattributed, which is harder to notice than a rejected event.

#### `Invalid type for field {field}: expected {expectedType}, got {typeof value}`

`analytics/DataLayerManager.ts:233` · extra context attached · wording lives at the caller

**Meaning:** A field has the wrong type — most often a number sent as a string, or the reverse. The event is still pushed, and destinations that coerce silently will report a wrong value rather than an error.

**Action:** Convert the field at the point the event is built. Revenue fields are the ones to check first, since a string total can be dropped or read as zero.

#### `Error in provider {name}`

`analytics/DataLayerManager.ts:396` · extra context attached · wording lives at the caller

**Meaning:** One provider threw while handling an event. The others still receive it, so this is a gap in one destination rather than a lost event.

**Action:** Read the attached error and the provider named in the message; that adapter’s own errors are in [errors.md](./errors.md).

## `[AnalyticsConfig]`

Holds the per-provider settings — which fields each provider needs before it can be switched on.

Logged from `analytics/config.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Missing config for provider "{name}"`

`analytics/config.ts:180`

**Meaning:** A provider was checked for its settings and had none. This cannot appear in a shipped build: the function that logs it, `validateProviderConfig()` in `analytics/config.ts`, is exported but never called anywhere in the SDK.

**Action:** Nothing to act on from a page. If you see it, something outside the SDK is calling that function — the live check that decides whether a provider can start is in `analytics/index.ts` and warns with `Provider "{key}" is enabled but …` instead.

#### `Missing required field "{field}" for provider "{name}"`

`analytics/config.ts:187`

**Meaning:** A provider’s settings are missing a field it needs. Like the message above, it comes from `validateProviderConfig()`, which nothing in the SDK calls, so a shipped build never prints it.

**Action:** Nothing to act on from a page. For a provider that genuinely will not start, look for `Provider "{key}" is enabled but {required} is missing …` from `NextAnalytics`.

## `[UserDataStorage]`

Remembers who the visitor is across pages — email, name, ids — in a cookie plus sessionStorage, so events after a redirect still identify them.

Logged from `analytics/userDataStorage.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to load user data:`

`analytics/userDataStorage.ts:130` · extra context attached

**Meaning:** Loading visitor data threw, so events go out without identity fields and without a stable session id. Purchase attribution to a visitor’s earlier pages breaks.

**Action:** Read the attached error. Cookies or storage being blocked is the usual cause; in that case identity cannot be kept across pages and the gap in reporting is expected, not a tracking bug.

#### `Failed to save user data:`

`analytics/userDataStorage.ts:154` · extra context attached

**Meaning:** Newly captured visitor details — typically an email typed at checkout — could not be stored, so the next page will not know them.

**Action:** Read the attached error. While this happens, events on later pages are anonymous even though the visitor identified themselves.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Failed to parse user data cookie:`

`analytics/userDataStorage.ts:94` · extra context attached

**Meaning:** The stored visitor cookie is not valid JSON, so it is ignored. Events on this page will not identify the visitor from the cookie; a fresh identity is built when they next enter their details.

**Action:** Read the attached error. One occurrence after a format change is expected; a cookie written by other code on the same name would explain a persistent one.

#### `Failed to parse sessionStorage user data:`

`analytics/userDataStorage.ts:106` · extra context attached

**Meaning:** The sessionStorage copy of the visitor data could not be parsed, so the older cookie copy is used. Recent details, such as an email typed on the previous step, may be missing from events.

**Action:** Read the attached error, then clear `user_data` from sessionStorage. It keeps failing on every page until the bad entry is removed.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `User email updated:` | `analytics/userDataStorage.ts:188` | yes |
| `User data cleared` | `analytics/userDataStorage.ts:226` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Loaded user data from cookie:` | `analytics/userDataStorage.ts:89` | yes |
| `Merged user data from sessionStorage` | `analytics/userDataStorage.ts:104` | — |
| `Saved user data to storage:` | `analytics/userDataStorage.ts:149` | yes |
| `Updated user data from form fields:` | `analytics/userDataStorage.ts:263` | yes |

## `[EventBuilder]`

Builds each event’s payload: campaign context, currency, and the item fields taken from the package in the campaign data.

Logged from `analytics/events/EventBuilder.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Could not access store state for user properties:`

`analytics/events/EventBuilder.ts:154` · extra context attached

**Meaning:** The event was built without user properties because reading the stores threw. It is still sent, minus the customer fields.

**Action:** Read the attached error. Expect events with no customer email or name for as long as it happens, which affects audience matching more than event counts.

#### `Could not build campaign context:`

`analytics/events/EventBuilder.ts:203` · extra context attached

**Meaning:** The event carries no campaign identifiers — campaign id, name, currency, language — because building them threw. Destinations that group by campaign will file it under nothing.

**Action:** Read the attached error. If `apiKey` is unset, the separate warning `No campaign apiKey configured …` names the fix; otherwise the campaign store had not loaded when the event was built.

#### `Could not access campaign store for currency:`

`analytics/events/EventBuilder.ts:292` · extra context attached

**Meaning:** Currency could not be read and the event fell back to `USD`. Revenue from a non-USD campaign is then reported in the wrong currency, which looks like a change in order value rather than an error.

**Action:** Read the attached error. Verify the currency on the affected events before trusting any revenue figure from the period.

#### `Could not access campaign store for item formatting:`

`analytics/events/EventBuilder.ts:330` · extra context attached

**Meaning:** An item in the event has no image URL because the campaign data could not be read. Everything else about the item is intact.

**Action:** Read the attached error. Cosmetic for most destinations; product feeds that require an image will reject the item.

#### `Could not find package data for packageId: {packageId}`

`analytics/events/EventBuilder.ts:366` · extra context attached

**Meaning:** The event refers to a package that is not in the loaded campaign data, so the item falls back to ids instead of product name, SKU, and variant. The attachment lists the packages that *were* available, which is the fastest way to see what went wrong.

**Action:** Compare the id in the message with the attached list. A package removed from the campaign, or an id from a different campaign, gives this; so does an event fired before the campaign finished loading.

#### `Could not access campaign store for product data:`

`analytics/events/EventBuilder.ts:380` · extra context attached

**Meaning:** Product details for an item could not be read, so the item is reported with ids only — no name, no SKU.

**Action:** Read the attached error. Reports built on product names will show these items as blank or as raw ids.

#### `Could not access campaign store for quantity:`

`analytics/events/EventBuilder.ts:430` · extra context attached

**Meaning:** The units-per-package figure could not be read, so quantity is reported as the number of packages rather than the number of units. A "3-pack" then counts as 1.

**Action:** Read the attached error. Check quantity on the affected events before comparing units sold with the store’s own figures.

#### `Could not access campaign store for price:`

`analytics/events/EventBuilder.ts:501` · extra context attached

**Meaning:** The catalogue price could not be read, so the item’s price field is left at its default. Revenue on the event may be understated.

**Action:** Read the attached error, then check the value of the affected events against the orders they belong to.

#### `Could not access campaign store for retail price:`

`analytics/events/EventBuilder.ts:554` · extra context attached

**Meaning:** The pre-discount retail price could not be read, so the event has no "price before discount". Discount reporting is affected; revenue is not.

**Action:** Read the attached error. Low urgency unless you report on discount depth.

#### `Could not access campaign store:`

`analytics/events/EventBuilder.ts:688` · extra context attached

**Meaning:** Campaign data could not be read while building an item, so it is sent with whatever fields were already resolved.

**Action:** Read the attached error. If it appears in bulk, the campaign store failed to load and the same reason explains most other analytics warnings on the page.

## `[EcommerceEvents]`

Builds the purchase-funnel events — view item, add to cart, begin checkout, purchase, upsell.

Logged from `analytics/events/EcommerceEvents.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Could not access campaign store for upsell data:`

`analytics/events/EcommerceEvents.ts:583` · extra context attached

**Meaning:** An upsell event was built without campaign name or package details because the campaign store could not be read. The event is still sent.

**Action:** Read the attached error. Upsell revenue is still counted; the product name attached to it may be missing.

## `[UserEvents]`

Builds the `dl_user_data` event that identifies the visitor and carries the current cart contents.

Logged from `analytics/events/UserEvents.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Could not add cart contents to user data event:`

`analytics/events/UserEvents.ts:69` · extra context attached

**Meaning:** `dl_user_data` went out without the cart contents. Identity fields are intact; audiences built on "has these products in cart" will not see this visitor.

**Action:** Read the attached error. It usually means the cart store was not ready when the event fired, which is expected very early in a page load.

## `[EventValidator]`

Checks an event against its schema in debug mode, so a missing or mistyped field is caught while you are looking rather than in a report a week later.

Logged from `analytics/validation/EventValidator.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Validation failed for {event}:`

`analytics/validation/EventValidator.ts:108` · extra context attached

**Meaning:** Debug-mode validation rejected an event and the attached list names each problem. The event is still delivered — validation reports, it does not block.

**Action:** Fix the fields in the attachment. Nothing outside debug mode prints this, so make a `?debug=true` pass part of launching a page rather than a reaction to bad data.

## `[AutoEventListener]`

Turns the SDK’s own cart, upsell, and exit-intent events into analytics events, so a page gets tracking without writing any.

Logged from `analytics/tracking/AutoEventListener.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error getting cart data:`

`analytics/tracking/AutoEventListener.ts:799` · extra context attached

**Meaning:** Reading the cart for an event threw, so the event goes out with no cart value and no items — or is skipped, depending on which event needed it.

**Action:** Read the attached error. If it coincides with a purchase, check that order’s value in the destination before trusting revenue reporting for the period.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Package not found for add to cart:`

`analytics/tracking/AutoEventListener.ts:125` · extra context attached

**Meaning:** Something was added to the cart but the matching package is not in the campaign data, so **no** `add_to_cart` event is sent. The cart itself is correct; the funnel loses a step.

**Action:** The id is attached. Check it against the campaign’s packages — markup pointing at a package from another campaign is the usual cause. Add-to-cart counts will be lower than orders until it is fixed.

#### `Package not found for remove from cart:`

`analytics/tracking/AutoEventListener.ts:187` · extra context attached

**Meaning:** An item was removed from the cart but its package could not be found, so no `remove_from_cart` event is sent.

**Action:** The id is attached; check it against the campaign’s packages. Same cause as the add-to-cart version, and the two normally appear together.

#### `Package data not found for swap:`

`analytics/tracking/AutoEventListener.ts:220` · extra context attached

**Meaning:** A package swap happened but one or both packages are missing from the campaign data, so no swap event is sent. The cart still holds the right item.

**Action:** Both ids are attached. Check each against the campaign’s packages; a selector offering a package the campaign no longer contains produces this.

#### `Package not found for upsell view:`

`analytics/tracking/AutoEventListener.ts:329` · extra context attached

**Meaning:** An upsell was shown but its package is not in the campaign data, so no upsell view event is sent. Accept and skip events for the same offer are affected in the same way.

**Action:** The id is attached. Check the upsell markup’s package id against the campaign — an upsell page reused across campaigns is the common cause.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `AutoEventListener initialized` | `analytics/tracking/AutoEventListener.ts:63` | — |
| `Tracked upsell page view:` | `analytics/tracking/AutoEventListener.ts:319` | yes |
| `Tracked upsell view:` | `analytics/tracking/AutoEventListener.ts:344` | yes |
| `Tracked upsell accepted:` | `analytics/tracking/AutoEventListener.ts:414` | yes |
| `Tracked upsell skipped:` | `analytics/tracking/AutoEventListener.ts:438` | yes |
| `Tracked purchase:` | `analytics/tracking/AutoEventListener.ts:599` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Event {eventName} debounced` | `analytics/tracking/AutoEventListener.ts:75` | — |
| `Tracked add to cart:` | `analytics/tracking/AutoEventListener.ts:168` | yes |
| `Tracked remove from cart:` | `analytics/tracking/AutoEventListener.ts:205` | yes |
| `Tracked package swap:` | `analytics/tracking/AutoEventListener.ts:271` | yes |
| `Upsell event already marked for queueing due to redirect` | `analytics/tracking/AutoEventListener.ts:410` | — |
| `Marked purchase event for queueing with _willRedirect = true` | `analytics/tracking/AutoEventListener.ts:596` | — |
| `Tracked exit intent shown:` | `analytics/tracking/AutoEventListener.ts:660` | yes |
| `Tracked exit intent accepted:` | `analytics/tracking/AutoEventListener.ts:678` | yes |
| `Tracked exit intent dismissed:` | `analytics/tracking/AutoEventListener.ts:696` | yes |
| `Tracked exit intent closed:` | `analytics/tracking/AutoEventListener.ts:714` | yes |
| `Tracked exit intent action:` | `analytics/tracking/AutoEventListener.ts:732` | yes |
| `AutoEventListener reset` | `analytics/tracking/AutoEventListener.ts:810` | — |
| `AutoEventListener destroyed` | `analytics/tracking/AutoEventListener.ts:825` | — |
| `Updated debounce config:` | `analytics/tracking/AutoEventListener.ts:848` | yes |

## `[MetaTagController]`

Fires `view_item` / `view_item_list` and scroll-depth events from `<meta>` tags, including reading the package id out of a URL parameter and waiting for a time, an element, or a scroll threshold.

Logged from `analytics/tracking/MetaTagController.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `URL param "{paramName}" not found for view_item event`

`analytics/tracking/MetaTagController.ts:196`

**Meaning:** A meta tag asked for the package id to come from a URL parameter (`content="url:pid"`) and that parameter is not in the URL, so no `view_item` fires.

**Action:** Either link to the page with the parameter (`?pid=42`) or put the id in the meta tag directly. The parameter name in the message is what to look for in the link.

#### `URL param "{paramName}" not found for view_item_list event`

`analytics/tracking/MetaTagController.ts:225`

**Meaning:** Same as above for `view_item_list`: the URL parameter naming the package list is missing, so no list event fires.

**Action:** Add the parameter to the links that lead here, or list the package ids in the meta tag. Ad platforms that strip unknown parameters are worth checking.

#### `Package {packageId} not found for view_item event`

`analytics/tracking/MetaTagController.ts:266`

**Meaning:** The meta tag names a package the campaign does not contain, so no `view_item` fires for it and the page reports no product view.

**Action:** Check the id in the meta tag against the campaign’s packages. It must be the package `ref_id`, not a product or variant id.

#### `Invalid time trigger value: {triggerValue}, firing immediately`

`analytics/tracking/MetaTagController.ts:310`

**Meaning:** A time-based trigger was configured with something that is not a positive number of milliseconds, so the event fired at once instead of after the delay. The event is not lost, only mistimed.

**Action:** Set the trigger to a positive whole number of milliseconds — `time:3000`. Views recorded before the visitor actually looked at the product will inflate view counts.

#### `Element {selector} not found for view_item trigger, firing immediately`

`analytics/tracking/MetaTagController.ts:328`

**Meaning:** The event was meant to wait until an element scrolled into view, but no element matches that selector, so it fired immediately.

**Action:** Check the selector against the page — an element rendered later than the meta tag is read gives this. Until fixed, the "viewed" figure counts page loads, not views.

#### `Unknown trigger type: {triggerType}, firing immediately`

`analytics/tracking/MetaTagController.ts:332`

**Meaning:** The trigger in the meta tag is not one the SDK recognises, so it fired immediately. A typo in the trigger name is the usual reason.

**Action:** Use a supported trigger — `immediate`, `time:{ms}`, or an element selector. The unrecognised value is printed in the message.

#### `Package {packageId} not found for view_item_list event`

`analytics/tracking/MetaTagController.ts:377`

**Meaning:** One package in a `view_item_list` meta tag is not in the campaign data and is left out of the list. The event still fires with the remaining packages, so the list is quietly shorter than intended.

**Action:** Check that id against the campaign’s packages. Item positions in the list shift when one is dropped, so list-position reporting is affected as well as the count.

#### `No valid packages found for view_item_list event`

`analytics/tracking/MetaTagController.ts:382`

**Meaning:** Every package in the meta tag was missing from the campaign data, so no list event fires at all.

**Action:** Check the whole id list against the campaign. This is usually a page reused from another campaign whose ids do not exist here.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Initializing MetaTagController...` | `analytics/tracking/MetaTagController.ts:74` | — |
| `Set list context from meta tags:` | `analytics/tracking/MetaTagController.ts:95` | yes |
| `MetaTagController initialized` | `analytics/tracking/MetaTagController.ts:114` | yes |
| `Parsed view_item from URL param: {paramName}={packageId}` | `analytics/tracking/MetaTagController.ts:200` | — |
| `Parsed view_item from meta tag: packageId={content}, trigger={trigger \|\| 'immediate'}` | `analytics/tracking/MetaTagController.ts:204` | — |
| `Parsed view_item_list from URL param: {paramName}={join(',')}` | `analytics/tracking/MetaTagController.ts:230` | — |
| `Parsed view_item_list from meta tag: {join(',')}` | `analytics/tracking/MetaTagController.ts:235` | — |
| `Fired dl_view_item from meta tag:` | `analytics/tracking/MetaTagController.ts:287` | yes |
| `Fired dl_view_item_list from meta tag:` | `analytics/tracking/MetaTagController.ts:395` | yes |
| `Setting up scroll tracking for thresholds:` | `analytics/tracking/MetaTagController.ts:445` | yes |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `MetaTagController already initialized` | `analytics/tracking/MetaTagController.ts:70` | — |
| `Parsed meta tag config:` | `analytics/tracking/MetaTagController.ts:86` | yes |
| `Event {eventName} blocked by enable-only whitelist` | `analytics/tracking/MetaTagController.ts:130` | — |
| `Event {eventName} blocked by disable list` | `analytics/tracking/MetaTagController.ts:138` | — |
| `Campaign data not yet loaded, deferring view_item event` | `analytics/tracking/MetaTagController.ts:247` | — |
| `view_item already fired from meta tag, skipping` | `analytics/tracking/MetaTagController.ts:272` | — |
| `Scheduling view_item to fire after {duration}ms` | `analytics/tracking/MetaTagController.ts:307` | — |
| `Setting up IntersectionObserver for view_item trigger: {selector}` | `analytics/tracking/MetaTagController.ts:319` | — |
| `Campaign data not yet loaded, deferring view_item_list event` | `analytics/tracking/MetaTagController.ts:345` | — |
| `view_item_list already fired from meta tag, skipping` | `analytics/tracking/MetaTagController.ts:356` | — |
| `Fired dl_scroll_depth at {threshold}%` | `analytics/tracking/MetaTagController.ts:466` | — |
| `All scroll thresholds reached, removing listener` | `analytics/tracking/MetaTagController.ts:473` | — |
| `MetaTagController reset` | `analytics/tracking/MetaTagController.ts:497` | — |

## `[PendingEventsHandler]`

Holds events that were raised as the page was navigating away, and replays them on the next page so a redirect does not lose a purchase.

Logged from `analytics/tracking/PendingEventsHandler.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to queue event:`

`analytics/tracking/PendingEventsHandler.ts:50` · extra context attached

**Meaning:** An event raised while the page was navigating away could not be stored, so it will not be replayed on the next page — it is lost. A purchase event on a redirect is the case that matters.

**Action:** Read the attached error; a blocked or full sessionStorage is the cause. Compare purchase events with orders for the period, because this loses events silently.

#### `Failed to get pending events:`

`analytics/tracking/PendingEventsHandler.ts:65` · extra context attached

**Meaning:** The queue of events held for after a redirect could not be read, so nothing is replayed on this page. Anything queued before is lost.

**Action:** Read the attached error. If the stored value is corrupt it keeps failing; clearing the SDK’s sessionStorage keys resets it.

#### `Failed to process pending event:`

`analytics/tracking/PendingEventsHandler.ts:114` · extra context attached

**Meaning:** Replaying one queued event threw. That event is dropped; the rest of the queue is still processed.

**Action:** Read the attached error and the event name beside it. A queued shape from an older SDK version can fail against newer validation.

#### `Failed to clear pending events:`

`analytics/tracking/PendingEventsHandler.ts:144` · extra context attached

**Meaning:** The queue could not be emptied, so events already replayed may be replayed again — duplicate events in the destination.

**Action:** Read the attached error. If purchase events are duplicated in reports, this line is the reason to look at first.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Skipping queued dl_user_data - current page should fire its own`

`analytics/tracking/PendingEventsHandler.ts:88`

**Meaning:** A queued `dl_user_data` was dropped on purpose: every page fires its own, and replaying an old one would report stale details. Expected behaviour, not a problem.

**Action:** Nothing. Confirm the page’s own `dl_user_data` appears — `UserDataTracker initialized - dl_user_data fired first` is that confirmation.

#### `Skipping stale event:`

`analytics/tracking/PendingEventsHandler.ts:103` · extra context attached

**Meaning:** A queued event was more than five minutes old and was discarded rather than replayed. It normally means the visitor left the tab and came back much later.

**Action:** Nothing in isolation. In bulk it means events are being queued and never replayed promptly — check whether the redirect they were queued for is happening at all.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Event queued for after redirect: {event} ({length} total queued)` | `analytics/tracking/PendingEventsHandler.ts:48` | — |
| `Processing {length} pending analytics events` | `analytics/tracking/PendingEventsHandler.ts:82` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `No pending analytics events to process` | `analytics/tracking/PendingEventsHandler.ts:78` | — |
| `Processed pending event:` | `analytics/tracking/PendingEventsHandler.ts:112` | yes |
| `Removed processed events:` | `analytics/tracking/PendingEventsHandler.ts:132` | yes |
| `Cleared all pending events` | `analytics/tracking/PendingEventsHandler.ts:142` | — |
| `PendingEventsHandler reset` | `analytics/tracking/PendingEventsHandler.ts:153` | — |
| `PendingEventsHandler initialized` | `analytics/tracking/PendingEventsHandler.ts:161` | — |

## `[UserDataTracker]`

Fires `dl_user_data` first on every page and again when the visitor is identified or the route changes.

Logged from `analytics/tracking/UserDataTracker.ts`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `UserDataTracker initialized - dl_user_data fired first` | `analytics/tracking/UserDataTracker.ts:69` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `User data tracking listeners set up after initial tracking` | `analytics/tracking/UserDataTracker.ts:66` | — |
| `trackUserData called after initial:` | `analytics/tracking/UserDataTracker.ts:81` | yes |
| `User data tracking debounced` | `analytics/tracking/UserDataTracker.ts:89` | — |
| `No user data to track` | `analytics/tracking/UserDataTracker.ts:97` | — |
| `Tracked user data:` | `analytics/tracking/UserDataTracker.ts:121` | yes |
| `Cart store not available or error accessing:` | `analytics/tracking/UserDataTracker.ts:155` | yes |
| `Error getting checkout data:` | `analytics/tracking/UserDataTracker.ts:165` | yes |
| `Route changed, tracking user data` | `analytics/tracking/UserDataTracker.ts:210` | — |
| `SDK route invalidated, tracking user data` | `analytics/tracking/UserDataTracker.ts:216` | — |
| `User logged in, tracking user data` | `analytics/tracking/UserDataTracker.ts:222` | — |
| `User logged out, tracking user data` | `analytics/tracking/UserDataTracker.ts:227` | — |
| `Browser navigation, tracking user data` | `analytics/tracking/UserDataTracker.ts:242` | — |
| `pushState changed path, tracking user data` | `analytics/tracking/UserDataTracker.ts:262` | — |
| `replaceState called, not tracking user data (query param update)` | `analytics/tracking/UserDataTracker.ts:272` | — |
| `User data tracking listeners set up` | `analytics/tracking/UserDataTracker.ts:276` | — |
| `UserDataTracker reset` | `analytics/tracking/UserDataTracker.ts:293` | — |
| `UserDataTracker destroyed` | `analytics/tracking/UserDataTracker.ts:311` | — |

## `[ViewItemListTracker]`

Detects the products present on a page and fires `view_item` / `view_item_list` for them without any meta tags.

Logged from `analytics/tracking/ViewItemListTracker.ts`.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Package not found in store:`

`analytics/tracking/ViewItemListTracker.ts:250` · extra context attached

**Meaning:** A product element on the page names a package that is not in the campaign data, so it is left out of automatic `view_item` / `view_item_list` tracking.

**Action:** The id is attached. Check the `data-next-package-id` on that element against the campaign’s packages; a leftover card from another campaign is the usual cause.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `ViewItemListTracker initialized` | `analytics/tracking/ViewItemListTracker.ts:60` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Scan debounced (too soon after last scan)` | `analytics/tracking/ViewItemListTracker.ts:69` | — |
| `Both view_item and view_item_list handled by meta tags, skipping auto-detection` | `analytics/tracking/ViewItemListTracker.ts:79` | — |
| `No products found on page` | `analytics/tracking/ViewItemListTracker.ts:86` | — |
| `Found {length} products on page` | `analytics/tracking/ViewItemListTracker.ts:90` | — |
| `view_item handled by meta tag, skipping auto-detection` | `analytics/tracking/ViewItemListTracker.ts:95` | — |
| `view_item_list handled by meta tag, skipping auto-detection` | `analytics/tracking/ViewItemListTracker.ts:105` | — |
| `Manual rescan triggered` | `analytics/tracking/ViewItemListTracker.ts:122` | — |
| `Found {length} products in selectors` | `analytics/tracking/ViewItemListTracker.ts:178` | — |
| `Campaign data not yet loaded, deferring tracking` | `analytics/tracking/ViewItemListTracker.ts:241` | — |
| `Tracked view_item for selected package:` | `analytics/tracking/ViewItemListTracker.ts:265` | yes |
| `Product already tracked:` | `analytics/tracking/ViewItemListTracker.ts:273` | yes |
| `Tracked view_item:` | `analytics/tracking/ViewItemListTracker.ts:307` | yes |
| `No new products to track` | `analytics/tracking/ViewItemListTracker.ts:359` | — |
| `Tracked view_item_list with {length} items` | `analytics/tracking/ViewItemListTracker.ts:367` | — |
| `Detected DOM changes with products` | `analytics/tracking/ViewItemListTracker.ts:427` | — |
| `Mutation observer set up` | `analytics/tracking/ViewItemListTracker.ts:440` | — |
| `ViewItemListTracker reset` | `analytics/tracking/ViewItemListTracker.ts:448` | — |
| `ViewItemListTracker destroyed` | `analytics/tracking/ViewItemListTracker.ts:465` | — |

## `[ListAttributionTracker]`

Remembers which list a product was clicked from so the next page’s events can say where the visitor came from within the site.

Logged from `analytics/tracking/ListAttributionTracker.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error loading list context from storage:`

`analytics/tracking/ListAttributionTracker.ts:282` · extra context attached

**Meaning:** The record of which list a product was clicked from could not be read, so events on this page cannot say where within the site the visitor came from. Nothing else is affected.

**Action:** Read the attached error. A corrupt stored value keeps failing on every page until it is cleared; storage being blocked cannot be fixed from the page, and list attribution is then unavailable for the whole session.

#### `Error saving list context to storage:`

`analytics/tracking/ListAttributionTracker.ts:297` · extra context attached

**Meaning:** The list a product was clicked from could not be stored, so the next page will not know it and its events lose the list name and position.

**Action:** Read the attached error — storage full or blocked is the usual cause. Expect gaps in "which list drove the sale" reporting while it lasts.

#### `Error removing list context from storage:`

`analytics/tracking/ListAttributionTracker.ts:312` · extra context attached

**Meaning:** An expired list record could not be deleted, so a stale list name may be attached to events it does not belong to — wrong attribution rather than missing attribution.

**Action:** Read the attached error, then clear the SDK’s sessionStorage keys if you are checking list attribution, so you are not reading a leftover value.

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `ListAttributionTracker initialized` | `analytics/tracking/ListAttributionTracker.ts:41` | — |
| `Set current list:` | `analytics/tracking/ListAttributionTracker.ts:58` | yes |
| `List context expired` | `analytics/tracking/ListAttributionTracker.ts:71` | — |
| `Cleared current list` | `analytics/tracking/ListAttributionTracker.ts:88` | — |
| `ListAttributionTracker reset` | `analytics/tracking/ListAttributionTracker.ts:96` | — |
| `Detected list from URL:` | `analytics/tracking/ListAttributionTracker.ts:134` | yes |
| `Loaded list context from storage:` | `analytics/tracking/ListAttributionTracker.ts:276` | yes |

## `[{ProviderName}]`

The delivery contract every provider shares: the enabled and blocked-event gate, and reporting each event as sent, skipped, or failed.

Logged from `analytics/providers/ProviderAdapter.ts`. The shared adapter base logs under the provider’s own name, so these lines appear as `[GTM]`, `[Facebook]`, `[RudderStack]`, `[NextCampaign]`, or `[Custom]` depending on which provider was delivering the event.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to send event "{event}"`

`analytics/providers/ProviderAdapter.ts:194` · extra context attached

**Meaning:** A provider threw something the delivery layer did not expect, so this event is lost for that provider. Unlike `Event "{event}" not delivered:`, this is not a known delivery outcome — it points at a fault in the adapter or the vendor script.

**Action:** Read the attached error. The provider is identified by the log prefix; that adapter’s own errors are in [errors.md](./errors.md).

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Event "{event}" not delivered: {message}`

`analytics/providers/ProviderAdapter.ts:192`

**Meaning:** One provider could not deliver one event, for a reason it expected — its script never loaded, or the vendor call threw. The reason is in the message. Other providers are unaffected, and the visitor sees nothing. The provider name is the log prefix.

**Action:** Read the reason after the colon: a "load timeout" means the vendor snippet is missing from the page, and the individual adapters warn once with the exact fix. The payload that would have been sent is in the debug overlay’s Provider Delivery panel (`?debug=true`).

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Event "{event}" is blocked for {name}` | `analytics/providers/ProviderAdapter.ts:152` | — |

## `[Facebook]`

Delivers events to the Meta Pixel (`fbq`).

Logged from `analytics/providers/FacebookAdapter.ts`. Set by the name the adapter passes to the shared base — `super('Facebook')`.

Rows marked *message assembled in code* are built from several string literals joined together, so searching the source for the whole sentence finds nothing — search for the first few words instead. The location given is where the message text begins, which is a line or two after the `logger.*` call itself.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Meta Pixel (fbq) not found — add the Meta Pixel base code to the page so events can be delivered. See https://www.facebook.com/business/help/952192354843755`

`analytics/providers/FacebookAdapter.ts:83` · message assembled in code

**Meaning:** The Facebook provider is running but `fbq` is not on the page, so nothing can be delivered to Meta. Printed once per page load, not once per event.

**Action:** Add the Meta Pixel base code above the SDK loader. If it is already there, an ad blocker removed it — verify in a clean browser profile before changing the page.

## `[NextCampaign]`

Loads the NextCampaign script with the campaign API key and sends it the page view.

Logged from `analytics/providers/NextCampaignAdapter.ts`. Set by the name the adapter passes to the shared base — `super('NextCampaign')`.

Rows marked *message assembled in code* are built from several string literals joined together, so searching the source for the whole sentence finds nothing — search for the first few words instead. The location given is where the message text begins, which is a line or two after the `logger.*` call itself.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to load NextCampaign SDK:`

`analytics/providers/NextCampaignAdapter.ts:157` · extra context attached

**Meaning:** The NextCampaign script did not load, so no events reach it. The error is re-thrown, which surfaces as a failed provider initialization in the analytics log above.

**Action:** Read the attached error and check that `campaigns.apps.29next.com` is reachable and not blocked by an extension.

#### `Error sending initial page view to NextCampaign:`

`analytics/providers/NextCampaignAdapter.ts:238` · extra context attached

**Meaning:** The script loaded but the first `page_view` threw, so that page view is missing from NextCampaign reporting. Later events are still attempted.

**Action:** Read the attached error — it comes from the NextCampaign script rather than from this SDK.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `No API key available for NextCampaign initialization`

`analytics/providers/NextCampaignAdapter.ts:63`

**Meaning:** The NextCampaign provider is enabled but has no API key, so it stops before loading its script. Nothing is sent to it; the rest of analytics is unaffected.

**Action:** Set the campaign API key with `<meta name="next-api-key" content="…">` or `window.nextConfig.apiKey` before the loader. The adapter logs `API key from config store: found` once it can see one.

#### `NextCampaign SDK failed to load — check that a valid apiKey is set and that campaigns.apps.29next.com is reachable.`

`analytics/providers/NextCampaignAdapter.ts:38` · message assembled in code

**Meaning:** The NextCampaign script never became available, so its events cannot be delivered. Printed once per page load.

**Action:** Confirm the campaign API key is set and that `campaigns.apps.29next.com` is reachable from the visitor’s network.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `NextCampaign adapter initializing...` | `analytics/providers/NextCampaignAdapter.ts:47` | — |
| `API key provided via config parameter` | `analytics/providers/NextCampaignAdapter.ts:52` | — |
| `API key from config store: {apiKey ? 'found' : 'not found'}` | `analytics/providers/NextCampaignAdapter.ts:57` | — |
| `NextCampaign API key found: {substring(0, 8)}...{length - 4)}` | `analytics/providers/NextCampaignAdapter.ts:67` | — |
| `NextCampaign SDK loaded and initialized successfully ✅` | `analytics/providers/NextCampaignAdapter.ts:153` | — |
| `Initial page_view event sent to NextCampaign` | `analytics/providers/NextCampaignAdapter.ts:235` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `NextCampaign script loaded` | `analytics/providers/NextCampaignAdapter.ts:185` | — |
| `NextCampaign configured with API key` | `analytics/providers/NextCampaignAdapter.ts:202` | — |

## `[RudderStack]`

Translates events into RudderStack’s track / page / identify calls.

Logged from `analytics/providers/RudderStackAdapter.ts`.

Rows marked *message assembled in code* are built from several string literals joined together, so searching the source for the whole sentence finds nothing — search for the first few words instead. The location given is where the message text begins, which is a line or two after the `logger.*` call itself.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `rudderanalytics not found — add the RudderStack JavaScript SDK snippet to the page so events can be delivered. See https://www.rudderstack.com/docs/sources/event-streams/sdks/rudderstack-javascript-sdk/`

`analytics/providers/RudderStackAdapter.ts:58` · message assembled in code

**Meaning:** The RudderStack provider is running but its SDK is not on the page, so nothing is delivered. Printed once per page load.

**Action:** Add the RudderStack JavaScript SDK snippet above the SDK loader, then reload and check for `Processing event "…"` lines.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Processing event "{event}"` | `analytics/providers/RudderStackAdapter.ts:128` | yes |

## `[Custom]`

Posts batches of events to an endpoint you configure, with a retry queue for the ones that fail.

Logged from `analytics/providers/CustomAdapter.ts`. Set by the name the adapter passes to the shared base — `super('Custom')`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Error sending batch to custom endpoint:`

`analytics/providers/CustomAdapter.ts:160` · extra context attached

**Meaning:** A batch of events was rejected or the request failed. Every event in the batch goes onto the retry queue, so this alone does not mean they are lost.

**Action:** Read the attached error and check the endpoint. `HTTP {status}: {statusText}` in the attachment is the endpoint’s own answer.

#### `Failed to send event after {maxRetries} attempts:`

`analytics/providers/CustomAdapter.ts:217` · extra context attached

**Meaning:** The retries for one event are exhausted and it is dropped. This is the point at which data is actually lost, unlike the batch error above.

**Action:** Read the attached event and fix the endpoint before comparing its numbers with anything else. The count in the message is the configured `maxRetries`.

## `[DebugModule]`

Loads the debug overlay on demand when debug mode is on, so none of it is in the bundle a normal visitor downloads.

Logged from `debug/DebugModule.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to load debug overlay module:`

`debug/DebugModule.ts:66` · extra context attached

**Meaning:** The debug overlay code could not be fetched, so no overlay appears even though debug mode is on. The SDK itself keeps working.

**Action:** Read the attached error. The overlay is loaded on demand, so this is a network or deployment problem — check that the version the loader asked for is published.

#### `Failed to initialize debug mode:`

`debug/DebugModule.ts:89` · extra context attached

**Meaning:** Debug mode did not start: no overlay, and none of the `window` debug helpers. Log level is still raised, so debug lines continue to print.

**Action:** Read the attached error. Investigate with the console alone until it is fixed — the log output is unaffected.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Loading debug overlay module...` | `debug/DebugModule.ts:48` | — |
| `Debug overlay module loaded successfully ✅` | `debug/DebugModule.ts:61` | — |

## `[DebugOverlay]`

The on-page debug panel itself — state inspectors, the event pipeline, and the country / currency / locale switchers.

Logged from `debug/DebugOverlay.ts`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Debug overlay initialized` | `debug/DebugOverlay.ts:158` | — |
| `Selector container initialized` | `debug/DebugOverlay.ts:162` | — |
| `Upsell selector initialized` | `debug/DebugOverlay.ts:166` | — |

## `[CountrySelector]`

The debug overlay’s country switcher, for checking an address form and shipping options as a visitor in another country.

Logged from `debug/CountrySelector.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to load countries:`

`debug/CountrySelector.ts:56` · extra context attached

**Meaning:** The debug overlay’s country switcher has no countries to offer and hides itself. Only the debug tool is affected — the page’s own address form is separate.

**Action:** Read the attached error; it is the same country-list fetch that `CountryService` logs about. Fix that and the switcher returns.

#### `Failed to change country:`

`debug/CountrySelector.ts:434` · extra context attached

**Meaning:** Switching country from the debug overlay failed and the overlay shows its error state. The page may be left part-way: currency updated, country not, or the reverse.

**Action:** Read the attached error and reload before continuing to test, so you are not looking at a half-applied state. Debug-only.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Country change already in progress`

`debug/CountrySelector.ts:304`

**Meaning:** A second country was picked in the debug overlay while the first change was still applying; the second was ignored. Expected when clicking quickly.

**Action:** Wait for the first change to finish, then pick again. Debug-only.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Country selector initialized` | `debug/CountrySelector.ts:46` | — |
| `Changing country to {newCountry}` | `debug/CountrySelector.ts:346` | — |
| `Cleared selected country override, using detected country` | `debug/CountrySelector.ts:358` | — |
| `Saved selected country to session: {newCountry}` | `debug/CountrySelector.ts:362` | — |
| `Country currency is {currencyCode}, updating...` | `debug/CountrySelector.ts:383` | — |
| `Country changed successfully to {newCountry}` | `debug/CountrySelector.ts:413` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Loaded {length} countries` | `debug/CountrySelector.ts:54` | — |
| `No countries available, hiding country selector` | `debug/CountrySelector.ts:102` | — |
| `Country select changed to: {newCountry}` | `debug/CountrySelector.ts:308` | — |
| `Resetting to detected country:` | `debug/CountrySelector.ts:321` | yes |
| `External country change detected, re-rendering selector` | `debug/CountrySelector.ts:328` | — |
| `Event listeners attached to country selector` | `debug/CountrySelector.ts:333` | — |

## `[CurrencySelector]`

The debug overlay’s currency switcher, for checking prices in every currency the campaign offers.

Logged from `debug/CurrencySelector.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to change currency:`

`debug/CurrencySelector.ts:398` · extra context attached

**Meaning:** Switching currency from the debug overlay failed. Prices on the page may still be in the previous currency while the selector shows the new one.

**Action:** Read the attached error and reload, then check whether the campaign actually offers that currency — `currency:fallback` is emitted when it does not. Debug-only.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Currency change already in progress`

`debug/CurrencySelector.ts:311`

**Meaning:** A second currency was picked while the first change was still applying, and was ignored.

**Action:** Wait for the first change to finish. Debug-only.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Currency selector initialized` | `debug/CurrencySelector.ts:41` | — |
| `Changing currency to {newCurrency}` | `debug/CurrencySelector.ts:350` | — |
| `Saved currency preference to session: {newCurrency}` | `debug/CurrencySelector.ts:368` | — |
| `Currency changed successfully to {newCurrency}` | `debug/CurrencySelector.ts:380` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Campaign currency changed or data loaded, re-rendering currency selector` | `debug/CurrencySelector.ts:57` | — |
| `No campaign data available yet, skipping currency selector render` | `debug/CurrencySelector.ts:124` | — |
| `Only one currency available, hiding currency selector` | `debug/CurrencySelector.ts:132` | — |
| `Currency select changed to: {newCurrency}` | `debug/CurrencySelector.ts:315` | — |
| `External currency change detected, re-rendering selector` | `debug/CurrencySelector.ts:331` | — |
| `Event listeners attached to currency selector` | `debug/CurrencySelector.ts:337` | — |

## `[LocaleSelector]`

The debug overlay’s locale switcher, for checking how prices and dates are formatted.

Logged from `debug/LocaleSelector.ts`.

### Error

Something did not work. Each of these means a visitor saw the wrong thing, or a piece of data went missing. Every one carries what it means and what to do.

#### `Failed to change locale:`

`debug/LocaleSelector.ts:390` · extra context attached

**Meaning:** Switching locale from the debug overlay failed, so number and date formatting stays as it was.

**Action:** Read the attached error. An unsupported locale string is the usual cause. Debug-only.

### Warn

The SDK carried on, but something in the markup, the configuration, or the campaign data was not what it expected. Worth fixing even when the page looks right — several of these are how tracking goes quietly wrong.

#### `Locale change already in progress`

`debug/LocaleSelector.ts:297`

**Meaning:** A second locale was picked while the first change was still applying, and was ignored.

**Action:** Wait for the first change to finish. Debug-only.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `Locale selector initialized` | `debug/LocaleSelector.ts:55` | — |
| `Changing locale to {newLocale}` | `debug/LocaleSelector.ts:338` | — |
| `Cleared selected locale override, using browser locale` | `debug/LocaleSelector.ts:345` | — |
| `Saved selected locale to session: {newLocale}` | `debug/LocaleSelector.ts:349` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Locale select changed to: {newLocale}` | `debug/LocaleSelector.ts:301` | — |
| `Resetting to browser locale:` | `debug/LocaleSelector.ts:313` | yes |
| `External locale change detected, re-rendering selector` | `debug/LocaleSelector.ts:320` | — |
| `Event listeners attached to locale selector` | `debug/LocaleSelector.ts:325` | — |
| `Refreshed {length} potential currency displays` | `debug/LocaleSelector.ts:438` | — |

## `[UpsellSelector]`

The debug overlay’s post-purchase upsell inspector: what the page offers and what is currently selected.

Logged from `debug/UpsellSelector.ts`.

### Info

Normal progress. Read these as the play-by-play of what the SDK decided: which country it detected, which currency it chose, what it loaded.

| Message | Source | Extra context |
|---|---|---|
| `UpsellSelector initialized` | `debug/UpsellSelector.ts:53` | — |

### Debug

The detail behind the info lines. Expected in bulk, and only visible with debug mode on — a long list here is health, not trouble.

| Message | Source | Extra context |
|---|---|---|
| `Not an upsell page, skipping initialization` | `debug/UpsellSelector.ts:43` | — |
| `Scanning for existing upsell elements:` | `debug/UpsellSelector.ts:84` | yes |
| `No upsell elements found` | `debug/UpsellSelector.ts:87` | — |
| `Initialized state from bundle selector:` | `debug/UpsellSelector.ts:103` | yes |
| `Found selected option:` | `debug/UpsellSelector.ts:118` | yes |
| `Found first available option:` | `debug/UpsellSelector.ts:127` | yes |
| `Found nested selector:` | `debug/UpsellSelector.ts:137` | yes |
| `Initialized state from existing upsell element:` | `debug/UpsellSelector.ts:150` | yes |
| `Upsell initialized:` | `debug/UpsellSelector.ts:166` | yes |
| `Bundle selection changed:` | `debug/UpsellSelector.ts:196` | yes |
| `Upsell option selected:` | `debug/UpsellSelector.ts:204` | yes |
| `Upsell quantity changed:` | `debug/UpsellSelector.ts:218` | yes |

## Lines that bypass the logger

12 messages in `src/core` are printed with a bare `console.error` or `console.warn` instead of through `Logger`. They behave differently from everything above, and the difference matters when you are reading a console:

- **No `[Prefix]`**, unless the message writes one out by hand — which the attribution collector does and the event bus does not. An unprefixed error line from the SDK is one of these.
- **Not gated by debug mode or the log level.** On the module bundle they print for every visitor. On the UMD bundle they are stripped like everything else.
- **`Logger.setLogLevel()` cannot silence them.**

They come from `attribution/attribution-collector.ts`, `events.ts`, `storage.ts`, `sdk-initializer.ts`. The debug tooling under `core/debug/` also writes to the console directly; that output is the tool talking to whoever opened it, so it is not listed here.

### `[AttributionCollector] Error storing {key} in sessionStorage:`

`attribution/attribution-collector.ts:115` · `console.error` · extra context attached

**Meaning:** An attribution value arrived in the URL but could not be saved for the rest of the session, so the next page will not have it and the order may be attributed to nothing. The value named is the URL parameter.

**Action:** Read the attached error — sessionStorage blocked or full is the cause. On paid traffic, check whether orders from this session carry their UTM tags before spending more on the campaign.

### `[AttributionCollector] Error reading {key} from sessionStorage:`

`attribution/attribution-collector.ts:128` · `console.error` · extra context attached

**Meaning:** A stored attribution value could not be read back. The collector falls through to localStorage and then to the persisted attribution copy, so the value may still be found — this line alone does not mean it was lost.

**Action:** Read the attached error. Confirm the final result with `next.getAttribution()` rather than assuming from this line.

### `[AttributionCollector] Error reading {key} from localStorage:`

`attribution/attribution-collector.ts:138` · `console.error` · extra context attached

**Meaning:** The localStorage fallback for one attribution value failed. One more fallback remains (the persisted attribution record), after which the value is empty.

**Action:** Read the attached error. Check `next.getAttribution()` for the field named to see whether anything was recovered.

### `[AttributionCollector] Error reading persisted attribution:`

`attribution/attribution-collector.ts:151` · `console.error` · extra context attached

**Meaning:** The stored `next-attribution` record could not be read or parsed, so the last fallback for every attribution value is unavailable. Values not in the current URL are lost.

**Action:** Read the attached error. If the record is corrupt it keeps failing on every page; clearing `next-attribution` from storage resets it, at the cost of the visitor’s earlier attribution.

### `[AttributionCollector] Error persisting funnel from URL:`

`attribution/attribution-collector.ts:205` · `console.error` · extra context attached

**Meaning:** A funnel name taken from the URL could not be saved, so later pages in the funnel will fall back to their own meta tag or to no funnel at all. Funnel reporting splits one journey into several.

**Action:** Read the attached error. Until it is fixed, set the funnel name with a meta tag on every page rather than relying on it carrying over from the URL.

### `[AttributionCollector] Error reading persisted funnel:`

`attribution/attribution-collector.ts:242` · `console.error` · extra context attached

**Meaning:** The saved funnel name could not be read, so this page uses whatever its own configuration says — which on an upsell or receipt page is often nothing.

**Action:** Read the attached error, then check the funnel on the resulting order. `next.debugAttribution()` prints what the SDK resolved.

### `[AttributionCollector] Error persisting funnel name:`

`attribution/attribution-collector.ts:263` · `console.error` · extra context attached

**Meaning:** A funnel name read from a meta tag could not be saved for later pages. Same effect as the URL version: the funnel does not follow the visitor.

**Action:** Read the attached error. Put the funnel meta tag on every page of the funnel so each one can resolve it without storage.

### `[AttributionCollector] Error persisting tag {tagName}:`

`attribution/attribution-collector.ts:329` · `console.error` · extra context attached

**Meaning:** One tracking tag from a `<meta>` tag could not be saved, so it will be missing from later pages and from the order. The tag named is the one lost.

**Action:** Read the attached error. Repeat the tag’s meta tag on the pages that need it rather than depending on it persisting.

### `[AttributionCollector] Error reading first visit timestamp:`

`attribution/attribution-collector.ts:383` · `console.error` · extra context attached

**Meaning:** The first-visit timestamp could not be read, so this visit is treated as a first visit. Anything that distinguishes new from returning visitors will say "new".

**Action:** Read the attached error. Do not build returning-visitor logic on this field while it is failing — write your own marker instead.

### `Event handler error for {event}:`

`events.ts:37` · `console.error` · extra context attached

**Meaning:** A subscriber to an SDK event threw. The event bus catches it and continues with the other subscribers, so one broken handler cannot stop the rest. The line has **no** `[Prefix]`, because it is written with a bare `console.error` — that absence is how you recognise it.

**Action:** Read the attached error and the event name. Your own `next.on(...)` handlers arrive here too, so check the stack before assuming the SDK is at fault. Wrap risky handler bodies in their own try/catch so a failure is reported where you can see it.

### `Failed to estimate storage quota:`

`storage.ts:191` · `console.warn` · extra context attached

**Meaning:** The browser would not report how much storage is available. Nothing depends on the answer — it is used for diagnostics — so this affects no behaviour.

**Action:** Nothing. Some browsers do not implement the estimate at all, and the SDK works either way.

### `❌ Failed to set shipping method {methodId}:`

`sdk-initializer.ts:883` · `console.error` · extra context attached

**Meaning:** The `testShippingMethod()` debug helper could not apply a shipping method. It only appears when someone calls that helper from the console, never on its own.

**Action:** Read the attached error and check the method id against the campaign’s `shipping_methods`. Debug-only; a visitor never triggers it.
