# Code findings — triage list

Found while documenting the SDK on **2026-07-30**, plus finding 24 from writing the
`accept-upsell` e2e coverage, findings 36–42 from documenting `src/core` (Phase 6),
findings 80–85 from the Fumadocs→TypeDoc migration, findings 86–91 from a further
TypeDoc/reference-docs verification pass, findings 92–94 from splitting the
`features/display` enhancers by layer, and findings 95–100 from splitting the `features/cart`,
`features/ui`, `features/behavior` and `features/order` ones, all on **2026-07-31**.
Findings 97–99 are on the upsell money path. Nothing here is a
documentation problem; each is a code change, and none has been made. The docs describe
current behaviour, including the broken parts, so this list is the backlog rather than a
description of what shipped.

Two entries were **closed** on 2026-07-31 rather than fixed in code: finding 34 turned out
to be answerable by measurement (and uncovered finding 36 doing it), and finding 35 was a
documentation fix, so it was made. Both are kept in place so the reasoning is not lost.

**Verified** means I read the code myself and reproduced the reasoning at the cited
line. **Reported** means it came out of a parallel review and is precise enough to act
on, but I have not personally confirmed it — check before scheduling.

Nothing in this file authorises a push or a deploy.

---

## P1 — wrong data reaches the customer or the API

### 1. Klarna is submitted as `card_token` on one of the two order paths — *verified*

There are **two** constants named `API_PAYMENT_METHOD_MAP`:

| Where | Has `klarna`? | Used by |
|---|---|---|
| `src/features/checkout/checkout-form.enhancer.ts:44` | **yes** | the standard submit, `:1838` |
| `src/features/checkout/constants/field-mappings.ts:61` | **no** | `builders/order-builder.ts:5`, applied at `:185` |

`order-builder.ts:185` is `API_PAYMENT_METHOD_MAP[method] || 'card_token'`, so a Klarna
order built through `OrderBuilder` — the path `OrderManager` and express checkout use —
reaches the API as a card charge. The standard form path is unaffected, which is why
this has not been obvious.

**Fix:** delete the local copy in the enhancer and import the shared one, then add
`klarna` to it. Two copies of a payment map is the underlying defect; see finding 2.

### 2. Order creation is implemented twice — *verified*

`CheckoutFormEnhancer.createOrder()` (`checkout-form.enhancer.ts:1875`) and
`OrderManager.createOrder()` (`managers/order-manager.ts:38`) are separate
implementations of the same thing: the same three validations, the same messages, the
same 429/401/422/5xx mapping. The enhancer **constructs an `OrderManager` at `:165`
and never calls it** for the standard path; `OrderManager` serves express checkout only.

A fix to one silently misses the other — finding 1 is an instance of exactly that.

**Fix:** make the standard path use `OrderManager`, and delete the enhancer's copy.

### 3. `sdk.getCartData().cartLines` is always empty — *verified*

`enrichedItems` is assigned `[]` at `cart.state.ts:15` and again inside `partialize`
at `:112`, and **nothing anywhere writes to it** — the analytics code says so in a
comment (`core/analytics/events/EcommerceEvents.ts:23,352`). It is exposed publicly as
`cartLines` at `core/next-commerce.ts:191`, and its TSDoc
(`types/global.ts:1034`) describes it as "enriched with full pricing breakdown for
display".

Any integration reading `cartLines` gets an empty array and no error.

**Fix:** either populate it or remove it from the public snapshot. Removing is an API
change; leaving it is a silent wrong answer.

### 4. `removeCoupon` is case-sensitive while `applyCoupon` is not — *verified*

`applyCoupon` stores `code.toUpperCase().trim()`
(`state/cart/operations/apply-coupon.ts:9`). `removeVoucher` filters on `v !== code`
with no normalisation (`state/checkout/checkout.state.ts:154`), and `removeCoupon` passes the
raw string through.

So `next.applyCoupon('save10')` followed by `next.removeCoupon('save10')` removes
nothing, returns no error, and still recalculates totals — the shopper keeps a discount
the page believes it removed.

**Fix:** normalise in `removeVoucher`, the same way `applyCoupon` does.

### 24. A selector-driven accept button boots enabled or disabled at random — *verified 2026-07-31 in a browser*

Numbered 24 to keep the existing numbers stable; by impact it belongs with the P1s
above — the failing outcome is a dead accept button on a post-purchase page.

Two facts that only bite together:

1. `PackageSelectorEnhancer` in upsell context **always pre-selects** — 
   `initializeSelection()` (`features/cart/package-selector/package-selector.enhancer.ts:224`)
   takes `items.find(i => i.isPreSelected) ?? this.items[0]` and selects it, emitting
   `selector:item-selected`.
2. `AcceptUpsellEnhancer.findSelectorElement()`
   (`features/cart/accept-upsell/accept-upsell.enhancer.ts:125`) matches
   `[data-next-upsell-selector][data-next-selector-id="<id>"]`,
   `[data-next-upsell-select="<id>"]`, and
   `[data-next-upsell][data-next-selector-id="<id>"]` — **never
   `[data-next-package-selector]`**, which is the container the feature's own
   `guide/get-started.md` (Option B) and `package-selector`'s guide both recommend.

So the 100 ms read in `setupSelectorListener` — the one whose whole job is to pick up a
selection that already exists — always misses, and logs
`Selector "<id>" not found` as a **warn on a correct page**. The button's only route to
the selection is the event, and whether it hears the pre-selection depends on which of
the two enhancers the scanner finished initializing first. Both outcomes observed on
identical markup:

- 10 runs of the same fixture across two Playwright projects: the button was `enabled`
  with `class=""` in some, `disabled` + `next-disabled` in others — the reason the e2e
  spec asserts the disabled state on a button with no selector instead.
- With `data-next-selected="true"` on the first card it was still `disabled="true"` a
  full second after the order had loaded: a card that looks chosen next to a button
  that does nothing until the visitor clicks a card.

The selector element *does* expose `_getSelectedPackageId` — the query simply never
finds it.

**Fix:** add `[data-next-package-selector][data-next-selector-id="<id>"]` to
`findSelectorElement()`'s query. The init read then works, the warn goes away, and the
pre-selection behaves the way three guide pages used to claim it did.

The docs were corrected rather than the code (`accept-upsell`'s `overview.md`
Limitations, `reference/logs.md`, `get-started.md`, and the manifest note on
`data-next-selector-id`), so an author reading them today is not misled.

---

## P2 — silently wrong behaviour a page author cannot diagnose

### 5. The first `<button>` in a coupon container wins — *verified*

`features/cart/coupon/coupon.enhancer.ts:32-33`:

```ts
this.element.querySelector('button') ||
  this.element.querySelector('[data-next-coupon="apply"]');
```

The generic query runs **first**, so an unrelated earlier button — a "Continue" — becomes
the apply trigger and gets `preventDefault()`. The explicit attribute is only consulted
when there is no button at all.

**Fix:** swap the order.

### 6. `first_visit_timestamp` never survives a session — *verified*

`core/attribution/attribution-collector.ts:143` falls back to
`localStorage.getItem('next-attribution')`, but the store's persist storage writes
**sessionStorage** only (`state/attribution/attribution.state.ts:367-379`). That key is never
written to localStorage, so the cross-session recovery path is dead code and every new
tab looks like a first visit.

**Fix:** decide which storage owns it, and use one.

### 7. `CartItem.properties` TSDoc contradicts the code — *verified*

`types/global.ts:981` says "Two items with the same packageId but different properties
are treated as separate lines." `state/cart/operations/add-item.ts:57-58` matches on
`packageId` **alone** and merges the quantity, discarding the incoming `properties`.
Separate property lines are only reachable through `swapCart`.

**Fix:** correct the TSDoc, or implement the documented behaviour. The docs currently
describe the code, not the comment.

### 8. Attribution `metadata` is an unprotected namespace — *reported*

`collectTrackingTags()` assigns every `os-tracking-tag` / `data-next-tracking-tag` meta
straight into `metadata`, so a tag named `device`, `domain`, `referrer`, or `timestamp`
overwrites the SDK's own value — and `getAttributionForApi()` forwards the result.

**Fix:** namespace custom tags, or reject collisions with a warning.

### 9. `getAllParams()` returns the store object by reference — *reported*

Mutating the returned object edits state without notifying subscribers, so a display
bound to a parameter goes stale. `core/next-commerce.ts` around `:984-1037`.

**Fix:** return a shallow copy.

### 10. `getTotalWeight()` computes no weight — *reported*

`state/cart/cart.state.ts:43-47` is byte-identical to `getTotalItemCount()`: a sum of
`quantity`. Anything using it for shipping is wrong.

**Fix:** implement it or remove it.

---

## P3 — contradictions and dead surface

| # | Finding | Where | Status |
|---|---|---|---|
| 11 | `express-checkout:started` / `completed` / `failed` / `error` are emitted by `processors/express-checkout-processor.ts`, yet `types/global.ts` marks all four `@deprecated — never emitted by this build`. The source contradicts itself; docs point readers at `order:completed` / `payment:error` and take no side. | `types/global.ts`, `processors/express-checkout-processor.ts` | reported |
| 12 | `campaign:loaded` has a live subscriber (`core/sdk-initializer.ts:639`) and no emitter. | — | reported |
| 13 | 16 `EventMap` events are never emitted. Removing them is an API change. | `types/global.ts` | verified earlier |
| 14 | `data-cart-item-id` vs `data-next-cart-item-id` — cart-item-list writes one, display-context reads the other, so display bindings never resolve cart-line context in a row. | — | reported |
| 15 | `accordion`'s `aria-controls` never resolves: the trigger gets `aria-controls="{id}"` while the panel is given `id="{id}-content"`. Accessibility, and no fix a page author can apply. | `features/ui/accordion/accordion.enhancer.ts` | reported |
| 16 | `CACHE_EXPIRY_MS` (10 min) is duplicated in `state/campaign/api.slice.ts:10` and `items.slice.ts:12` — two copies that can drift. `config.cacheTtl` does not control it. | — | reported |
| 17 | 14 `ConfigState` fields are read nowhere outside the debug panel, including `cacheTtl`, `retryAttempts`, `maxRetries`, `enableAnalytics`, and `tracking`. Analytics reads `config.analytics?.enabled` instead. | `types/global.ts` | reported |
| 18 | `campaignId` is never sent anywhere — requests authenticate by `apiKey` alone. | — | reported |
| 19 | Config load order differs between boot and the debug panel: `sdk-initializer.ts:395-398` lets meta tags win, `core/debug/DebugPanels.ts:144-145` lets `window.nextConfig` win. A value shown after a debug reload can differ from the one used at boot. | — | reported |
| 20 | `campaign` store `reset()` does not clear `isFromCache` / `cacheAge` — `initialCampaignState` omits both keys and Zustand `set` merges, so a reset store keeps reporting the previous load's cache status. | — | reported |
| 21 | `src/types/cart.ts` holds a second, dead `CartState` (numbers, `tax`, `shipping`, `coupon`) that disagrees with the live one in `types/global.ts` (Decimals, `vouchers`, `summary`), plus stale duplicate `CartItem`, `EnrichedCartLine`, `ShippingMethod`. Candidate for deletion. | `types/cart.ts:16` | reported |
| 22 | `checkout.testMode` / `setTestMode` are dead — test-order behaviour comes from `core/test-mode.ts`. | — | reported |
| 23 | `getProduct(id)` is an alias of `getPackage(id)` despite the name implying a product lookup. | `state/campaign/items.slice.ts:56` | reported |

