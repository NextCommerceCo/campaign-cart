import type { CoreLogNote } from './core-logs.types';

/**
 * Hand-written Meaning and Action for every `error` and `warn` the extractor can read
 * out of `src/core`. See {@link CoreLogNote} for the shape, and `core-logs.ts` for why
 * `info`/`debug` are not here.
 */
export const CORE_LOG_NOTES: CoreLogNote[] = [
  // ── sdk-initializer.ts (+ sdk-initializer.url-params.ts, whose messages are
  //    interspersed below at the points where `loadConfiguration` and
  //    `loadCampaignData` call into it) ───────────────────────────────────────
  {
    level: 'warn',
    message: 'SDK already initialized',
    meaning:
      'Something called `initialize()` a second time and the call was ignored. Usually the loader script is on the page twice, or a page builder duplicated it into a template.',
    action:
      'Harmless in itself — the second call does nothing. Remove the duplicate loader anyway: two loaders can disagree about which SDK version to fetch, and that difference is much harder to diagnose than this line.',
  },
  {
    level: 'error',
    message: 'SDK initialization failed:',
    meaning:
      'Boot threw before it finished. Nothing on the page is enhanced yet: prices show their placeholders and buttons do nothing. The attached error says which step failed.',
    action:
      'Read the attached error first. A missing API key is the most common cause and says so plainly. Boot retries up to three times (`Retrying initialization …`); if all attempts fail the page stays un-enhanced, so fix the cause rather than reloading.',
  },
  {
    level: 'warn',
    message:
      'Retrying initialization (attempt {retryAttempts}/{maxRetries})...',
    meaning:
      'Boot failed and is trying again after a pause. Expected to be followed either by `SDK initialization complete ✅` or by another `SDK initialization failed:`.',
    action:
      'Nothing while the retries are running. If you see the third attempt, treat the page as broken for that visitor and fix the error logged above it — retrying a missing API key never succeeds.',
  },
  {
    level: 'warn',
    message: 'Failed to capture URL parameters:',
    meaning:
      'Reading the current URL’s parameters threw, so `forcePackageId`, currency overrides, and visibility parameters are not applied on this page. Boot continues.',
    action:
      'Check the attached error. A malformed URL or a blocked `sessionStorage` are the realistic causes; the page still works, but any behaviour driven by a URL parameter is silently off.',
  },
  {
    level: 'warn',
    message:
      'Failed to fetch country config for {forcedCountry}, falling back to detection',
    meaning:
      'A country was forced — by `?country=` or a previous choice saved in the session — but the API returned no configuration for it, so normal detection is used instead. The visitor may see a different country than the one that was forced.',
    action:
      'Check that the forced code is a two-letter code the campaign ships to; the shipping list is logged at boot as `Campaign shipping countries set globally:`. Clear `next_selected_country` from sessionStorage to stop a stale saved choice from repeating this.',
  },
  {
    level: 'error',
    message: 'Error fetching country config:',
    meaning:
      'The request for the forced country’s configuration threw rather than returning a bad answer. Detection is used instead, so the address form and currency may not match the forced country.',
    action:
      'Read the attached error. It is normally a network failure and clears on reload, since the result is cached once a request succeeds.',
  },
  {
    level: 'warn',
    message: 'Location detection failed or timed out, using defaults:',
    meaning:
      'Location detection did not answer within three seconds, so boot continued with the built-in defaults — the United States and the campaign’s default currency. Prices are still correct for that default, not for the visitor’s real country.',
    action:
      'Expected occasionally on slow connections. If it is constant, check that the campaigns host is reachable and not blocked by an extension, because every visitor is then being treated as US.',
  },
  {
    level: 'warn',
    message: 'Failed to fetch countries list:',
    meaning:
      'The country a visitor is in was resolved, but the list of *all* countries was not, so the country dropdown in the address form has nothing to offer.',
    action:
      'Check the attached error. Until it succeeds a visitor cannot change country at checkout; a reload usually fixes it, as the list is cached once fetched.',
  },
  {
    level: 'warn',
    message: 'Failed to initialize location/currency, using defaults:',
    meaning:
      'The whole location-and-currency step threw. Boot continues with defaults and with any currency the visitor had already chosen this session.',
    action:
      'Read the attached error. Prices are being shown in the default currency, so treat this as a revenue-visible problem rather than a cosmetic one.',
  },
  {
    level: 'warn',
    message: 'Package {packageId} not found in campaign data, skipping',
    meaning:
      'A `forcePackageId` entry names a package the campaign does not contain, so that entry is skipped. Other valid entries in the same parameter are still added.',
    action:
      'Check the id against the campaign’s packages — it must be the package `ref_id`, not a product or variant id. A link built for a different campaign is the usual cause.',
  },
  {
    level: 'error',
    message: 'Error processing forcePackageId parameter:',
    meaning:
      'The `forcePackageId` parameter could not be applied, so the cart is not pre-filled. Boot deliberately continues — a bad link should not take the page down.',
    action:
      'Read the attached error: `Invalid package ID` and `Invalid quantity` name the offending value. The parameter format is `id` or `id:quantity`, comma-separated.',
  },
  {
    level: 'warn',
    message: 'No shipping methods available in campaign data',
    meaning:
      '`forceShippingId` was asked for, but the campaign came back with no shipping methods at all, so nothing could be selected.',
    action:
      'Check the campaign has shipping methods configured. Every visitor on this campaign will reach checkout with no shipping option, not only the ones using the parameter.',
  },
  {
    level: 'warn',
    message: 'Shipping method {shippingId} not found in campaign data',
    meaning:
      'The id in `forceShippingId` does not match any shipping method in this campaign, so the cart keeps whatever method it had.',
    action:
      'Use a `ref_id` from the campaign’s shipping methods — the debug line `Available shipping methods:` right after this one lists the valid ids, codes, and prices.',
  },
  {
    level: 'error',
    message: 'Error processing forceShippingId parameter:',
    meaning:
      'Applying `forceShippingId` threw, so shipping is unchanged. Boot continues.',
    action:
      'Read the attached error — `Invalid shipping ID` means the parameter was not a positive number. Otherwise the cart update itself failed, and the visitor picks shipping manually.',
  },
  {
    level: 'error',
    message: 'Attribution initialization failed:',
    meaning:
      'Attribution did not start, so the order will be missing UTM tags, funnel name, and click ids. The page and checkout still work — this is a reporting problem, not a buying one.',
    action:
      'Read the attached error. Orders placed while this is happening cannot be attributed after the fact, so it is worth fixing quickly on paid traffic.',
  },
  {
    level: 'warn',
    message: 'Analytics v2 initialization failed (non-critical):',
    meaning:
      'The analytics module failed to load or initialize. No analytics events will be sent from this page load; everything else works.',
    action:
      'Read the attached error. A blocked script or an ad blocker is the common cause. Do not treat the resulting gap in reporting as a drop in sales.',
  },
  {
    level: 'warn',
    message: 'Error handler initialization failed:',
    meaning:
      'The global error handler did not start, so uncaught page errors are no longer re-published as `error:occurred` events. Nothing else changes.',
    action:
      "Read the attached error. Low urgency, but while it lasts your own `next.on('error:occurred')` handlers will not fire.",
  },
  {
    level: 'error',
    message: 'Failed to auto-load order:',
    meaning:
      'A `ref_id` in the URL was found but the order behind it could not be loaded, so a receipt or upsell page has nothing to show and `next.addUpsell()` will reject.',
    action:
      'Check the attached error and the `ref_id`. An expired or wrong reference gives this; so does the API being unreachable. Until it loads, treat the page as having no order rather than an empty one.',
  },
  {
    level: 'error',
    message: 'Ready callback error:',
    meaning:
      'One of your own `window.nextReady` callbacks threw. The SDK caught it and ran the remaining callbacks, so this is your page code failing, not the SDK.',
    action:
      'Fix the callback named in the attached stack. Note that a callback failing part-way can leave your own page half-configured even though boot reports success.',
  },

  // ── attribute-scanner.ts ───────────────────────────────────────────────────
  {
    level: 'warn',
    message: 'Already scanning, queuing request',
    meaning:
      'A second DOM scan was asked for while one was running; the request is queued rather than run in parallel. Expected on a page that injects markup while booting.',
    action:
      'Nothing. If it repeats continuously, something is mutating the DOM in a loop — look at what is adding elements, not at the scanner.',
  },
  {
    level: 'error',
    message: 'Error during scan and enhance:',
    meaning:
      'The DOM scan threw part-way, so some elements were enhanced and others were not. The page is in a mixed state: some prices update, some do not.',
    action:
      'Read the attached error, then reload with `?debug=true` and look at the lines above to see which element the scan was on when it failed.',
  },
  {
    level: 'error',
    message: 'Failed to initialize {type} enhancer:',
    meaning:
      'One feature threw while starting up. It is destroyed and that element is left as plain markup — its button does nothing, its display keeps its placeholder. Everything else on the page is unaffected. A missing required attribute is the usual cause.',
    action:
      'The element is attached to the log line: expand it, then check its attributes against that feature’s `reference/attributes.md`. `Required attribute {name} not found on element` in the attached error names the missing one directly.',
  },
  {
    level: 'error',
    message: 'Failed to enhance element:',
    meaning:
      'Enhancing one element failed outside any single feature’s own start-up — while resolving which features it needs, for example. That element stays plain markup.',
    action:
      'The element is attached. Check for contradictory attributes on it, such as a display path that names no known namespace, and compare against a working element nearby.',
  },
  {
    level: 'warn',
    message: 'Unknown action type: {action}',
    meaning:
      '`data-next-action` has a value the SDK does not recognise, so the element does nothing when clicked. A typo in the value is almost always the reason.',
    action:
      'Use one of the supported actions — `add-to-cart` or `accept-upsell`. The value is printed in the message, so compare it character by character, including case.',
  },
  {
    level: 'warn',
    message: 'Unknown enhancer type: {type}',
    meaning:
      'The scanner matched an element to a feature name it has no constructor for, so nothing is attached to that element. This means an attribute is spelled in a way that resolves to an unknown feature.',
    action:
      'Check the `data-next-*` attributes on the element against the feature catalog. If the name in the message looks correct, the feature exists but is not registered in `attribute-scanner.ts` — that is a code fix, not a markup one.',
  },
  {
    level: 'error',
    message: 'Failed to create enhancer of type {type}:',
    meaning:
      'Loading the code for a feature failed, so no element using it is enhanced. Features are imported on demand, so a network problem or a broken deployment produces this rather than a markup mistake.',
    action:
      'Read the attached error. A failed dynamic import points at the deployed bundle — check that the SDK version the loader asked for is actually published.',
  },
  {
    level: 'error',
    message: 'Failed to enhance queued element:',
    meaning:
      'An element that arrived after boot — injected by a page builder or an A/B tool — could not be enhanced. The rest of the queue is still processed.',
    action:
      'The element is attached. Treat it as `Failed to enhance element:`: compare its attributes with an equivalent element that was present at boot.',
  },

  {
    level: 'error',
    message: 'Failed to destroy enhancer:',
    meaning:
      "One feature's own `destroy()` threw while the scanner was tearing the page down. The scanner carries on with the rest, so the other features are still torn down — but this one may have left a listener, a timer or a subscription behind.",
    action:
      'Fix the `destroy()` named in the attached error. Until then, expect the leak that teardown was meant to prevent: on a single-page flow that re-enhances, the stale handler keeps firing on an element nobody is managing.',
  },
  {
    level: 'warn',
    message: 'Scanner destroyed, ignoring scan request',
    meaning:
      'Something asked the scanner to scan after `destroy()` had already run. Expected during teardown — a queued or in-flight scan finishing after the SDK was torn down — and the scan is correctly refused rather than enhancing elements nothing would ever clean up.',
    action:
      'Nothing, if the page is unloading or re-initializing. If it appears on a page that is still live, something is calling `scanAndEnhance()` on a scanner it already destroyed — use the new instance instead.',
  },
  // ── next-commerce.ts ───────────────────────────────────────────────────────
  {
    level: 'error',
    message: 'Callback error for {type}:',
    meaning:
      'One of your own callbacks registered through `next.on…` threw. The SDK caught it and carried on with the other callbacks for that type.',
    action:
      'Fix the callback named in the attached error. The SDK’s own state is unaffected, but anything your callback was supposed to do — a pixel, a redirect — did not happen.',
  },
  {
    level: 'warn',
    message: 'Package not found in store:',
    meaning:
      '`next.trackViewItem()` was called with a package id the campaign data does not contain, so no `view_item` event is sent for it.',
    action:
      'Pass the package `ref_id`, not a product or variant id. If the id is right, the call ran before the campaign finished loading — move it inside `window.nextReady`.',
  },
  {
    level: 'error',
    message: 'Failed to add attribution metadata:',
    meaning:
      'A single metadata value could not be added, so it will be missing from the order. Nothing else is affected.',
    action:
      'Read the attached error. Values must be serialisable — a DOM element or a function passed as metadata fails here.',
  },
  {
    level: 'error',
    message: 'Failed to set attribution metadata:',
    meaning:
      'A whole metadata object could not be merged in, so none of those values reach the order.',
    action:
      'Read the attached error and check the object is plain and serialisable. Confirm afterwards with `next.getMetadata()`.',
  },
  {
    level: 'error',
    message: 'Failed to clear attribution metadata:',
    meaning:
      'Resetting metadata failed, so previously set values may still be attached to the next order.',
    action:
      'Read the attached error, then verify with `next.getMetadata()` rather than assuming the reset worked.',
  },
  {
    level: 'error',
    message: 'Failed to get attribution metadata:',
    meaning:
      'Reading metadata threw, and `next.getMetadata()` returned `undefined` — which is indistinguishable from "no metadata set" to the caller.',
    action:
      'Read the attached error. Do not treat the `undefined` as proof there is no metadata; check the attribution store in the debug overlay.',
  },
  {
    level: 'error',
    message: 'Failed to set attribution:',
    meaning:
      'Updating attribution threw, so the values you passed are not recorded and the order will carry whatever was there before.',
    action:
      'Read the attached error and confirm with `next.getAttribution()`. On paid traffic this is worth fixing quickly, since it decides which channel gets credit for the sale.',
  },
  {
    level: 'error',
    message: 'Failed to get attribution:',
    meaning:
      'Reading attribution threw and `next.getAttribution()` returned `undefined`.',
    action:
      'Read the attached error. Inspect the attribution store in the debug overlay before concluding attribution is empty.',
  },
  {
    level: 'error',
    message: 'Failed to debug attribution:',
    meaning:
      'The `next.debugAttribution()` helper threw. It only prints attribution state, so nothing about the page or the order changed.',
    action:
      'Nothing on a customer page — this call exists for debugging. Read the attached error if you were using it to investigate something else.',
  },
  {
    level: 'error',
    message: 'Failed to setup exit intent:',
    meaning:
      'The exit-intent popup could not be configured, so it will never show. The error is also re-thrown, so your own `await next.exitIntent(...)` rejects.',
    action:
      'Read the attached error and check the options you passed, particularly the image URL. Handle the rejection in your own code so a popup failing does not stop the rest of your setup.',
  },
  {
    level: 'error',
    message: 'Failed to start FOMO popup:',
    meaning:
      'The FOMO popup did not start, so no social-proof messages appear. The error is re-thrown to your caller.',
    action:
      'Read the attached error and check the configuration you passed — an empty or malformed customer list is the usual cause.',
  },
  {
    level: 'error',
    message: 'Failed to add upsell(s) via SDK:',
    meaning:
      'A post-purchase upsell could not be added. The error is re-thrown, so the promise from `next.addUpsell()` rejects.',
    action:
      'Read the attached error before offering the visitor a retry: the line may already exist on the order, and a blind retry can charge them twice. Re-read the order first.',
  },

  // ── monitoring/error-handler.ts ────────────────────────────────────────────
  {
    level: 'error',
    message: 'Captured error:',
    meaning:
      'The global handler caught an uncaught error, a rejected promise, or something written to `console.error`, and re-published it as `error:occurred`. The attached objects carry the original error plus SDK version, URL, and user agent. The failure itself happened somewhere else — this line is the report, not the cause.',
    action:
      'Read the attached error and stack to find the real source. Errors from your own page code arrive here too, so check the stack before assuming it is the SDK.',
  },

  // ── storage.ts ─────────────────────────────────────────────────────────────
  {
    level: 'error',
    message: 'Failed to store value for key {key}:',
    meaning:
      'Writing to storage failed and the write was abandoned — the caller received `false`. Storage being full or unavailable, which is normal in some private-browsing modes, produces this.',
    action:
      'Read the attached error. Nothing recovers a blocked storage from the page; expect the value not to survive a reload, and check anything that assumes it will.',
  },
  {
    level: 'error',
    message: 'Failed to retrieve value for key {key}:',
    meaning:
      'Reading a key threw, so the caller got its default value. A stored value that is no longer valid JSON does this as well as storage being unavailable.',
    action:
      'Read the attached error. If it names one key repeatedly, remove that key: a corrupt entry keeps failing until it is cleared.',
  },
  {
    level: 'error',
    message: 'Failed to remove value for key {key}:',
    meaning:
      'Deleting a key failed, so a value you expected to be gone may still be there and be read back later.',
    action:
      'Read the attached error, then confirm the key is actually gone before relying on it — a stale cache surviving a reset produces confusing follow-on behaviour.',
  },
  {
    level: 'error',
    message: 'Failed to clear storage:',
    meaning:
      'Clearing storage failed, so previous values remain. Anything meant to start from a clean slate does not.',
    action:
      'Read the attached error. Clear the site’s storage in devtools when you need a genuinely fresh session for testing.',
  },

  // ── base/base-enhancer.ts ──────────────────────────────────────────────────
  {
    level: 'error',
    message: 'Error in {context}:',
    meaning:
      'A feature caught an error inside itself and reported it under its own prefix, naming the operation that failed. It also emits `error:occurred`. The feature stays alive but that operation did not complete.',
    action:
      'Read the operation name and the message. Which feature it is comes from the log prefix, and the matching `guide/reference/errors.md` covers the messages that feature raises.',
  },

  // ── base/dom-observer.ts ───────────────────────────────────────────────────
  {
    level: 'warn',
    message: 'Already observing, ignoring start request',
    meaning:
      'Something asked the DOM observer to start while it was already running; the request was ignored. One observer is all that is needed, so nothing is lost.',
    action:
      'Nothing. Repeated occurrences mean code is starting the observer in a loop — look at the caller.',
  },
  {
    level: 'error',
    message: 'Failed to start DOM observation:',
    meaning:
      'The observer could not attach, so elements added after boot will not be enhanced. Markup present at boot still works, which makes this look like "only dynamic content is broken".',
    action:
      'Read the attached error. A missing target element is the usual cause — the observer needs a `<body>` to watch, so starting the SDK before the body exists produces this.',
  },
  {
    level: 'error',
    message: 'Handler error:',
    meaning:
      'A handler subscribed to DOM changes threw. The observer caught it and carried on with the other handlers, so one broken handler does not stop the rest.',
    action:
      'Read the attached error to find the handler. If it fires on every mutation, the console noise alone will slow the page down.',
  },

  // ── base/attribute-parser.ts ───────────────────────────────────────────────
  {
    level: 'error',
    message: 'Failed to parse condition:',
    meaning:
      'A `data-next-show` or `data-next-hide` expression could not be parsed. The parser falls back to `cart.isEmpty`, so the element will show or hide on cart emptiness rather than on what you wrote — visible but wrong, which goes unnoticed longer than a blank element would.',
    action:
      'The unparsed condition is attached: check it against the conditional-display grammar. Unbalanced quotes and a comparison operator with no right-hand side are the common mistakes.',
  },

  // ── country-service.ts ─────────────────────────────────────────────────────
  {
    level: 'error',
    message: 'Failed to fetch location data:',
    meaning:
      'The location request failed and the built-in fallback is in use: the configured country list and the United States as the detected country. Prices and shipping options are for that fallback, not for the visitor.',
    action:
      'Read the attached error. It is often an ad blocker or a network failure. A single successful response is cached in localStorage, so a reload usually clears it.',
  },
  {
    level: 'error',
    message: 'Failed to fetch states for {countryCode}:',
    meaning:
      'The state list for that country could not be loaded, so the state field renders with no options. In countries where a state is required, the visitor cannot complete the address.',
    action:
      'Read the attached error and re-select the country to retry; a good response is cached. If one country always fails, check that its code is in the campaign’s shipping countries.',
  },
  {
    level: 'error',
    message: 'Invalid postal code regex:',
    meaning:
      'The postal-code pattern configured for a country is not a valid regular expression, so validation was skipped and any postal code is accepted. Orders can be placed with an address the carrier will reject.',
    action:
      'Fix the pattern in the country configuration. Until then postal codes are unvalidated — the failure is silent from the visitor’s side, so do not wait for a complaint.',
  },
  {
    level: 'warn',
    message: 'Failed to clear cache:',
    meaning:
      'Clearing the cached country and state data failed, so stale lists may still be served this session.',
    action:
      'Read the attached error. Clear site data in devtools if you are testing a change to the country list and it will not take effect.',
  },
  {
    level: 'warn',
    message: 'Failed to clear cache for country {countryCode}:',
    meaning:
      'The cached states for one country could not be removed, so the old list may still be shown.',
    action:
      'Same as above — read the attached error, and clear site data when testing a change to that country’s states.',
  },
  {
    level: 'warn',
    message: 'Failed to read from cache:',
    meaning:
      'A cached entry could not be read, so the data is fetched from the API instead. Correct behaviour, one request slower.',
    action:
      'Nothing. If it repeats on every page, storage is unavailable in this browser mode and every visit will re-fetch the country data.',
  },
  {
    level: 'warn',
    message: 'Failed to write to cache:',
    meaning:
      'A response could not be cached, so the next page will fetch it again. Nothing is wrong with the data.',
    action:
      'Nothing. Persistent occurrences mean storage is full or blocked, which costs a request per page rather than breaking anything.',
  },
  {
    level: 'warn',
    message:
      '⚠️ Using deprecated showCountries config. Please use campaign API instead.',
    meaning:
      'The country list is being filtered by the `showCountries` setting in configuration. That setting is deprecated: the campaign’s `available_shipping_countries` is the intended source, and it is ignored while `showCountries` is set.',
    action:
      'Set the shipping countries on the campaign, then remove `showCountries` from the page configuration. Leaving both in place means the page and the campaign can disagree about where you ship.',
  },
  {
    level: 'warn',
    message:
      '⚠️ No countries available in filtered list. Using config defaultCountry: {defaultCountry}',
    meaning:
      'Filtering left no countries at all, so the configured default is used on its own. The visitor sees a country dropdown with one entry, whatever their real location.',
    action:
      'Check the campaign’s shipping countries and any `showCountries` filter — an overlap of zero between them produces this. This one blocks visitors from ordering, so treat it as urgent.',
  },

  // ── attribution/attribution-collector.ts ───────────────────────────────────
  {
    level: 'warn',
    message: 'Subaffiliate value truncated from {length} to 225 characters',
    meaning:
      'A subaffiliate value was longer than the API accepts and was cut to 225 characters. The order is still created; the value stored is shortened, so reports may not match the tracking link exactly.',
    action:
      'Shorten the value at the source — the affiliate link or the tracking template. Two long values that differ only after character 225 become indistinguishable once truncated.',
  },

  // ── attribution/utm-transfer.ts ────────────────────────────────────────────
  {
    level: 'error',
    message: 'Invalid link element provided',
    meaning:
      'UTM transfer was handed something that is not a usable link element, so no parameters were copied onto it. Only code calling the API directly can cause this; the automatic pass over the page’s links does not.',
    action:
      'Pass an `<a>` element that is in the document. A `null` from a selector that matched nothing is the usual cause.',
  },
  {
    level: 'error',
    message: 'Invalid URL:',
    meaning:
      'A link’s `href` could not be parsed as a URL, so attribution parameters were not added to it. A visitor clicking that link arrives on the next page with no UTM tags.',
    action:
      'The offending `href` is attached. Fix the link — a stray space, an unsubstituted template token such as `{{url}}`, or a `javascript:` href all produce this.',
  },

  // ── analytics/index.ts ─────────────────────────────────────────────────────
  {
    level: 'error',
    message: 'Error checking ignore parameter:',
    meaning:
      'Reading `?ignore=true` or writing its session flag threw, so analytics may not be suppressed on a page where you asked for it to be. Events could be sent from a session you meant to exclude.',
    action:
      'Read the attached error — a blocked `sessionStorage` is the usual cause. Do not rely on `?ignore=true` for excluding your own test traffic while this appears.',
  },
  {
    level: 'error',
    message: 'Error checking ignore status:',
    meaning:
      'Deciding whether this session is ignored threw, and the answer defaulted to "not ignored" — so events are sent.',
    action:
      'Read the attached error. Same practical consequence as above: internal traffic may be landing in reports.',
  },
  {
    level: 'error',
    message: 'Failed to initialize analytics:',
    meaning:
      'Analytics did not start and the error is re-thrown to boot, which logs `Analytics v2 initialization failed (non-critical):`. No events are sent from this page load.',
    action:
      'Read the attached error. A provider that cannot load its own script is the common cause, and the provider name in the message tells you which to look at.',
  },
  {
    level: 'warn',
    message: 'Analytics not initialized, queuing event:',
    meaning:
      'An event arrived before analytics finished starting. It is held and sent once initialization completes, so this is expected once or twice at the top of a page load.',
    action:
      'Nothing if `NextAnalytics initialized successfully` follows. If it never does, the queued events are never sent — investigate the initialization failure instead of this line.',
  },
  {
    level: 'error',
    message: 'Event validation failed:',
    meaning:
      'In debug mode only, an event did not match its schema; the attached list names the fields. The event is still sent, so the problem shows up as bad data in the destination rather than a missing event.',
    action:
      'Fix the fields named in the attachment. This check does not run outside debug mode, so run `?debug=true` before a launch rather than after a report of odd numbers.',
  },
  {
    level: 'warn',
    message: 'Event validation warnings:',
    meaning:
      'Debug-mode validation found things worth noting on an event that already failed — a missing recommended field, or an event with no schema at all.',
    action:
      'Read the list. Warnings do not stop delivery; treat them as the list of fields a destination will silently ignore.',
  },
  {
    level: 'error',
    message: 'Error clearing ignore flag:',
    meaning:
      'Removing the analytics ignore flag failed, so the session stays excluded from analytics — no events will be sent from it until storage is cleared.',
    action:
      'Read the attached error, then clear `analytics_ignore` from sessionStorage in devtools. A tester left in this state reports "no events" for a reason unrelated to the tracking setup.',
  },

  // ── analytics/config.ts ────────────────────────────────────────────────────
  {
    level: 'error',
    message: 'Missing config for provider "{name}"',
    meaning:
      'A provider was checked for its settings and had none. This cannot appear in a shipped build: the function that logs it, `validateProviderConfig()` in `analytics/config.ts`, is exported but never called anywhere in the SDK.',
    action:
      'Nothing to act on from a page. If you see it, something outside the SDK is calling that function — the live check that decides whether a provider can start is in `analytics/index.ts` and warns with `Provider "{key}" is enabled but …` instead.',
  },
  {
    level: 'error',
    message: 'Missing required field "{field}" for provider "{name}"',
    meaning:
      'A provider’s settings are missing a field it needs. Like the message above, it comes from `validateProviderConfig()`, which nothing in the SDK calls, so a shipped build never prints it.',
    action:
      'Nothing to act on from a page. For a provider that genuinely will not start, look for `Provider "{key}" is enabled but {required} is missing …` from `NextAnalytics`.',
  },

  // ── analytics/data-layer-manager.ts ──────────────────────────────────────────
  {
    level: 'error',
    message: 'Failed to persist debug mode',
    meaning:
      'Debug mode was switched on or off but the choice could not be saved to localStorage, so it will not survive a page navigation.',
    action:
      'Add `?debug=true` to the URL instead of relying on the saved setting. The attached error is normally storage being blocked.',
  },

  // ── analytics/user-data-storage.ts ───────────────────────────────────────────
  {
    level: 'warn',
    message: 'Failed to parse user data cookie:',
    meaning:
      'The stored visitor cookie is not valid JSON, so it is ignored. Events on this page will not identify the visitor from the cookie; a fresh identity is built when they next enter their details.',
    action:
      'Read the attached error. One occurrence after a format change is expected; a cookie written by other code on the same name would explain a persistent one.',
  },
  {
    level: 'warn',
    message: 'Failed to parse sessionStorage user data:',
    meaning:
      'The sessionStorage copy of the visitor data could not be parsed, so the older cookie copy is used. Recent details, such as an email typed on the previous step, may be missing from events.',
    action:
      'Read the attached error, then clear `user_data` from sessionStorage. It keeps failing on every page until the bad entry is removed.',
  },
  {
    level: 'error',
    message: 'Failed to load user data:',
    meaning:
      'Loading visitor data threw, so events go out without identity fields and without a stable session id. Purchase attribution to a visitor’s earlier pages breaks.',
    action:
      'Read the attached error. Cookies or storage being blocked is the usual cause; in that case identity cannot be kept across pages and the gap in reporting is expected, not a tracking bug.',
  },
  {
    level: 'error',
    message: 'Failed to save user data:',
    meaning:
      'Newly captured visitor details — typically an email typed at checkout — could not be stored, so the next page will not know them.',
    action:
      'Read the attached error. While this happens, events on later pages are anonymous even though the visitor identified themselves.',
  },

  // ── analytics/events/event-builder.ts ───────────────────────────────────────
  {
    level: 'warn',
    message: 'Could not access store state for user properties:',
    meaning:
      'The event was built without user properties because reading the stores threw. It is still sent, minus the customer fields.',
    action:
      'Read the attached error. Expect events with no customer email or name for as long as it happens, which affects audience matching more than event counts.',
  },
  {
    level: 'warn',
    message: 'Could not build campaign context:',
    meaning:
      'The event carries no campaign identifiers — campaign id, name, currency, language — because building them threw. Destinations that group by campaign will file it under nothing.',
    action:
      'Read the attached error. If `apiKey` is unset, the separate warning `No campaign apiKey configured …` names the fix; otherwise the campaign store had not loaded when the event was built.',
  },
  {
    level: 'warn',
    message: 'Could not access campaign store for currency:',
    meaning:
      'Currency could not be read and the event fell back to `USD`. Revenue from a non-USD campaign is then reported in the wrong currency, which looks like a change in order value rather than an error.',
    action:
      'Read the attached error. Verify the currency on the affected events before trusting any revenue figure from the period.',
  },
  {
    level: 'warn',
    message: 'Could not access campaign store for item formatting:',
    meaning:
      'An item in the event has no image URL because the campaign data could not be read. Everything else about the item is intact.',
    action:
      'Read the attached error. Cosmetic for most destinations; product feeds that require an image will reject the item.',
  },
  {
    level: 'warn',
    message: 'Could not find package data for packageId: {packageId}',
    meaning:
      'The event refers to a package that is not in the loaded campaign data, so the item falls back to ids instead of product name, SKU, and variant. The attachment lists the packages that *were* available, which is the fastest way to see what went wrong.',
    action:
      'Compare the id in the message with the attached list. A package removed from the campaign, or an id from a different campaign, gives this; so does an event fired before the campaign finished loading.',
  },
  {
    level: 'warn',
    message: 'Could not access campaign store for product data:',
    meaning:
      'Product details for an item could not be read, so the item is reported with ids only — no name, no SKU.',
    action:
      'Read the attached error. Reports built on product names will show these items as blank or as raw ids.',
  },
  {
    level: 'warn',
    message: 'Could not access campaign store for quantity:',
    meaning:
      'The units-per-package figure could not be read, so quantity is reported as the number of packages rather than the number of units. A "3-pack" then counts as 1.',
    action:
      'Read the attached error. Check quantity on the affected events before comparing units sold with the store’s own figures.',
  },
  {
    level: 'warn',
    message: 'Could not access campaign store for price:',
    meaning:
      'The catalogue price could not be read, so the item’s price field is left at its default. Revenue on the event may be understated.',
    action:
      'Read the attached error, then check the value of the affected events against the orders they belong to.',
  },
  {
    level: 'warn',
    message: 'Could not access campaign store for retail price:',
    meaning:
      'The pre-discount retail price could not be read, so the event has no "price before discount". Discount reporting is affected; revenue is not.',
    action:
      'Read the attached error. Low urgency unless you report on discount depth.',
  },
  {
    level: 'warn',
    message: 'Could not access campaign store:',
    meaning:
      'Campaign data could not be read while building an item, so it is sent with whatever fields were already resolved.',
    action:
      'Read the attached error. If it appears in bulk, the campaign store failed to load and the same reason explains most other analytics warnings on the page.',
  },

  // ── analytics/events/ecommerce-events.ts ────────────────────────────────────
  {
    level: 'warn',
    message: 'Could not access campaign store for upsell data:',
    meaning:
      'An upsell event was built without campaign name or package details because the campaign store could not be read. The event is still sent.',
    action:
      'Read the attached error. Upsell revenue is still counted; the product name attached to it may be missing.',
  },

  // ── analytics/events/user-events.ts ─────────────────────────────────────────
  {
    level: 'warn',
    message: 'Could not add cart contents to user data event:',
    meaning:
      '`dl_user_data` went out without the cart contents. Identity fields are intact; audiences built on "has these products in cart" will not see this visitor.',
    action:
      'Read the attached error. It usually means the cart store was not ready when the event fired, which is expected very early in a page load.',
  },

  // ── analytics/validation/event-validator.ts ─────────────────────────────────
  {
    level: 'error',
    message: 'Validation failed for {event}:',
    meaning:
      'Debug-mode validation rejected an event and the attached list names each problem. The event is still delivered — validation reports, it does not block.',
    action:
      'Fix the fields in the attachment. Nothing outside debug mode prints this, so make a `?debug=true` pass part of launching a page rather than a reaction to bad data.',
  },

  // ── analytics/tracking/auto-event-listener.ts ────────────────────────────────
  {
    level: 'warn',
    message: 'Package not found for add to cart:',
    meaning:
      'Something was added to the cart but the matching package is not in the campaign data, so **no** `add_to_cart` event is sent. The cart itself is correct; the funnel loses a step.',
    action:
      'The id is attached. Check it against the campaign’s packages — markup pointing at a package from another campaign is the usual cause. Add-to-cart counts will be lower than orders until it is fixed.',
  },
  {
    level: 'warn',
    message: 'Package not found for remove from cart:',
    meaning:
      'An item was removed from the cart but its package could not be found, so no `remove_from_cart` event is sent.',
    action:
      'The id is attached; check it against the campaign’s packages. Same cause as the add-to-cart version, and the two normally appear together.',
  },
  {
    level: 'warn',
    message: 'Package data not found for swap:',
    meaning:
      'A package swap happened but one or both packages are missing from the campaign data, so no swap event is sent. The cart still holds the right item.',
    action:
      'Both ids are attached. Check each against the campaign’s packages; a selector offering a package the campaign no longer contains produces this.',
  },
  {
    level: 'warn',
    message: 'Package not found for upsell view:',
    meaning:
      'An upsell was shown but its package is not in the campaign data, so no upsell view event is sent. Accept and skip events for the same offer are affected in the same way.',
    action:
      'The id is attached. Check the upsell markup’s package id against the campaign — an upsell page reused across campaigns is the common cause.',
  },
  {
    level: 'error',
    message: 'Error getting cart data:',
    meaning:
      'Reading the cart for an event threw, so the event goes out with no cart value and no items — or is skipped, depending on which event needed it.',
    action:
      'Read the attached error. If it coincides with a purchase, check that order’s value in the destination before trusting revenue reporting for the period.',
  },

  // ── analytics/tracking/meta-tag-controller.ts ────────────────────────────────
  {
    level: 'warn',
    message: 'URL param "{paramName}" not found for view_item event',
    meaning:
      'A meta tag asked for the package id to come from a URL parameter (`content="url:pid"`) and that parameter is not in the URL, so no `view_item` fires.',
    action:
      'Either link to the page with the parameter (`?pid=42`) or put the id in the meta tag directly. The parameter name in the message is what to look for in the link.',
  },
  {
    level: 'warn',
    message: 'URL param "{paramName}" not found for view_item_list event',
    meaning:
      'Same as above for `view_item_list`: the URL parameter naming the package list is missing, so no list event fires.',
    action:
      'Add the parameter to the links that lead here, or list the package ids in the meta tag. Ad platforms that strip unknown parameters are worth checking.',
  },
  {
    level: 'warn',
    message: 'Package {packageId} not found for view_item event',
    meaning:
      'The meta tag names a package the campaign does not contain, so no `view_item` fires for it and the page reports no product view.',
    action:
      'Check the id in the meta tag against the campaign’s packages. It must be the package `ref_id`, not a product or variant id.',
  },
  {
    level: 'warn',
    message: 'Invalid time trigger value: {triggerValue}, firing immediately',
    meaning:
      'A time-based trigger was configured with something that is not a positive number of milliseconds, so the event fired at once instead of after the delay. The event is not lost, only mistimed.',
    action:
      'Set the trigger to a positive whole number of milliseconds — `time:3000`. Views recorded before the visitor actually looked at the product will inflate view counts.',
  },
  {
    level: 'warn',
    message:
      'Element {selector} not found for view_item trigger, firing immediately',
    meaning:
      'The event was meant to wait until an element scrolled into view, but no element matches that selector, so it fired immediately.',
    action:
      'Check the selector against the page — an element rendered later than the meta tag is read gives this. Until fixed, the "viewed" figure counts page loads, not views.',
  },
  {
    level: 'warn',
    message: 'Unknown trigger type: {triggerType}, firing immediately',
    meaning:
      'The trigger in the meta tag is not one the SDK recognises, so it fired immediately. A typo in the trigger name is the usual reason.',
    action:
      'Use a supported trigger — `immediate`, `time:{ms}`, or an element selector. The unrecognised value is printed in the message.',
  },
  {
    level: 'warn',
    message: 'Package {packageId} not found for view_item_list event',
    meaning:
      'One package in a `view_item_list` meta tag is not in the campaign data and is left out of the list. The event still fires with the remaining packages, so the list is quietly shorter than intended.',
    action:
      'Check that id against the campaign’s packages. Item positions in the list shift when one is dropped, so list-position reporting is affected as well as the count.',
  },
  {
    level: 'warn',
    message: 'No valid packages found for view_item_list event',
    meaning:
      'Every package in the meta tag was missing from the campaign data, so no list event fires at all.',
    action:
      'Check the whole id list against the campaign. This is usually a page reused from another campaign whose ids do not exist here.',
  },

  // ── analytics/tracking/pending-events-handler.ts ─────────────────────────────
  {
    level: 'error',
    message: 'Failed to queue event:',
    meaning:
      'An event raised while the page was navigating away could not be stored, so it will not be replayed on the next page — it is lost. A purchase event on a redirect is the case that matters.',
    action:
      'Read the attached error; a blocked or full sessionStorage is the cause. Compare purchase events with orders for the period, because this loses events silently.',
  },
  {
    level: 'error',
    message: 'Failed to get pending events:',
    meaning:
      'The queue of events held for after a redirect could not be read, so nothing is replayed on this page. Anything queued before is lost.',
    action:
      'Read the attached error. If the stored value is corrupt it keeps failing; clearing the SDK’s sessionStorage keys resets it.',
  },
  {
    level: 'warn',
    message: 'Skipping queued dl_user_data - current page should fire its own',
    meaning:
      'A queued `dl_user_data` was dropped on purpose: every page fires its own, and replaying an old one would report stale details. Expected behaviour, not a problem.',
    action:
      'Nothing. Confirm the page’s own `dl_user_data` appears — `UserDataTracker initialized - dl_user_data fired first` is that confirmation.',
  },
  {
    level: 'warn',
    message: 'Skipping stale event:',
    meaning:
      'A queued event was more than five minutes old and was discarded rather than replayed. It normally means the visitor left the tab and came back much later.',
    action:
      'Nothing in isolation. In bulk it means events are being queued and never replayed promptly — check whether the redirect they were queued for is happening at all.',
  },
  {
    level: 'error',
    message: 'Failed to process pending event:',
    meaning:
      'Replaying one queued event threw. That event is dropped; the rest of the queue is still processed.',
    action:
      'Read the attached error and the event name beside it. A queued shape from an older SDK version can fail against newer validation.',
  },
  {
    level: 'error',
    message: 'Failed to clear pending events:',
    meaning:
      'The queue could not be emptied, so events already replayed may be replayed again — duplicate events in the destination.',
    action:
      'Read the attached error. If purchase events are duplicated in reports, this line is the reason to look at first.',
  },

  // ── analytics/tracking/view-item-list-tracker.ts ──────────────────────────────
  {
    level: 'warn',
    message: 'Package not found in store:',
    meaning:
      'A product element on the page names a package that is not in the campaign data, so it is left out of automatic `view_item` / `view_item_list` tracking.',
    action:
      'The id is attached. Check the `data-next-package-id` on that element against the campaign’s packages; a leftover card from another campaign is the usual cause.',
  },

  // ── analytics/tracking/list-attribution-tracker.ts ───────────────────────────
  {
    level: 'error',
    message: 'Error loading list context from storage:',
    meaning:
      'The record of which list a product was clicked from could not be read, so events on this page cannot say where within the site the visitor came from. Nothing else is affected.',
    action:
      'Read the attached error. A corrupt stored value keeps failing on every page until it is cleared; storage being blocked cannot be fixed from the page, and list attribution is then unavailable for the whole session.',
  },
  {
    level: 'error',
    message: 'Error saving list context to storage:',
    meaning:
      'The list a product was clicked from could not be stored, so the next page will not know it and its events lose the list name and position.',
    action:
      'Read the attached error — storage full or blocked is the usual cause. Expect gaps in "which list drove the sale" reporting while it lasts.',
  },
  {
    level: 'error',
    message: 'Error removing list context from storage:',
    meaning:
      'An expired list record could not be deleted, so a stale list name may be attached to events it does not belong to — wrong attribution rather than missing attribution.',
    action:
      'Read the attached error, then clear the SDK’s sessionStorage keys if you are checking list attribution, so you are not reading a leftover value.',
  },

  // ── analytics/providers/provider-adapter.ts ─────────────────────────────────
  {
    level: 'warn',
    message: 'Event "{event}" not delivered: {message}',
    meaning:
      'One provider could not deliver one event, for a reason it expected — its script never loaded, or the vendor call threw. The reason is in the message. Other providers are unaffected, and the visitor sees nothing. The provider name is the log prefix.',
    action:
      'Read the reason after the colon: a "load timeout" means the vendor snippet is missing from the page, and the individual adapters warn once with the exact fix. The payload that would have been sent is in the debug overlay’s Provider Delivery panel (`?debug=true`).',
  },
  {
    level: 'error',
    message: 'Failed to send event "{event}"',
    meaning:
      'A provider threw something the delivery layer did not expect, so this event is lost for that provider. Unlike `Event "{event}" not delivered:`, this is not a known delivery outcome — it points at a fault in the adapter or the vendor script.',
    action:
      'Read the attached error. The provider is identified by the log prefix; that adapter’s own errors are in [errors.md](./errors.md).',
  },

  // ── analytics/providers/next-campaign-adapter.ts ─────────────────────────────
  {
    level: 'warn',
    message: 'No API key available for NextCampaign initialization',
    meaning:
      'The NextCampaign provider is enabled but has no API key, so it stops before loading its script. Nothing is sent to it; the rest of analytics is unaffected.',
    action:
      'Set the campaign API key with `<meta name="next-api-key" content="…">` or `window.nextConfig.apiKey` before the loader. The adapter logs `API key from config store: found` once it can see one.',
  },
  {
    level: 'error',
    message: 'Failed to load NextCampaign SDK:',
    meaning:
      'The NextCampaign script did not load, so no events reach it. The error is re-thrown, which surfaces as a failed provider initialization in the analytics log above.',
    action:
      'Read the attached error and check that `campaigns.apps.29next.com` is reachable and not blocked by an extension.',
  },
  {
    level: 'error',
    message: 'Error sending initial page view to NextCampaign:',
    meaning:
      'The script loaded but the first `page_view` threw, so that page view is missing from NextCampaign reporting. Later events are still attempted.',
    action:
      'Read the attached error — it comes from the NextCampaign script rather than from this SDK.',
  },

  // ── analytics/providers/custom-adapter.ts ───────────────────────────────────
  {
    level: 'error',
    message: 'Error sending batch to custom endpoint:',
    meaning:
      'A batch of events was rejected or the request failed. Every event in the batch goes onto the retry queue, so this alone does not mean they are lost.',
    action:
      'Read the attached error and check the endpoint. `HTTP {status}: {statusText}` in the attachment is the endpoint’s own answer.',
  },
  {
    level: 'error',
    message: 'Failed to send event after {maxRetries} attempts:',
    meaning:
      'The retries for one event are exhausted and it is dropped. This is the point at which data is actually lost, unlike the batch error above.',
    action:
      'Read the attached event and fix the endpoint before comparing its numbers with anything else. The count in the message is the configured `maxRetries`.',
  },

  // ── debug/country-selector.ts ──────────────────────────────────────────────
  {
    level: 'error',
    message: 'Failed to load countries:',
    meaning:
      'The debug overlay’s country switcher has no countries to offer and hides itself. Only the debug tool is affected — the page’s own address form is separate.',
    action:
      'Read the attached error; it is the same country-list fetch that `CountryService` logs about. Fix that and the switcher returns.',
  },
  {
    level: 'warn',
    message: 'Country change already in progress',
    meaning:
      'A second country was picked in the debug overlay while the first change was still applying; the second was ignored. Expected when clicking quickly.',
    action: 'Wait for the first change to finish, then pick again. Debug-only.',
  },
  {
    level: 'error',
    message: 'Failed to change country:',
    meaning:
      'Switching country from the debug overlay failed and the overlay shows its error state. The page may be left part-way: currency updated, country not, or the reverse.',
    action:
      'Read the attached error and reload before continuing to test, so you are not looking at a half-applied state. Debug-only.',
  },

  // ── debug/currency-selector.ts ─────────────────────────────────────────────
  {
    level: 'warn',
    message: 'Currency change already in progress',
    meaning:
      'A second currency was picked while the first change was still applying, and was ignored.',
    action: 'Wait for the first change to finish. Debug-only.',
  },
  {
    level: 'error',
    message: 'Failed to change currency:',
    meaning:
      'Switching currency from the debug overlay failed. Prices on the page may still be in the previous currency while the selector shows the new one.',
    action:
      'Read the attached error and reload, then check whether the campaign actually offers that currency — `currency:fallback` is emitted when it does not. Debug-only.',
  },

  // ── debug/locale-selector.ts ───────────────────────────────────────────────
  {
    level: 'warn',
    message: 'Locale change already in progress',
    meaning:
      'A second locale was picked while the first change was still applying, and was ignored.',
    action: 'Wait for the first change to finish. Debug-only.',
  },
  {
    level: 'error',
    message: 'Failed to change locale:',
    meaning:
      'Switching locale from the debug overlay failed, so number and date formatting stays as it was.',
    action:
      'Read the attached error. An unsupported locale string is the usual cause. Debug-only.',
  },

  // ── debug/debug-module.ts ──────────────────────────────────────────────────
  {
    level: 'error',
    message: 'Failed to load debug overlay module:',
    meaning:
      'The debug overlay code could not be fetched, so no overlay appears even though debug mode is on. The SDK itself keeps working.',
    action:
      'Read the attached error. The overlay is loaded on demand, so this is a network or deployment problem — check that the version the loader asked for is published.',
  },
  {
    level: 'error',
    message: 'Failed to initialize debug mode:',
    meaning:
      'Debug mode did not start: no overlay, and none of the `window` debug helpers. Log level is still raised, so debug lines continue to print.',
    action:
      'Read the attached error. Investigate with the console alone until it is fixed — the log output is unaffected.',
  },

  // ── base/base-display-enhancer.ts ──────────────────────────────────────────
  {
    level: 'warn',
    message: 'Validator failed for {displayPath}:',
    meaning:
      'A `data-next-display` binding resolved to a value its format rejected — a price path that produced text, a date path that produced something unparseable. The element shows the fallback for that format instead of the real value, so the page looks finished while one number is quietly wrong. The path is in the message and the thrown error is attached.',
    action:
      'Compare the named path against the data actually in the store (`window.next.getCartData()`, or the campaign in the debug overlay). Usually the path is right and the data is missing for this campaign, in which case the fix is upstream in the campaign setup, not in the markup. A path that is simply misspelled produces no value at all rather than this line.',
  },

  // ── base/display-error-boundary.ts ─────────────────────────────────────────
  {
    level: 'error',
    message: '[Display Error] {operation}:',
    meaning:
      'One display binding threw and the boundary caught it, so that single element stopped updating while the rest of the page carried on. `{operation}` names the step that failed and the attached object carries the error, its stack, and the binding’s context.',
    action:
      'Read the attached `context` to find which element and path were involved, then the `error`. Because the failure is contained, this line is the only signal — nothing on the page will look broken except one stale or blank value, so treat it as a real defect rather than noise.',
  },
  {
    level: 'error',
    message: 'Error in error handler:',
    meaning:
      'A custom handler registered on the display error boundary threw while handling another error. The original error was still logged; this is the handler failing on top of it.',
    action:
      'Fix the handler — it is your code, registered via the boundary’s handler list. Look for the preceding `[Display Error]` line to see what it was reacting to. A handler that throws can hide the real problem, so it should never do more than report.',
  },

  // ── rendering/template-renderer.ts ─────────────────────────────────────────
  {
    level: 'warn',
    message: 'Template rendering error for placeholder {placeholder}:',
    meaning:
      'One placeholder in a cart, package, or order item template threw while being formatted. That placeholder falls back to its default — usually an empty string — so the row still renders with one field blank or stale, and the rest of the template is unaffected.',
    action:
      'Read the attached error and check the named placeholder against the data the row was given; a missing price or currency on the item is the usual cause. Note this used to print through `console.warn` and so appeared on production pages regardless of log level — it is now gated like every other warning, so reproduce it with `?debug=true` if a field is blank on a live page.',
  },

  // ── base/display-value-validator.ts ────────────────────────────────────────
  // Every line here means the element rendered a fallback. None of them break the
  // page, which is exactly why they are worth reading: the symptom is a wrong number,
  // not a missing one.
  {
    level: 'warn',
    message: 'Invalid percentage value: {value}',
    meaning:
      'A path formatted as a percentage produced something that is not a number, so the element shows **0%**. A real 0% and a failed conversion look identical on the page.',
    action:
      'The offending value is in the message. Check whether the path should be a percentage at all — `data-next-format="percentage"` on a plain number path is the usual cause — or whether the campaign is missing that field.',
  },
  {
    level: 'warn',
    message: 'Percentage exceeds 100: {num}',
    meaning:
      'A percentage resolved above 100 and was clamped to **100%**. Most often a fraction that was already converted once, so 0.85 became 85 and then 8500.',
    action:
      'Check whether the source field stores a fraction (0–1) or a percentage (0–100); the validator accepts both, so a value that has been scaled twice is the thing to look for.',
  },
  {
    level: 'warn',
    message: 'Invalid currency value: {value}',
    meaning:
      'A money path produced something unparseable, so the element shows **0** in the campaign currency. This is the one to take most seriously: a zero price reads as free.',
    action:
      'Read the value in the message. Currency symbols and commas are stripped before conversion, so a failure here usually means the field is absent or holds text. Verify the package actually carries that price in the campaign.',
  },
  {
    level: 'warn',
    message: 'Invalid number value: {value}',
    meaning:
      'A numeric path produced a non-number and the element shows **0**.',
    action:
      'Check the path against the campaign or cart data. A `0` on the page with no line here is a genuine zero; a `0` with this line is a conversion that failed.',
  },
  {
    level: 'warn',
    message: 'Invalid date value: {value}',
    meaning:
      'A date path could not be parsed, so the element renders **nothing** — this is the one failure in this file that leaves a blank rather than a wrong number.',
    action:
      'Read the value in the message. `new Date()` parses ISO 8601 reliably and little else consistently across browsers, so a format that works in one browser and blanks in another is the pattern to expect.',
  },
];
