# Glossary

## bfcache

Browser back/forward cache. When a user navigates away from a page and then presses the browser back button, the browser may restore the page from memory rather than reloading it. The `pageshow` event fires with `event.persisted === true` in this case. The enhancer listens for this to clear any loading overlay left from the previous click.

---

## canAddUpsells

A computed flag on `orderStore` that returns `true` only when: an order is loaded, the order has `supports_post_purchase_upsells: true`, and no upsell submission is currently in progress. The accept button is enabled only when this is `true`.

---

## completedUpsells

An array of package ID strings stored in `orderStore`. It records every package that was successfully submitted as an upsell in the current session. Used to detect duplicate submissions before showing the confirmation dialog.

---

## duplicate upsell

A submission attempt for a package that is already in `completedUpsells` or has an `'accepted'` entry in `upsellJourney`. The enhancer shows a confirmation dialog and lets the user decide whether to add it again or navigate forward without re-submitting.

---

## post-purchase upsell

A product offer presented to a customer after their initial order has been placed and payment has been taken. The offer is added to the existing order using the stored payment method — no new payment details are required. This is distinct from an add-to-cart action, which modifies the pre-checkout cart.

---

## upsell context

A mode flag (`data-next-upsell-context`) on a `PackageSelectorEnhancer` container that disables all cart writes and forces select mode. Used on upsell pages where the selector's only job is to track the user's choice, not update the cart.

---

## upsellJourney

An ordered log of actions (`viewed`, `accepted`, `skipped`) stored in `orderStore`, keyed by package ID and page path. The enhancer checks this log alongside `completedUpsells` to detect whether a package was already accepted in this session.