---

## Found while inventorying `src/core` for Phase 6 (2026-07-31)

Numbered 25+ to keep the existing numbers stable. These came out of the inventory in
[documentation-plan.md](./documentation-plan.md) §5q, not from a bug hunt, so severity
varies. *verified* = I read the cited line myself; *reported* = precise from the
inventory, unconfirmed by me.

### 25. `next:ready` fires before the SDK is ready — *reported, P1-shaped*

`public/loader.js:153` dispatches `next:ready` immediately after importing the module;
boot then runs 19 more steps and fires `next:initialized`
(`core/sdk-initializer.ts:1070`). A page that waits for `next:ready` and calls
`next.getCartData()` races the whole boot — campaign not loaded, cart not rehydrated,
`window.next` possibly not assigned. **Fix:** either rename/retire the loader event or
make it wait; documenting it is not enough, because the name is the trap.

### 26. A missing API key un-hides the page it was supposed to keep hidden — *verified*

`sdk-initializer.ts:434` throws `API key not found…` at step 7, so nothing after it runs:
no DOM scan, no `window.next`, no `next:display-ready`, and `window.nextReady` callbacks
never drain. But `body[data-next-sdk-loading]` is set to `false` anyway (`:103`), which is
the documented hook for revealing markup — so the visitor sees the un-enhanced page with
`{price}` placeholders instead of nothing. Three retries at 1s/2s/3s follow, then an
uncaught rejection. **Fix:** leave the loading flag set when boot fails, and surface the
failure through `error:occurred`.

### 27. `next:initialized` reports version `'0.2.0'` — *verified*

`sdk-initializer.ts:1072` hard-codes it while `VERSION` (`index.ts:78`) resolves the real
one (currently 0.4.30). Anything keying analytics or support triage off that payload sees
a version from years ago. **Fix:** use `VERSION`.

### 28. `next-analytics-disable` / `-enable-only` are parsed and never enforced — *verified*

`MetaTagController.shouldBlockEvent()` (`analytics/tracking/MetaTagController.ts:125`) has
**no caller** — its declaration is the only reference in the repo, and `disabledEvents` /
`enabledOnlyEvents` are read nowhere else. So a page that sets those meta tags to suppress
events still sends every one of them, and the tags are even logged as applied (`:78-79`,
`:117`). Both are published as `status: 'inert'` on the generated
[meta-tag reference](../src/core/guide/reference/meta-tags.md), and a test now fails if
`shouldBlockEvent()` ever gains a caller, so the docs cannot silently go stale either way.
**Fix:** call it in the push path, or delete the meta tags and the parser together.

### 29. `?reset=true` clears only part of what the SDK wrote, and the two branches disagree — *verified*

`sdk-initializer.ts:1098-1133` sweeps only keys starting `next-` or `_next` from both
storages — while the **cookie** branch at `:1125` checks `next_`. So the two halves of the
same function use different prefixes, and every underscore key survives a "reset":
`next_selected_currency`, `next_selected_country`, `next_selected_locale`,
`next_funnel_name`, `next_prospect_cart`, `next_utm_data`, `next_v2_pending_events`,
`next_country_*`, `nextDataLayer_*` — plus `analytics_*`, `visitor_id`, `user_data`,
`session_id`, `evclid`, `tn_tag_*`, `upsells_*`, and every `debug-*` key.

Symptom during QA: you "cleared all storage" and the page still comes up in the previous
currency, still attributed to the previous funnel, and still silently untracked if
`analytics_ignore` was set. The same gap applies to `SDKInitializer.clearAllStorage()`,
which is what `?reset=true` calls. **Fix:** match `next_` as well, and derive the list from
[`core/docs/storage-keys.ts`](../src/core/docs/storage-keys.ts), which now enumerates all
49 rows for exactly this purpose.

### 30. `reinitialize()` **and every failed-boot retry** stack duplicate listeners — *verified*

`setupAttributionListeners()` (`sdk-initializer.ts:617`, registering at `:634-665`) has no
idempotence guard, and `reinitialize()` (`:1001`) does not remove what it registered. So
each call adds another `campaign:loaded` handler, another `cart:updated` handler, and
another `popstate` listener.

Originally reported as affecting only the debug panel's reload path. It is worse than that:
**the retry path hits it too**, so a first boot that failed at step 5 or later leaves
duplicated attribution `conversion_timestamp` writes on every subsequent cart update — on a
normal customer page, with no debug tooling involved. **Fix:** guard the registration, or
track the handlers and remove them before re-registering.

### 31. `storage.ts` timer helpers write the wrong storage — *verified*

`saveTimerState` / `loadTimerState` / `clearTimerState` (`storage.ts:157-170`) write
`next-timer-*` to **sessionStorage** and are called from nowhere; the only code using that
prefix, `features/display/timer/timer.enhancer.ts:39,45,100`, uses **localStorage**. So two
mechanisms exist for one key family and the helpers can never read what the timer wrote — a
future caller would silently get a different lifetime. Also `CONFIG_STORAGE_KEY =
'next-config-state'` (`storage.ts:146`) is exported and never read or written anywhere under
`src/`. **Fix:** delete all four, or make the helpers match their consumer.

### 32. `config.ts` documents two analytics providers that do not exist — *reported*

`analytics/config.ts:37-62` describes `GA4` and `SEGMENT` settings; there is no adapter and
no entry in `PROVIDER_FACTORIES` for either. A reader configures them and nothing happens.
**Fix:** delete the entries, or say plainly they are not implemented.

### 33. ~280 lines of dead debug code — *reported*

`debug/DebugModule.ts` (184 lines) and `debug/test-components.ts` (96) have no importers,
and the four panel classes in `debug/DebugPanels.ts` are superseded by `panels/` and not
exported — one of them calls `require()` inside an ESM file, so it would throw if anything
did reach it. **Fix:** delete.

### 34. ~~`drop_console: true` may contradict every published log reference~~ — **ANSWERED 2026-07-31, and it is a different problem**

Measured against a fresh `npm run build`, so this no longer threatens the 28 published
`reference/logs.md` pages — but only because a *second* defect cancels the first.

| Bundle | Loaded when | `console.error` | `warn` / `info` / `debug` / `log` |
|---|---|---|---|
| `dist/index.js` + `dist/chunks/*` (ESM) | **always** — `public/loader.js:50` sets `PROD_ENTRY_PATH = '/index.js'` | present | **present** |
| `dist/index.umd.js` | `nomodule` browsers, and when the module import fails (`loader.js:170`, `:192`) | **zero** | **zero** |

Precision on that second row, because a first pass got it wrong: the UMD contains **0
`console.*` call sites**. Four textual occurrences of `console.error` exist and none is a
call — one read and one assignment from the error handler replacing it, and two inside
string literals (`source: "console.error"`). `drop_console: true` removes error calls along
with the rest, so **the UMD fallback prints nothing at all, including errors.**

The published log pages are therefore accurate for the bundle customers actually get.
`Logger` (`core/logger.ts`) gates the non-error levels behind
`isProduction && !isDebugModeEnabled()`, so they print only with `?debug=true`,
`?debugger=true`, `nextConfig.debug`, or `nextConfig.debugger`; `Logger.error` has no
production guard and always prints. Two facts worth carrying into the docs, now written up
on [`src/core/guide/subsystems/logging-and-debug.md`](../src/core/guide/subsystems/logging-and-debug.md):
on the UMD fallback debug mode **cannot** bring the missing levels back, because the calls
were removed at build time rather than gated at runtime.

**The reason they survive is finding 36.** No fix is needed on the log pages.

### 36. The ESM bundle — the one every customer page loads — is not minified — *verified*

`vite.config.ts:323-324` sets `minify: 'terser'` with `terserOptions` on the main build,
and the UMD build at `:137-138` does the same. It takes effect for the UMD and **not** for
the ESM output:

| File | Lines | Avg line length | Minified? |
|---|---|---|---|
| `dist/index.umd.js` | 2 | ~697,000 | yes |
| `dist/chunks/state-*.js` | 2,245 | 36 | **no** |
| `dist/chunks/display-core-*.js` | 837 | 37 | **no** |
| `dist/chunks/vendor-*.js` | 16,452 | 41 | **no** |

The chunks ship original identifiers, indentation, and template literals — e.g.
`if (isNaN(num)) { console.warn(\`Invalid percentage value: ${value}\`); ...`. So every
campaign page downloads unminified JavaScript, `drop_console` never runs on it, and the
`mangle.properties.regex: /^_/` setting never applies either.

Not a documentation problem, and the largest single performance item found so far: the
uncompressed chunk total exceeds 2 MB, with `vendor` alone at 656 kB and `debug` at 349 kB.
**Fix:** find out why terser is skipped for the library ESM build — most likely the
`build.lib` multi-entry configuration or the plugin `config` hook that adds the UMD pass —
then re-measure. Worth confirming whether the `debug` chunk is reachable from a production
page at all before optimising anything else.

Related, and probably the same root cause: the build log writes the compression plugin's
output to `dist//home/bond/29next/campaigns/campaign-cart/chunks/…` — an absolute path
pasted after `dist/`, so the `.br` artefacts land in a nested directory tree instead of
beside the chunks.

### 35. ~~Two stale claims in core READMEs~~ — **FIXED 2026-07-31**

Both READMEs were corrected. What they now say, and why the old text was wrong:

- `src/core/README.md` claimed core stays out of the public reference because it is marked
  `@internal` with `excludeInternal: true`. An AST scan finds **zero `@internal` tags on
  any exported declaration** in core — the only seven are file-header blocks in
  `core/docs/`, attached to nothing. It is excluded by being unreachable from the single
  `entryPoints: ["src/index.ts"]` (four core symbols re-exported) **plus**
  `DROP_DIRS = ['classes']` in `scripts/typedoc-fumadocs.mjs:26`, which deletes the class
  pages. The README now says that, and spells out the consequence: TSDoc inside
  `src/core/**` is a contributor artefact that reaches no reader.

  **Addendum, added while switching the docs site to TypeDoc:** `scripts/typedoc-fumadocs.mjs`
  — the file named in the bullet above — has since been deleted as part of that switch, and
  `src/core` is now itself a TypeDoc entry point (`typedoc.json:3-7`) with real class pages
  under `docs/site/classes/`. The reasoning above is kept as the historical record it was
  accurate to at the time (the README's old `@internal` excuse really was wrong, for the
  reason given) rather than rewritten, matching how finding 34 is handled. `src/core/README.md`
  already carries the corrected, current story. Four other places still cited the deleted file
  by name — see finding 85.
