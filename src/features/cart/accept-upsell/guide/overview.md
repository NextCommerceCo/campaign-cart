---
title: "Features/Cart/Accept Upsell/Overview"
group: "Features"
category: "Accept Upsell"
---

# AcceptUpsellEnhancer

> Category: `cart`
> Last reviewed: 2026-03-27
> Owner: campaign-cart

A button enhancer that submits a post-purchase upsell offer to an existing order. It activates only when the order supports upsells, delegates the API write to `orderStore`, and navigates the user forward when the submission succeeds.

## Concept

`AcceptUpsellEnhancer` is an action-only enhancer. It does not render anything — it drives a button's enabled/disabled state and fires a single API call when the user clicks. The button is enabled only when `orderStore.canAddUpsells()` returns true and a package is resolved (from a direct attribute or a linked selector).

There are two ways to resolve which package to submit:

- **Direct package**: `data-next-package-id` is set on the button. The package is fixed.
- **Selector-driven**: `data-next-selector-id` links the button to a `PackageSelectorEnhancer` running in upsell context. In practice the button learns the selection from the `selector:item-selected` event, so **treat a visitor click as what makes it live**. It is meant to also read `_getSelectedPackageId()` off the selector element 100 ms after boot, which would catch the selector's own start-up pre-selection — that read never matches the recommended markup, so whether the button starts enabled is a race. See Limitations.

After a successful API call the enhancer emits `upsell:accepted` and redirects. The redirect URL is resolved in priority order: `data-next-url` attribute → `<meta name="next-upsell-accept-url">` content. If neither is present, the loading overlay is dismissed and the page stays put.

```
User clicks button
      │
      ▼
executeAction() — prevents concurrent clicks
      │
      ▼
acceptUpsell()
 ├── resolvePackageId() — direct or selector-driven
 ├── isAlreadyAccepted()? → show duplicate dialog
 │     ├── declined → resolveRedirectUrl(decline) → navigate
 │     └── confirmed → continue
 ├── loadingOverlay.show()
 ├── orderStore.addUpsell() — POST to API
 ├── emit upsell:accepted
 └── resolveRedirectUrl(accept) → navigate | hide overlay
```

## Business logic

- The button is disabled (`disabled` attribute + `next-disabled` class) whenever `canAddUpsells()` is false. This covers: no order loaded, order does not support post-purchase upsells, or an upsell is already in flight.
- If the same package has already been accepted in this session (`completedUpsells` or `upsellJourney` with action `'accepted'`), a confirmation dialog is shown before re-submitting. The user can cancel, which triggers the decline-URL redirect without submitting.
- Currency is resolved from `campaignStore.data.currency`, falling back to `configStore.selectedCurrency`, then `configStore.detectedCurrency`, then `'USD'`.
- If the page is restored from the browser's bfcache (back/forward navigation), the loading overlay is dismissed and the button is re-enabled so the user is not stuck.
- The `triggerAcceptUpsell()` public method allows programmatic submission — identical to a click, including duplicate detection and navigation.

## Decisions

- We chose `BaseActionEnhancer` over `BaseCartEnhancer` because this enhancer writes to the order, not the cart. Using `BaseCartEnhancer` would subscribe to cart state that is irrelevant here.
- We chose to put all async logic in `AcceptUpsellEnhancer.handlers.ts` and pass a context object rather than keeping it in the class, so the handler can be unit-tested without instantiating the enhancer.
- We chose `completedUpsells` + `upsellJourney` for duplicate detection (not cart state) because this is a post-purchase flow — the cart is settled and not authoritative for what has been accepted.
- We chose stable bound references (`boundHandleClick`, `boundHandleSelectorChange`, etc.) over ad-hoc `.bind()` calls to ensure `removeEventListener` and `eventBus.off` remove the exact same function reference.
- We chose the meta-tag fallback (`<meta name="next-upsell-accept-url">`) as a secondary redirect source to keep the HTML clean when a URL is shared across many buttons on the same page.

## Limitations

- Does not manage the upsell offer display (the offer card, pricing, countdown). That is `UpsellEnhancer`'s responsibility.
- Does not support adding multiple packages in a single click. Each button targets one package.
- Does not validate that the package exists in the campaign. If the package ID is wrong, the API call will fail.
- Does not handle payment re-collection for upsells. Upsell payment is handled server-side on the existing order's stored payment method.
- The 100 ms delay in `setupSelectorListener` is a heuristic. It now finds every supported
  selector container, including `[data-next-package-selector]`, so a selection made while the
  page booted is picked up — but a container that only reaches the DOM *later* than 100 ms
  (rendered into a tab, a modal, or behind a deferred script) still misses that read. When it
  does, `Selector "<id>" not found` is logged and the button falls back to arming on the
  visitor's first click on a card. **What to do as an author:** if your selector renders late,
  expect the button to start disabled and to enable on the first card click.
