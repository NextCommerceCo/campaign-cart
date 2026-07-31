---
title: "Core/Reference/Boot Sequence"
group: "Core"
category: "Core Reference"
---

# Boot sequence

<!-- Generated from src/core/sdk-initializer.ts. Do not edit by hand:
     edit the source or STEP_NOTES in src/docs/render/render-boot-sequence.ts,
     then run `npm run docs:reference`. -->

The SDK boots once per page load, in 14 steps, and only the last of them makes `window.next` usable. This page is the order those steps run in, what each one gives the page, and which signal to wait for before your own code touches the cart.

## Wait for `next:initialized`, not `next:ready`

There are two events with similar names and a long gap between them. `next:ready` means the SDK **file** arrived. `next:initialized` means the SDK **ran**. Only the second one tells you the cart is restored, campaign prices are loaded, and `window.next` exists.

```html
<script>
  // Runs after boot, whether the SDK has already finished or not.
  window.nextReady = window.nextReady || [];
  window.nextReady.push(function (next) {
    console.log('cart total', next.getCartData().totals.total.value);
  });

  // The event form, for code that is not holding a reference to the queue.
  window.addEventListener('next:initialized', function () {
    document.body.classList.add('my-page-is-live');
  });
</script>
```

`window.nextReady` works before boot and after it: the loader creates it as an array that collects callbacks, and step 12 drains that array and replaces it with an object whose `push` runs callbacks immediately. Pushing is therefore safe at any point in the page.

## The order

Read the **Boot waits?** column as "does the next step wait for this one to finish". Read **If it fails** as what happens to the rest of the page when this step throws.

| # | Step | Boot waits? | Runs | If it fails | Source |
|---|---|---|---|---|---|
| 1 | **`waitForDOM`**<br>Waits for `DOMContentLoaded` when the document is still parsing. Nothing below runs until `<body>` exists. | yes | always | nothing in it can throw or reject | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 2 | **`loadConfiguration`**<br>Reads settings from `window.nextConfig`, then from the `<meta name="next-*">` tags, which win on conflict. Also stores every URL parameter for the rest of the session and honours `?reset=true` by clearing SDK storage. | yes | always | **aborts the boot** | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 3 | **`initializeLocationAndCurrency`**<br>Detects the visitor's country and picks the display currency, before campaign prices are fetched so they arrive in the right currency. Skipped when `window.nextConfig.currencyBehavior` is `'manual'`; `?country=` and `?currency=` override detection, and detection gives up after 3 seconds and falls back to US / USD. | yes | always | logged, boot continues | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 4 | **`initializeAttribution`**<br>Captures where the visitor came from — UTM tags, click ids, referrer, landing page — so the values are attached to the order later. Adds the SDK version and the detected IP to the attribution metadata. | yes | always | logged, boot continues | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 5 | **`loadCampaignData`**<br>Fetches the campaign with your API key: packages, prices, shipping methods, and the countries it ships to. **This is the step that needs `next-api-key`** — until it finishes, no price on the page has a real value. | yes | always | **aborts the boot** — `API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey` | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 6 | **`initializeAnalytics`**<br>Starts the analytics pipeline after campaign data exists, so product-level events have prices to report. It stays dormant unless a provider is configured. | yes | always | logged, boot continues | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 7 | **`waitForStoreRehydration`**<br>Restores a cart saved earlier in the session from sessionStorage and recalculates its totals. This is why cart-reading code has to wait for boot: before this step the cart looks empty even when the visitor has items. | yes | always | **aborts the boot** if recalculating totals throws — the 50 ms wait itself cannot fail | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 8 | **`cartOperations.clear`**<br>Empties the restored cart when the page asks for a clean start with `<meta name="next-clear-cart" content="true">`. Used on landing pages that must not inherit a cart from an earlier visit. | no | only when `useConfigStore.getState().clearCartOnInit` | not analysed here — the call leaves `SDKInitializer` | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 9 | **`initializeErrorHandler`**<br>Installs the global handler that captures uncaught errors from SDK code. It loads in the background rather than being waited for, so treat it as available shortly after boot rather than exactly at boot. | no | always | logged, boot continues | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 10 | **`checkAndLoadOrder`**<br>Loads an existing order when the URL carries `?ref_id=` or `?order_ref_id=`, which is what makes receipt and post-purchase upsell pages work on a plain link. | yes | always | logged, boot continues | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 11 | **`scanAndEnhanceDOM`**<br>Scans `<body>` for `data-next-*` attributes and turns each match into a live feature. This is the step that fills in prices, totals, and selectors — before it, the markup is whatever you wrote by hand. | yes | always | boot continues — the awaited call is unguarded, but the scanner catches every error inside itself and never rejects | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 12 | **`setupReadyCallbacks`**<br>Publishes `window.next` and runs every callback queued on `window.nextReady`, then replaces the queue with an object whose `push` runs callbacks immediately. Nothing you call on `window.next` can work before this step. | no | always | logged, boot continues | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 13 | **`initializeDebugMode`**<br>Loads the debug overlay and `window.nextDebug` when debug mode is on — `?debugger=true`, `<meta name="next-debug" content="true">`, or `window.nextConfig.debug` — and turns logging up to `DEBUG`. Does nothing on a normal page load. | yes | always | **aborts the boot** | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| 14 | **`emitInitializedEvent`**<br>Dispatches `next:initialized` on `window`. Boot is over: everything above has finished, so this is the signal to build page logic on. | no | always | nothing in it can throw or reject | `core/sdk-initializer.ts › SDKInitializer.initialize` |

