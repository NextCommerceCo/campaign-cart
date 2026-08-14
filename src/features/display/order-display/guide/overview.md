---
title: "Features/Display/Order Display/Overview"
group: "Features"
category: "Order Display"
---

# Order Display

> Category: `display`
> Last reviewed: 2026-07-30
> Owner: Campaigns

Shows values from an order that has already been paid for — its number, totals,
customer, and shipping — on receipt pages and post-purchase upsell pages.

## Concept

Everywhere else in the SDK, display bindings read from state the visitor is
building. Here they read from something finished: an order that exists on the
server.

That changes two things. First, the order has to be **fetched**, so there is a
moment on every post-purchase page where the values are not there yet — which is
why this namespace exposes its own `isLoading`, `hasError`, and `errorMessage`
paths. Anything that assumes the values are present on first paint will render
blank.

Second, the order is **found for you**. The page URL carries the order reference, so
a receipt page needs no configuration beyond the bindings themselves.

## Business logic

- The order is loaded from the reference in the page URL.
- The completed order is kept for **15 minutes**. After that a revisited receipt
  page has nothing to render — expected behaviour on an old tab, not a bug.
- `isLoading`, `hasError`, and `errorMessage` describe the fetch, not the order.
  Use them to render a waiting state and a failure state.
- API-shaped fields keep their original names (`total_incl_tax`, `created_at`,
  `ref_id`), so what you see in the docs matches what the API returns.
- **`order.paymentMethod` is the one value that is relabelled, not passed
  through.** The API's code becomes the platform's own name for the method, so a
  receipt reads `iDEAL`, `SEPA Direct Debit` or `Credit Card` rather than `ideal`,
  `sepa_debit` or `card_token` — see `paymentMethodLabel` in
  `utils/payment-method.ts`, the one table the receipt, the
  `add_payment_info` event and the express error message all read. A method with no label yet is shown
  as the API spelled it, on purpose: a raw code on a receipt gets reported, an
  invented label does not.
- For a per-line breakdown of what was bought, this feature is the wrong tool —
  those are rows, not single values.

## Decisions

- We load from the URL reference rather than asking the page to pass an order id,
  because a receipt page is generic and the reference is already there.
- We expose loading and error as paths rather than handling them internally,
  because what to show while waiting is a design decision, not an SDK one.
- We kept the API's snake_case field names rather than renaming them, so a value in
  the docs can be matched against an API response without a translation table.
- We relabel the payment method from a table rather than title-casing its code,
  because the right answers are not derivable: `iDEAL`, `PayPal` and `SEPA Direct
  Debit` are all house capitalisation, and `card_token` reads as plumbing rather
  than as how somebody paid.
- We expire the stored order after 15 minutes so a shared or bookmarked receipt
  link does not display someone's purchase indefinitely.

## Limitations

- Does not render line items. Use
  [order-item-list](../../../order/order-item-list/guide/overview.md).
- Does not work outside a post-purchase page — there is no order reference in the
  URL elsewhere.
- Does not survive past the 15-minute window.
- Does not refetch. If the load fails, the error state is final for that page view.

## Reference

- [Attributes](./reference/attributes.md) — loading and error states
- [Display Paths](./reference/display-paths.md) — every `order.*` value
- Shared modifiers:
  [display-core](../../display-core/guide/reference/attributes.md)