- `src/core/analytics/README.md` advertised "GTM, Facebook Pixel, custom endpoints" while
  `providers/` holds five concrete adapters (**+ RudderStack, + NextCampaign**), had two
  dead import paths (`@/utils/analytics/v2`, which does not exist — the real path is
  `@/core/analytics`), told the reader to call `window.NextDataLayer.setDebugMode(true)` on
  what is a plain `DataLayerEvent[]` array, and claimed `RudderStackAdapter` remaps
  `campaign_*` to camelCase. `buildContextProps` (`RudderStackAdapter.ts:69-86`) keeps them
  snake_case and says so in its own comment. All corrected, with the provider table now
  pointing at the generated
  [`analytics-providers.md`](../src/core/guide/reference/analytics-providers.md) so a
  hand-maintained list cannot drift again.

### 37. A failed dynamic import in `initializeErrorHandler` is unhandled, and error capture silently never installs — *verified*

`sdk-initializer.ts:689-692` calls `import('...').then(...)` with no `.catch`, and it is
not awaited (`:75`). The enclosing `try` cannot catch a rejected dynamic import, so a
chunk-fetch failure becomes an unhandled rejection **and** global error capture is never
installed — while boot reports success. Because it is not awaited, its install time is also
unordered relative to the rest of boot, so an error thrown early in a later step may or may
not be captured. **Fix:** `await` it and catch, or accept the async install and say so.

### 38. `SDKInitializer.initialize()` is a floating promise at both call sites — *verified*

`src/index.ts:89` and `:93` call it with no handler. After three failed retries
`sdk-initializer.ts:115` re-throws, so the only trace of a completely failed boot is an
unhandled rejection in the console. **Fix:** attach a `.catch` that reports through the
SDK's own error path.

### 39. A debug-chunk fetch failure aborts a boot that would have succeeded in production — *verified*

`sdk-initializer.ts:87` awaits `initializeDebugMode`, which at `:783` does an unguarded
`await import('@/core/debug/DebugOverlay')`. In debug mode a failed chunk fetch therefore
throws inside the boot try block and takes the whole SDK down — on the exact page someone
is trying to debug. **Fix:** wrap it; debug tooling must never be able to fail the boot.

### 40. `scanAndEnhance` swallows its own error, making `data-next-sdk-loading="false"` unusable alone — *verified*

`attribute-scanner.ts:53-158` catches at `:157`, so `next:initialized` can fire and the body
attribute can flip to `"false"` while `next-display-ready` / `next:display-ready` never
arrive and no feature was activated. A reveal rule keyed on the attribute alone un-hides a
page of raw `{price}` placeholders. The generated
[`boot-sequence.md`](../src/core/guide/reference/boot-sequence.md) documents the two-signal
workaround, so this is a code decision to confirm rather than a docs gap. **Fix:** either
re-throw, or emit a distinct failure signal the page can style off.

### 41. Retrying the boot cycles the loading attribute, un-hiding the page mid-retry — *verified*

On the retry path `data-next-sdk-loading` goes `"false"` (`:103`) → `"true"` (`:47`) →
`"false"`, so a page can visibly un-hide showing placeholder markup *between* attempts,
not only after the last one. Finding 34's table explains why the console gives no clue on a
production build. **Fix:** leave the attribute at `"true"` while a retry is pending.

### 42. Four boot statistics are written and never read — *verified*

`initTime` (`sdk-initializer.ts:90`), `campaignLoadTime` (`:443`), `campaignFromCache`
(`:444`), and `rehydrationTime` (`:1056`) are assigned and never read;
`getInitializationStats()` (`:1086`) reports none of them. Hidden by
`noUnusedLocals: false` in `tsconfig.json`. **Fix:** report them from
`getInitializationStats()` — they are the timings anyone debugging a slow boot wants — or
delete them.

### 43. Seven of the 35 analytics events are never built by any SDK code — *verified*

Machine-checked against the emit sites while generating the event catalogue:
`dl_search`, `dl_add_to_wishlist`, `dl_refund`, `dl_view_promotion`,
`dl_select_promotion`, `dl_start_trial`, and `dl_accepted_upsell` have zero construction
sites. They are indistinguishable from live events to anyone reading `DL_EVENTS`, so a
provider configured to expect one waits forever.

`dl_accepted_upsell` is the worst of the seven because it looks maintained: declared at
`analytics/schemas/events.ts:194`, given a schema at `schemas/index.ts:462`, specially
validated at `validation/EventValidator.ts:446-449`, and mapped for Meta at
`providers/FacebookAdapter.ts:35` — while `createAcceptedUpsellEvent` actually builds
`dl_upsell_purchase` (`events/EcommerceEvents.ts:654`).

The generated catalogue now marks all seven, and the drift test requires the mark to match
"zero emit sites" exactly. **Fix:** emit them or remove them; either way the vocabulary
should not advertise events the SDK cannot send.

### 44. The analytics vocabulary gate cannot detect finding 43 — *verified*

`src/tests/utils/analyticsVocabulary.test.ts:117-123` looks for each event name as **raw
text** anywhere under `src/core/analytics`, so a name that exists only as a key in a
provider's mapping table counts as "emitted". That is exactly why all seven dead events
pass it today.

Worth fixing because this test is the precedent the whole documentation programme was
modelled on (§2 of the plan) — it is cited as the example of a gate that works.
**Fix:** match construction sites (an event object being built) rather than any textual
occurrence, the way `extract-analytics-events.ts` now does.

### 45. `blockedEvents` is silently ignored by three of the five providers — *verified*

`analytics/index.ts:50` (`nextCampaign`), `:56` (`rudderstack`), and `:58` (`custom`)
construct their adapters with no options, so `ProviderAdapter.blockedEvents` is `[]` for
all three. Only `gtm` and `facebook` receive the list. A page that blocks an event sees it
suppressed for two destinations and delivered to the other three, which is worse than not
being able to block at all. **Fix:** pass the options through in all five factories.

### 46. A 100%-discount order sends no purchase event at all — *verified*

`DataLayerManager.validateEvent` tests the value with a falsy check (`:212`, `:222`), and
`EVENT_VALIDATION_RULES.eventSpecific` requires `ecommerce.value` for `dl_purchase`
(`analytics/config.ts:74`) and `dl_upsell_purchase` (`:90`). A zero-value order therefore
fails validation and never reaches the data layer or any provider — so a free order is
invisible to every analytics destination, with no error. **Fix:** check for `undefined`
rather than falsiness.

### 47. `CustomAdapter`'s retry queue can never fire, and two GTM fields are always undefined — *verified*

The retry queue keys on `event.id` (`providers/CustomAdapter.ts:200-206`) and nothing ever
sets `id` — the pipeline sets `event_id` (`DataLayerManager.ts:296`). So `maxRetries: 3` is
inert and a failed custom-endpoint delivery is simply lost. The same mismatch makes
`GTMAdapter.ts:79` send `event_id: undefined` and `event_timestamp: undefined` on every
event. **Fix:** read `event_id` / `event_timestamp`.

### 48. GTM's entire GA4 shaping path is unreachable for canonical events — *verified*

`GTMAdapter.sendEvent` returns early for anything `dl_`-prefixed (`:44-55`), pushing it
verbatim to `ElevarDataLayer` and `dataLayer`. Everything below that — the `dl_` strip at
`:349`, `buildEcommerceObject`, `eventHasValue`, and the promotion and list field rules —
only runs for non-`dl_` pushes. Since every canonical SDK event is `dl_`-prefixed, that
code is dead for all of them.

This also corrects a claim carried in the plan: **no adapter strips the prefix to pick GA4
field rules.** Facebook (`FacebookAdapter.ts:15-54`) and RudderStack
(`RudderStackAdapter.ts:325-365`) rename through fixed tables instead. The net effect the
plan described is right — no vendor API sees a `dl_` name — but the mechanism is not.
**Fix:** decide whether the GA4 shaping is meant to apply, and either route canonical
events through it or delete it.

### 49. Two events require fields their own schema does not declare — *verified*

`analytics/config.ts:88-89` requires top-level `lead_type` on `dl_subscribe` and
`ecommerce.items_removed` / `items_added` on `dl_package_swapped`, neither of which is in
the event's schema. The SDK's own factories supply them, so this only bites a hand-built
push through `window.NextDataLayer` — which then fails validation and vanishes. Documented
as a caution on the catalogue. **Fix:** add the fields to the schemas.

### 50. Delivery telemetry exists in every build and nothing outside the overlay can read it — *verified*

`AnalyticsDebugTracker` records per-provider `pending|sent|blocked|skipped|failed` with the
payload, the error, and the duration, unconditionally — no debug gate. But
`analyticsDebug` is never attached to `window`; its only consumers are
`debug/DebugOverlay.ts:130` and the event timeline panel. So on a page where the overlay
cannot be opened, the one data source that answers "why did my provider get nothing" is
unreachable. **Fix:** expose it on `window.nextDebug`, which is where a reader would look.

### 51. Test mode is armed on every production page, and the Konami shortcut creates a real order — *verified*

The sharpest finding of Phase 6. `core/test-mode.ts:367` is a module-level singleton, statically
imported by `core/sdk-initializer.ts:16`, and its constructor attaches a `document` keydown
listener at `:70-76`. `handleKeyDown` (`:79-98`) **never checks whether test mode is on.**

So ↑↑↓↓←→←→BA on any live checkout dispatches `next:test-mode-activated` →
`checkout-form.enhancer.ts:247` → `:3480-3556` fills `Test Order / Test Address 123 /
Tempe AZ 85281` and sets `card_token: 'test_card'` → `:2031`/`:2049` post it to the **real**
`apiClient.createOrder`. Submitting also resets the cart and checkout stores and redirects
(`:2079-2112`), so it takes the shopper's cart with it. `?debugger=true` arms the same path as
a side effect (`core/test-mode.ts:104`), which means opening the debug overlay on a live page
is enough.

Two aggravating details: an **empty** cart still produces an order for `package_id: 1,
quantity: 1` (`checkout-form.enhancer.ts:2003-2010`) with shipping falling back to
`cartStore.shippingMethod?.id || 1` (`:2029`); and the card list in `test-mode.ts` is
unreachable — `showTestCardMenu()` (`:299`) has no caller and is the only thing that calls
`fillTestCardData()` (`:237`) — so what ships is always the `test_card` token.

**Fix:** gate `initializeKonamiCode()` behind a non-production build flag or an explicit
opt-in, and add an `isTestMode` guard to `handleKeyDown`.

### 52. The DOM observer watches 8 attributes while the scanner activates 30 — *verified*

`dom-observer.ts:43`'s `attributeFilter` holds 8 names; `attribute-scanner.ts:55` queries 30
selectors on the first pass. So markup injected after boot comes alive only if it carries
`data-next-display`, `-toggle`, `-timer`, `-show`, `-hide`, `-checkout`, `-validate`, or
`-express-checkout`. An injected `data-next-action="add-to-cart"`, `-package-selector`,
`-cart-items`, `-coupon`, or `-quantity` is never activated, with no error — which reads as a
broken feature.

Worse, two of the eight are dead: `data-next-toggle` (the live attribute is
`data-next-package-toggle`) and `data-next-validate` (validation moved into
`CheckoutFormEnhancer`). The observer pays for two attributes that map to no enhancer while
missing every attribute that does. **Fix:** derive the filter from the scanner's selector
list.

### 53. Enhancers are never destroyed when their element is removed — *verified*

