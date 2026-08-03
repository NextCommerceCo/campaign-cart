---
title: "Core/Subsystems/DOM Activation"
group: "Core"
category: "Core Subsystems"
---

# DOM activation

> Category: `core`
> Last reviewed: 2026-08-02
> Owner: Campaign Cart SDK

DOM activation is how a `data-next-*` attribute becomes a working feature. You write plain HTML; this part of [the engine](../overview.md) reads your document once during boot, decides which feature each marked element should get, loads that feature's code, and starts it on the element. It then keeps a watch on the page so some markup added after boot is picked up too. Nothing on a campaign page renders a price, reacts to a click, or writes to the cart until this has happened to its element.

## Concept

Activation is **matching, not configuration**. There is no registry you fill in from the page and no code you call: an element either matches something the scanner asks for, or it is inert. That single fact explains most "the feature does nothing" reports, because an attribute the scanner does not ask about produces no error at all.

The match runs in **two stages**, and both have to agree:

1. **The query.** One `querySelectorAll` over `<body>` with a fixed list of 30 selectors finds the candidate elements (`attribute-scanner.ts › AttributeScanner.scanAndEnhance`). This list is the real definition of "an attribute the SDK knows".
2. **The type decision.** For each candidate, `AttributeParser.getEnhancerTypes()` returns the list of feature types that element should get — a list, because one element can carry several attributes and get several features. The scanner then `import()`s each type on demand and runs the feature's `initialize()`.

The result is stored twice: in a `WeakMap` keyed by the element, which answers "is this element already activated, and with what", and in a plain `Set` of those elements, which is the only thing that can be *listed*. The `Set` is what makes a full teardown possible — a `WeakMap` cannot be enumerated, so before it existed, destroying the scanner destroyed none of the features it had made. Both are emptied in one place, `attribute-scanner.ts › AttributeScanner.cleanupElement`.

After the initial scan the same scanner listens to a `MutationObserver`. **Activation** through that watcher runs through a much narrower filter than the initial query — eight attributes, not thirty (`dom-observer.ts › DOMObserver.constructor`). **Deactivation** does not: every element that leaves the document is reported, whatever it carries. That asymmetry is the shape of the whole subsystem, and it is worth reading the diagram for.

```
  INITIAL SCAN (boot's DOM step)              AFTER BOOT (MutationObserver)
  ───────────────────────────────             ─────────────────────────────
  querySelectorAll(30 selectors)              added nodes + attribute changes,
  over <body>                                 filtered to 8:
            │                                   data-next-display, -toggle,
            ▼                                   -timer, -show, -hide,
  getEnhancerTypes(el) ─► ['display',           -checkout, -validate,
                           'action', …]         -express-checkout
            │                                             │
            ▼                                             ▼
  await import(feature)                         queue, 50 ms debounce
  new Enhancer(el).initialize()                           │
            │                                             │
            ▼                                             ▼
      WeakMap<HTMLElement, BaseEnhancer[]>  ◄──────────────┘
      + Set<HTMLElement>  ── the list destroy() walks
            │        ▲
            │        └──────  removed nodes — no filter:
            ▼                 anything in the Set that is no
  html.next-display-ready     longer in the document is torn down
  + next:display-ready
```

Read the filtered column as the complete list of what the SDK **activates** on its own after boot. An element inserted later with `data-next-action="add-to-cart"`, `data-next-package-selector`, or `data-next-cart-items` is **not** in that filter and is never activated. **Symptom:** markup rendered by your own script or a page builder looks right and does nothing, while identical markup present at page load works. **Fix:** put that markup in the HTML the page is served with, or wrap the inserted subtree in an element carrying one of the eight filtered attributes so the insertion is noticed.

Removal is the other way round because the two questions are not the same question. "Should this new element be activated?" can only be answered from its attributes; "was this element activated?" is already recorded in the `Set`. So the observer reports every removal and the scanner answers from its own registry, checking `isConnected` on each element it enhanced (`attribute-scanner.ts › AttributeScanner.cleanupDetachedElements`). Removing a wrapper `<div>` therefore tears down every feature inside it, whichever of the thirty attributes those elements carry.

## Business logic

