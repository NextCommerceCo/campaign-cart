---
title: "Reference/Order Store Integration"
group: "Reference"
category: "Reference"
---

# Order store integration

Use the public `useOrderStore` export to read the completed order for the current campaign. Do not read `sessionStorage.getItem('next-order')` or scan `next-order*`: another campaign on the same origin can have an order under that prefix. Storage names and serialized envelopes are internal implementation details.

## Load the supported interface

With `loader.js`, the imported SDK module is available as `window.NextCommerce`. The loader assigns that global before emitting `next:ready`; that event says the module arrived, not that campaign initialization or order loading succeeded. Queue your integration with `window.nextReady`, which runs during initialization or immediately when initialization has already finished. Check the store state even inside that callback.

```js
window.nextReady = window.nextReady || [];
window.nextReady.push(() => {
  const store = window.NextCommerce?.useOrderStore;
  const params = new URLSearchParams(window.location.search);
  const expectedRef = params.get('ref_id') || params.get('order_ref_id');
  const order = readCurrentOrder(store, expectedRef);
  document.querySelector('[data-order-message]').textContent = order
    ? `Order ${order.number}`
    : 'Order unavailable';
});
```

Include the `readCurrentOrder` function below before this callback. The callback's argument is the `window.next` facade, not the module containing the store export. If the loader fails or the export is absent, keep order-bearing content hidden or show a generic unavailable message.

A direct ESM import does not install `window.NextCommerce`. Import the named store export from the same SDK module instance the page uses, then run your integration after initialization with `window.nextReady` or `next:initialized`:

```js
import { useOrderStore } from '@NextCommerce/campaign-cart';

window.nextReady = window.nextReady || [];
window.nextReady.push(() => {
  const params = new URLSearchParams(window.location.search);
  const expectedRef = params.get('ref_id') || params.get('order_ref_id');
  const order = readCurrentOrder(useOrderStore, expectedRef);
  document.querySelector('[data-order-message]').textContent = order
    ? `Order ${order.number}`
    : 'Order unavailable';
});
```

Do not import a second SDK version alongside the loader. It can create a different store instance from the one initialization populated.

## Accept only the current order

Boot loads the URL's `ref_id` (or `order_ref_id`) through the configured campaign client. A store can still contain a previous order while a new one is loading. Require a reference in the URL and match both the store's `refId` and the API order's `ref_id`; otherwise display no order. Also reject loading, errors, missing timestamps and expiry. This example reads state without initiating a request or changing persistence:

```js
function readCurrentOrder(store, expectedRef) {
  if (!store || !expectedRef) return null;
  const state = store.getState();
  const loadedAt = state.orderLoadedAt;
  const age = Date.now() - loadedAt;
  if (
    state.isLoading ||
    state.isProcessingUpsell ||
    state.error ||
    state.upsellError ||
    !state.order ||
    state.refId !== expectedRef ||
    state.order.ref_id !== expectedRef ||
    !Number.isFinite(loadedAt) ||
    loadedAt <= 0 ||
    age < 0 ||
    age >= 15 * 60 * 1000 ||
    state.isOrderExpired()
  ) {
    return null;
  }
  return state.order;
}
```

A missing URL reference deliberately returns `null`, even if the store has an order. A mismatch never falls back to another storage entry. Do not use a persisted reference as a substitute for the page's reference.

The store's expiry check uses `orderLoadedAt`, with a 15-minute window since the order was loaded or set. It is evaluated on demand, not by a timer that erases the order. Re-run the guard immediately before every render or action that uses order data, including after a store subscription fires; a result retained from an earlier read can expire. Unsubscribe when the integration is removed. A readiness callback alone does not keep a custom display current.

## Compatibility and migration

For SDK 0.4.38, the supported read interface is the public `useOrderStore` export with `getState()` and `subscribe()`, the fields used above, and `isOrderExpired()`. These are part of the existing public export contract; this guide adds no order API. Pin the SDK version and review release notes before upgrading. Internal storage keys, suffix hashes, and persistence payloads have no integration compatibility promise.

The [storage migration metadata](https://github.com/NextCommerceCo/campaign-cart/blob/main/docs/compatibility/storage-migrations.v1.json) is generated from the existing source extractor and content registry with `npm run docs:reference`. It carries schema version 1, the SDK version, an explicit supported version range, hashed generation inputs, extracted source anchors, and verified per-key release boundaries. A `null` migration or replacement means none is verified in this manifest; it does not mean a key is safe to read. Tools must treat unsupported schema versions and SDK versions outside the recorded range as insufficient evidence.

`next-order` became scope-specific in 0.4.34. The SDK derives the scope from the campaign API key and the first directory segment, when a directory sits above the page. The same origin can therefore hold independent orders for different campaigns or top-level funnel folders. Provide `next-api-key` before the SDK modules load: missing configuration can leave a bare key, which is not a safe compatibility fallback. Migrate the integration to the public store rather than reconstructing the hash or accepting the first matching key.

## Cautions

- Initialization can finish without a successfully loaded order. Keep the unavailable path usable.
- Scope isolation selects a store; the URL and API reference checks still select the order within that scope.
- Never log or publish order/customer payloads when diagnosing migration failures.
- This read guard does not authorize a charge. Use the SDK's [upsell operations](javascript-api.md#upsells) for post-purchase actions.

Source evidence: `public/loader.js` assigns the module global; `src/index.ts` exports `useOrderStore`; `src/core/sdk-initializer/sdk-initializer.ts` loads the URL reference and runs readiness callbacks; `src/core/storage-scope.ts` derives scope; `src/state/order/order.state.ts` defines loading, errors, reference state and expiry. The migration manifest records the immutable release commits and tags for each annotated key.