`dom-observer.ts:278` notifies `removed` only for elements carrying one of the eight filtered
attributes, so `attribute-scanner.ts:507 cleanupElement` never runs for most features:
`destroy()` is not called, store subscriptions stay live, and `enhancerCount` is never
decremented. Symptom on a page that swaps views: cart updates keep reaching features whose
elements are gone. **Fix:** track enhanced elements and reconcile on removal regardless of
the filter.

### 54. A second DOM scan double-activates every element — *verified*

`attribute-scanner.ts:516 destroy()` does not destroy live enhancers — its own comment says it
cannot, because they are held in a `WeakMap` — and `sdk-initializer.ts:727-732` then builds a
**fresh** scanner with a fresh `WeakMap`. Every element is re-enhanced, so each ends up with
two features and cart writes double.

Reachable two ways: `reinitialize()`, and a boot **retry** after a step later than the scan
fails — which finding 39 makes concrete, since a failed debug-chunk fetch at step 13 aborts a
boot whose scan already ran. **Fix:** keep a real registry of live enhancers so `destroy()`
can tear them down.

### 55. `window.next` is `undefined` inside a callback queued before boot — *verified*

`sdk-initializer.ts:745` drains `window.nextReady` and `:755` assigns `window.next`, in that
order. So a callback pushed before boot that reads `window.next` gets `undefined`, while the
same callback pushed after boot works. Load-order-dependent, and the documented pattern is
the one that fails. The generated
[JavaScript API](../src/core/guide/reference/javascript-api.md) now tells readers to use the
`next` argument the callback receives. **Fix:** assign `window.next` before draining.

### 56. `window.NextDataLayerTransformFn` is discarded if set before the SDK loads — *verified*

`analytics/index.ts:84` nulls it unconditionally in the `NextAnalytics` constructor. Assigning
it in a `<script>` tag ahead of the loader — the way it reads as intended — silently loses it
and every event ships untransformed. **Fix:** only null it when a transform is being replaced,
or read the existing value first.

### 57. `require()` in ESM source — *verified as present, runtime effect unconfirmed*

`core/next-commerce.ts:783` has `const { formatCurrency } = require('@/core/currency-formatter');`
inside `formatPrice()`, and `core/debug/DebugPanels.ts:173` has another. The library builds ESM
(`vite.config.ts` `formats: ['es']`), where `require` is not defined, so `next.formatPrice()`
plausibly throws `require is not defined` in the browser. Worth a 30-second check in a real
page — it is a public method. Note `src/state/campaign/guide/overview.md:48` claims the last
CommonJS `require` was eliminated; two remain. **Fix:** convert both to static imports.

### 58. `registerCallback` handlers are never fired by the SDK — *verified*

`triggerCallback` (`core/next-commerce.ts:354`) has no caller anywhere in `src/`, so the
callback channel only fires when page code triggers it. It reads like a lifecycle hook and is
a page-driven notification bus. The generated JavaScript API page now says so — the prose had
claimed a callback runs "when the SDK fires its type". **Fix:** either fire them from the
places that emit the matching bus events, or mark the trio deprecated in favour of
`next.on()`.

### 59. `addUpsell` attributes value to the wrong package when the API reorders lines — *verified*

`core/next-commerce.ts:1024` pairs the requested `lines` with the API's `addedLines` **by array
index**, so `upsell:added.value` can be credited to a different package when the API merges or
reorders. `totalValue` on the resolved result is computed correctly, so only the per-line
attribution is wrong. **Fix:** match on package id.

### 60. Two events are dispatched without `bubbles`, and their own docs tell you to listen on `document` — *verified*

`checkout:location-fields-shown` and `checkout:billing-location-fields-shown` are dispatched on
the form element with `bubbles` defaulting to `false` (`checkout-form.enhancer.ts:1391`,
`:1424`), so `document.addEventListener` never fires — while `types/global.ts:567-568`
instructs exactly that. **Fix:** add `bubbles: true`, or correct the TSDoc.

### 61. Three boot-time events cannot be subscribed to in time — *verified*

The bus does not replay, and these fire during boot before any page code can be listening:

- `sdk:url-parameters-processed` — emitted inside `loadCampaignData` at boot step 5
  (`sdk-initializer.ts:465`); its only subscriber registers during the step-11 DOM scan
  (`features/display/conditional-display/conditional-display.enhancer.ts:97`), so that handler can never run.
- `currency:fallback` (`state/campaign/api.slice.ts:98`, `:162`) — also step 5. The
  "surface this to the visitor" advice in `types/global.ts:160-163` is unactionable; the usable
  signal is `configStore.currencyFallbackOccurred` (`api.slice.ts:93`, `:157`, `:168`).

**Fix:** either replay the last value for these, or document the state field as the contract
and drop the event.

### 62. Every enhancer failure emits `error:occurred` twice — *verified*

`core/base/base-enhancer.ts:138` emits it, and the log line written at `:136` starts with
"Error in …", which passes the error handler's `includes('error')` filter
(`monitoring/error-handler.ts:40-47`) and produces a second event. Anything counting these
double-reports. **Fix:** skip messages the SDK itself just logged, or drop the string-matching
branch.

### 63. Duplicated and inline expiry constants — *verified*

`CACHE_EXPIRY_MS = 10 * 60 * 1000` is declared **twice**, in `state/campaign/api.slice.ts:10`
and `state/campaign/items.slice.ts:12` — the reader and the writer of the same cache each hold
their own copy, so changing one desynchronises them silently. Two more windows are inline
literals with no constant: `5 * 60 * 1000` at `analytics/tracking/PendingEventsHandler.ts:102`
and `30 * 60 * 1000` at `analytics/DataLayerManager.ts:338`. Ten independent windows exist in
total, itemised on the generated
[storage reference](../src/core/guide/reference/storage-keys.md). **Fix:** one shared constant
per window, named.

### 64. `?ignore=true` and `window.nextConfig.tracking` — one works, one is a phantom — *verified*

`?ignore=true` is a real, undocumented analytics kill switch (`analytics/index.ts:100-138`) —
it writes `analytics_ignore` to sessionStorage and returns before any provider initialises, and
it now has a page. `config.tracking` is the opposite: `state/config/config.state.ts:249-251` stores it
and **nothing reads it**, which `config.state-manifest.ts:256`, `:342` already noted. The
meta-tag reference had been recommending it as the way to suppress events; corrected.
**Fix:** implement `tracking` or delete the field.

### 65. Dead code inventory — *verified*

Confirmed unreachable, no importer anywhere under `src/`:

| File | Lines | Note |
|---|---|---|
| `core/debug/DebugModule.ts` | 184 | Live path is `SDKInitializer.initializeDebugMode`. Its `?debugger` set/delete sites look like real behaviour and never run |
| `core/debug/test-components.ts` | 96 | `testDebugComponents()` never called |
| `features/checkout/debug/test-order-manager.ts` | 206 | The enhancer has its own inline Konami handler |

`core/debug/DebugStyleLoader.ts` is **not** dead (`DebugOverlay.ts:271`) — worth stating, since
an earlier pass grouped it with these. Also dead in `core/storage.ts`, none with a non-test
caller: `createStoragePersist`, `onStorageChange`, `getStorageQuota`, `localStorageManager`,
`StorageManager.clear/has/keys/size`, `TIMER_STORAGE_PREFIX`, `getTimerKey`. `onStorageChange`
is unusable as written anyway — it filters `event.storageArea === sessionStorage`, and the
`storage` event never fires for sessionStorage. **Fix:** delete; ~490 lines.

### 66. Two stale-Zustand-snapshot bugs in boot — *verified*

The pattern is capturing `useStore.getState()` before an `await` and reading it after. Zustand
replaces the state object on `set()`, so the captured snapshot never sees the update.

- **Campaign shipping countries are never set from boot.** `sdk-initializer.ts:432` captures the
  campaign snapshot, `:442` awaits `loadCampaign()`, then `:450-453` reads
  `campaignStore.data?.available_shipping_countries` off the **pre-load** snapshot.
  `setCampaignShippingCountries()` is therefore never called and the
  `Campaign shipping countries set globally:` info line never appears. Masked on the checkout
  page because `checkout-form.enhancer.ts:890-893` redoes it — so country filtering works there
  and nowhere else. `:444` (`isFromCache`) has the same bug and feeds the debug boot timings.
- **Attribution metadata is reverted on every cart change.** `:589` captures the attribution
  snapshot and `:603-609` calls `updateAttribution({ metadata: { ...attributionStore.metadata,
  … } })` with the **pre-`collect()`** metadata; `updateAttribution` merges as
  `{...state.metadata, ...data.metadata}` (`state/attribution/attribution.state.ts:133-135`), so stale keys
  overwrite fresh ones. Same at `:645-653` (`cart:updated` → `conversion_timestamp`) and
  `:658-664` (`popstate` → `landing_page`).

**Fix:** call `getState()` inside each handler, after the await.

### 67. `currencyBehavior` only exists at boot, despite its comment — *verified*

`state/config/config.state.ts:69` comments it as "auto-switch currency on country change". The field is
read in exactly one place, `sdk-initializer.ts:160`, at boot. Changing the country in the
checkout form reloads states and relabels fields but never re-prices; only the debug overlay's
`core/debug/CountrySelector.ts:380-400` switches currency and reloads the campaign. So the
comment describes behaviour that exists only in a debug tool. **Fix:** correct the comment, or
implement re-pricing on country change.

### 68. `UtmTransfer` classifies links by substring, so parameters leak — *verified*

`core/attribution/utm-transfer.ts:209-211` decides external with
`href.includes('://') && !href.includes(window.location.hostname)`. A protocol-relative
`//example.com/x` has no `://` and is treated as internal; and any external URL that merely
mentions your hostname — a redirect wrapper, a `?return_to=` parameter — is also internal, so
parameters are appended to it even with `applyToExternalLinks: false`. **Fix:** parse with
`new URL(href, location.href)` and compare origins. Documented meanwhile with the
`excludedDomains` workaround.

### 69. `UtmTransferConfig.debug` cannot be set through the typed config — *verified*

`core/attribution/utm-transfer.ts:15` declares `debug?: boolean`, but `ConfigState.utmTransfer`
(`types/global.ts:1316-1321`) omits it and `loadFromWindow` copies the object wholesale
(`state/config/config.state.ts:264-269`). It works at runtime and cannot be typed, so it is left out of
the documented example. **Fix:** add it to the `ConfigState` shape.

### 70. `facebook-pixel-id` and `os-facebook-pixel` have no precedence — *verified*

`core/attribution/attribution-collector.ts:340-342` looks up both in a single `querySelector`, so
with both present **document order** decides which wins. The Spreedly keys have the same shape at
`state/config/config.state.ts:122-123`, except there the `||` gives a defined order. **Fix:** pick an
explicit precedence, as the Spreedly pair does.

### 71. `next-campaign-id` is stored and read by nothing but a debug panel — *verified*

`state/config/config.state.ts:92-97` stores it; the only consumer is `core/debug/DebugPanels.ts:107`,
and `sdk-initializer.ts:438` confirms the API needs only the key. It looks like it selects which
campaign loads and does not. Published as `status: 'inert'`. **Fix:** remove the tag and its
parsing.

### 72. 97 raw `console.log` calls bypass the log gate — *verified*

