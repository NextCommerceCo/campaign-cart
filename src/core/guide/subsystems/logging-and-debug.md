---
title: "Core/Subsystems/Logging and Debug"
group: "Core"
category: "Core Subsystems"
---

# Logging and the debug overlay

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

There are two ways to watch the SDK work on a page you cannot step through: the browser
console, where every part of [the engine](../overview.md) narrates what it is doing under
its own name in square brackets, and an on-page overlay that shows the cart, the campaign,
the order, the checkout form, storage, and every analytics event as it happens. Neither is
on for a shopper, both are switched on by something you add to the URL or the document —
and the thing that switches on the console output is not the thing that opens the overlay.
That one detail is the most common dead end on a campaign page: the parameter gets added,
the console fills up, and the panel that was wanted never appears.

## Concept

Two separate mechanisms share the name "debug mode". Turning one on does not turn the
other on.

**Logging is a pipe with two gates, and the gates are checked on every single call.** Each
module owns a named logger, so the prefix in a console line is the part of the engine that
spoke (`[SDKInitializer]`, `[AttributeScanner]`, `[NextAnalytics]` — the full list is in
[logs](../reference/logs.md)). A `warn`, `info`, or `debug` line has to pass both gates to
reach the console:

1. **The production gate.** In a built bundle, `Logger` returns early unless debug mode is
   on (`core/logger.ts › Logger.warn`, `Logger.info`, `Logger.debug`). It works out "on" by
   re-reading `window.location.search` and `window.nextConfig` *at the moment of the call*
   (`core/logger.ts › isDebugModeEnabled`) — nothing is cached at boot, so setting
   `window.nextConfig.debug = true` from the console starts the narration on the next line
   the SDK writes, with no reload.
2. **The level ladder.** A global level, `INFO` by default (`core/logger.ts › Logger`), then
   drops anything below it. Only one thing in the SDK ever raises it to `DEBUG`
   (`core/sdk-initializer.ts › SDKInitializer.initializeDebugMode`), and it does so from the
   config store — which is why `?debug=true` produces `info` and `warn` lines but no `debug`
   lines at all.

`error` passes both gates by design (`core/logger.ts › Logger.error`). If a page prints errors and
nothing else, logging is working and debug mode is off.

**The overlay is a separate program that visits your page.** It is imported only in debug
mode, renders into its own shadow root (`#next-debug-overlay-host`) so your CSS and its CSS
cannot reach each other, reads the stores on a one-second poll rather than subscribing, and
keeps its own preferences in `localStorage`. It also does three things to the page while it
is open: it wraps `window.fetch` to record API calls
(`core/debug/DebugEventManager.ts › DebugEventManager.interceptFetch`),
it adds a `debug-body-expanded` class to `<body>` and `<html>` when expanded
(`core/debug/DebugOverlay.ts › DebugOverlay.updateBodyHeight`), and it puts the page into
[test mode](./test-mode.md).

### Which switch does what

Every row assumes a built bundle — the numbers in the first column are the only inputs
these two subsystems read.

| What you set | `info` / `warn` in the console | `debug` lines | `window.nextDebug` | The overlay |
|---|---|---|---|---|
| `?debug=true` | yes | **no** | no | no |
| `window.nextConfig.debug = true` | yes | yes | yes | **no** |
| `<meta name="next-debug" content="true">` | **no** | no | yes | **no** |
| `?debugger=true` | yes | yes | yes | **yes** — and test mode |
| `window.nextConfig.debugger = true` | yes | yes | yes | **yes** — and test mode |

Read the surprises in that table rather than the pattern:

- **`?debug=true` is console output and nothing else.** No overlay, no `window.nextDebug`,
  and no `debug`-level lines, because it never reaches the config store that raises the
  level.
- **The `next-debug` meta tag prints nothing in a built bundle.** It sets
  `config.debug` (`state/config/config.state.ts › loadFromMeta`), which raises the level
  and installs `window.nextDebug`
  (`core/sdk-initializer.ts › SDKInitializer.initializeDebugMode`) — but `Logger` does not
  read the config store or the document, only the URL and `window.nextConfig`
  (`core/logger.ts › isDebugModeEnabled`), so the production gate still discards every
  line the raised level was meant to reveal. **Symptom:** the tag is in the page,
  `window.nextDebug` works in the console, and the console is otherwise silent. **Fix:**
  add `?debug=true` to the URL, or set `window.nextConfig.debug = true` before the loader
  runs. (On the dev server the gate is absent, so the tag behaves as expected there —
  which is how the mismatch survives review.)
