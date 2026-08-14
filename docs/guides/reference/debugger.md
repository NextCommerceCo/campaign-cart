---
title: "Reference/Debugger"
group: "Reference"
category: "Reference"
---

# Debugger

When a price renders blank, an attribute does nothing, or an analytics event never arrives, the debugger tells you why without adding a single line to the page. It shows the cart the SDK is holding, the campaign it fetched, the fields it matched on your form, and every event it sent. It is off on a normal shopper visit.

## Enabling the debugger

Add `?debugger=true` to any page the SDK runs on.

```
https://shop.example.com/checkout/?debugger=true
```

Or set it before the loader script runs, which is how a staging build opens it on every page.

```html
<script>
  window.nextConfig = {
    apiKey: '{YOUR_CAMPAIGN_API_KEY}',
    debugger: true,
  };
</script>
```

Both are read by `core/debug/debug-module.ts › DebugModule.isDebugMode`. Nothing else opens the overlay.

Opening the debugger also puts the page into **test mode**, so use a test card rather than a real one while it is on.

## Debug switches

These look like they do the same thing. They do not, and picking the wrong one is why a panel never appears or a console stays silent. Every row assumes a built bundle, which is what a live page loads.

| Switch | Opens the overlay |
|---|---|
| `?debugger=true` | yes, plus test mode |
| `window.nextConfig.debugger` | yes, plus test mode |
| `window.nextConfig.debug` | no |
| `?debug=true` | no |
| `<meta name="next-debug">` | no |

What each one prints, for the four that do not open it.

| Switch | Console output |
|---|---|
| `window.nextConfig.debug` | all levels, and `window.nextDebug` |
| `?debug=true` | `info` and `warn` only |
| `<meta name="next-debug">` | nothing, but installs `window.nextDebug` |

Three of those are worth reading twice.

### Only debugger opens the overlay

`debug` and `debugger` differ by two letters and do different jobs. `window.nextConfig.debug = true` raises the log level and installs `window.nextDebug`, but the overlay checks for `debugger` specifically and returns at its own gate otherwise.

**Symptom:** louder logs, `window.nextDebug` works in the console, no panel on the page. **Fix:** the parameter is `?debugger=true`.

### The debug meta tag prints nothing on a live page

`<meta name="next-debug" content="true">` sets `config.debug`, which raises the log level and installs `window.nextDebug`. But `core/logger.ts › isDebugModeEnabled` reads only the URL and `window.nextConfig`, never the config store or the document, so the production gate discards every line the raised level was meant to reveal.

**Symptom:** the tag is on the page, `window.nextDebug` works, and the console is silent anyway. **Fix:** use `?debug=true` in the URL, or set `window.nextConfig.debug` before the loader runs.

This one survives review because the dev server has no production gate, so the tag behaves as expected locally and goes quiet once built.

### Errors always print

`core/logger.ts › Logger.error` has no production gate. A live page reports its own failures whether or not you turned anything on. Every quieter level is opt-in.

## Panels

Built in `core/debug/debug-overlay/debug-overlay.ts › DebugOverlay.initializePanels`.

| Panel | What it shows |
|---|---|
| Cart | Items, totals, and applied discounts |
| Offers | Offers matched against the cart |
| Order | The completed order and its upsell journey |
| Config | The resolved `window.nextConfig` |
| Campaign | Every package and price the campaign returned |
| Checkout | Form fields, validation state, and raw data |
| Analytics and Events | Every `dl_*` event, per provider |
| Storage | Every key the SDK wrote, with its expiry |

The Analytics panel marks each event delivered, blocked, skipped, or failed for each provider, and runs an ecommerce payload validator over it. Which events reach which provider is in [Analytics Events](./analytics-events.md).

## Pickers

Alongside the panels are controls that change what the visitor sees, applied immediately with no reload.

| Picker | What it changes |
|---|---|
| Currency | The currency prices render in |
| Country | The detected country |
| Locale | How prices are written |
| Upsell | Which offer a post-purchase page shows |
| X-ray | Outlines every element the SDK enhanced |

The locale picker outranks `window.nextConfig.locale`, so a campaign that pins its price formatting can still be previewed in another locale.

## Console API

Opening the debugger installs `window.nextDebug`. It is the scriptable half of the overlay, built in `core/sdk-initializer/sdk-initializer.debug-utils.ts`.

| Member | What it does |
|---|---|
| `nextDebug.stores` | The five state stores, live |
| `nextDebug.sdk` | The same instance as `window.next` |
| `nextDebug.overlay()` | The overlay module |
| `nextDebug.testMode` | The test-mode manager |
| `nextDebug.getStats()` | Boot and scanner statistics |
| `nextDebug.reinitialize()` | Boots the SDK again |
| `nextDebug.addToCart(id, qty)` | Adds a package without clicking |
| `nextDebug.removeFromCart(id)` | Removes a package |
| `nextDebug.updateQuantity(id, qty)` | Sets a line's quantity |
| `nextDebug.addTestItems()` | Fills the cart with test lines |
| `nextDebug.loadCampaign()` | Refetches the campaign |
| `nextDebug.clearCampaignCache()` | Drops the cached campaign |
| `nextDebug.getCacheInfo()` | Prints the cache state as a table |
| `nextDebug.inspectPackage(id)` | Prints one package as a table |
| `nextDebug.testShippingMethod(id)` | Applies a shipping method |
| `nextDebug.sortPackages()` | Reorders the package list |
| `nextDebug.analytics` | The analytics debug surface |
| `nextDebug.attribution` | The attribution debug surface |
| `nextDebug.order` | The order debug surface |
| `nextDebug.accordion` | The accordion debug surface |
| `nextDebug.highlightElement(el)` | Outlines one element |

`core/debug/debug-module.ts › DebugModule.setupGlobalDebugAccess` merges four more onto the same object: `enableDebug()`, `disableDebug()`, `toggleDebug()`, and `isDebugMode()`.

### Example

Below is an example that reads the live cart from the console, adds two of package 1 without touching the page, and confirms the debugger is on.

```js
nextDebug.isDebugMode();
nextDebug.stores.cart.getState().items;
nextDebug.addToCart(1, 2);
nextDebug.inspectPackage(1);
```

## Cautions

- **The debugger puts the page in test mode.** Orders placed while it is open are test orders. Close it before checking a real payment path.
- **`?debug=true` is not `?debugger=true`.** The first is console output only. If you are waiting for a panel to appear, you probably typed the shorter one.
- **The switch is re-read on every call, never cached.** `core/logger.ts › isDebugModeEnabled` parses the URL and reads `window.nextConfig` each time, so you can flip it mid-session from the console. A page under load pays a small cost for lines it will never print.
- **`window.nextDebug` is not a public API.** It exists for debugging and its members change between releases. Build against `window.next` ([JavaScript API](./javascript-api.md)) for anything that ships.