Outside `Logger`, excluding tests, docs machinery and `debug/`. On the unminified module bundle
(finding 36) they print for **every** visitor, with no debug flag involved — including on the
real order path, `features/checkout/managers/order-manager.ts:212-247`. **Fix:** route them
through `Logger` or delete them; ESLint's `no-console` already reports them as warnings.

### 73. `getCartTotals()` returns `Decimal` objects, not numbers — *verified, and a documentation trap rather than a bug*

`CartState.subtotal` / `total` / `totalDiscount` / `totalDiscountPercentage` are decimal.js
instances (`types/global.ts:1050-1060`), so `subtotal - total` is `NaN` and `total > 50` compares
strings. The method has no return annotation, so nothing in the signature reveals it. Now carried
as a `returns` line and a caution on the
[JavaScript API](../src/core/guide/reference/javascript-api.md). **Fix:** annotate the return
type; consider exposing plain numbers.

### 74. `window.fetch` is monkey-patched in debug mode and never restored — *verified*

`core/debug/DebugEventManager.ts:44-56` replaces it for the life of the page, with no restore on
`hide()` or `destroy()`. It delegates correctly, but anything else on the page that wraps `fetch`
ends up wrapping the SDK's wrapper. Its captured-event list (`:23-32`) is also stale DOM names
(`next:cart-updated`, `next:item-added`) that nothing dispatches any more. **Fix:** restore on
teardown, and refresh the event list.

### 75. Analytics email leaves the page in the clear — *verified*

`analytics/index.ts:391`, `:397` (`trackSignUp` / `trackLogin`) put the address into the event as
`customer_email`, `events/EventBuilder.ts:126` adds it from the checkout form, and
`events/EcommerceEvents.ts:406` adds it from the order. **There is no hashing anywhere under
`src/core/`** — no `sha256`, no `crypto.subtle.digest`, no helper — and no `customer_email_hash`.

Worth flagging on its own terms: a project memory recorded PII hashing as implemented, which is
what a doc pass nearly published as fact. That memory has been corrected. **Fix:** decide
whether raw email to every configured provider is intended; if not, hash before the push.

### 76. Two smaller `NextCommerce` API inconsistencies — *verified*

- `trackViewItemList(packageIds, _listId, listName)` accepts and ignores its second argument
  (`core/next-commerce.ts:371-380`), so passing the list name in position 2 loses it silently.
- `clearCart()` and `swapCart()` are `async` while `cartOperations.clear()` is sync, and
  `removeCoupon()` returns `void` while firing an async operation (`void
  cartOperations.removeCoupon(code)`) — so there is nothing to await for the outcome.

### 77. Minor `AttributeScanner` reporting defects — *verified*

- `:45-48` logs `Already scanning, queuing request` and queues nothing; the request is dropped.
- `:116` increments `enhancedCount` for every visited element, including the ones
  `enhanceElement` skipped, so `next:display-ready.detail.enhancedCount` overstates and
  disagrees with `getStats().enhancedElements`.
- `:37`, `:40` read `?debug=true` straight off the URL and print with raw `console.log`,
  bypassing `Logger` and the config store's debug flag.
- `sdk-initializer.ts:1038`, `:167`, `:187` read `sessionStorage` unguarded, so a
  storage-blocked browser turns boot into three failed attempts and an unhandled rejection.

### 78. Inert test-mode state fields — *verified*

`config.testMode` is written and read only by the debug Config panel
(`core/debug/panels/ConfigPanel.ts:128`, `:206`), and `checkout.testMode`'s `setTestMode`
(`state/checkout/checkout.state.ts:142`) has no callers. Neither influences submission — that is decided
entirely by `core/test-mode.ts`. `state/config/config.state-manifest.ts:176` says the submit path
consults "`core/test-mode.ts` and the checkout store", and the checkout-store half is wrong.
**Fix:** delete both fields, and correct that manifest line.

### 79. The test-order payload exists in three copies — *verified*

`features/checkout/checkout-form.enhancer.ts:2013-2047`,
`features/checkout/builders/order-builder.ts:145-180`, and a third copy of the form data in
`features/checkout/debug/test-order-manager.ts:82-105` (itself dead — finding 65). Three places
to keep in sync for one hard-coded address. **Fix:** one shared constant.

---

## Found while switching the docs site from Fumadocs to TypeDoc (2026-07-31)

Numbered 80+ to keep the existing numbers stable. Found while moving the generated site from
an external Fumadocs build to an in-repo TypeDoc HTML site (`documentation-plan.md` §8).
*verified* = read myself and reproduced the reasoning at the cited line.

### 80. `Order` vs `OrderData` — two declarations of one concept — *verified*

