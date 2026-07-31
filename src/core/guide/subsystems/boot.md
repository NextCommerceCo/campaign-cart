---
title: "Core/Subsystems/Boot"
group: "Core"
category: "Core Subsystems"
---

# Boot sequence

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

Boot is the one-time startup that turns your static HTML into a working campaign page. It reads the settings off your document, works out where the visitor is and which currency they should see, fetches the campaign so prices have real values, restores the cart they left in this session, brings your markup to life, and only then hands control to your own scripts. Every other part of [the engine](../overview.md) is something boot switched on, so when a page misbehaves from the first paint, this is the subsystem to suspect.

## Concept

Boot is **one linear pass, once per page load, with no way in and no way out**. There is no plugin point, no re-ordering, and no partial success you can build on: the sequence either reaches its last step and announces `next:initialized`, or it stops and the page is left holding the markup you wrote.

Two ideas explain almost every boot question.

**The order is a dependency chain, not a preference.** Currency is resolved before the campaign is fetched, because the campaign is fetched *in* a currency and cached per currency. The campaign is loaded before analytics starts, because product events need prices. The saved cart is restored before your markup is scanned, because a display that renders before the restore renders zero. `window.next` is published after the scan, so the first line of your code sees a page whose prices are already filled in.

**Each step is either a gate or a courtesy.** Some steps stop the whole boot when they throw; others log and let the sequence continue. Which is which is per step and listed in the [boot sequence reference](../reference/boot-sequence.md) — the point to hold in your head is that the campaign fetch is a gate, so a page with no API key gets *nothing*, not a degraded version of everything.

```
       loader.js ──► next:ready          ← the file arrived. Boot has not started.
                         │
   ┌─────────────────────┴──────────────────────────────────┐
   │ SDKInitializer.initialize()  (self-starting, one pass)  │
   │                                                        │
   │  read the page      settings, URL parameters           │
   │  place the visitor  country ─► currency                │
   │  load the money     campaign          ◄── hard gate    │
   │  restore the past   cart, order, attribution           │
   │  wake the markup    DOM scan ──► next:display-ready    │
   │  open the door      window.next, nextReady drained     │
   └─────────────────────┬──────────────────────────────────┘
                         │
                  next:initialized       ← the one "SDK is ready" signal
```

`next:ready` sits deliberately outside the box. The loader fires it the moment the SDK module finishes downloading (`public/loader.js`), which is before the first step runs. Code that reads the cart from a `next:ready` handler races the entire sequence and normally finds an empty cart or no `window.next` at all; the fix is a callback on `window.nextReady`, which is safe both before and after boot. See [boot sequence › wait for `next:initialized`](../reference/boot-sequence.md) for both forms.

## Business logic

