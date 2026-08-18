---
title: "Reference/Window Globals"
group: "Reference"
category: "Reference"
---

# Window globals

Loading the SDK puts a handful of objects on `window`. Use this page when you need to reach one from your own script, when a tag manager needs the event array, or when you find a `next*` global in a console and want to know whether it is yours to call.

Each entry says whether the SDK installs it or reads what you set, and which of them are debugging tools rather than API.


## Page globals

| Global | Description |
|---|---|
| [`window.next`](#windownext) | The SDK itself — every call in the JavaScript API hangs off this. |
| [`window.nextReady`](#windownextready) | The queue for code that needs the SDK before you know whether it has loaded — push a function and it runs with the SDK as its argument. |
| [`window.nextConfig`](#windownextconfig) | The configuration object your page sets before the SDK loads — API key, debug flag, page type, and analytics settings. |
| [`window.__NEXT_SDK_VERSION__`](#window__next_sdk_version__) | The version the loader script reports, which `next.getVersion()` prefers over the build-time value. |


## Analytics and tag-manager hooks

| Global | Description |
|---|---|
| [`window.NextDataLayer`](#windownextdatalayer) | The SDK's own event array — every analytics event it emits is pushed here, in order, whether or not any provider is configured. |
| [`window.NextDataLayerTransformFn`](#windownextdatalayertransformfn) | A hook for rewriting every event before it is dispatched — rename fields, add your own, or drop the event. |
| [`window.NextAnalytics`](#windownextanalytics) | The analytics engine, for reading its status and provider list from a console. |
| [`window.NextDataLayerManager`](#windownextdatalayermanager) | The data-layer manager behind `NextDataLayer`, for setting a transform function or inspecting configuration at runtime. |
| [`window.NextMetaTagController`](#windownextmetatagcontroller) | Reads the analytics configuration the page declares in `<meta>` tags, for checking what the SDK picked up. |
| [`window.NextInvalidateContext`](#windownextinvalidatecontext) | Tells analytics the route changed, for a single-page app that cannot import from the SDK. |
| [`window.NextAnalyticsClearIgnore`](#windownextanalyticsclearignore) | Clears the flag that suppresses analytics for a session — the escape hatch after a page was marked as internal traffic. |
| [`window.nextCampaign`](#windownextcampaign) | The NextCampaign vendor SDK. |


## Third-party arrays

| Global | Description |
|---|---|
| [`window.dataLayer`](#windowdatalayer) | Google Tag Manager's event queue. |
| [`window.ElevarDataLayer`](#windowelevardatalayer) | Elevar's event queue, created and filled the same way as `dataLayer`. |


## Preview and QA overrides

| Global | Description |
|---|---|
| [`window._nextForcePackageId`](#window_nextforcepackageid) | Pre-loads the cart with a package for preview, taken from the `?forcePackageId=` URL parameter. |
| [`window._nextForceShippingId`](#window_nextforceshippingid) | Pre-selects a shipping method for preview, from the `?forceShippingId=` URL parameter. |
| [`window._nextForceBundleId`](#window_nextforcebundleid) | Forces which bundle card starts selected, from the `?forceBundleId=` URL parameter — overriding `data-next-selected` in the markup. |


## Debug-only globals

| Global | Description |
|---|---|
| [`window.nextDebug`](#windownextdebug) | The console toolbox: the raw stores, cart shortcuts, campaign cache controls, analytics status, attribution tools, and order inspection. |
| [`window.validateFormats`](#windowvalidateformats) | Checks every display binding on the page for a malformed format string, logs a report, and outlines the offending elements. |
| [`window.eventTimelinePanel_*`](#windoweventtimelinepanel-handlers) | Eleven click handlers for the debug overlay's event-timeline panel, on `window` because the panel wires its buttons with inline `onclick`. |
| [`window.fetch`](#windowfetch) | The browser's own `fetch`, wrapped by the debug event manager so API calls appear in the event timeline. |


## Global reference

One section per global, with what installs it and a runnable example.


### window.next

The SDK itself — every call in the [JavaScript API](./javascript-api.md) hangs off this.

**Direction:** the SDK installs it

```js
await window.next.addItem({ packageId: 2 });
```

Assigned late in boot, so it is `undefined` for any script that runs before the SDK is ready. Reading `next.getCartCount()` at the top of a page script throws — use `nextReady.push()`.


### window.nextReady

The queue for code that needs the SDK before you know whether it has loaded — push a function and it runs with the SDK as its argument.

**Direction:** the SDK installs it

```js
// Works whether the SDK has loaded yet or not.
window.nextReady = window.nextReady || [];
window.nextReady.push(sdk => {
  console.log('cart count at boot:', sdk.getCartCount());
});
```

It changes shape during boot: an array you create, replaced by an object with a `push` method that runs callbacks immediately. Only ever call `push` on it — treating it as an array afterwards (`nextReady.length`, `nextReady.map`) fails.


### window.nextConfig

The configuration object your page sets before the SDK loads — API key, debug flag, page type, and analytics settings.

**Direction:** the SDK reads what you set

```js
<script>
  window.nextConfig = {
    apiKey: '{YOUR_CAMPAIGN_API_KEY}',
    debugger: false,
    pageType: 'product',
  };
</script>
<script src="{SDK_LOADER_URL}"></script>
```

Read during boot, so it has to be set before the SDK script runs; assigning it afterwards changes nothing. Meta tags override it where both are present.


### window.\_\_NEXT_SDK_VERSION\_\_

The version the loader script reports, which `next.getVersion()` prefers over the build-time value.

**Direction:** the SDK reads what you set

```js
console.log(window.__NEXT_SDK_VERSION__ ?? 'set by the loader only');
```

Only the loader sets it. On a page that imports the bundle directly it is `undefined`, and `next.getVersion()` falls back to the build-time version — which is the accurate one in that case.


### window.NextDataLayer

The SDK's own event array — every analytics event it emits is pushed here, in order, whether or not any provider is configured.

**Direction:** the SDK installs it

```js
console.table(window.NextDataLayer);
```

Emptied when the data layer reinitialises, so it is a live view rather than a complete session log. Do not read a length from it and assume it only grows.


### window.NextDataLayerTransformFn

A hook for rewriting every event before it is dispatched — rename fields, add your own, or drop the event.

**Direction:** the SDK installs it

```js
window.NextDataLayerTransformFn = event => ({
  ...event,
  store_id: '{YOUR_STORE_ID}',
});
```

Assign it **after** the SDK is up — from inside `window.nextReady.push()`. The analytics engine's constructor sets this slot to `null` unconditionally, so a transform assigned in a `<script>` tag before the SDK loads is discarded and every event goes out untransformed. It also runs on every event, so a throw inside it costs you analytics across the whole page — keep it free of anything that can fail.


### window.NextAnalytics

The analytics engine, for reading its status and provider list from a console.

**Direction:** the SDK installs it

```js
console.log(window.NextAnalytics.getStatus());
```

An internal object exposed for inspection. Prefer `next.track*` and `next.setDebugMode()`; methods here are free to change.


### window.NextDataLayerManager

The data-layer manager behind `NextDataLayer`, for setting a transform function or inspecting configuration at runtime.

**Direction:** the SDK installs it

```js
window.NextDataLayerManager.setTransformFunction(event => event);
```

Internal, same as `NextAnalytics`. The supported seam is `NextDataLayerTransformFn`.


### window.NextMetaTagController

Reads the analytics configuration the page declares in `<meta>` tags, for checking what the SDK picked up.

**Direction:** the SDK installs it

```js
console.log(window.NextMetaTagController.getConfig?.());
```

Internal. Meta tags are the interface; this object is how the SDK reads them.


### window.NextInvalidateContext

Tells analytics the route changed, for a single-page app that cannot import from the SDK.

**Direction:** the SDK installs it

```js
window.NextInvalidateContext();
```

The same thing as `next.invalidateAnalyticsContext()`. Two doors to one behaviour; prefer the method, and use this only from code that has no reference to `next`.


### window.NextAnalyticsClearIgnore

Clears the flag that suppresses analytics for a session — the escape hatch after a page was marked as internal traffic.

**Direction:** the SDK installs it

```js
window.NextAnalyticsClearIgnore();
```

If events stopped arriving from one browser and nothing else explains it, the ignore flag is the thing to check, and this is how you clear it.


### window.nextCampaign

The NextCampaign vendor SDK. When its script is on the page, the SDK forwards analytics events into it.

**Direction:** the SDK reads what you set

```js
if (window.nextCampaign) {
  console.log('NextCampaign provider is live');
}
```

Loaded by the SDK when that provider is configured, and read back once present. If the script never loads, events raise a dispatch failure rather than being silently dropped — check the console before assuming the provider is off.


### window.dataLayer

Google Tag Manager's event queue. The SDK creates it if absent and pushes its events there.

**Direction:** the SDK installs it

```js
console.log(window.dataLayer.filter(e => e.event?.startsWith('dl_')));
```

Created with `window.dataLayer = window.dataLayer || []`, so an existing queue is preserved and load order does not matter. Do not reassign it — replacing the array orphans everything GTM has already read.


### window.ElevarDataLayer

Elevar's event queue, created and filled the same way as `dataLayer`.

**Direction:** the SDK installs it

Created even when Elevar is not in use, in which case it stays an empty array.


### window._nextForcePackageId

Pre-loads the cart with a package for preview, taken from the `?forcePackageId=` URL parameter.

**Direction:** the SDK installs it

```js
// Open the page with:
// https://example.com/offer?forcePackageId=2
```

> **Watch out:** Consumed and deleted once the campaign has loaded, so reading it later gives `undefined` even though it worked. Drive it from the URL, not from script.


### window._nextForceShippingId

Pre-selects a shipping method for preview, from the `?forceShippingId=` URL parameter.

**Direction:** the SDK installs it

```js
// https://example.com/checkout?forceShippingId=1
```

> **Watch out:** Consumed and deleted after the campaign loads, same as `_nextForcePackageId`.


### window._nextForceBundleId

Forces which bundle card starts selected, from the `?forceBundleId=` URL parameter — overriding `data-next-selected` in the markup.

**Direction:** the SDK installs it

```js
// One selector on the page:
// https://example.com/offer?forceBundleId=3
// Several selectors, addressed by id:
// https://example.com/offer?forceBundleId=main:3,upsell:7
```

> **Watch out:** Unlike the other two this one is not deleted after use, because the bundle selector reads it when it initialises, which can be after the campaign has loaded.


### window.nextDebug

The console toolbox: the raw stores, cart shortcuts, campaign cache controls, analytics status, attribution tools, and order inspection.

**Direction:** the SDK installs it

```js
// With ?debugger=true on the URL:
nextDebug.stores.cart.getState().items;
nextDebug.addToCart(2, 1);
nextDebug.getCacheInfo();
nextDebug.attribution.debug();
```

> **Watch out:** It hands out the six Zustand stores directly, and a `setState` on one of those skips every operation that carries the pricing and event logic — the cart will disagree with its totals and with analytics. Read through it; write through `next.*`. Absent entirely when debug mode is off, and assembled in two passes (boot, then the debug overlay), so a key can appear a moment after the object does.


### window.validateFormats

Checks every display binding on the page for a malformed format string, logs a report, and outlines the offending elements.

**Direction:** the SDK installs it

```js
validateFormats(); // returns the report as well as logging it
```

> **Watch out:** Installed whenever the display code loads, not only in debug mode, but it is a console tool — it writes to the console and mutates element outlines.


### window.eventTimelinePanel handlers

Eleven click handlers for the debug overlay's event-timeline panel, on `window` because the panel wires its buttons with inline `onclick`.

**Direction:** the SDK installs it

> **Watch out:** Implementation detail of the overlay. They exist only while that panel is open, and calling one from your own code drives the panel's UI, nothing else.


### window.fetch

The browser's own `fetch`, wrapped by the debug event manager so API calls appear in the event timeline.

**Direction:** the SDK installs it

> **Watch out:** A monkey-patch of a browser global — the one entry here that changes behaviour outside the SDK. It delegates to the original and only adds logging, but it is installed for the life of the page and never restored, so anything that also wraps `fetch` will see the patched version. Debug mode only.