- **An element is activated at most once.** A candidate already in the WeakMap is skipped, which is what makes the observer's re-checks harmless.
- **Template markup is skipped on purpose.** Anything inside a `[data-next-cart-items]` container is left alone, because those children are a template holding placeholders such as `{item.packageId}`, and so is any element whose `data-package-id` contains `{` or `}` (`attribute-scanner.ts › AttributeScanner.enhanceElement`).
- **Four attributes are matched by the query but map to no feature** — `data-next-timer-display`, `data-next-timer-expired`, `data-next-upsell-selector`, and `data-next-upsell-select`. They are markers their parent feature reads. They log `No enhancer types found for element` at debug level, which is expected output rather than a fault. See [logs](../reference/logs.md).
- **A `data-next-display` path routes on its first segment** — `cart`, `cart-summary`, `selection`, `package`, `campaign`, `order`, `shipping`, `bundle`, `selector`, `toggle`. Anything else falls back: if an ancestor carries a package id the element becomes a product display, otherwise a cart display (`attribute-scanner.ts › AttributeScanner.createEnhancer`). **Trap:** a misspelt object (`data-next-display="prodct.name"`) is not an error — it becomes a cart display and renders nothing recognisable. **Fix:** check the first segment against that list before checking the property name.
- **An unrecognised value does warn, in two places.** `data-next-action="buy"` logs `Unknown action type: buy`, and `data-next-enhancer="whatever"` logs `Unknown enhancer type: whatever`, both at warn level and both producing no feature.
- **A feature whose `initialize()` throws is destroyed and dropped.** The element stays in the DOM with nothing attached, the scan continues, and the error is logged — which is why boot can report success while part of the page is not enhanced.
- **A scan while a scan is running is dropped.** `scanAndEnhance()` returns immediately and logs `Already scanning, queuing request`; despite the wording nothing is queued (`attribute-scanner.ts › AttributeScanner.scanAndEnhance`).
- **Changing a filtered attribute re-activates the element.** The scanner destroys the element's features and re-runs the match, so switching `data-next-display` at runtime works. Switching an attribute outside the eight — `data-next-package-id`, for instance — changes nothing until the element is re-created.
- **Removing an element destroys its features, at any depth.** The check is "is this element still in the document", run over the scanner's own list of activated elements, so pulling out a wrapper `<div>` tears down everything inside it — no attribute filter involved (`attribute-scanner.ts › AttributeScanner.cleanupDetachedElements`). Destroying a feature releases its store subscriptions, its event-bus handlers and its listeners; what it does **not** do is undo what the feature already wrote, so a package the removed markup added to the cart stays in the cart.
- **A subtree removed and put back in the same frame keeps its features.** Removals are reported after a 16ms batch and anything back in the document by then is not reported at all (`dom-observer.ts › DOMObserver.processPendingRemovals`), so a re-render that detaches and re-attaches its markup is invisible to activation. **Trap:** re-attach it *later* — after an `await`, a `setTimeout`, or a fetch — and the features are already gone; the element comes back inert unless it carries one of the eight filtered attributes, which are the only ones re-activated. **Fix:** move the node in one synchronous step, or rebuild the markup fresh so the insertion is a real insertion.
- **Rendered children are replaced, not updated.** `data-next-cart-items` and `data-next-cart-summary` features rewrite their `innerHTML` on every cart change, so any listener you attached to a child is discarded with it. **Fix:** attach listeners to the container and match the target, or to an element outside the rendered subtree.
- **The scan root is `<body>`.** Attributes on `<html>` or in `<head>` are never candidates.

## Decisions

- **We chose one fixed selector query over walking the tree and inspecting attributes,** because a single `querySelectorAll` runs inside the browser rather than in our loop. The cost is a registration list: an attribute added to a feature but not to that list activates nothing, and nothing reports it.
- **We chose to `import()` each feature type on first use over bundling them all,** because a landing page uses a handful of the SDK's features and a checkout page a different handful. The cost is that activation is asynchronous, so features come alive over several frames rather than all at once.
- **We chose a `WeakMap` keyed by the element *plus* a listable `Set` of those elements over either one alone,** because the two answer different questions: the `WeakMap` answers "already activated?" per element, and only the `Set` can be walked — to tear everything down (`attribute-scanner.ts › AttributeScanner.destroy`), and to find what a removed subtree contained. The cost is bookkeeping — the `Set` holds each element, so an element removed while the watcher is stopped or paused is held until the scanner is destroyed, where a `WeakMap` alone would have let it go. That trade is deliberate: a feature holding a store subscription was never collectable anyway, because the store holds the subscription.
- **We chose a narrow attribute filter for the observer over re-running the full match,** because a `MutationObserver` on a busy page pays its check on every mutation, including mutations the SDK caused itself. The cost is the gap described above: most dynamically inserted SDK markup is not activated.
- **We chose to answer "what did this removal take with it" from the registry over walking the removed subtree,** because the walk is the expensive half and the wrong half. Matching attributes inside a removed subtree costs a `querySelectorAll` over however much was removed — on a view swap, most of the page — and still finds only the eight filtered attributes; reading `isConnected` on each activated element costs one flag per feature on the page, whatever was removed, and finds all thirty. So a removal now costs the observer one type test per removed node and the scanner one pass over its list per frame in which anything was removed.
- **We chose to enhance in batches of ten with a yield between them over enhancing everything at once,** because a page with hundreds of bindings would hold the main thread for the whole scan and delay first paint.

## Limitations

- **Does not activate most markup added after boot** — only the eight filtered attributes are noticed. There is no public "re-scan this element" call: `SDKInitializer.getAttributeScanner()` reaches the scanner's `pause()` and `resume()`, but only from a module import, and neither of them re-scans.
- **Does not report an unknown `data-next-*` attribute.** A typo in the attribute name itself (rather than in its value) leaves the element out of the query and produces no log at any level.
- **Does not release an element it never hears about being removed.** Destroying the scanner tears down every feature it created, and so does removing an element the observer watches — but an enhanced element removed any other way stays in the scanner's list, with its feature running, until the scanner itself is destroyed. **Symptom:** memory grows in a page that swaps views. **Fix:** the same as the cleanup limit above — hide SDK markup instead of removing it.
- **The count in `next:display-ready` is not the number of features created.** `detail.enhancedCount` counts every candidate element the scan visited, including the ones it skipped (`attribute-scanner.ts › AttributeScanner.scanAndEnhance`). For the number of live features read `nextDebug.getStats()` — see [logging and the debug overlay](./logging-and-debug.md).
- **Per-feature timing is only collected under `?debug=true`,** and the report is printed with `console.table` rather than exposed as data.
- **No ordering guarantee between features.** Elements are activated in document order in batches, but each feature's `initialize()` is asynchronous, so one feature cannot assume another is already running. Features coordinate through the [event bus](./event-bus.md) instead.
