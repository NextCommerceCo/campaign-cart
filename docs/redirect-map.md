# Redirect map — retiring `data-attributes/`

> **Historical, as of 2026-07-31.** This mapped URLs on the external Fumadocs
> `developer-docs` site. That site is **no longer a docs target** — the
> published artifact is now a versioned TypeDoc HTML site built and served from
> this repo (see [`documentation-plan.md` §8](./documentation-plan.md)). None of
> the redirect work below applies to the new site. The 62 stale
> `data-attributes/` pages this map references still sit in the `developer-docs`
> repo, out of scope here — this file is kept as a record, not a live task.

Status (2026-07-31): **redirects applied, inbound links rewired, the 62 files are
still on disk.** Deleting them is the one step left, and it is the only
hard-to-reverse one — see [What is left](#what-is-left).

Mechanism: **two files, not one.** The site deploys to Netlify *and* to Cloudflare
Workers static assets, and each reads its own redirect list:

| File | Format | Used by |
|---|---|---|
| `developer-docs/netlify.toml` | `[[redirects]]` blocks, `status = 301` | Netlify |
| `developer-docs/public/_redirects` | `<from> <to> 301` per line | Cloudflare Workers (`wrangler.jsonc` serves `./out`) |

Both now carry all 42 rules and are byte-for-byte equivalent in content (69 rules
each, verified by comparing the parsed `from → to → status` sets). `next.config.mjs`
uses `output: 'export'`, so a Next.js `redirects()` is not an option — this list is
the whole mechanism.

**Do not collapse these into a wildcard.** The existing `:path` placeholder matches a
single segment, so `…/data-attributes/:path` would miss every two- and three-segment
URL such as `…/actions/reference/attributes`. All 40 are enumerated for that reason.

`FG` below is shorthand for `/docs/campaigns/feature-guides`.

## Where the content went

| Retired URL | Redirect to | Why |
|---|---|---|
| `/docs/campaigns/data-attributes` | `FG/all-attributes` | The index's job — one door to every attribute — is now generated |
| `…/actions` | `FG/cart/add-to-cart/overview` | "Actions" was add-to-cart plus quantity and remove |
| `…/actions/get-started` | `FG/cart/add-to-cart/overview` | |
| `…/actions/cart-actions` | `FG/cart/add-to-cart/overview` | |
| `…/actions/quantity-actions` | `FG/cart/quantity-control/overview` | |
| `…/actions/reference/attributes` | `FG/cart/add-to-cart/reference/attributes` | |
| `…/campaign` | `FG/display/product-display/overview` | The `campaign.` namespace is an alias of `package.` |
| `…/campaign/reference/attributes` | `FG/display/product-display/reference/display-paths` | Its content was the path list, now generated |
| `…/checkout-review` | `FG/checkout/checkout-review/overview` | |
| `…/checkout-review/get-started` | `FG/checkout/checkout-review/overview` | get-started is merged into overview |
| `…/checkout-review/reference/attributes` | `FG/checkout/checkout-review/reference/attributes` | |
| `…/configuration` | `FG/display/display-core/reference/attributes` | "Configuration" was the display modifiers |
| `…/configuration/formatting` | `FG/display/display-core/reference/attributes` | `data-next-format`, `data-hide-*` |
| `…/configuration/math` | `FG/display/display-core/reference/attributes` | `data-multiply-by`, `data-divide-by` |
| `…/configuration/reference/attributes` | `FG/display/display-core/reference/attributes` | |
| `…/css-classes` | `FG/all-attributes#css-classes` | Now generated from the manifests — 41 classes, up from 20 |
| `…/css-classes/reference/css` | `FG/all-attributes#css-classes` | |
| `…/display` | `FG/display/display-core/overview` | |
| `…/display/get-started` | `FG/display/display-core/overview` | |
| `…/display/paths` | `FG/display/display-core/reference/attributes#namespaces` | The namespace routing table |
| `…/display/package-display` | `FG/display/product-display/overview` | |
| `…/display/cart-items-template` | `FG/cart/cart-item-list/overview` | |
| `…/display/reference/attributes` | `FG/display/display-core/reference/attributes` | |
| `…/order-data` | `FG/display/order-display/overview` | |
| `…/order-data/get-started` | `FG/display/order-display/overview` | |
| `…/order-data/properties` | `FG/display/order-display/reference/display-paths` | Now generated from the routing table |
| `…/order-data/reference/attributes` | `FG/display/order-display/reference/display-paths` | |
| `…/order-data/order-items-template` | `FG/order/order-item-list/overview` | |
| `…/prospect-cart` | `FG/checkout/prospect-cart/overview` | |
| `…/selection` | `FG/display/selection-display/overview` | |
| `…/selection/reference/attributes` | `FG/display/selection-display/reference/display-paths` | |
| `…/state` | `FG/display/conditional-display/overview` | "State" was the conditional system |
| `…/state/get-started` | `FG/display/conditional-display/overview` | |
| `…/state/operators` | `FG/display/conditional-display/reference/attributes#conditions` | |
| `…/state/properties` | `FG/display/display-core/reference/attributes#namespaces` | The testable paths are the display paths |
| `…/state/reference/attributes` | `FG/display/conditional-display/reference/attributes` | |
| `…/url-parameters` | `FG/display/conditional-display/reference/attributes#url-parameter-conditions` | `param.*` is a condition namespace |
| `…/url-parameters/get-started` | `FG/display/conditional-display/reference/attributes#url-parameter-conditions` | |
| `…/url-parameters/reference/attributes` | `FG/display/conditional-display/reference/attributes#url-parameter-conditions` | |
| `…/url-parameters/javascript-api` | `/docs/campaigns/javascript-api/methods` | The `next.getParam` family — that door stays |

## The profiles pages (deleted 2026-07-30, redirects live 2026-07-31)

These two are **already deleted from the working tree** — they documented a feature
that no longer exists in `src` (see the profile-system entry in
[CHANGELOG.md](../CHANGELOG.md)). They were unlisted in `guides/meta.json`, so they
were reachable only by direct URL, but that includes bookmarks and old support
replies. They need redirects for the same reason the rest of this map does.

| Retired URL | Redirect to | Why |
|---|---|---|
| `/docs/campaigns/guides/profiles` | `FG/cart/package-selector/overview` | 703 lines on `ProfileManager` / `next.registerProfile` / `data-next-profile`. Switching the customer between price tiers is now a package selector's job |
| `/docs/campaigns/guides/tier-selector-implementation` | `/docs/campaigns/guides/package-selector-with-button` | The Buy 1 / Buy 2 / Buy 3 recipe is still a real requirement — it was built on `window.nextConfig.profiles`, and the current way to build it is a package selector plus an add-to-cart button |

The tier-selector redirect is the one worth a second look: the *use case* survives
even though the mechanism does not, so it should land on a recipe that still works
rather than on a feature reference.

## What building this map found

Mapping the URLs is what surfaced the last two content gaps, both now closed:

- **URL parameters had no home.** `param.<name>` is a **conditional-display
  namespace** — `data-next-show="param.mode == 'advanced'"` — and that was documented
  nowhere in the new structure. It is the mechanism for driving page content from a
  link, so losing it would have been a real regression. Now documented on
  conditional-display, including that parameters are only readable after
  `sdk:url-parameters-processed`.
- **CSS classes had no home.** The manifests carried the data; the index was not
  rendering it. Now generated — **41 classes against the old door's 20** — plus three
  that belonged to no feature: `next-display-ready` (SDK boot, on `<html>`),
  `next-loaded` (order-display), and `next-error` / `next-error-field`
  (checkout-form).

## Verified before applying (all 2026-07-31)

- [x] **Every retiring URL backs a real file, and every file is mapped.** The 62 files
      are 40 `.mdx` + 22 `meta.json`; the `meta.json`s serve no URL, and the 40 pages
      map 1:1 onto the 40 rows. **No live URL will 404** — checked by set comparison,
      not by eye.
- [x] **All 26 destinations resolve**, and all four anchors exist: `#css-classes`
      (`all-attributes.md` → `## CSS classes`), `#namespaces` and `#conditions` and
      `#url-parameter-conditions` (display-core / conditional-display
      `reference/attributes.md`). No slug collisions, so no `-1` suffix hazard.
- [x] **`npm run validate-links`: 0 errors** after rewiring, with the guides and the
      SDK reference regenerated first.
- [x] **The profiles question is answered: the feature is gone for good.** Removed in
      **v0.4.6 (2026-04-01)**, commit `f77c78e` — `CHANGELOG.md` lists `ProfileManager`,
      `ProfileSwitcherEnhancer`, `ProfileMapper`, and `profileStore` under *Removed*.
      `src/` has zero references to `data-next-profile`, `ProfileManager`,
      `registerProfile`, `profileStore`, or any `profile:*` event, and the scanner
      never queries a profile attribute.
- [ ] The anchors are generated heading slugs and will move if those headings are
      reworded — re-run `validate-links` after any change to those pages.

## What was rewired (2026-07-31)

Deleting the section would have broken the build, not just some links:
`npm run build` runs `validate-links` **before** `next build`, and it fails on broken
markdown links *and* broken JSX `href=` props.

**7 hand-written pages linked into the section** and now point at the generated home
of that content:

| Page | Was | Now |
|---|---|---|
| `campaigns/configuration.mdx` | `…/url-parameters/reference/attributes` | conditional-display `reference/attributes#url-parameter-conditions` |
| `campaigns/guides/checkout-multi-step.md` | `…/checkout-review` | `checkout/checkout-review/overview` |
| `campaigns/javascript-api/attribution.md` | `…/url-parameters` | conditional-display `#url-parameter-conditions` |
| `campaigns/javascript-api/methods.md` | `…/data-attributes` | `feature-guides/all-attributes` |
| `campaigns/javascript-api/url-parameters.md` | `…/url-parameters`, `…/state` | conditional-display `#url-parameter-conditions`, conditional-display `overview` |
| `campaigns/utilities/exit-intent/reference/attributes.mdx` | `…/display` | `display/display-core/overview` |

**3 links lived in generator sources in this repo**, so fixing the published copy
would have been overwritten on the next build. Fixed at the source, and now relative
so they read correctly in the editor too:

- `src/features/display/product-display/guide/get-started.md` and `guide/overview.md`
  → `./reference/display-paths.md` (the same path list, generated from the SDK's own
  routing table)
- `src/index.ts` TSDoc → `feature-guides/all-attributes`, which flows into the SDK
  reference landing page

**1 nav entry:** `content/docs/campaigns/meta.json` listed `data-attributes` in the
Cart SDK group; removed, so the sidebar no longer offers it.

Nothing in the site tooling reads the folder — the generators, `validate-links`,
`lib/source.ts`, the sitemap, and `llms.txt` all derive from the filesystem or from
`source`, so none of them needs a change.

## Two more pages retiring (2026-07-31) — the nav gap that hid them

`advanced-customization.md` and `quantity-package-swapper.md` under
`campaigns/guides/` were missing from `guides/meta.json`, so they rendered at their URL
but were unreachable from the sidebar — **the same invisibility that let the profiles
page rot.** Both were checked attribute-by-attribute against the source, and both fail:

| Retired URL | Redirect to | Why |
|---|---|---|
| `/docs/campaigns/guides/advanced-customization` | `/docs/campaigns/guides` | Its examples do not run |
| `/docs/campaigns/guides/quantity-package-swapper` | `FG/cart/package-selector/overview` | Documents a script this repo does not ship |

**`advanced-customization` (626 lines) is broken at the activation level.** Its three
package selectors use `data-next-cart-selector`, which the scanner does not activate —
the real attribute is `data-next-package-selector`, and `data-next-cart-selector` survives
only as an ancestor marker display features read. So the selectors never instantiate and
everything downstream (`data-next-selected`, `.next-selected`, the `selection.*` bindings)
is dead. Its four add-on checkboxes use bare `data-next-toggle`, which belongs to the DOM
observer, not `data-next-package-toggle`. `cart.hasSavings`,
`cart.totalSavingsAmount`, and `cart.totalSavingsPercentage` are not cart properties (they
exist on `package.*`), so the savings banner never shows. Three handlers subscribe to
`selection:changed`, which is not in `EventMap` (`selector:selection-changed` is). The
A/B tracker reads `data.item.price` off a `cart:item-added` payload that has no `item`.
`validateCart()` reads `cartData.total` / `.items` where the API returns `cartTotals` /
`cartLines`. And the flagship bundle-builder button contains
`// This would normally use SDK methods` and only `console.log`s — it never adds anything
to a cart. A reader following it gets a page where nothing happens and no error appears.

Redirecting to the section index rather than one page, because its six sections have four
different owners: bundle building is covered better by
`guides/bundle-set-sale.md` and the generated bundle-selector guide,
multi-currency by `campaigns/configuration.mdx`, coupons by their feature guides.
What is left after removing the wrong and the duplicated is generic JavaScript with no SDK
content — which is why this is a retire, not a rewrite.

**`quantity-package-swapper` (350 lines) documents an artifact that does not exist here.**
It loads `quantity-package-swapper.js`, which is not in this repo (only in the old
`cart-sdk-docs`), and it describes that script's API wrongly even there: it documents
`CONFIG.syncOnLoad` (real: `clearCartOnLoad`, `resetToQuantityOne`, `addInitialPackage`)
and four global methods (`syncSelectorFromCart`, `syncAllSelectorsFromCart`,
`swapToPackage`, `getCartState`) of which **none** exist — the real global exposes
`initialize`, `swapToPackages`, `clearCart`, `config`, `maps`. The page says it syncs from
the cart on load; the script clears the cart on load. It also contradicts itself on that
point between line 96 and line 349, and its snippet ends in a `// ... rest of script ...`
placeholder, which is what the guide rules forbid and is presumably why the `.js` never
got ported.

Its premise is also obsolete: the reason it gave for existing — "no SDK selector enhancer
needed" — was solved natively. `package-selector` ships inline quantity controls
(`data-next-quantity`, `data-next-min-quantity`, `data-next-max-quantity`,
`data-next-quantity-increase` / `-decrease` / `-display`), and its first documented use
case is a quantity-tiered 1/3/6-pack offer. The modern answer is ~15 lines of markup in a
drift-checked generated page, not a 350-line standalone script.

Neither page has a single inbound link in either repo.

**Related nav gap, not fixed:** the guides landing grid is a hard-coded list of five in
`components/guide-cards/index.tsx`, and `checkout-multi-step` is missing from it even
though `meta.json` lists it. Two nav sources that can disagree is the same class of
problem as the unlisted pages.

## What is left

**Deleting the retired files.** Not done here: the delete was refused by the permission
layer, so it needs to be run by a human. One command covers all of it:

```bash
cd developer-docs && git rm -r content/docs/campaigns/data-attributes \
  content/docs/campaigns/guides/advanced-customization.md \
  content/docs/campaigns/guides/quantity-package-swapper.md
```

Everything listed is tracked in git, so the deletion is recoverable. The redirects are
already in place and do nothing until then: a real file at the path wins over a redirect
rule, so applying them early is safe and the deletion is what switches them on.

Until it happens the section is still served, and that matters for one reason beyond
tidiness: **its pages are the last place that still documents the removed profile
system as working.** `state/properties.mdx`, `state/reference/attributes.mdx`,
`display/paths.mdx`, `state/operators.mdx`, and two index pages advertise
`profile.active`, `profile.is('vip')`, `data-next-show-if-profile`, and the deleted
`profileStore` with runnable examples. Those attributes are inert since v0.4.6 — a
reader following them today gets content that never hides. They are unreachable from
the sidebar now, but still live by direct URL.