- **Only `debugger` opens the overlay.** `debugOverlay.initialize()` is called for any
  value of `config.debug`, and returns at its own gate unless `?debugger=true` or
  `window.nextConfig.debugger === true` (`core/debug/DebugOverlay.ts › DebugOverlay.initialize`).
  **Symptom:** louder logs, `window.nextDebug` present, no panel. **Fix:** the parameter
  is `?debugger=true` — one letter, and it is the only way in.

```
  a warn / info / debug call
            │
            ├─ production gate ── off ─► dropped   ?debug, ?debugger,
            │  logger.ts › Logger                  nextConfig.debug / .debugger
            │
            ├─ level ladder ───── below ─► dropped  raised to DEBUG only by
            │  logger.ts › Logger                   config.debug (meta tag,
            │                                       nextConfig.debug, ?debugger)
            └─► console.warn / info / debug
                                                   ┌───────────────────────────┐
  an error call ──────────────────────────────────► │ always printed            │
                                                   └───────────────────────────┘

  config.debug true ──► log level DEBUG + window.nextDebug ──► debugOverlay.initialize()
                                                                        │
                                                     ?debugger=true only ─┴─► overlay opens
```

### What the overlay shows

Eight panels (`core/debug/DebugOverlay.ts › DebugOverlay.initializePanels`): **Cart** (items, totals, discounts),
**Offers**, **Order** (the post-purchase order and its upsell journey), **Config**,
**Campaign** (every package and price the campaign returned), **Checkout State** (form
fields, validation, raw data), **Analytics & Events** (every `dl_*` event with per-provider
delivery — sent, blocked, skipped, or failed — and an ecommerce payload validator), and
**Storage** (every key the SDK wrote, with its expiry). Alongside them are pickers that
change the visitor's currency, country, and locale, an overlay for choosing which upsell a
post-purchase page shows, and an "x-ray" mode that outlines every enhanced element on the
page. Which events reach which provider is explained in
[analytics providers](../reference/analytics-providers.md); what the storage panel is
listing is in [storage keys](../reference/storage-keys.md).

## Business logic

- **The debug switch is re-read per call, never cached.** `core/logger.ts › isDebugModeEnabled`
  parses `window.location.search` and reads `window.nextConfig` on every suppressed call, so the
  flag can be flipped mid-session from the console — and a page under load pays a small
  cost for lines it will never print.
- **`error` has no production gate** (`core/logger.ts › Logger.error`) and no other level does. A
  live page always reports its own failures; everything quieter is opt-in.
- **The level starts at `INFO` and only boot raises it.** Nothing lowers it, and there is
  no page-facing call to change it, so `debug`-level lines are available exactly when
  `config.debug` is true.
- **97 raw `console.log` calls outside `Logger` are not gated at all.** They live in
  features, stores, and core itself, and in the module bundle they print for every visitor
  regardless of debug mode. **Trap:** a live console that is not empty reads as
  debug mode being stuck on. **Symptom:** unprefixed lines, or lines with emoji markers
  such as `🟢 [OrderManager]`, appearing with no parameter set. **Fix:** filter the console
  by `[` or by the prefix you care about; the gated `Logger` lines are the ones the
  [logs reference](../reference/logs.md) catalogues, and the raw ones are not in it.
- **What prints depends on which bundle loaded, and one of them cannot be talked round.**
  The module bundle (`/index.js`, what almost every visitor runs) is not minified, so every
  `console` call is still in the shipped file and debug mode genuinely reveals them. The
  fallback UMD bundle (`dist/index.umd.js`, used for `nomodule` browsers and when the
  module import fails — `public/loader.js`, in the module and nomodule fallback branches)
  is minified with `drop_console` (`vite.config.ts` defines the Terser options; they are
  applied to the UMD build in `vite.config.ts › closeBundle`), which removes the calls
  **at build time**.
  **Trap:** debug mode is a runtime switch and cannot restore a call that is not in the
  file. **Symptom:** debug mode on, overlay open, console showing little or nothing.
  **Fix:** check which bundle loaded before concluding nothing ran — the loader announces
  the fallback itself with a `UMD fallback loaded` line, and `window.__NEXT_SDK_VERSION__`
  is set either way. The per-bundle breakdown is in
  [logs › what prints in production](../reference/logs.md).
- **The error handler replaces `console.error`**, so a line your own code logs there also
  arrives as an `error:occurred` event. That is [error capture](./error-handling.md)'s
  behaviour, not the logger's.
- **The overlay is loaded on demand and only in debug mode**, as a dynamic import
  (`core/sdk-initializer.ts › SDKInitializer.initializeDebugMode`). A shopper never
  downloads it on the module bundle.
