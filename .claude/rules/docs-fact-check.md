# Docs Fact-Check Rules

Born from the PR #82 review (2026-08-12): a full docs rewrite shipped with ~20 factual errors that read plausibly and passed every automated gate. Every class of error below actually happened. Re-check all of them before calling any docs change done — a behavior claim with no source citation read in the same session does not ship.

## 1. Public docs use the public template only

- The public example baseline is the `apollo` starter template. `olympus` and every other internal template is IP — its name, file paths, and `content="Olympus"` never appear in `docs/guides/**`, `docs/site-home.md`, or `src/index.ts`.
- Sweep before shipping: `grep -ri olympus docs/guides docs/site-home.md src/index.ts` must return zero hits.
- Copy template examples from the templates repo's **origin/main**, not a local checkout. The local clone was months stale and predated apollo entirely.

## 2. `data-next-*` only — never `os-*`

- Never document `os-*` / `data-os-*` attributes, even though the SDK still reads a few as compatibility fallbacks (`checkout-form/field-scanning.ts`, `upsell/upsell.handlers.ts`). Fallback reads are tech debt, not API.
- The Data Attributes caution stays firm: copy `data-next-*`, never `os-*`.

## 3. Behavior claims: SDK source or it doesn't ship

Every "the SDK does X when Y" needs the deciding `file:line` in the SDK source, read in the same session. Template markup and template comments are **not** evidence — apollo's own `shipping-address-form.html` comment says the location fields gate on country selection; the SDK actually reveals them when `address1` gets a value ([location-field-visibility.ts](../../src/features/checkout/checkout-form/location-field-visibility.ts)).

- An attribute row must name the feature's real activating/config attribute, confirmed in its `*.manifest.ts` and enhancer. `data-next-toggle` is a DOM-observer watch entry, not a control ([sdk-attributes.ts](../../src/docs/content/sdk-attributes.ts)) — PR #82 documented it as one because it appears in template markup.
- Enumerate the full value set from the manifest. `data-next-selection-mode` is `swap | select`; documenting only `swap` shipped.
- Say what an attribute value *is*, not a paraphrase. `data-next-package-sync` takes package id(s) and syncs quantity to the sum of those lines — "in step with the main package" shipped instead.
- Split SDK work from template work explicitly. `data-next-await` hiding is template CSS (`next-core.css` keyed on `next-display-ready`); the SDK only adds the class. Attributing template behavior to the SDK shipped twice.

## 4. JS examples: trace every property chain to the real return value

- Walk each chain in an example through the actual return statement in the facade source. `getCartData().totals.total.value` shipped — the key is `cartTotals`, `total` is a `Decimal`, and Decimal converts with `.toNumber()`, never `.value` ([next-commerce.cart.ts](../../src/core/next-commerce/next-commerce.cart.ts)).
- Money values in stores are `Decimal`s (`cart.state.ts`), not numbers. Say so wherever an example reads one.

## 5. Success/failure semantics: read the operation, don't assume

- Every claimed failure path must name its return branch in the operation source. `applyCoupon` was documented as failing on invalid codes; the only `success: false` branch is "already applied" — unknown codes succeed and discount nothing ([apply-coupon.ts](../../src/state/cart/operations/apply-coupon.ts)).

## 6. Check open bugs before teaching a pattern

- Before documenting a getter or field, check open GitHub issues and the state manifests' cautions. `getCartData().cartLines` is always `[]` (issue #36, [cart.state-manifest.ts](../../src/state/cart/cart.state-manifest.ts)) — the doc must name the bug and the working alternative, never teach gating on the broken field.

## 7. Analytics: "auto" means a traced caller, nothing less

- An event is "auto" only if you can cite the tracker that fires it during auto-mode init. A builder, a schema, a validator entry, or a provider mapping is **not** evidence it fires — `dl_select_item`, `dl_view_search_results`, and `dl_subscribe` all have builders and never fire; `dl_sign_up` / `dl_login` fire only from `next.trackSignUp` / `next.trackLogin`.
- "Manual mode" claims trace to the init branch: manual only skips the auto-trackers ([core/analytics/index.ts](../../src/core/analytics/index.ts)); every `next.track*` method still works.
- Provider coverage claims trace to the adapter's event map. Facebook has no `dl_upsell_purchase` mapping — unmapped events are dropped, so upsell revenue never reaches Meta from the browser.
- Reliability claims trace to working code, not config keys. The custom adapter's retry queue keys on `event.id`, which the event builder never sets (`event_id` only) — the retry never engages, so "batched with retries" was false.

## 8. Docs describe the published site, not the repo

- Never reference sidebar sections or pages the current `typedoc.json` does not publish. PR #82 unpublished the Features/State trees while how-it-works still said "listed under **Features** in the sidebar".
- After changing `entryPoints` or `projectDocuments`, re-read every guide for navigation references, and update the sdk-docs skill's entry-point description in the same change.

## 9. Recount every inline count

- Any prose count ("four things", "seven names never fire") is re-counted against the list it describes every time either side changes. Both shipped wrong in PR #82.

## 10. Deprecated surfaces: demote, never teach

- Published guides (`docs/guides/**`) never document a deprecated surface — no syntax, no examples, no table rows. The only allowed mention is a caution telling the reader not to copy it, placed where they will meet it in template markup.
- Contributor inventories stay truthful while the code ships the surface (the coverage gates require the entry), but the entry must carry machine-readable status: `status: 'legacy'` + `supersededBy` in [meta-tags.ts](../../src/docs/content/meta-tags.ts), `@deprecated` on TSDoc symbols, `status: 'deprecated'` on feature manifests. Prose like "legacy spelling" with no flag is not enough.
- A new fallback read shipped without its deprecation marker in the same change is a review blocker.
- Docs stop naming a deprecated surface the day its code is deleted — deletion is the only way the entries disappear, and the gates then enforce removal instead of presence.

## Checklist (before calling a docs change done)

- [ ] `grep -ri olympus` over the published docs surface → zero hits; no `os-*` documented.
- [ ] Every behavior claim carries a same-session SDK source citation; none rest on template markup or comments.
- [ ] Every example property chain traced through the real return value; Decimals converted with `.toNumber()`.
- [ ] Every failure-path claim matched to a return branch in the operation source.
- [ ] Open GitHub issues checked for every API the doc teaches.
- [ ] Every "auto" event has a named tracker; provider and reliability claims traced to adapter code.
- [ ] No references to unpublished pages or sidebar sections.
- [ ] All inline counts re-counted.
