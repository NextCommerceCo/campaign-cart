---
title: "Core/Reference/Window Surface"
group: "Core"
category: "Core Reference"
---

# The `window` surface

<!-- Generated. Do not edit by hand: edit src/docs/content/next-methods.ts
     for the prose, or the source under src/core and src/features for what is inventoried, then run
     `UPDATE_DOCS=1 npx vitest run src/tests/docs/nextMethods.test.ts`. -->

Loading the SDK puts 28 names on `window` and reads 3 more that your page sets — 31 in total. Most of them are not part of the API you should build on, and knowing which is which is the point of this page: a name that only exists in debug mode, or that the SDK deletes halfway through boot, will work when you try it in a console and fail in production.

Every entry below is read out of the source, so the list cannot fall behind the code. The calls on `window.next` itself are documented separately, in the [JavaScript API](./javascript-api.md).

| | Meaning |
|---|---|
| **install** | The SDK assigns this. It exists because the SDK is on the page. |
| **read** | Your page assigns it and the SDK reads it. Setting it is how you configure the SDK. |

## Everything at a glance

| Global | Direction | In the code |
|---|---|---|
| [`window.next`](#windownext) | install | `core/sdk-initializer.ts › SDKInitializer.setupReadyCallbacks` |
| [`window.nextReady`](#windownextready) | install | `core/sdk-initializer.ts › SDKInitializer.setupReadyCallbacks` |
| [`window.nextConfig`](#windownextconfig) | read | `core/debug/debug-module.ts › DebugModule.initializeIfEnabled` and 10 more |
| [`window.__NEXT_SDK_VERSION__`](#window__next_sdk_version__) | read | `core/debug/panels/config-panel.ts › ConfigPanel.getOverviewContent` and 3 more |
| [`window.NextDataLayer`](#windownextdatalayer) | install | `core/analytics/data-layer-manager.ts › DataLayerManager.initializeDataLayer`, `core/analytics/data-layer-manager.ts › DataLayerManager.clear` |
| [`window.NextDataLayerTransformFn`](#windownextdatalayertransformfn) | install | `core/analytics/data-layer-manager.ts › DataLayerManager.initializeDataLayer` and 2 more |
| [`window.NextAnalytics`](#windownextanalytics) | install | `core/analytics/index.ts` |
| [`window.NextDataLayerManager`](#windownextdatalayermanager) | install | `core/analytics/index.ts` |
| [`window.NextMetaTagController`](#windownextmetatagcontroller) | install | `core/analytics/index.ts` |
| [`window.NextInvalidateContext`](#windownextinvalidatecontext) | install | `core/analytics/index.ts` |
| [`window.NextAnalyticsClearIgnore`](#windownextanalyticsclearignore) | install | `core/analytics/index.ts` |
| [`window.nextCampaign`](#windownextcampaign) | read | `core/analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.sendEvent` and 3 more |
| [`window.dataLayer`](#windowdatalayer) | install | `core/analytics/providers/gtm-adapter.ts › GTMAdapter.sendEvent`, `core/debug/panels/event-timeline/event-timeline-panel.capture.ts › watchDataLayer` |
| [`window.ElevarDataLayer`](#windowelevardatalayer) | install | `core/analytics/providers/gtm-adapter.ts › GTMAdapter.sendEvent` |
| [`window._nextForcePackageId`](#window_nextforcepackageid) | install | `core/sdk-initializer.ts › SDKInitializer.loadConfiguration` |
| [`window._nextForceShippingId`](#window_nextforceshippingid) | install | `core/sdk-initializer.ts › SDKInitializer.loadConfiguration` |
| [`window._nextForceBundleId`](#window_nextforcebundleid) | install | `core/sdk-initializer.ts › SDKInitializer.loadConfiguration` |
| [`window.nextDebug`](#windownextdebug) | install | `core/debug/debug-module.ts › DebugModule.setupGlobalDebugAccess`, `core/sdk-initializer.ts › SDKInitializer.setupGlobalDebugUtils` |
| [`window.validateFormats`](#windowvalidateformats) | install | `features/display/display-core/format-validator.ts` |
| [`window.eventTimelinePanel_*`](#windoweventtimelinepanel_) | install | 11 names, see below |
| [`window.fetch`](#windowfetch) | install | `core/debug/debug-event-manager.ts › DebugEventManager.interceptFetch` |

## What your page should use

Two globals the SDK installs for you to call, and two it reads from what you set. These are supported: build on them.

### `window.next`

The SDK itself — every call in the [JavaScript API](./javascript-api.md) hangs off this.

```ts
await window.next.addItem({ packageId: 2 });
```

> ⚠️ Assigned late in boot, so it is `undefined` for any script that runs before the SDK is ready. Reading `next.getCartCount()` at the top of a page script throws — use `nextReady.push()`.

<sub>Assigned in `core/sdk-initializer.ts › SDKInitializer.setupReadyCallbacks`</sub>

### `window.nextReady`

The queue for code that needs the SDK before you know whether it has loaded — push a function and it runs with the SDK as its argument.

```ts
// Works whether the SDK has loaded yet or not.
window.nextReady = window.nextReady || [];
window.nextReady.push(sdk => {
  console.log('cart count at boot:', sdk.getCartCount());
});
```

**What is on it:**

- `push`

> ⚠️ It changes shape during boot: an array you create, replaced by an object with a `push` method that runs callbacks immediately. Only ever call `push` on it — treating it as an array afterwards (`nextReady.length`, `nextReady.map`) fails.

<sub>Assigned in `core/sdk-initializer.ts › SDKInitializer.setupReadyCallbacks`</sub>

### `window.nextConfig`

The configuration object your page sets before the SDK loads — API key, debug flag, page type, and analytics settings.

```html
<script>
  window.nextConfig = {
    apiKey: '{YOUR_CAMPAIGN_API_KEY}',
    debugger: false,
    pageType: 'product',
  };
</script>
<script src="{SDK_LOADER_URL}"></script>
```

> ⚠️ Read during boot, so it has to be set before the SDK script runs; assigning it afterwards changes nothing. Meta tags override it where both are present.

<sub>Read in `core/debug/debug-module.ts › DebugModule.initializeIfEnabled`, `core/debug/debug-module.ts › DebugModule.isDebugMode`, `core/debug/debug-overlay/debug-overlay.ts › DebugOverlay.constructor`, `core/debug/debug-overlay/debug-overlay.ts › DebugOverlay.initialize`, `core/debug/panels/event-timeline/event-timeline-panel.ts › EventTimelinePanel.constructor`, `core/logger.ts › isDebugModeEnabled`, `core/sdk-initializer.ts › SDKInitializer.loadConfiguration`, `core/test-mode.ts › TestModeManager.checkUrlTestMode`, `core/url-utils.ts › isDebugMode`, `core/url-utils.ts › isDebuggerMode`, `features/cart/cart-item-list/cart-item-list.renderer.ts › prepareCartItemData`</sub>

### `window.__NEXT_SDK_VERSION__`

The version the loader script reports, which `next.getVersion()` prefers over the build-time value.

```ts
console.log(window.__NEXT_SDK_VERSION__ ?? 'set by the loader only');
```

> ⚠️ Only the loader sets it. On a page that imports the bundle directly it is `undefined`, and `next.getVersion()` falls back to the build-time version — which is the accurate one in that case.

<sub>Read in `core/debug/panels/config-panel.ts › ConfigPanel.getOverviewContent`, `core/debug/panels/config-panel.ts › ConfigPanel.getSettingsContent`, `core/next-commerce.ts › NextCommerce.getVersion`, `core/sdk-initializer.ts › SDKInitializer.initializeAttribution`</sub>

## Analytics and tag-manager hooks

Installed so a tag manager, or your own reporting code, can see and reshape events without importing anything. Stable enough to integrate against, but they are an integration seam rather than the page API — reach for `next.track*` first.

### `window.NextDataLayer`

The SDK's own event array — every analytics event it emits is pushed here, in order, whether or not any provider is configured.

```ts
console.table(window.NextDataLayer);
```

> ⚠️ Emptied when the data layer reinitialises, so it is a live view rather than a complete session log. Do not read a length from it and assume it only grows.

<sub>Assigned in `core/analytics/data-layer-manager.ts › DataLayerManager.initializeDataLayer`, `core/analytics/data-layer-manager.ts › DataLayerManager.clear`</sub>

### `window.NextDataLayerTransformFn`

A hook for rewriting every event before it is dispatched — rename fields, add your own, or drop the event.

```ts
window.NextDataLayerTransformFn = event => ({
  ...event,
  store_id: '{YOUR_STORE_ID}',
});
```

> ⚠️ Assign it **after** the SDK is up — from inside `window.nextReady.push()`. The analytics engine's constructor sets this slot to `null` unconditionally, so a transform assigned in a `<script>` tag before the SDK loads is discarded and every event goes out untransformed. It also runs on every event, so a throw inside it costs you analytics across the whole page — keep it free of anything that can fail.

<sub>Assigned in `core/analytics/data-layer-manager.ts › DataLayerManager.initializeDataLayer`, `core/analytics/data-layer-manager.ts › DataLayerManager.setTransformFunction`, `core/analytics/index.ts › NextAnalytics.constructor`</sub>

### `window.NextAnalytics`

The analytics engine, for reading its status and provider list from a console.

```ts
console.log(window.NextAnalytics.getStatus());
```

> ⚠️ An internal object exposed for inspection. Prefer `next.track*` and `next.setDebugMode()`; methods here are free to change.

<sub>Assigned in `core/analytics/index.ts`</sub>

### `window.NextDataLayerManager`

The data-layer manager behind `NextDataLayer`, for setting a transform function or inspecting configuration at runtime.

```ts
window.NextDataLayerManager.setTransformFunction(event => event);
```

> ⚠️ Internal, same as `NextAnalytics`. The supported seam is `NextDataLayerTransformFn`.

<sub>Assigned in `core/analytics/index.ts`</sub>

### `window.NextMetaTagController`

Reads the analytics configuration the page declares in `<meta>` tags, for checking what the SDK picked up.

```ts
console.log(window.NextMetaTagController.getConfig?.());
```

> ⚠️ Internal. Meta tags are the interface; this object is how the SDK reads them.

<sub>Assigned in `core/analytics/index.ts`</sub>

### `window.NextInvalidateContext`

Tells analytics the route changed, for a single-page app that cannot import from the SDK.

```ts
window.NextInvalidateContext();
```

> ⚠️ The same thing as `next.invalidateAnalyticsContext()`. Two doors to one behaviour; prefer the method, and use this only from code that has no reference to `next`.

<sub>Assigned in `core/analytics/index.ts`</sub>

### `window.NextAnalyticsClearIgnore`

Clears the flag that suppresses analytics for a session — the escape hatch after a page was marked as internal traffic.

```ts
window.NextAnalyticsClearIgnore();
```

> ⚠️ If events stopped arriving from one browser and nothing else explains it, the ignore flag is the thing to check, and this is how you clear it.

<sub>Assigned in `core/analytics/index.ts`</sub>

### `window.nextCampaign`

The NextCampaign vendor SDK. When its script is on the page, the SDK forwards analytics events into it.

```ts
if (window.nextCampaign) {
  console.log('NextCampaign provider is live');
}
```

> ⚠️ Loaded by the SDK when that provider is configured, and read back once present. If the script never loads, events raise a dispatch failure rather than being silently dropped — check the console before assuming the provider is off.

<sub>Read in `core/analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.sendEvent`, `core/analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.performLoad`, `core/analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.sendPageView`, `core/analytics/providers/next-campaign-adapter.ts › NextCampaignAdapter.waitForNextCampaign`</sub>

## Third-party arrays the SDK fills

Not the SDK's namespace. It creates these if the vendor script has not, so that events queued before the vendor loads are not lost.

### `window.dataLayer`

Google Tag Manager's event queue. The SDK creates it if absent and pushes its events there.

```ts
console.log(window.dataLayer.filter(e => e.event?.startsWith('dl_')));
```

> ⚠️ Created with `window.dataLayer = window.dataLayer || []`, so an existing queue is preserved and load order does not matter. Do not reassign it — replacing the array orphans everything GTM has already read.

<sub>Assigned in `core/analytics/providers/gtm-adapter.ts › GTMAdapter.sendEvent`, `core/debug/panels/event-timeline/event-timeline-panel.capture.ts › watchDataLayer`</sub>

### `window.ElevarDataLayer`

Elevar's event queue, created and filled the same way as `dataLayer`.

> ⚠️ Created even when Elevar is not in use, in which case it stays an empty array.

<sub>Assigned in `core/analytics/providers/gtm-adapter.ts › GTMAdapter.sendEvent`</sub>

## Preview and QA overrides

Set from URL parameters during boot and consumed once the campaign has loaded, so a tester can force a selection without editing the page. They are not part of the API — the URL parameter is the interface.

### `window._nextForcePackageId`

Pre-loads the cart with a package for preview, taken from the `?forcePackageId=` URL parameter.

```ts
// Open the page with:
// https://example.com/offer?forcePackageId=2
```

> ⚠️ Consumed and deleted once the campaign has loaded, so reading it later gives `undefined` even though it worked. Drive it from the URL, not from script.

<sub>Assigned in `core/sdk-initializer.ts › SDKInitializer.loadConfiguration`</sub>

### `window._nextForceShippingId`

Pre-selects a shipping method for preview, from the `?forceShippingId=` URL parameter.

```ts
// https://example.com/checkout?forceShippingId=1
```

> ⚠️ Consumed and deleted after the campaign loads, same as `_nextForcePackageId`.

<sub>Assigned in `core/sdk-initializer.ts › SDKInitializer.loadConfiguration`</sub>

### `window._nextForceBundleId`

Forces which bundle card starts selected, from the `?forceBundleId=` URL parameter — overriding `data-next-selected` in the markup.

```ts
// One selector on the page:
// https://example.com/offer?forceBundleId=3
// Several selectors, addressed by id:
// https://example.com/offer?forceBundleId=main:3,upsell:7
```

> ⚠️ Unlike the other two this one is not deleted after use, because the bundle selector reads it when it initialises, which can be after the campaign has loaded.

<sub>Assigned in `core/sdk-initializer.ts › SDKInitializer.loadConfiguration`</sub>

## Debug-only globals

Present only in debug mode, or only for typing into a console. Every one of them can change or vanish in a patch release, so nothing on a customer page may depend on them. Turn debug mode on with `?debugger=true` or `window.nextConfig.debugger`.

### `window.nextDebug`

The console toolbox: the raw stores, cart shortcuts, campaign cache controls, analytics status, attribution tools, and order inspection.

```ts
// With ?debugger=true on the URL:
nextDebug.stores.cart.getState().items;
nextDebug.addToCart(2, 1);
nextDebug.getCacheInfo();
nextDebug.attribution.debug();
```

**What is on it:**

- `overlay`
- `enableDebug`
- `disableDebug`
- `toggleDebug`
- `isDebugMode`
- `testMode`
- `stores` — `cart`, `campaign`, `config`, `checkout`, `order`, `attribution`
- `sdk`
- `reinitialize`
- `getStats`
- `addToCart`
- `removeFromCart`
- `updateQuantity`
- `loadCampaign`
- `clearCampaignCache`
- `getCacheInfo`
- `inspectPackage`
- `testShippingMethod`
- `sortPackages`
- `analytics` — `getStatus`, `getProviders`, `track`, `setDebugMode`, `invalidateContext`
- `attribution` — `debug`, `get`, `setFunnel`, `setEvclid`, `clearFunnel`, `getFunnel`
- `highlightElement`
- `addTestItems`
- `accordion` — `open`, `close`, `toggle`
- `order` — `getJourney`, `isExpired`, `clearCache`, `getStats`

> ⚠️ It hands out the six Zustand stores directly, and a `setState` on one of those skips every operation that carries the pricing and event logic — the cart will disagree with its totals and with analytics. Read through it; write through `next.*`. Absent entirely when debug mode is off, and assembled in two passes (boot, then the debug overlay), so a key can appear a moment after the object does.

<sub>Assigned in `core/debug/debug-module.ts › DebugModule.setupGlobalDebugAccess`, `core/sdk-initializer.ts › SDKInitializer.setupGlobalDebugUtils`</sub>

### `window.validateFormats`

Checks every display binding on the page for a malformed format string, logs a report, and outlines the offending elements.

```ts
validateFormats(); // returns the report as well as logging it
```

> ⚠️ Installed whenever the display code loads, not only in debug mode, but it is a console tool — it writes to the console and mutates element outlines.

<sub>Assigned in `features/display/display-core/format-validator.ts`</sub>

### `window.eventTimelinePanel_*`

Eleven click handlers for the debug overlay's event-timeline panel, on `window` because the panel wires its buttons with inline `onclick`.

Covers 11 names: `eventTimelinePanel_showModal`, `eventTimelinePanel_closeModal`, `eventTimelinePanel_setTab`, `eventTimelinePanel_selectFlowNode`, `eventTimelinePanel_search`, `eventTimelinePanel_filterProvider`, `eventTimelinePanel_toggleIssues`, `eventTimelinePanel_clearFilters`, `eventTimelinePanel_toggleDrawer`, `eventTimelinePanel_toggleInternal`, `eventTimelinePanel_setView`.

> ⚠️ Implementation detail of the overlay. They exist only while that panel is open, and calling one from your own code drives the panel's UI, nothing else.

### `window.fetch`

The browser's own `fetch`, wrapped by the debug event manager so API calls appear in the event timeline.

> ⚠️ A monkey-patch of a browser global — the one entry here that changes behaviour outside the SDK. It delegates to the original and only adds logging, but it is installed for the life of the page and never restored, so anything that also wraps `fetch` will see the patched version. Debug mode only.

<sub>Assigned in `core/debug/debug-event-manager.ts › DebugEventManager.interceptFetch`</sub>

## Cautions

- **Only four names are supported page API:** `next` and `nextReady`, which the SDK installs, plus the two it reads — `nextConfig`, which you set, and `__NEXT_SDK_VERSION__`, which the loader sets. Everything else is an integration seam or a debug tool and may change in a patch release.
- **`nextReady` changes type during boot** — an array before, an object with `push` after. Only ever call `push` on it.
- **`nextDebug` hands out the raw stores.** A `setState` on one bypasses the cart operations, so totals and analytics stop matching the visible cart. Read through it, write through `next.*`.
- **`nextDebug` is absent when debug mode is off,** so a snippet developed against it fails silently in production. Gate on `window.nextDebug` or, better, do not ship it.
- **The `_nextForce*` globals are consumed and deleted** (all but `_nextForceBundleId`). Reading one back after boot tells you nothing about whether it took effect.
- **`window.fetch` is wrapped in debug mode** and never restored. Anything else on the page that wraps `fetch` will be wrapping the SDK's wrapper.
- **Never reassign `dataLayer`.** The SDK and the tag manager share the array by reference; replacing it orphans every event already queued.
