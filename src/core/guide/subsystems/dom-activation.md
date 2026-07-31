---
title: "Core/Subsystems/DOM Activation"
group: "Core"
category: "Core Subsystems"
---

# DOM activation

> Category: `core`
> Last reviewed: 2026-07-31
> Owner: Campaign Cart SDK

DOM activation is how a `data-next-*` attribute becomes a working feature. You write plain HTML; this part of [the engine](../overview.md) reads your document once during boot, decides which feature each marked element should get, loads that feature's code, and starts it on the element. It then keeps a watch on the page so some markup added after boot is picked up too. Nothing on a campaign page renders a price, reacts to a click, or writes to the cart until this has happened to its element.

## Concept

Activation is **matching, not configuration**. There is no registry you fill in from the page and no code you call: an element either matches something the scanner asks for, or it is inert. That single fact explains most "the feature does nothing" reports, because an attribute the scanner does not ask about produces no error at all.

The match runs in **two stages**, and both have to agree:

1. **The query.** One `querySelectorAll` over `<body>` with a fixed list of 30 selectors finds the candidate elements (`attribute-scanner.ts › AttributeScanner.scanAndEnhance`). This list is the real definition of "an attribute the SDK knows".
2. **The type decision.** For each candidate, `AttributeParser.getEnhancerTypes()` returns the list of feature types that element should get — a list, because one element can carry several attributes and get several features. The scanner then `import()`s each type on demand and runs the feature's `initialize()`.

The result is stored in a `WeakMap` keyed by the element, so an element's features live exactly as long as the element does.

After the initial scan the same scanner listens to a `MutationObserver` — but through a **much narrower filter than the initial query**: eight attributes, not thirty (`dom-observer.ts › DOMObserver.constructor`). This is the difference between "the SDK keeps up with my page" and what actually happens, and it is worth reading the diagram for.

```
  INITIAL SCAN (boot's DOM step)              AFTER BOOT (MutationObserver)
  ───────────────────────────────             ─────────────────────────────
  querySelectorAll(30 selectors)              added / removed nodes,
  over <body>                                 attribute changes — filtered to 8:
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
            │
            ▼
  html.next-display-ready  +  next:display-ready
```

Read the right-hand column as the complete list of what the SDK notices on its own after boot. An element inserted later with `data-next-action="add-to-cart"`, `data-next-package-selector`, or `data-next-cart-items` is **not** in that filter and is never activated. **Symptom:** markup rendered by your own script or a page builder looks right and does nothing, while identical markup present at page load works. **Fix:** put that markup in the HTML the page is served with, or wrap the inserted subtree in an element carrying one of the eight filtered attributes so the insertion is noticed.

## Business logic

