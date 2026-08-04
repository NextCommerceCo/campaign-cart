---
title: "Core/Public Facade"
group: "Core"
category: "Core Subsystems"
---

# JavaScript API (`window.next`)

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

`window.next` is the object your own page scripts talk to. Attributes cover the ordinary page — a selector, an add button, a total — and everything else goes through here: adding an item from a custom widget, swapping the whole cart for a bundle, applying a coupon from your own form, reading the cart to render something the SDK does not, subscribing so your code hears about a change. It is the scriptable half of [the engine](../overview.md), and it is the same set of behaviours the attributes drive, reached from code.

## Concept

The facade is **one object, created once, holding no state of its own**. Every read is a snapshot taken from a store at the moment you call it. Every write is handed to the cart operations layer, which validates it, updates the store, and announces the change. Your code and the SDK's own features then react to the same announcement.

```
  your script ──► next.cart.addItem() ──► cart operations ──► cart store
                                                                   │
                                                          emits on the event bus
                                                                   │
        next.on('cart:updated', …) ◄───────────────────────────────┤
                                                                   │
        DOM features re-render themselves ◄────────────────────────┘
```

Two consequences follow from that shape, and they are the whole mental model:

**Reads do not update themselves.** `next.getCartTotals()` gives you the totals as they are now; it does not re-run when they change. If your own markup has to stay current, subscribe with `next.on(...)` and read again inside the handler. You never have to update the SDK's own markup — the features do that from the same store.

**Writes go through one door.** `next.cart.addItem()` and a shopper clicking an add button run the same operation, so both produce the same totals, the same events, and the same analytics. Nothing in the facade edits a store directly, which is why there is no "and now refresh the display" step to remember.

Availability is the last piece. The instance exists as soon as anything asks for it, but it is **assigned to `window.next` near the end of boot** — after the campaign has loaded, the cart has been restored, and your markup has been activated. Before that point `window.next` is `undefined`, so a script tag above the loader sees nothing. Use `window.nextReady`, which queues before boot and runs immediately after it:

```html
<script>
  window.nextReady = window.nextReady || [];
  window.nextReady.push(function (next) {
    // `next` is the facade. Use the argument, not window.next — see below.
    console.log(next.getCartCount(), 'items');
  });
</script>
```

**Use the callback's argument, not `window.next`, inside a queued callback.** Boot drains the queue *before* it assigns `window.next` (both happen inside `sdk-initializer.ts › SDKInitializer.setupReadyCallbacks` — it runs the queued callbacks first, then does the assignment). **Symptom:** a callback that reads `window.next` throws `Cannot read properties of undefined` on a normal page load, yet works when you paste it into the console after the page settles — the same code takes a different path depending on whether boot had already finished. **Fix:** take the `next` parameter every queued callback is given.

## Business logic