- **The overlay remembers itself in `localStorage`**, under `debug-overlay-expanded`,
  `debug-overlay-active-panel`, `debug-overlay-active-tab` (`core/debug/DebugOverlay.ts ›
  DebugOverlay`, the class's storage-key constants), `debug-mini-cart-visible`
  (`core/debug/DebugOverlay.ts › DebugOverlay.show`), and `debug-xray-active`
  (`core/debug/XrayStyles.ts › XrayManager`). **Trap:** those names do not begin with
  `next-`, so `?reset=true` does not clear them (see [storage and expiry](./storage.md)).
  **Symptom:** the overlay reopens expanded, on a panel you were using yesterday, or the
  page still has x-ray outlines. **Fix:** collapse or toggle it off through the overlay
  itself, which rewrites the key.
- **An expanded overlay changes the page's own layout.** It adds `debug-body-expanded` to
  `<body>` and `<html>` (`core/debug/DebugOverlay.ts › DebugOverlay.updateBodyHeight`).
  **Trap:** a layout bug that only appears with the overlay open is the overlay's.
  **Fix:** collapse it before measuring anything.
- **Only three panels live-update.** The one-second poll refreshes the quick stats plus the
  Cart, Config, and Campaign panels, and skips a panel whose "raw" tab is showing
  (`core/debug/DebugOverlay.ts › DebugOverlay.startAutoUpdate`); the Analytics panel
  re-renders when the delivery tracker changes
  (`core/debug/DebugOverlay.ts › DebugOverlay.setupEventListeners`).
  **Trap:** a panel not on that list can show state from when you opened it. **Fix:**
  switch away and back, which forces a re-render.
- **Opening the overlay arms test mode.** `?debugger=true` and
  `window.nextConfig.debugger` are read by the test-mode manager as well
  (`core/test-mode.ts › TestModeManager.checkUrlTestMode`). Read [test mode](./test-mode.md)
  before using either on a live campaign.
- **`window.nextDebug` is installed whenever `config.debug` is true**, with the stores, the
  cart helpers, the analytics status, the attribution dump, and the campaign cache tools
  (`core/sdk-initializer.ts › SDKInitializer.setupGlobalDebugUtils`). Its full surface is in
  [window surface](../reference/window-surface.md).

## Decisions

- **We chose two switches — one for the console, one for the overlay — over a single
  `debug` flag,** because the overlay is not a passive viewer: it downloads a chunk, wraps
  `window.fetch`, changes body classes, and arms test mode. A shared switch would make
  "show me the logs" do all of that. The cost is the confusion this page exists to fix: the
  two words are one letter apart.
- **We chose to evaluate the switch on every call over reading it once at boot,** because
  it lets someone flip `window.nextConfig.debug` mid-session on a page that is already
  misbehaving, without losing the state a reload would clear. The cost is a URL parse per
  suppressed call.
- **We chose to strip the console calls out of the fallback bundle at build time over
  gating them at runtime,** because that bundle is a single inlined file for old browsers
  where size matters most. The cost is that debug mode is inert there, which is why "which
  bundle loaded" is the first question when the console is quiet.
- **We chose to leave `error` ungated in production over silencing everything,** because a
  page that fails silently cannot be diagnosed after the fact from a customer's screenshot.
- **We chose a one-second poll for the overlay over subscribing it to the stores,** because
  a subscription that re-renders panel HTML on every store change fought with typing in the
  panels' own inputs. The cost is the stale-panel behaviour above, and a timer that runs for
  as long as the overlay is open.

## Limitations

- **No page-level control over the log level.** `Logger` is exported from the package but
  the loader never puts it on `window`, so a page loaded through the loader cannot raise or
  lower the level itself. The level follows `config.debug` or nothing.
- **No per-prefix filtering.** Debug mode is all-or-nothing across all 36 prefixes; narrowing
  down is the browser console's filter box, not an SDK setting.
- **No way to silence the raw `console.log` calls** on the module bundle. They are not
  routed through `Logger`, so no switch reaches them.
- **No keyboard shortcut opens the overlay.** Nothing in `core/debug/` listens for a key
  combination, so a page already loaded without `?debugger=true` needs a reload with the
  parameter. `window.nextDebug.overlay()` can be toggled by hand, but the instance builds
  its panels only if `?debug`, `?debugger`, `nextConfig.debug`, or `nextConfig.debugger` was
  present when it was constructed (`core/debug/DebugOverlay.ts › DebugOverlay.constructor`)
  — with the `next-debug` meta tag alone it has none, and toggling renders an empty
  overlay.
- **The overlay is not a supported interface.** Panel names, tabs, and its `localStorage`
  keys are internal and change between releases; nothing should be automated against them.
- **The overlay does not show console output.** It records a fixed list of DOM events and
  the SDK's API calls, not log lines — the console remains the only place to read those.
- **`core/debug/DebugModule.ts` is unreachable.** Nothing under `src/` imports it; the live
  path is `SDKInitializer.initializeDebugMode`. Its behaviour is not a contract to build on.