- **An element is activated at most once.** A candidate already in the WeakMap is skipped, which is what makes the observer's re-checks harmless.
- **Template markup is skipped on purpose.** Anything inside a `[data-next-cart-items]` container is left alone, because those children are a template holding placeholders such as `{item.packageId}`, and so is any element whose `data-package-id` contains `{` or `}` (`attribute-scanner.ts › AttributeScanner.enhanceElement`).
- **Four attributes are matched by the query but map to no feature** — `data-next-timer-display`, `data-next-timer-expired`, `data-next-upsell-selector`, and `data-next-upsell-select`. They are markers their parent feature reads. They log `No enhancer types found for element` at debug level, which is expected output rather than a fault. See [logs](../reference/logs.md).
- **A `data-next-display` path routes on its first segment** — `cart`, `cart-summary`, `selection`, `package`, `campaign`, `order`, `shipping`, `bundle`, `selector`, `toggle`. Anything else falls back: if an ancestor carries a package id the element becomes a product display, otherwise a cart display (`attribute-scanner.ts › AttributeScanner.createEnhancer`). **Trap:** a misspelt object (`data-next-display="prodct.name"`) is not an error — it becomes a cart display and renders nothing recognisable. **Fix:** check the first segment against that list before checking the property name.
- **An unrecognised value does warn, in two places.** `data-next-action="buy"` logs `Unknown action type: buy`, and `data-next-enhancer="whatever"` logs `Unknown enhancer type: whatever`, both at warn level and both producing no feature.
- **A feature whose `initialize()` throws is destroyed and dropped.** The element stays in the DOM with nothing attached, the scan continues, and the error is logged — which is why boot can report success while part of the page is not enhanced.
- **A scan while a scan is running is dropped.** `scanAndEnhance()` returns immediately and logs `Already scanning, queuing request`; despite the wording nothing is queued (`attribute-scanner.ts › AttributeScanner.scanAndEnhance`).
- **Changing a filtered attribute re-activates the element.** The scanner destroys the element's features and re-runs the match, so switching `data-next-display` at runtime works. Switching an attribute outside the eight — `data-next-package-id`, for instance — changes nothing until the element is re-created.
- **Cleanup on removal is limited to the same eight attributes.** Removing an element that carries one of them destroys its features; removing any other enhanced element does not, so that feature's store subscriptions stay live for the rest of the page. **Symptom:** in a page that swaps views, cart updates keep reaching features whose elements are long gone, and memory grows with each swap. **Fix:** hide SDK markup rather than removing it when a view changes, or reload the page between views.
- **Rendered children are replaced, not updated.** `data-next-cart-items` and `data-next-cart-summary` features rewrite their `innerHTML` on every cart change, so any listener you attached to a child is discarded with it. **Fix:** attach listeners to the container and match the target, or to an element outside the rendered subtree.
- **The scan root is `<body>`.** Attributes on `<html>` or in `<head>` are never candidates.

## Decisions

- **We chose one fixed selector query over walking the tree and inspecting attributes,** because a single `querySelectorAll` runs inside the browser rather than in our loop. The cost is a registration list: an attribute added to a feature but not to that list activates nothing, and nothing reports it.
- **We chose to `import()` each feature type on first use over bundling them all,** because a landing page uses a handful of the SDK's features and a checkout page a different handful. The cost is that activation is asynchronous, so features come alive over several frames rather than all at once.
- **We chose a `WeakMap` keyed by the element over a registry of live features,** so an element removed from the page takes its features with it and needs no bookkeeping. The cost is that the scanner cannot enumerate what it created — which is why tearing the scanner down does not destroy the features it made (`attribute-scanner.ts › AttributeScanner.destroy`).
- **We chose a narrow attribute filter for the observer over re-running the full match,** because a `MutationObserver` on a busy page pays its check on every mutation, including mutations the SDK caused itself. The cost is the gap described above: most dynamically inserted SDK markup is not activated.
- **We chose to enhance in batches of ten with a yield between them over enhancing everything at once,** because a page with hundreds of bindings would hold the main thread for the whole scan and delay first paint.

## Limitations

- **Does not activate most markup added after boot** — only the eight filtered attributes are noticed. There is no public "re-scan this element" call: `SDKInitializer.getAttributeScanner()` reaches the scanner's `pause()` and `resume()`, but only from a module import, and neither of them re-scans.
- **Does not report an unknown `data-next-*` attribute.** A typo in the attribute name itself (rather than in its value) leaves the element out of the query and produces no log at any level.
- **Does not destroy features when the scanner is destroyed,** so a second scan over the same document leaves two live features per element. Two features on one selector means two cart writes per click.
- **The count in `next:display-ready` is not the number of features created.** `detail.enhancedCount` counts every candidate element the scan visited, including the ones it skipped (`attribute-scanner.ts › AttributeScanner.scanAndEnhance`). For the number of live features read `nextDebug.getStats()` — see [logging and the debug overlay](./logging-and-debug.md).
- **Per-feature timing is only collected under `?debug=true`,** and the report is printed with `console.table` rather than exposed as data.
- **No ordering guarantee between features.** Elements are activated in document order in batches, but each feature's `initialize()` is asynchronous, so one feature cannot assume another is already running. Features coordinate through the [event bus](./event-bus.md) instead.
