---
title: "Features/Order/Upsell/Use Cases"
group: "Features"
category: "Upsell"
---

# Use Cases

## Single post-purchase add-on

> Effort: lightweight

**When:** After checkout you want to offer one clear add-on — a warranty, an extra unit, expedited shipping — with a yes/no choice.

**Why this enhancer:** Direct mode (`data-next-upsell` + `data-next-package-id`) is exactly this: one package, an add button, a skip button, and an automatic redirect to the next page.

**Watch out for:** The order must have `supports_post_purchase_upsells` set, or the offer hides itself and the add renders "Unable to add upsell at this time".

---

## Tiered choice (pick one of several)

> Effort: moderate

**When:** You want the customer to choose among options — 1 year vs 2 years of protection, or a small/medium/large add-on.

**Why this enhancer:** Selector mode (`data-next-upsell-selector` + `data-next-upsell-option` cards, or a `data-next-upsell-select` dropdown) tracks the selection and only adds the chosen package. The selected card carries `next-selected` so you can style it.

**Watch out for:** An add with nothing selected renders "Please select an option first" — pre-select a card with `data-next-selected="true"` if you want a default.

---

## Chained upsells (accept one, see the next)

> Effort: moderate

**When:** You run a sequence of upsell pages — accept or skip page 1, then land on page 2, and so on.

**Why this enhancer:** Point each button's next URL (or the `next-upsell-accept-url` / `next-upsell-decline-url` meta tags) at the following page. The order `ref_id` is appended automatically so the next page loads the same order.

**Watch out for:** The order store expires 15 minutes after completion — a long chain can outlive it, after which later pages have no order and hide their offers.

---

## Upsell tied to a package or bundle selector

> Effort: complex setup

**When:** The upsell reuses a `PackageSelectorEnhancer` or `BundleSelectorEnhancer` already on the page (for variants or multi-item bundles) rather than plain option cards.

**Why this enhancer:** With a child `data-next-package-selector`/`data-next-bundle-selector` (or explicit `data-next-package-selector-id` / `data-next-bundle-selector-id`), the enhancer reads the current selection from that selector at click time and adds it — including bundle line items and their vouchers.

**Watch out for:** The linked selector must expose its selection (`_getSelectedPackageId` / `_getSelectedBundleItems`); if it is missing or unresolved, the add falls back to no selection.

---

## When NOT to use this

### Adding a package before payment (on the checkout page)

**Why not:** This enhancer only appends to an already-completed order; it does not touch payment.

**Use instead:** `AddToCartEnhancer` / the checkout flow — build the cart before the order is placed.

### A pre-purchase "accept offer" button that isn't post-purchase

**Why not:** `UpsellEnhancer` depends on a completed order in `useOrderStore`.

**Use instead:** `AcceptUpsellEnhancer` (`data-next-action="accept-upsell"`) for the cart-stage accept pattern.