- **Every method is available the moment `window.next` is,** whether or not the data behind it is. A campaign lookup returning `null` means "not found" and "not loaded yet" equally, so read campaign data inside a `campaign:loaded` handler or check `getCampaignData()` first.
- **Cart writes silently do nothing without a package id.** `addItem`, `removeItem`, and `updateQuantity` take an options object; with `packageId` omitted they return normally and change nothing. If an add never lands, log the id you passed.
- **Failure is reported two different ways.** `applyCoupon()` resolves with `{ success: false, message }` for a code that is invalid or already applied; `setShippingMethod()` and `addUpsell()` throw. A bare `await` on the first reads as success.
- **The `track*` family resolves before it sends anything.** Each one schedules the work on a microtask and loads the analytics module inside it, so the promise you await resolves whether or not the event was delivered, and a delivery failure is logged at debug level only. Treat these calls as fire-and-forget and confirm delivery in the debug overlay — see [analytics](./analytics.md) and [analytics events](../reference/analytics-events.md).
- **The `track*` family also double-counts.** The SDK already reports the standard funnel — view, add to cart, begin checkout, purchase. Adding your own call for the same step reports it twice, which shows up as inflated revenue rather than as an error.
- **`addUpsell()` charges the saved payment method.** It is the one facade call that moves money. It throws when there is no order in session, when the order cannot take upsells or is mid-processing, and when neither `packageId` nor `items` was given. It emits one `upsell:added` per requested line, and pairs each requested line to a returned order line **by position** (`next-commerce.ts › NextCommerce.addUpsell`) — so the per-event `value` can be attributed to the wrong line when the API merges or re-orders lines. The `totalValue` on the resolved result is computed from the returned lines and is the number to trust.
- **Metadata merges; attribution overwrites.** `setMetadata()` adds to what is already there despite the name, and `clearMetadata()` keeps the automatically collected fields (`landing_page`, `referrer`, `device`, `device_type`, `domain`, `timestamp`). `setAttribution()`, by contrast, replaces the values that decide who is credited for the sale — a reporting change, not a display change. See [attribution capture](./attribution.md).
- **URL-parameter methods write the session store, not the address bar.** `setParam()` makes a value readable to conditional-display rules and later pages in the session without changing the URL. `clearAllParams()` drops the `utm_*` values attribution reads, so use `clearParam()` when you mean one key. The parameters themselves are listed in [URL parameters](../reference/url-parameters.md).
- **Subscriptions are matched by function identity and never cleaned up for you.** An inline arrow passed to `on()` or `registerCallback()` can never be removed, and handlers accumulate across view changes in a long-lived page.
- **The popup helpers are lazy and reusable.** `exitIntent()` and `fomo()` import their feature on the first call and reconfigure the same instance on later calls; `disableExitIntent()` and `stopFomo()` do nothing when the matching starter was never called.

Every method, its signature, a runnable example, and its own caution live in the [JavaScript API reference](../reference/javascript-api.md). Everything else the SDK puts on `window` — including the debug-only names — is in the [window surface](../reference/window-surface.md).

## Decisions

- **We chose one object on `window` over a module you import,** because campaign pages are HTML with inline scripts and no build step. The cost is the readiness problem above: a global cannot exist before the code that creates it.
- **We chose to delegate every write to the cart operations layer over exposing the stores,** because that layer owns validation, recalculation, and event emission. A page that wrote to a store directly would get a changed number with no event and no analytics, and would break the moment the store's shape changed.
- **We chose snapshot getters over reactive bindings,** because the SDK's own features already re-render from the store and a second reactive system on the page would be a second source of truth. The cost is that your code has to subscribe with `on()` to stay current.
- **We chose to lazy-import analytics and the popups on first use over shipping them in the main bundle,** because most pages never call them. The cost is the fire-and-forget behaviour of `track*`: the promise cannot report what has not been loaded yet.
- **We chose to keep `registerCallback()` alongside `on()` rather than removing it,** because removing a name from `window.next` breaks pages already deployed against it. New work should use `on()`, whose payloads describe what changed rather than handing over the whole cart.

## Limitations

- **Not reactive, and no way to make it so.** There is no `subscribe(selector)` and no computed value that updates in place.
- **The callback registry has no SDK-side trigger.** Nothing inside the SDK calls `triggerCallback()`, so a handler registered with `registerCallback()` runs only when your own code fires it. For changes the SDK makes, subscribe with `next.on('cart:updated', …)` — see [event bus](./event-bus.md).
- **No unsubscribe-all, and no handle object.** `off()` and `unregisterCallback()` need the same function reference you registered.
- **No control over the DOM layer.** You cannot activate an element from code, force a re-scan, or ask which features are attached to an element. See [DOM activation](./dom-activation.md) for what that means for markup you add yourself.
- **No checkout submission.** The facade reads and writes the cart; placing the order is the checkout feature's job, and `validateCheckout()` only reports whether the cart is empty.
- **Several returns are untyped.** `getPackage()`, the variant lookups, and `addUpsell()` resolve as `any`, so field names in those results are not checked by the compiler. Their shapes are in the generated data-shape reference rather than here.
- **It does not exist outside a browser.** There is no `window.next` in a server-side render, and no headless mode.
