/**
 * The **inventory** of author-facing core subsystems — the denominator the coverage
 * gate measures core against.
 *
 * Why an inventory at all, when `src/core` is 75 files: neither of the obvious
 * denominators works. **By file** is wrong because 37% of core's lines are the debug
 * overlay and two files are dead, so the number would move for reasons a reader does
 * not care about. **By exported symbol** is worse — 228 exports at 43% TSDoc coverage
 * would improve by writing TSDoc that lands on a class page. Those pages are published
 * (`src/core` is a TypeDoc entry point since 2026-07-31), but they answer a
 * contributor's question, not the question of someone building a page. So the unit is
 * the **contract a page depends on**, and the rows below are the parts of the engine an
 * author can configure, call, subscribe to, or observe.
 *
 * Prose deliberately lives elsewhere — `src/core/guide/subsystems/<id>.md` per row.
 * See {@link ./core-manifest.CoreSubsystem}.
 */

import { defineCoreSubsystem, type CoreSubsystem } from './core-manifest';

export const CORE_SUBSYSTEMS: CoreSubsystem[] = [
  defineCoreSubsystem({
    id: 'boot',
    title: 'Boot sequence',
    summary:
      'Starts the SDK: reads your configuration, works out the currency, loads the campaign, then scans the page and wires up every feature. Nothing else on this list works until it has finished.',
    sources: ['core/sdk-initializer.ts'],
    howAuthorsReachIt: ['observed', 'configured'],
    // `storage-keys` is here because boot owns `?reset=true`, and what that does and does
    // not clear is a storage question a reader follows straight out of this page.
    reference: ['boot-sequence', 'meta-tags', 'url-parameters', 'storage-keys'],
    emits: ['sdk:url-parameters-processed'],
    cautions: [
      '`next:ready` is not the "SDK is ready" signal — the loader fires it as soon as the module has been imported, long before boot finishes. A page that reads the cart from a `next:ready` handler races the whole boot and usually gets an empty cart. Wait for `next:initialized`, or queue a callback on `window.nextReady`.',
      'A missing API key aborts boot rather than degrading it: no DOM scan, no `window.next`, and queued `window.nextReady` callbacks never drain — while `body[data-next-sdk-loading]` still flips to `false`, so the page un-hides and shows its raw `{price}` placeholders. Confirm the API key meta tag is present before debugging anything downstream.',
    ],
  }),

  defineCoreSubsystem({
    id: 'public-facade',
    title: 'JavaScript API (`window.next`)',
    summary:
      'The object your own scripts talk to — adding items, swapping packages, applying coupons, reading the cart. Everything the SDK lets you drive from JavaScript arrives through here.',
    sources: [
      'core/next-commerce.ts',
      'core/next-commerce.cart.ts',
      'core/next-commerce.campaign.ts',
      'core/next-commerce.events.ts',
      'core/next-commerce.analytics.ts',
      'core/next-commerce.attribution.ts',
      'core/next-commerce.shipping.ts',
      'core/next-commerce.utility.ts',
      'core/next-commerce.coupons.ts',
      'core/next-commerce.popups.ts',
      'core/next-commerce.upsells.ts',
      'core/next-commerce.url-params.ts',
    ],
    howAuthorsReachIt: ['called'],
    reference: ['javascript-api', 'window-surface'],
    emits: ['upsell:added'],
    cautions: [
      '`window.next` does not exist until boot completes, so a script tag placed above the loader sees `undefined`. Queue your code with `window.nextReady.push(fn)` — and inside that callback use the `next` argument it hands you, not `window.next`: boot drains the queue and assigns `window.next` in `sdk-initializer.ts › SDKInitializer.setupReadyCallbacks`, so a callback queued before boot would still read `undefined` from the global.',
      'The callbacks registered with `next.registerCallback()` are never fired by the SDK — `triggerCallback` has no caller in the codebase, so your own code has to trigger them. For things the SDK really does announce, use `next.on()`.',
    ],
  }),

  defineCoreSubsystem({
    id: 'dom-activation',
    title: 'DOM activation',
    summary:
      'Finds the `data-next-*` elements on your page and turns each one into a working feature. It watches for markup added later too, but only for a short list of attributes — not for everything it activates on the first pass.',
    sources: [
      'core/attribute-scanner.ts',
      'core/base/dom-observer.ts',
      'core/base/attribute-parser.ts',
    ],
    howAuthorsReachIt: ['configured', 'observed'],
    reference: ['logs'],
    cautions: [
      'A feature only activates if the scanner queries its attribute. An attribute the scanner does not know about is inert with no error — the element simply never does anything, which reads like a broken feature rather than a typo.',
      'The first scan matches 30 selectors; the watcher that picks up markup added afterwards matches **8 attributes** (`dom-observer.ts › DOMObserver.constructor`). So HTML injected after boot activates only if it carries `data-next-display`, `-toggle`, `-timer`, `-show`, `-hide`, `-checkout`, `-validate`, or `-express-checkout`. An injected `data-next-action="add-to-cart"`, `-package-selector`, `-cart-items`, `-coupon`, or `-quantity` never comes alive, with no error. Re-scan after inserting that markup rather than relying on the watcher.',
    ],
  }),

  defineCoreSubsystem({
    id: 'geo',
    title: 'Country, state, and currency',
    summary:
      'Works out which country the visitor is in, which currency to price in, and which state or province list the checkout should offer.',
    sources: ['core/country-service.ts'],
    howAuthorsReachIt: ['configured', 'observed'],
    reference: ['storage-keys', 'url-parameters'],
    cautions: [
      'Currency is resolved before the campaign loads, and the campaign is then cached per currency. A visitor whose currency is detected differently on a later visit reads a different cache entry, so a stale price is a currency question before it is a caching question.',
    ],
  }),

  defineCoreSubsystem({
    id: 'test-mode',
    title: 'Test mode',
    summary:
      'Fills the checkout with a known address and a test card so you can walk a campaign end to end without typing real details.',
    sources: ['core/test-mode.ts'],
    howAuthorsReachIt: ['debug-only'],
    reference: ['url-parameters'],
    cautions: [
      "Test mode posts to the **real** order API — it is not a sandbox. Orders it creates are real orders on the campaign, and submitting also resets the cart and checkout stores and redirects, so a demo on a live page can take a shopper's cart with it. Clear the orders up rather than assuming they were discarded.",
      'The risk is not the `?test=true` flag, it is the keyboard shortcut: the Konami listener is attached when the module is imported (`core/test-mode.ts › TestModeManager.initializeKonamiCode`, instantiated at module scope in `core/test-mode.ts`, imported by `core/sdk-initializer.ts`) and `handleKeyDown` never checks whether test mode is on. So ↑↑↓↓←→←→BA creates a real order on any production checkout. `?debugger=true` also arms test mode as a side effect (`core/test-mode.ts › TestModeManager.checkUrlTestMode`) — opening the overlay on a live page is enough.',
      'What reaches the API is the token string `test_card`, not one of the card numbers in `core/test-mode.ts`. Those are unreachable: `showTestCardMenu()` (`core/test-mode.ts › TestModeManager.showTestCardMenu`) has no caller, and it is the only thing that calls `fillTestCardData()` (`core/test-mode.ts › TestModeManager.fillTestCardData`). Do not expect to pick a card brand.',
    ],
  }),

  defineCoreSubsystem({
    id: 'storage',
    title: 'Storage and expiry',
    summary:
      'Where the SDK keeps the cart, the campaign, the order, and attribution between page loads — and how long each one stays valid.',
    sources: ['core/storage.ts'],
    howAuthorsReachIt: ['observed'],
    reference: ['storage-keys'],
    cautions: [
      'There is no single expiry setting. Each kind of data carries its own TTL in its own constant, so "the cache is 10 minutes" is true of the campaign and wrong about everything else — check the key you actually care about.',
    ],
  }),

  defineCoreSubsystem({
    id: 'logging-and-debug',
    title: 'Logging and the debug overlay',
    summary:
      'What the SDK prints to the browser console, and the on-page overlay that shows you the cart, the campaign, and every analytics event as they happen.',
    sources: [
      'core/logger.ts',
      'core/debug/',
      // The Analytics panel's per-provider delivery status comes from here, not from
      // core/debug/ — a reader chasing "my provider got nothing" ends up in this file.
      'core/analytics/debug/analytics-debug-tracker.ts',
    ],
    howAuthorsReachIt: ['debug-only', 'observed'],
    reference: ['logs', 'url-parameters', 'meta-tags'],
    cautions: [
      'There are four ways to turn debugging on and they do different things. `?debug=true` prints `info` and `warn` but not `debug` lines and opens no overlay; `nextConfig.debug` adds `debug` lines and `window.nextDebug` but still no overlay; the `next-debug` meta tag installs `window.nextDebug` and prints **nothing**, because `Logger` reads only the URL and `window.nextConfig` (`core/logger.ts › isDebugModeEnabled`); only `?debugger=true` gives you the lines *and* the overlay. Reach for `?debugger=true` unless you know you want less.',
      'On the fallback UMD bundle every `console` call is removed at build time — errors included — so a page there prints nothing at any level and no switch can restore it. If the console is silent on a clearly broken page, check which bundle loaded before concluding nothing failed.',
    ],
  }),

  defineCoreSubsystem({
    id: 'event-bus',
    title: 'Event bus',
    summary:
      'How your code hears about what the SDK did — an item added, the cart recalculated, an order completed — through `next.on(...)`.',
    sources: ['core/events.ts'],
    howAuthorsReachIt: ['subscribed'],
    cautions: [
      'Some events are dispatched as DOM `CustomEvent`s rather than on the bus, and a few go out on only one of the two channels. `next.on()` for a DOM-only event never fires, with no error to explain it. `bundle:price-updated`, `selector:price-updated` and `toggle:price-updated` are the DOM-only ones; listen for them on the element instead. The per-feature `reference/events.md` pages say which channel carries each event.',
      '**16 of the 73 `EventMap` entries are declared and never emitted by this build**, and they look identical to live ones in the type — so a handler wired to one silently never runs and reads as a broken feature. Each is marked `@deprecated` in `src/types/global.ts` naming what to use instead; check there before building on an event you have not seen fire.',
      'Subscribing early is not the same as catching everything. Several events are emitted during boot before any page code can be listening — `sdk:url-parameters-processed` and `currency:fallback` both fire at boot step 5 — and the bus does not replay. For those, read the resulting state instead of waiting for the event.',
    ],
  }),

  defineCoreSubsystem({
    id: 'attribution',
    title: 'Attribution capture',
    summary:
      'Captures where the visitor came from — UTM tags, affiliate and click ids, funnel name — at the start of the visit, and attaches it to the order they place.',
    sources: ['core/attribution/'],
    howAuthorsReachIt: ['configured', 'observed'],
    reference: ['url-parameters', 'meta-tags', 'storage-keys'],
    cautions: [
      'It is **last-touch per parameter**, not first-touch. `getStoredValue()` (`core/attribution/attribution-collector.ts › AttributionCollector.getStoredValue`) reads the URL first and mirrors a hit back into storage, so a second tagged link in the same session re-credits that parameter; a parameter absent from the URL carries over from storage instead. `?funnel=` is the most emphatic case — it always wins and logs `🔄 Funnel override`. So a value you did not expect is a carry-over-versus-overwrite question, not proof the tag was lost.',
      '`first_visit_timestamp` is the exception that does not survive a new tab: the collector recovers it from `localStorage["next-attribution"]`, and the store only ever writes that key to sessionStorage. Returning-visitor logic built on it always reports a first visit. Write your own localStorage marker if you need truth across tabs.',
    ],
  }),

  defineCoreSubsystem({
    id: 'error-handling',
    title: 'Error capture',
    summary:
      'Watches for runtime errors the SDK or the page throws and announces each one on the event bus, so your monitoring can see a failure the visitor cannot.',
    sources: ['core/monitoring/error-handler.ts'],
    howAuthorsReachIt: ['subscribed'],
    reference: ['errors'],
    emits: ['error:occurred'],
    cautions: [
      "It observes and reports; it does not contain failures. Keeping one broken feature from taking the page down is each feature's own `try/catch` (`core/base/base-enhancer.ts › BaseEnhancer.handleError`), not this. So silence here is not evidence that nothing broke.",
      'It replaces `console.error` to observe errors, and its filter accepts any string containing "error". So anything your own code logs through `console.error` also arrives as `error:occurred`, and an enhancer failure arrives **twice** — once from the feature and once from the console line it wrote. Deduplicate before alerting on the count.',
      'Capture is installed at boot step 9 through an import that is **not awaited** (`core/sdk-initializer.ts › SDKInitializer.initializeErrorHandler`), so nothing earlier in boot produces `error:occurred` — config, geo, campaign load, analytics, and a first failed boot attempt are all outside its window. If a failure disappears without an event, check whether it happened before this installed.',
    ],
  }),

  defineCoreSubsystem({
    id: 'analytics',
    title: 'Analytics',
    summary:
      'Turns shopper behaviour into ecommerce events and hands them to whichever providers you configured — Google Tag Manager, Facebook, RudderStack, or your own endpoint.',
    sources: ['core/analytics/'],
    howAuthorsReachIt: ['configured', 'called'],
    reference: ['analytics-events', 'analytics-providers'],
    cautions: [
      'Analytics sends nothing until it is switched on, and no meta tag switches it on — so a page with providers configured and analytics left at its default is silent. Conversely, once enabled with no providers at all, every event still lands on `window.NextDataLayer`.',
      'A provider that is configured and receives nothing has three separate places it can be dropped, none of which throws. Read the per-provider outcome the debug tracker records rather than inferring from the absence of an event.',
    ],
  }),
];

/** Every subsystem id, for the coverage gate's denominator. */
export const CORE_SUBSYSTEM_IDS = CORE_SUBSYSTEMS.map(s => s.id);
