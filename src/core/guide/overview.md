---
title: "Core/Overview"
group: "Core"
category: "Core"
---

# The SDK engine

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

Everything on a campaign page that is not a feature you switched on with a
`data-next-*` attribute. The engine starts the SDK, works out the visitor's country and
currency, loads the campaign, finds your markup and brings it to life, remembers the
cart between pages, catches errors, and reports to analytics. You never import any of it
— and every page depends on what it does.

## Concept

The rest of the documentation is organised around things you *add* to a page. This part
is organised around **contracts** instead, because that is the only thing about the
engine you can act on:

- what it **reads** off your document — `<meta>` tags, URL parameters, attributes
- what it **writes** — storage keys, body attributes, CSS classes, console output
- what it **announces** — events you can subscribe to
- what it **offers** — the `window.next` methods your scripts call

The classes behind those contracts are internal and move between releases. The contracts
do not, which is why they are what gets documented. If you are looking for a class
reference, there isn't one on purpose: `src/index.ts` exports four core symbols and the
docs toolchain drops class pages, so any explanation that lives only in a TSDoc comment
inside `src/core/` reaches maintainers and no readers.

## The one thing to get right

**Wait for the engine before touching it.** Almost every "the cart is empty", "the price
shows `{price}`", or "`next` is undefined" report is the same mistake: code that ran
before boot finished. The signal is `next:initialized`, or a callback queued on
`window.nextReady` — *not* `next:ready`, which fires as soon as the SDK file downloads
and long before it has done anything.

```html
<script>
  window.nextReady = window.nextReady || [];
  window.nextReady.push(function (next) {
    // Safe here: campaign loaded, cart restored, features wired up.
    console.log(next.getCartData().totals.total.value);
  });
</script>
```

See [boot sequence](./reference/boot-sequence.md) for the full order and what each step
gives you.

## The subsystems

| Subsystem | What it does for your page |
|---|---|
| [Boot sequence](./subsystems/boot.md) | Starts everything. Nothing else works until it finishes |
| [JavaScript API](./subsystems/public-facade.md) | `window.next` — what your own scripts call |
| [DOM activation](./subsystems/dom-activation.md) | Finds your `data-next-*` markup and makes it work, including markup added later |
| [Country, state, and currency](./subsystems/geo.md) | Where the visitor is, what currency they see, which states the checkout offers |
| [Storage and expiry](./subsystems/storage.md) | What survives a page change, and for how long |
| [Event bus](./subsystems/event-bus.md) | How your code hears what the SDK did |
| [Attribution capture](./subsystems/attribution.md) | Where the visitor came from, attached to their order |
| [Analytics](./subsystems/analytics.md) | Shopper behaviour out to GTM, Facebook, RudderStack, or your endpoint |
| [Error capture](./subsystems/error-handling.md) | Keeps one failing feature from taking the page down |
| [Logging and the debug overlay](./subsystems/logging-and-debug.md) | What the console prints, and the on-page inspector |
| [Test mode](./subsystems/test-mode.md) | Walking a checkout end to end without typing real details |

## Reference

Generated from the source and checked against it on every test run, so these cannot
drift from what the SDK actually does:

| Page | Answers |
|---|---|
| [Boot sequence](./reference/boot-sequence.md) | What runs in what order, and when it is safe to call `next.*` |
| [Meta tags](./reference/meta-tags.md) | Every `<meta name="…">` the SDK reads |
| [URL parameters](./reference/url-parameters.md) | Every query parameter it honours, including the debugging ones |
| [Storage keys](./reference/storage-keys.md) | Every key, its storage, its expiry, and what clearing it costs |
| [JavaScript API](./reference/javascript-api.md) | Every `next.*` method, with a runnable example |
| [Window surface](./reference/window-surface.md) | Everything the SDK installs on `window`, including `nextDebug` |
| [Logs](./reference/logs.md) | Every console message, by prefix and level, with the exact string |
| [Errors](./reference/errors.md) | Every error the engine throws, recoverable or fatal, and the fix |
| [Analytics events](./reference/analytics-events.md) | Every `dl_*` event, per field |
| [Analytics providers](./reference/analytics-providers.md) | Which provider forwards, reshapes, or drops what |

## Business logic

Rules the engine enforces regardless of what your page asks for:

- **The campaign is loaded once per currency and cached**, so two visitors in different
  currencies read different cache entries. A price that looks stale is a currency
  question first.
- **A missing API key stops the boot** rather than degrading it — no DOM scan, no
  `window.next`, and no queued callbacks run. The page still un-hides, so the visible
  symptom is raw `{price}` placeholders rather than an error.
- **Attribution is last-touch per parameter.** A parameter present in the URL always wins
  and is written back to storage; one that is absent carries over from the previous page. So
  a second tagged link inside the same session re-credits the parameters it carries and
  leaves the rest alone.
- **Analytics is off unless the page turns it on**, and no meta tag turns it on.
- **Errors are captured, not swallowed.** A feature that throws is isolated and the
  failure is announced on the event bus as `error:occurred`.

## Decisions

- **We document contracts rather than classes** because the classes are internal and the
  contracts are not. A class reference would promise stability the engine does not offer,
  and would go stale on the first refactor.
- **We generate every page a scanner can produce** — boot order, storage keys, meta tags,
  logs, errors, the analytics catalogue — and hand-write only judgement. The generated
  half is checked against the source on every test run, so it cannot describe an older
  SDK.
- **We measure core in the coverage gate** rather than trusting review. Before Phase 6 the
  gate reported every metric at 100% while this entire layer had three READMEs, because
  nothing counted it.
- **We count contracts, not files or exports.** By file would be dominated by the debug
  overlay; by exported symbol would reward writing TSDoc that is never published.
- **We keep the debug overlay in this section** even though it never runs in production,
  because reaching for it is the first step in most debugging and it is the one part of
  the engine an author interacts with directly.

## Limitations

- **No class or method-level reference for internals.** `SDKInitializer`,
  `AttributeScanner`, and `CountryService` are documented by behaviour, not API surface.
  If you need to change them, read the source.
- **No control over boot order.** The sequence is fixed; there is no hook to insert a step
  or to re-order one.
- **No supported way to run the engine twice** on one page. `reinitialize()` exists for the
  SDK's own use and is not a page-level API.
- **The debug overlay is not a production tool.** It is loaded only in debug mode and its
  panels are not a supported interface.
- **URL parameters are read once, early.** Parameters added to the address bar afterwards
  are not picked up until the next page load.