- **Nothing starts boot but loading the bundle.** `src/index.ts` calls `initialize()` itself, on `DOMContentLoaded` or immediately if the document is already parsed. There is no start call for a page to make and no way to defer it.
- **It runs once.** A second `initialize()` logs `SDK already initialized` and returns without repeating a step.
- **Meta tags beat `window.nextConfig`.** Settings load from the window object first and the `<meta name="next-*">` tags second, so a tag wins any conflict. Both surfaces are listed in [meta tags](../reference/meta-tags.md).
- **`?reset=true` clears SDK storage before anything reads it** — but only keys beginning `next-` or `_next` (`sdk-initializer.ts › SDKInitializer.clearAllStorage`). Keys written with an underscore after `next` survive: the locked-in currency and country (`next_selected_currency`, `next_selected_country`), the persisted funnel name (`next_funnel_name`), and the country caches. **Trap:** a reset that leaves prices in the previous currency reads as a caching bug. **Fix:** close the tab to drop sessionStorage, or change currency and country through the debug selectors, which write those keys directly. See [storage keys](../reference/storage-keys.md) and [storage and expiry](./storage.md).
- **URL parameters are captured once, early, and merged over what the session already stored** — a parameter present on this URL overwrites the stored value for that key, and keys not present survive. Parameters added to the address bar afterwards are not picked up until the next page load. Full list in [URL parameters](../reference/url-parameters.md).
- **`?forcePackageId=` empties the cart before it adds** (`sdk-initializer.ts › SDKInitializer.processForcePackageId`). A visitor who already had items and then opens a forced-package link loses them. When the forced packages are in the cart, boot emits `sdk:url-parameters-processed` on the event bus so features can re-evaluate.
- **`<meta name="next-clear-cart" content="true">` empties the restored cart** right after the restore step — the mechanism landing pages use so they cannot inherit a cart from an earlier visit.
- **`?ref_id=` or `?order_ref_id=` loads that order during boot**, which is what makes a receipt or post-purchase upsell page work from a plain link.
- **A failed boot is retried whole, not resumed** — up to three attempts, waiting 1s, 2s, then 3s. Retrying from the top is what keeps the stores consistent, and it has two consequences worth knowing:
  - Attribution's event-bus and `popstate` listeners are registered again on each attempt (`sdk-initializer.ts › SDKInitializer.setupAttributionListeners`), so a page that booted on the third try has three sets.
  - An attempt that already reached the DOM scan and failed after it scans the page a second time, while the features from the first scan are still alive — see [DOM activation](./dom-activation.md) for what a doubled feature does.
- **Assumes `sessionStorage` is readable.** The currency, country, and cart-restore steps read it without a guard, so a browser that blocks storage turns boot into three failed attempts and a rejected promise nothing catches.

## Decisions

- **We chose to stop the boot when the campaign cannot load, over continuing without prices,** because every later step — analytics, cart totals, the DOM scan — prices from campaign data. Continuing would publish wrong numbers instead of no numbers. The cost is the failure mode described in the [boot sequence reference](../reference/boot-sequence.md): the page un-hides with raw `{price}` placeholders, so a reveal rule needs the `next-display-ready` class as well as the loading attribute.
- **We chose to resolve currency before fetching the campaign, over converting prices afterwards,** because the campaign is cached per currency and one fetch in the right currency is cheaper and truer than a conversion. That is why a stale price is a currency question first — see [country, state, and currency](./geo.md).
- **We chose a fixed short wait for the cart restore over a completion signal,** because the store's rehydrate hook recalculates totals with no event to wait on. The cost is a fixed delay on every page that has a saved cart, and a race that reappears if that recalculation ever gets slower.
- **We chose to retry the whole sequence rather than resume at the failed step,** because the steps share the config, campaign, and currency they populate, and a resumed boot would run on half-filled stores. The cost is the duplicated side effects listed above.
- **We chose to publish `window.next` after the DOM scan rather than before,** so the first callback to run sees resolved prices and a restored cart rather than a page mid-assembly.

## Limitations

- **No control over the sequence.** No hook to add a step, no way to skip or re-order one, no way to delay boot until your own code is ready.
- **No supported second run.** `SDKInitializer.reinitialize()` exists for the SDK's own use; it tears down the DOM scanner without destroying the features that scanner created, so calling it from a page leaves two live features on every element.
- **The version in `next:initialized` is not the SDK version.** `detail.version` is the hardcoded string `'0.2.0'` (`sdk-initializer.ts › SDKInitializer.emitInitializedEvent`). Read `next.getVersion()` instead — see [JavaScript API](../reference/javascript-api.md).
- **No per-step progress to observe.** Boot marks its start with `data-next-sdk-loading="true"`, its scan with `next:display-ready`, and its end with `next:initialized`; the steps in between report only to the console. Store-level events such as `campaign:loaded` fire on the [event bus](./event-bus.md), which an inline page script has no handle on until `window.next` exists at the end of boot.
- **Failure is not announced to the page.** No event fires when boot aborts; the retries and the final error appear in the console only, so a page cannot render its own fallback in response.
- **It does not validate the API key beyond its presence,** so a wrong key fails inside the campaign request rather than at the step that reads the tag.