Calling `initialize()` a second time logs `SDK already initialized` and returns without repeating any of this. Re-running the sequence on purpose goes through `SDKInitializer.reinitialize()`, which tears the DOM scanner down first.

## What the page can watch

Two markers land on the document, and they answer different questions. The attribute says the SDK is running; the class says the page is safe to show.

| Written | Where | Means | Source |
|---|---|---|---|
| `data-next-sdk-loading="true"` | `<body>` | boot has started — nothing on the page has real values yet | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| `data-next-sdk-loading="false"` | `<body>` | boot finished — every step in the table above ran | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| `data-next-sdk-loading="false"` | `<body>` | a step threw — see [When a step fails](#when-a-step-fails) | `core/sdk-initializer.ts › SDKInitializer.initialize` |
| class `next-display-ready` | `<html>` | the DOM scan finished and display bindings have their first values | `core/attribute-scanner.ts › AttributeScanner.scanAndEnhance` |

A reveal rule wants both — the attribute alone flips to `"false"` on the failure path too:

```css
/* Hide un-enhanced prices while the SDK works. */
body[data-next-sdk-loading="true"] .price { visibility: hidden; }

/* Reveal only once the DOM scan actually resolved values. */
html.next-display-ready .price { visibility: visible; }
```

### Events

| Event | Listen on | Meaning | `detail` | Source |
|---|---|---|---|---|
| `next:ready` | `window.addEventListener` | The SDK **file** finished downloading. Boot has not started. Not a readiness signal. | `loadTime`, `version`, `mode` | `public/loader.js › moduleScript` (3 dispatch sites) |
| `next:display-ready` | `window.addEventListener` | The DOM scan finished and display bindings resolved their first values. Fires inside the DOM-scan step, so `window.next` does not exist yet. | `enhancedCount`, `root` | `core/attribute-scanner.ts › AttributeScanner.scanAndEnhance` |
| `next:initialized` | `window.addEventListener` | Boot finished. `window.next` exists, the cart is restored, and campaign data is loaded. **This is the one to listen for.** | `version`, `timestamp`, `stats` | `core/sdk-initializer.ts › SDKInitializer.emitInitializedEvent` |
| `sdk:url-parameters-processed` | `next.on()` | Internal, on the SDK event bus rather than on `window`: URL overrides such as `?forcePackageId=` have been applied to the cart, so features can re-evaluate. | — | `core/sdk-initializer.ts › SDKInitializer.loadCampaignData` |

## When a step fails

An error in any step marked **aborts the boot** above stops the sequence there, so no later step runs. The whole sequence is then retried up to **3 times**, waiting 1s, then 2s, then 3s before each attempt (`core/sdk-initializer.ts › SDKInitializer.initialize`).

What the visitor sees in the meantime is the part worth planning for:

- `data-next-sdk-loading` is set back to `"false"` on the failure path, the same value it gets on success. CSS that reveals the page on `"false"` reveals it with nothing filled in — raw `{price}` placeholders and an empty cart.
- The `next-display-ready` class is **not** added, because the DOM scan never ran. That is the signal that separates a finished boot from an abandoned one.
- `window.next` is never published and callbacks queued on `window.nextReady` never run, so page code waiting on either stays silent rather than erroring.
- Each retry re-runs every step from the top, so the console shows the whole boot log again. Duplicate boot logs mean the first attempt failed — look for the earlier `SDK initialization failed:` line rather than treating the repetition as a page bug.
- After the last retry the error is re-thrown. Nothing catches it (`src/index.ts` calls `initialize()` without a handler), so it surfaces as an unhandled promise rejection.

### Errors that stop the boot

| Message | Step | Source |
|---|---|---|
| `API key not found. Please set next-api-key meta tag or window.nextConfig.apiKey` | 5. `loadCampaignData` | `core/sdk-initializer.ts › SDKInitializer.loadCampaignData` |

Steps 2 (`loadConfiguration`) and 13 (`initializeDebugMode`) carry no error message of their own, and no `catch` either — a rejected request or a failed dynamic import inside them lands on the same retry path.

## Cautions

- **`next:ready` is not a readiness signal.** It fires as soon as the SDK module finishes downloading, before step 1 has run. A listener that calls `next.getCartData()` there reads `undefined` — `window.next` does not exist yet — or, on a slow campaign request, an empty cart. Listen for `next:initialized` or push onto `window.nextReady` instead.
- **A missing API key aborts the boot instead of degrading it.** Without `<meta name="next-api-key" content="…">` (or `window.nextConfig.apiKey`), the campaign step throws, so there is no DOM scan, no `window.next`, and no `next-display-ready` class — yet `data-next-sdk-loading` still ends up `"false"`. A page that reveals itself on that attribute alone shows raw `{price}` placeholders. Add the meta tag, and gate the reveal on the `next-display-ready` class as well.
- **The cart looks empty until the rehydration step finishes.** Code that reads cart contents from a `DOMContentLoaded` handler or an inline script sees zero items even when the visitor has a full cart, because the saved cart is restored partway through boot. Move that code into a `window.nextReady` callback.
- **A failed DOM scan does not fail the boot.** The scanner catches its own errors, so `next:initialized` can fire while `next-display-ready` and `next:display-ready` never arrive and parts of the page stay un-enhanced. When enhanced elements are missing but boot reported success, search the console for `Error during scan and enhance` rather than re-checking your attributes.
- **Debug mode participates in the boot.** With debug on, the overlay is imported inside the sequence, so a failure fetching that chunk aborts a boot that would have succeeded in production. Reproduce boot failures with debug off before concluding the page is broken.