`state/order/order.state.ts:13` types the store's `order` field as `Order`, imported from
`types/api.ts:129`. Only `OrderData` (`types/global.ts:1605`) is re-exported from
`src/index.ts` (via `{@link OrderData}` at `:47`) — `Order` never is, and no page for it
exists anywhere under `docs/site`. So the order store's real field type is unpublished. The
store's own TSDoc (`order.state.ts:99`) already works around this: `{@link index.OrderData |
order}` points a reader at the published type rather than the one actually on the field. That
link is a sensible stopgap; the underlying defect is that one concept has two declarations,
only one of which is public. **Fix:** make `OrderData` and `Order` the same type, or derive
one from the other, so the store's field type and the published type are not two things.

### 81. TypeDoc's `invalidLink` validation does not see absolute links — *verified*

`typedoc.json`'s `"validation": { "invalidLink": true }`, and `npm run docs:check
--treatWarningsAsErrors`, both pass clean today (confirmed by running it: `0 errors, 0
warnings`) — even though `types/global.ts:16` still links `[JavaScript API ›
Events](/docs/campaigns/javascript-api/events)`, a path that pointed at the now-retired
Fumadocs site and resolves to nothing under `docs/site` (no such page exists in the built
output). TypeDoc's link checker resolves `{@link}` tags and relative markdown links; a
`/`-rooted link is opaque to it, so a dead absolute link ships silently and `docs:check` gives
no signal either way. Two links of the same shape (`documentation-plan.md`'s record of a
2-link Fumadocs cleanup in `product-display` and `upsell`) were caught and fixed by eye during
this migration — this third one, in a TSDoc comment rather than a guide file, was missed by
that same manual sweep, which is the argument for a gate over another manual pass. **Fix (not
mine — `scripts/docs-coverage.mjs` belongs to another agent):** add a grep check there for
`](/` inside anything TypeDoc renders (guides and TSDoc alike), and separately fix
`types/global.ts:16`.

### 82. Stale post-rename paths in three hand-written guides — *verified*

Four citations across three guide files still point at pre-rename locations under
`src/stores/` and `src/enhancers/`, neither of which exists — the code moved to `src/state/`
and `src/features/` during the stores→state / enhancers→features migration:

| File | Cites | Current location |
|---|---|---|
| `features/cart/quantity-control/guide/relations.md:11` | `src/stores/cartStore/` | `src/state/cart/cart.state.ts` (+ `cart-calculator.ts`, `cart.types.ts`, `cart.state-manifest.ts`) |
| `features/cart/remove-item/guide/relations.md:11` | `src/stores/cartStore.ts` | `src/state/cart/cart.state.ts` |
| `features/cart/remove-item/guide/relations.md:12` | `src/enhancers/base/BaseCartEnhancer.ts` | `src/core/base/base-cart-enhancer.ts` |
| `features/cart/bundle-selector/guide/testing.md:9` | `src/enhancers/cart/BundleSelector/tests/applyBundle.test.ts` | `src/features/cart/bundle-selector/tests/applyBundle.test.ts` (same filename, moved directory) |

A dev following any of these four paths finds nothing there. **Fix:** update the four
citations to their current paths.

### 83. State manifests are published, feature manifests are not — one entry-point choice, two outcomes — *verified*

`typedoc.json`'s `entryPoints` lists `src/state` (`entryPointStrategy: "expand"`) but not
`src/features`. That reaches the generated site: every `*.state-manifest.ts` gets a real
module page — e.g. `state/checkout/checkout.state-manifest.ts` produces
`docs/site/modules/state_checkout.state-manifest.html` and
`docs/site/variables/state_checkout.state-manifest.default.html` — while the 29
`*.manifest.ts` files under `src/features` (e.g.
`features/display/shipping-display.manifest.ts`) have no equivalent page; only their
hand-written `guide/*.md` documents are published, not the manifest source itself. Both file
families hold the same kind of thing — structured prose data read by the doc generators — so
the state manifests' prose is incidentally public, versioned API surface while the feature
manifests' identical role is not. **Fix:** decide whether `src/features` should also be an
entry point, or exclude `*.state-manifest.ts` from `src/state`'s expansion, so the two file
families are treated the same way.

### 84. `docs/site/latest` is a symlink whose fallback almost never triggers — *verified*

`scripts/docs-build-version.mjs`'s `linkLatest()` (`:252-261`) calls `symlinkSync(folder, link,
'junction')` and only falls back to `cpSync` inside the `catch` — i.e. only on filesystems
where the symlink call itself throws (Windows without developer mode). On Linux/macOS,
including any Linux CI runner, the call succeeds, so `docs/site/latest` is a real symlink
there. `rsync` and `tar -h` follow it and work; `git archive`, some zip tooling, and some
static hosts do not dereference symlinks and would publish or archive a broken `latest` entry
instead of the folder it points to. `docs/site/` is gitignored today, so the gap is latent
rather than active — but it surfaces the moment the site is archived or hosted by anything
that does not dereference symlinks. **Fix:** make the fallback a policy choice (always copy,
or detect the target tool) instead of something that only activates when the symlink call
happens to fail.

### 85. Stale references to the deleted `scripts/typedoc-fumadocs.mjs` — *verified*

Grepped the repo for other Fumadocs-era markers after finding and removing the
`<!-- typedoc-index-end -->` comment in `src/index.ts` — the marker the now-deleted
`scripts/typedoc-fumadocs.mjs` used to locate where to splice its class-page listing. Four more
references to that same deleted file survive as prose, all asserting a publishing mechanism
that no longer exists:

- `scripts/docs-coverage.mjs:289` and (as of this writing) `:778` — a comment and a generated
  `fix:` suggestion string both say `scripts/typedoc-fumadocs.mjs` "deletes the class pages."
  That file is being actively edited by another agent in parallel, so the second line number
  may have moved by the time this is read — grep the string to relocate it.
- `src/core/docs/core-subsystems.ts:10` and `src/core/docs/next-methods.ts:11` — file-header
  TSDoc making the same claim, given as the reason a hand-written manifest file has to carry
  reader-facing prose instead of relying on TSDoc.

None of these four blocks is attached to an exported declaration TypeDoc renders — checked
against the built site, where both modules' pages come up empty of this text — so, unlike the
`src/index.ts` marker, none is live dead code. But the claim itself is false either way now:
`scripts/typedoc-fumadocs.mjs` does not exist, `src/core` is a TypeDoc entry point
(`typedoc.json:3-7`), and `docs/site/classes/` does contain class pages today (e.g.
`core_sdk-initializer.SDKInitializer.html`) — `src/core/README.md` already carries the
corrected story (see the note added to finding 35). These four are the copies that were missed.
**Fix:** update or delete the four citations; `scripts/docs-coverage.mjs` and
`src/core/docs/*.ts` are not mine to edit, but belong to whoever owns those files next.

---

## Found during a further TypeDoc/reference-docs verification pass (2026-07-31)

Numbered 86+ to keep the existing numbers stable. *verified* = read myself and reproduced
the reasoning at the cited line, including checking the generated `docs/site` output where
relevant.

### 86. ~~The events-guide generator ate `{@link}` tags~~ — **FIXED, in progress in parallel**

`src/tests/docs/extract-event-docs.ts`'s `summaryOf()` used to read only the plain-text
parts of a JSDoc comment, so an `EventMap` summary written as `{@link Foo}` rendered as
nothing in the generated `guide/reference/events.md`, and `{@link Foo | label}` left a
stray `|` behind — a silent hole every time `UPDATE_DOCS=1 npm run docs:reference` ran.

Checked against the file as it stands right now (another job is editing it in parallel,
so this reflects its current state, not necessarily its state when read next): `summaryOf`
now calls a `commentTextOf` helper that special-cases `ts.isJSDocLink` /
`JSDocLinkCode` / `JSDocLinkPlain` nodes through a new `linkTextOf()` (`:35-48`), which
picks the label when one is given (`{@link Foo | label}` → `label`) and falls back to the
symbol name otherwise (`{@link Foo}` → `Foo`). The fix's own doc comment (`:18-34`)
narrates the exact bug being fixed. A grep of every generated `guide/reference/events.md`
for `{@link` or a trailing `| ` found none, consistent with the fix already taking effect.
No code fix needed from this pass — recorded so it is not re-reported.

### 87. `Discount` is declared twice, and the API-reference site links the wrong one — *verified*

`src/types/api.ts:50` declares `Discount` with `offer_id: number` (required).
`src/types/global.ts:998` declares a second `Discount` with `offer_id?: number` (optional)
and is otherwise the same shape. Only the `global.ts` one is reachable from
`src/index.ts` (`export type * from './types/global'`); `api.ts`'s copy is never exported,
yet it is the one actually used on `Order.discounts` (`api.ts:205`, `Discount[]`) because
`Order` itself is imported from `api.ts`.

Confirmed in the built site (`docs/site/interfaces/index.Order.html`): the `discounts`
field renders as plain text, `<span class="tsd-signature-type">Discount</span>`, with no
`href` — while `docs/site/interfaces/index.Discount.html` exists as its own page, generated
from the *other*, differently-shaped declaration. A reader clicking `Discount` on the
`Order` page gets nothing; a reader who finds the `Discount` page separately gets a shape
that does not match what `Order.discounts` actually returns (`offer_id` looks always-present
there when the field actually seen on `Order` can omit it).

**Fix:** make `api.ts`'s `Discount` and `global.ts`'s `Discount` the same declaration (one
importing the other, or one deleted in favour of the other) — the same shape of fix as
finding 80's `Order`/`OrderData` split.

### 88. Type duplication across `api.ts` / `global.ts` / `campaign.ts` / `cart.ts` is real but uneven — *verified, correcting an overstated draft*

A draft version of this finding claimed a uniform pattern — `User`/`OrderUser` plus eight
named types each declared in two or three files. Checked field-by-field; the actual picture
splits into three different situations, only some of which are the `Discount`-shaped bug
(same name, incompatible shapes, one of them unreachable from the public API):

**Same name, live in two files, shapes diverge:**

- `Package` — `types/campaign.ts:63` vs `types/global.ts:1158`. `campaign.ts`'s version has
  two fields `global.ts`'s does not: `product?: Product` and
  `product_variant_attribute_values?: VariantAttribute[]`. Both files are actively imported
  (8+ files import `types/campaign`), so this is two live, drifting shapes for one concept,
  not a dead copy.

**Same name, live in three files, one diverges structurally and two are near-identical:**

- `Campaign` — `types/api.ts:6`, `types/campaign.ts:5`, `types/global.ts:1126`. The `api.ts`
  copy types `packages` as `PackageSerializer[]` and the payment-method fields as
  `PaymentMethodOption[]` — different named types, though `PaymentMethodOption` is
  structurally identical to the inline `Array<{ code, label }>` the other two use, which is
  why `state/campaign/api.slice.ts:143-198` can assign an `api.ts`-typed API response into a
  `global.ts`-typed store field without `tsc` complaining. `campaign.ts` and `global.ts` are
  near-identical to each other, except `global.ts` adds one field neither of the other two
  has: `id?: number`.

**Same name, live in three files, byte-identical (comments aside):**

- `ShippingOption` — `types/api.ts:317`, `types/campaign.ts:112`, `types/global.ts:1208`.
  All three are exactly `{ ref_id: number; code: string; price: string }`. This is the
  closest live analogue to finding 87's `Discount` bug — three declarations of one concept,
  two of them unreachable from `src/index.ts` — except today all three happen to agree, so
  there is no visible symptom yet. `api.ts`'s copy is not dead: it types
  `features/display/shipping-display/shipping-display.enhancer.ts`'s import directly.

**Same name, but both sides of the pair are the already-known-dead `types/cart.ts`:**

`CartItem` (`cart.ts:5` vs `global.ts:915`), `CartState` (`cart.ts:16` vs `global.ts:1042`),
`ShippingMethod` (`cart.ts:69` vs `global.ts:1569`), `Coupon` (`cart.ts:63` vs
`global.ts:1558`), and `EnrichedCartLine` (`cart.ts:41` vs `global.ts:1084`) are indeed all
duplicated by name — but `types/cart.ts` has **zero importers under `src/`** (confirmed by
grep), so all five are restating finding 21 ("`src/types/cart.ts` holds a second, dead
`CartState`… candidate for deletion"), not five new defects. Field-by-field, for the record:
`Coupon` and `EnrichedCartLine` are byte-identical to their `global.ts` counterparts;
`CartItem`, `CartState`, and `ShippingMethod` are substantially divergent (the `cart.ts`
versions are the old plain-number shape; `global.ts`'s are the current `Decimal`-based,
`vouchers`/discount-aware shape) — consistent with what finding 21 already says. **No new
fix beyond finding 21's: delete `types/cart.ts`.**

**Not a same-name duplicate at all, despite looking like one:** `User` (`api.ts:328`) and
`OrderUser` (`api.ts:345`) are two *different* exported names whose fields are byte-identical
(the `OrderUser` declaration even says so in its own comment: "Same fields as the customer on
a cart; it is a separate name because the two come from different endpoints and may
diverge."). `User` is internal (only used by `CartBase.user`, never exported from
`src/index.ts`); `OrderUser` is the public one. This is real duplication-to-watch but a
different shape of problem from the rest of this finding — one concept, two intentionally
separate names, not one name pointing at two declarations — so it does not belong in the
same fix as `Package`/`Campaign`/`ShippingOption`.

**Net correction:** the real, newly-reported duplication is `Package` (2-way, divergent),
`Campaign` (3-way, one structurally different), and `ShippingOption` (3-way, currently
identical). The `cart.ts`-side pairs are finding 21 restated, not new. `User`/`OrderUser` is
a related but distinct pattern. **Fix:** for `Package` and `Campaign`, pick one file as the
source of truth and have the others import it (or accept the divergence is intentional and
document why); for `ShippingOption`, collapse to one declaration before the three drift the
way `Package` already has.

### 89. `Order.display_taxes` and `Order.shipping_code` are read nowhere in `src/` — *verified*

Grepped both field names (`types/api.ts:192`, `:198`) across `src/` outside the type
declaration itself — no reader. `display_taxes`'s own comment already concedes this: "Tax
presentation hint the orders endpoint returns... The SDK does not read it; it is here
because the API sends it" — so its backend meaning is documented as opaque even to the
person who typed it, not just unverified by this pass. `shipping_code`'s comment claims it
"match[es] the campaign's `shipping_methods[].code`", which is a plausible enough use, but
nothing in `src/` actually performs that match today. Both are published, dead surface on a
type customers integrate against. **Fix:** either wire a consumer (matching shipping code
back to the campaign's shipping methods is the obvious one for `shipping_code`) or mark them
as present-for-completeness-only in the TSDoc so a reader does not go looking for the
behaviour.

### 90. ~~`upsell`'s object-attributes guide documents a field `OrderData` does not have~~ — **FIXED 2026-07-31, in parallel**

`src/features/order/upsell/guide/reference/object-attributes.md:31` used to list
`supports_post_purchase_upsells` under "`OrderData` (result)". `OrderData`
(`types/global.ts:1637-1670`) is a `Pick<Order, 'ref_id' | 'number' | 'currency' |
'total_incl_tax' | 'order_status_url' | 'is_test'>` plus loosely-typed `lines`/`user` — it
never picked `supports_post_purchase_upsells`, and the field does not appear anywhere else
on the interface. The field is real, but it lives on `Order` (`types/api.ts`), not on the
narrower `OrderData` this guide page was documenting.

Fixed by another job while this pass was running, confirmed against the working tree: the
section is now titled "`Order` (result)", links `{@link index.Order | Order}` instead of
`OrderData`, adds a note distinguishing the two ("Not to be confused with `OrderData`: that
type declares only the six fields the `order:completed` event guarantees, and it does not
carry `supports_post_purchase_upsells` or typed lines"), and adds a new `OrderLine` object
section for the line fields the feature reads. No further action needed.

### 91. ~~`order` state-reference example JSON is cart-shaped, not `Order`-shaped~~ — **FIXED 2026-07-31, in parallel**

`src/state/order/guide/reference/state-reference.md:81-86`'s example used to have
`"order": { "ref_id": ..., "number": ..., "total": "59.98", "lines": [{ "package_id": 2,
"quantity": 1, "price": "29.99" }] }`. Neither `"total"` nor a line's `"package_id"` /
`"price"` exist on the real shape: `Order` (`types/api.ts:158`) has `total_incl_tax` /
`total_excl_tax` / `total_tax` / `total_discounts`, none named `total`, and `OrderLine`
(`api.ts:244-269`) has `id`, `product_sku`, `product_title`, `price_incl_tax` /
`price_excl_tax` (+ `_excl_discounts` variants) and `quantity` — no `package_id`, no bare
`price`. It read as a cart line (`CartItem` uses `packageId`/`price`) pasted into an order
example.

Fixed by another job while this pass was running, confirmed against the working tree: the
example now uses `total_incl_tax`, `total_tax`, `supports_post_purchase_upsells`, `is_test`,
and two `lines` entries each shaped as a real `OrderLine` (`id`, `product_title`,
`quantity`, `price_incl_tax`, `is_upsell`). No further action needed.

### 92. `ConditionalDisplayEnhancer.detectSelectorContext`'s condition branch is unreachable — *verified*

`initialize` calls `detectSelectorContext()` **before** it parses `data-next-show` /
`data-next-hide` into `this.condition`. So that method's opening `if (this.condition)`
is always false, and the whole "read the selector id out of the condition itself" path
never runs — only the DOM-ancestor fallback does. Two consequences:

- A condition written as `selection.<selectorId>.<property>` does not use the selector id
  it names. It silently falls back to the nearest ancestor `data-next-selector-id`, which
  on a page with several selectors is a different selector.
- `conditional-display/guide/reference/logs.md` publishes `Found selector ID in property:`
  and `Found selector ID in comparison:` as debug output, generated from those two
  unreachable `logger.debug` calls. Someone debugging a mis-resolved selector will search
  for them and find nothing.

**Fix:** move the `detectSelectorContext()` call below the condition parse. That is a
behaviour change — it changes which selector wins for a `selection.<id>.<prop>` condition,
which is the point — so it needs a test for both the named-id and ancestor cases first.
Found while splitting the enhancer (2026-07-31); deliberately left alone there because that
work was a pure move.

### 93. `evaluateParamsCondition` is a second copy of `evaluateParamsConditionRecursive` — *verified*

The `property` / `comparison` / `function` arms exist twice, differing only in whether the
condition comes from the enhancer's own field or from a parameter. The other five condition
families (cart, package, order, selection, shipping) all have the top-level function
delegate to the recursive one; params is the only one that duplicates it.

The visible symptom is divergent logging: the top-level copy carries a `logger` call the
recursive copy lacks, so **the same condition logs differently depending on whether it is
nested inside an `and` / `or`**. The evaluation result agrees today, which is what makes
this a latent bug rather than a live one — the next edit to one arm silently misses the other.

**Fix:** have `evaluateParamsCondition` delegate to `evaluateParamsConditionRecursive`, as
the other five do. Now cheap: both live in `conditional-display.param-conditions.ts`.

### 94. The only `logger.info` in `conditional-display` is on a hot path — *verified*

`evaluateParamsCondition`'s comparison arm logs a nine-field object at **`info`**, on every
parameter-store update. Every other diagnostic in this feature is `debug`, i.e. gated behind
`?debug=true`. So a page using a `param.*` condition prints to the console on ordinary
navigation for every visitor, not just for a developer debugging.

**Fix:** downgrade it to `debug` to match the rest of the feature. One-line change, but it
alters what a live page prints, so it is not part of a pure move.

### 95. Four DOM-activated features are invisible to the docs-coverage feature scan — *verified*

`scanFeatures` in `scripts/docs-coverage.mjs` finds features by walking for `*.enhancer.ts`
and keeping the ones that extend a base enhancer. These four extend `BaseDisplayEnhancer`
and are registered in `attribute-scanner.ts`, but live in `.display.ts` files, so the walk
never reaches them:

| Class | File | Activated by |
|---|---|---|
| `PackageSelectorDisplayEnhancer` | `cart/package-selector/package-selector.display.ts` | `data-next-display="selector.…"` |
| `BundleDisplayEnhancer` | `cart/bundle-selector/bundle-selector.display.ts` | `data-next-display="bundle.…"` |
| `PackageToggleDisplayEnhancer` | `cart/package-toggle/package-toggle.display.ts` | `data-next-display="toggle.…"` |
| `CartDisplayEnhancer` | `cart/cart-summary/cart-summary.display.ts` | `data-next-display="cart.…"` |

They are in neither the numerator nor the denominator of "28/28 features with a
guide/overview.md", and — unlike the two files the script *does* exclude — they are not
named in the "excluded from the counts above" list either. The script's own standard is to
declare exclusions out loud; these are silent.

**It has already cost documentation.** `display-paths.md` — the page enumerating which
properties a display namespace supports — exists for `cart-summary` and for the four
`features/display/` features, but **not** for `package-selector`, `bundle-selector`, or
`package-toggle`. So `data-next-display="selector.{selectorId}.{packageId}.{property}"` is
routed correctly by the namespace table in `display-core.manifest.ts` and then lands on an
`attributes.md` that never lists the properties: `isSelected`, `isInCart`, `price`,
`compare`, `savings`, `savingsPercentage`, `hasSavings` (read off the class's own TSDoc).
No gate flagged it because no gate can see the feature.

**Fix, in order:** teach `scanFeatures` to find DOM-activated classes in any feature file,
not only `*.enhancer.ts` — then either write the three missing `display-paths.md` pages or
declare the four as covered-by-parent in the exclusion list, so the choice is recorded
rather than accidental. The deeper cleanup is that `.display.ts` means two different things
in `features/cart/` (a registered enhancer) and in `features/display/` (a state→DOM layer);
splitting these four into their own feature folders would end the collision, but that moves
published guide URLs, so it needs its own decision. Found 2026-07-31 while splitting the
cart enhancers by layer — the collision bit that work, which is how it surfaced.

### 96. A double-tap kills a tooltip permanently — *verified*

`hide()` hands the teardown to `dismissTooltip`, which schedules an **untracked** 200 ms
`setTimeout` (untracked = not in the enhancer's `timers`, so nothing cancels it). That
callback reads the *live* `tooltip` field rather than the one it was scheduled for, removes
whatever it finds from the DOM, and unconditionally nulls `tooltip` and `arrow`.
`handleTouchStart` toggles with **no delay**. So on a touch device:

1. Tap → `show()` → `isVisible = true`, tooltip mounted.
2. Tap → `hide()` → `isVisible = false`, removal scheduled for +200 ms.
3. Tap again inside that 200 ms → `show()` proceeds (`isVisible` is false) → mounts a
   **new** tooltip, `isVisible = true`.
4. The timer from step 2 fires → reads the *new* tooltip → removes it from the DOM →
   `tooltip = null`, `arrow = null`.

Final state is `isVisible === true` with `tooltip === null`, and that is unrecoverable:
`show()` early-returns on `if (this.isVisible) return`, and `hide()` early-returns on
`if (!this.isVisible || !this.tooltip) return` **without clearing `isVisible`**. Escape does
nothing for the same reason. The tooltip is dead for that element until the enhancer is
destroyed and re-created, and `aria-describedby` is left pointing at a removed node — so a
screen reader announces a description that is no longer in the document.

The hover path hides this: the show delay defaults to 500 ms (`data-next-tooltip-delay`)
and `scheduleHide` waits 150 ms, so a re-hover lands after the 200 ms removal has finished.
Only the immediate toggle in `handleTouchStart` — i.e. mobile — collides.

**Fix:** hold the dismissal timeout in `timers` alongside `showTimeout` / `hideTimeout` so
`show()` and `cleanupTimeouts` cancel it, and have the callback remove only the element it
was scheduled for (capture it, do not re-read the field). Both changes alter timing
behaviour, so they belong with a test — `src/features/ui/tooltip/` has no tests at all
today, which is why nothing caught this. Found 2026-07-31 while splitting the enhancer by
layer; the split preserved the behaviour exactly, including this.

### 97. A selector-mode upsell submits quantity 1 no matter what `data-next-quantity` says — *verified*

Ordering bug in `UpsellEnhancer.initialize`:

- `:122` calls `initializeSelectorMode`, which seeds the per-selector quantity map:
  `state.quantityBySelectorId.set(state.selectorId, state.quantity)`
  (`upsell.interaction-handlers.ts:37-38`).
- `:138-139` *then* reads the attribute: `data-next-quantity` → `state.quantity`.

So the map is seeded with the field's initial value, **1**, and the attribute lands in
`state.quantity` afterwards where the map never sees it. `addUpsellToOrder` prefers the map
over the scalar (`upsell.handlers.ts:152-153`, `if (ctx.selectorId &&
ctx.quantityBySelectorId.has(ctx.selectorId)) quantityToUse = map.get(...)`), so a
selector-mode offer marked `data-next-quantity="3"` is **submitted to the order API as
quantity 1**. The customer is charged for one unit of a three-unit offer.

Two related defects in the same map, same root cause — the map and the scalar are two
sources of truth for one number:

- The `[data-next-upsell-quantity-toggle]` handler writes `state.quantity` and emits, but
  never writes `quantityBySelectorId`. `renderQuantityDisplay` prefers the map, so the
  displayed quantity does not follow the toggle — and neither does the submitted one.
- `adjustQuantity` (the +/- buttons) *does* write the map, which is why that path works and
  hides the other two.

**Fix:** parse `data-next-quantity` before `initializeSelectorMode`, and make one of the two
the single source of truth rather than syncing them at each write site. Money path, so it
needs tests first — `src/features/order/upsell/tests/` currently covers `addUpsellToOrder`
only, which is precisely the function that reads the map and cannot see how it was seeded.

### 98. `UpsellEnhancer.destroy` clears the array `cleanupEventListeners` needs, before calling it — *verified*

```ts
public override destroy(): void {
  if (this.pageShowHandler) window.removeEventListener('pageshow', this.pageShowHandler);
  this.state.actionButtons = [];   // ← cleared here
  super.destroy();                 // ← which calls cleanupEventListeners() (base-enhancer.ts:33)
}
```

`cleanupEventListeners` removes the click handler by iterating `state.actionButtons`
(`:244-246`). By the time it runs, that array is empty, so **no click listener is ever
removed** — every accept/decline button keeps a live handler after teardown. On a page that
re-inits (or on `update()`, see below) the handlers accumulate.

This is the exact failure mode the project rule "**call `super.destroy()` first** when
overriding `destroy()`" exists to prevent (`CLAUDE.md`, and the `sdk-structure` skill's
behavior contracts). One file violates it and the rule caught nothing, because nothing
checks it.

**Fix:** move `super.destroy()` above the array clear — or drop the clear entirely, since
the instance is being discarded. Then consider a contract test asserting that every
`destroy()` override calls `super.destroy()` first; it is a mechanical check and this is the
second time the ordering has mattered.

### 99. `UpsellEnhancer.update()` double-wires every listener — *verified by report, not reproduced*

`update()` re-runs `scanUpsellElements`, which **pushes** into the existing
`state.actionButtons` rather than replacing it, and re-runs the quantity-control wiring. So
after one `update()` the same button is in the array twice and carries two click listeners:
one press steps the quantity by two, and an accept can fire twice. Reported by the agent
that split this feature; I confirmed the `push`-into-existing-array shape but did not drive
an `update()` cycle to observe the double-step.

**Fix:** have `scanUpsellElements` reset `actionButtons` and remove previously-attached
listeners before re-scanning — which requires finding 98's cleanup to work first.

### 100. Two smaller upsell defects, and one duplicated helper — *verified*

- **`currentPagePath` is never assigned.** It is declared, threaded through
  `UpsellHandlerContext`, and read by `skipUpsell` → `markUpsellSkipped(id, undefined)`. The
  skip journey therefore never records which page the shopper skipped from.
- **`collectDefaultProperties` exists twice**, byte-identical, in
  `features/order/upsell/upsell.properties.ts` and `features/cart/shared/properties.ts`.
  The copy was kept deliberately during the split: importing `cart/shared` from the
  dynamically-imported upsell chunk would pull cart code into that chunk, and
  `src/tests/contract/` gates production-bundle contents. So this is a real decision
  (share it via `core/` or `utils/`, or keep two copies knowingly) rather than an oversight
  — but it should be made rather than inherited.

---

## Fixed during the documentation work

Listed so they are not re-reported. All were one-line or docs-only.

| Finding | Where | What changed |
|---|---|---|
| `data-next-show-if-profile` activated the conditional enhancer, which then **threw** `Either data-next-show or data-next-hide is required` on every such element | `core/base/attribute-parser.ts` | removed the dead activation. ⚠️ Content those attributes used to hide is now **visible** |
| A leftover debug statement logged at **warn** level on every read of `unitSavingsPercentage`, a common display path | `features/display/product-display/product-display.enhancer.ts:385` | dropped to `debug` |
| `npm run lint` could not run at all — `"@typescript-eslint/recommended"` needs the `plugin:` prefix, twice | `.eslintrc.json` | fixed. It now reports **12,365 errors**; see the open decision below |
| The type-aware linter could not parse any test file, so all 51 colocated feature tests were silently unlinted | `tsconfig.json` excluded `**/*.test.ts` | added `tsconfig.eslint.json` |
| Dead profile system: `ProfileManager` docs, a 703-line guide, a 451-line recipe, and 4 `profile:*` events that are not in `EventMap` | across docs | removed |
| A leftover `console.log` on every modal button click, printing the action name to the visitor's console. Forbidden by CLAUDE.md (`this.logger` instead), and now inside `core/` where the log-reference gate applies | `core/ui/general-modal.ts:260` | reported |
| `TemplateRenderer` reports a failed placeholder with `console.warn` rather than a logger, so a blank field on a live page is invisible to the SDK's own log level. Documented in the core log reference as part of the `shared/` → `core/rendering/` move; the call itself still bypasses the logger | `core/rendering/template-renderer.ts:54` | reported |
| The docs tooling hardcodes `src/features/display/display-types.ts` in two places — `featureReference.test.ts:51` and `extract-display-paths.ts` (which reads `PROPERTY_MAPPINGS` out of it). Moving that file breaks doc generation with an `ENOENT`, not a readable error. Same fragility class as the line-number coupling in the open decisions below | `src/tests/docs/` | reported — blocks moving display base classes into `core/base/` |
| **Generated pages cited `file:line`**, so any reformat rewrote hundreds of doc lines describing unchanged behaviour and failed the drift tests. One blank line in `sdk-initializer.ts` was enough. This blocked `npm run format`, the lint cleanup, and task C1 | seven extractors under `src/docs/extract/` | **fixed** — anchors are now `file › EnclosingSymbol` via `source-anchor.ts`. See [documentation-plan.md §0a](./documentation-plan.md) |
| **`FieldManager` (364 lines) was dead code** — nothing imported it, nothing constructed it, no method had a caller in `src/` or `e2e/`. It was not stray scaffolding but a *fork*: an earlier extraction of the field-management cluster that was never wired in, while the enhancer kept and maintained its own copies. The two had diverged in both directions — the enhancer tracks a submit button that `FieldManager` has no concept of, and `FieldManager.getFieldNameFromElement` had grown an 83-line heuristic (inferring `country`/`province`/`postal` from substrings in `id`/`name`) that the live 13-line version does not have. Adopting it would therefore have been a **behaviour change on the money path** — field→order mapping decides what data lands on a real order. The damage while it existed was documentary: the manifest claims `managers/` via `extraSource`, so the checkout guide published **13 log messages from a class that never ran**, and anyone debugging a missing field would search `Found billing field: {fieldName}`, find nothing, and wrongly conclude the scan had failed | `features/checkout/managers/field-manager.ts` | **deleted 2026-07-31** (was at `76403a1` if the heuristic is ever wanted). The 13 phantom log entries left the guide with it. Extracting the field cluster from the *live* code is step 4 of the `checkout-form` split, which preserves behaviour by construction |
| Tolerating checkout fields that carry **no SDK attribute at all** — inferring `country`/`province`/`postal` from `id`/`name` substrings — is a plausible feature, and the deleted `FieldManager` contained a working implementation of it. Worth deciding on its own merits rather than inheriting by wiring up an old class: a wrong guess on the money path (an element named `billing_country_note` classified as `country`) is more expensive than not guessing | `features/checkout/` | open — not scheduled. Retrieve the prior art from `76403a1` if picked up |
| **"Keep a valid autofilled province" was unreachable code.** `updateStateOptions` read `provinceField.value` to decide whether to preserve a province the browser had autofilled — but by then the field had been overwritten twice, first with `<option>Loading...` near the top of the function and again by the state render. The read always saw `''`, so a shopper whose province was autofilled always had to re-pick it, and the `Kept autofilled state:` debug log could never print. **Predates the extraction** — the original had the same ordering — and the surrounding validation was already correct, so only the read position was wrong | `features/checkout/checkout-form/state-fields.ts` | **fixed** — the value is captured beside `originalHTML`, before the first overwrite. Found by the unit tests written after extraction; guarded by a test that fails if the capture moves back down |
| `loadCountryStates` evicted its cache entry with `void request.finally(…)`, which derives a **second** promise that rejects whenever the request does — a different promise from the one the caller awaits and catches, with no handler of its own. One failing states fetch therefore produced a genuine unhandled rejection, outside the function's own error handling, which is fatal in a process configured to treat those as such | `features/checkout/checkout-form/state-fields.ts` | **fixed** — `.then(cleanup, cleanup)` instead of `.finally`, so the derived promise always settles. The failure test deliberately installs no `unhandledRejection` listener, so a regression surfaces as a failing run |
| `CheckoutFormEnhancer` carried a **verbatim copy of `core/url-utils.ts › preserveQueryParams`** — 50 lines, functionally identical, differing only in two log lines. Two implementations of "carry the tracking parameters to the next page" is exactly the drift risk that matters here: a fix to one would silently not reach the other, and the parameters decide whether an order is attributed | `features/checkout/checkout-form/checkout-form.enhancer.ts` | **fixed** — the copy is deleted and the enhancer imports the core function. Its two duplicate log strings (`Preserved parameters from store:`, `Error preserving query params:`) left the checkout guide with it; core's own `[URL Utils] Error preserving query parameters:` remains documented |
| The autofill poll handle was stashed with `(this as any).autofillInterval = …` and cleared with `clearInterval((this as any).autofillInterval)` — untyped at **both** ends, so neither the set nor the clear was checked and a typo in either would have leaked a 30-second interval silently | `features/checkout/checkout-form/checkout-form.enhancer.ts` | **fixed** — `setupAutofillDetection` now returns the handle and the enhancer holds it in a typed `autofillInterval` field |
| `populateCountryDropdown` **silently drops an author's placeholder that carries a value.** It clears the `<select>` then re-appends the first option only when `!firstOption.value`, so `<option value="US">United States</option>` used as a pre-set default is destroyed with no fallback. Note the HTML-spec wrinkle that makes this easy to get wrong when testing: `HTMLOptionElement.value` falls back to `textContent` when there is no `value` attribute, so an option with only text is **not** empty-valued | `features/checkout/checkout-form/country-fields.ts` | reported — behaviour is now pinned by a test either way, so a deliberate change is safe to make; whether to preserve valued placeholders is a product call |
| `updateFormLabels` / `updateBillingFormLabels` assign `label.textContent`, which **destroys any child markup inside the label** — a styled required-marker `<abbr>`, a tooltip `<span>` — replacing it with plain text. An author who marks up their labels loses that on the first country change | `features/checkout/checkout-form/country-fields.ts` | reported — pinned by a test. Fixing means writing only the text node rather than the whole subtree, which is a small change but a visible one for pages relying on it |
| The expiry-month `change` listener **stacked one per call**. `populateExpirationFields` clears the `<select>`'s options with `innerHTML = ''`, which does not remove listeners from the element itself, then unconditionally added another — so a re-render left N live handlers, each closing over the element references captured at *its* call. Same leak as the billing animation, found the same way (writing tests for the extracted module) | `features/checkout/checkout-form/expiration-fields.ts` | **fixed** — the listener is registered with an `AbortSignal` and the previous one aborted first. Guarded by a test that asserts exactly one of three registered signals stays live |
| `populateYearOptions` matched the shopper's saved year by interpolating it into a CSS selector — `` querySelector(`option[value="${savedValue}"]`) ``. A value containing a quote builds malformed CSS, and a real browser throws `SyntaxError` from `querySelector` where **happy-dom is lenient and returns `null`** — so no unit test could ever have caught it. Not reachable today (the value only ever comes from `<select>.value`, which browsers constrain to a rendered option) but a latent crash for zero benefit | `features/checkout/checkout-form/expiration-fields.ts` | **fixed** — compares `option.value` while scanning `yearField.options` instead of building a selector |
| The billing expand/collapse animation **never removed its `transitionend` listener** except when the listener fired naturally and removed itself. Two paths left one attached: the 350 ms fallback force-completing an animation, and a shopper re-toggling before the transition finished. Stale handlers then all ran on the next real `transitionend` — each re-settling its own animation and logging a "complete" for a direction the section was no longer going — and accumulated without bound across repeated toggles | `features/checkout/checkout-form/billing-animation.ts` | **fixed** — listeners now registered with an `AbortSignal`; `cancelPending` and the fallback both abort. Found by the unit tests written for the extraction, reproduced as two failing tests first, and those tests now guard it |
| `ApiClient.request()` computes `duration`, `statusCode`, `errorType` and `retryAfter` on every call and **never reads any of them** — telemetry scaffolding that was wired up to nothing. Harmless but misleading: it reads as if API latency and error classification are being reported somewhere, and `getErrorType()` exists only to feed a dead variable | `api/client.ts` (`request`) | reported — either report them or delete them; 3 of the 4 are already `no-unused-vars` errors |
| ~154 line refs in **hand-written** prose (`core-subsystems.ts`, `storage-keys.ts`, `meta-tags.ts`, the `source:` fields in `analytics-events.ts`) are literal strings no extractor regenerates, so **no gate can catch them going stale**. A reformat makes them quietly wrong rather than loudly wrong — the opposite of the generated case, which now fails loudly or not at all | `src/docs/content/`, `src/docs/render/` | reported — not fixed; needs either symbol refs by hand or a check that each cited line still contains what the prose claims |

---

## Open decisions

1. **Lint.** 12,365 errors now that it runs — 7,391 auto-fixable (7,296 of them pure
   `prettier/prettier`), 4,974 needing a human (~3,900 `no-unsafe-*` from the
   `recommended-requiring-type-checking` tier that was configured but never enforced).
   CI runs only `type-check` and `test:coverage`, which is how it accumulated. Options:
   reformat 318 files, drop the strict tier, or ratchet it the way
   `docs-coverage.baseline.json` does.

   **The docs half of this is no longer a blocker (2026-07-31).** Reformatting used to
   drag hundreds of regenerated doc lines along with it; generated pages now cite symbols
   instead of lines, and a 233-file reformat was measured to leave every documentation
   suite green with nothing regenerated. The formatting commit is now purely a formatting
   commit. What still needs a decision is the *`git blame` cost* of touching ~72% of `src`
   at once, and the ~3,900 `no-unsafe-*` findings — neither of which the anchor change
   touches.
2. ~~**Retiring `data-attributes/`.**~~ Reviewed and applied 2026-07-31: the 42
   redirects are in both `netlify.toml` and `public/_redirects`, the inbound links and
   the nav entry are rewired, `validate-links` is at 0 errors. One step left, and it
   needs a human — `cd developer-docs && git rm -r content/docs/campaigns/data-attributes`
   (see [`redirect-map.md`](./redirect-map.md)).
